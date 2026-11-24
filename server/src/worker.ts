// 计算节点（bun server.js worker）：放在学校的机器上，主动连服务器的 /worker，替服务器编译运行学生程序、评分、
// 提供语言服务。不对外开端口、不存数据：学生的数据库文件跟着每次运行发过来，程序结束后把改动发回去。
// 连不上或断了就每隔几秒重连；断开时结束手上所有学生程序（服务器那边已经当它们结束了）。
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { compileService } from './compile-service'
import { config } from './config'
import { gradeLocally } from './dispatch'
import type { ProgramHandle } from './executor'
import { runLocally } from './executor'
import { languageService } from './language-service'
import { cleanupStaleRuns } from './run-session'
import { checkSandbox, sandboxError } from './sandbox'
import { sqlService } from './sql-service'
import { decodeChecks, diffDbFiles, type HubMessage, readDbDir, VERSION_HEADER, type WorkerMessage, writeDbFiles } from './worker-protocol'

/** 多久发一次心跳；多久没收到服务器的任何消息就当连接已经断了 */
const PING_MS = 15_000
const DEAD_MS = 45_000
/** 重连间隔：从 2 秒开始，每次翻倍，最多 30 秒 */
const RETRY_MIN_MS = 2000
const RETRY_MAX_MS = 30_000

export interface WorkerOptions {
  url: string
  token: string
  version: string
}

export interface Worker {
  /** 连上了没有 */
  readonly connected: boolean
  /** 等到连上 */
  ready(): Promise<void>
  /** 断开、不再重连，结束手上的学生程序 */
  stop(): Promise<void>
}

export function startWorker(options: WorkerOptions): Worker {
  let socket: WebSocket | undefined
  let connected = false
  let stopped = false
  let retryMs = RETRY_MIN_MS
  let retryTimer: Timer | undefined
  let pingTimer: Timer | undefined
  let lastHeard = Date.now()
  let readyWaiters: (() => void)[] = []
  /** 正在运行的程序：服务器给的编号 → 程序 */
  const programs = new Map<number, ProgramHandle>()

  const send = (ws: WebSocket, message: WorkerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }

  function connect() {
    if (stopped) return
    const ws = new WebSocket(options.url, {
      headers: { authorization: `Bearer ${options.token}`, [VERSION_HEADER]: options.version },
    } as unknown as string[])
    socket = ws
    ws.onopen = () => {
      connected = true
      retryMs = RETRY_MIN_MS
      lastHeard = Date.now()
      console.log(`已连上服务器 ${options.url}`)
      for (const resolve of readyWaiters) resolve()
      readyWaiters = []
      pingTimer = setInterval(() => {
        if (Date.now() - lastHeard > DEAD_MS) {
          console.warn(`${DEAD_MS / 1000} 秒没收到服务器的消息，重连`)
          ws.close()
          return
        }
        send(ws, { t: 'ping' })
      }, PING_MS)
    }
    ws.onmessage = (event) => {
      lastHeard = Date.now()
      let message: HubMessage
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      void handle(ws, message)
    }
    ws.onclose = (event) => {
      if (socket !== ws) return
      socket = undefined
      clearInterval(pingTimer)
      if (connected) console.warn(`和服务器的连接断了（${event.code} ${event.reason}），结束 ${programs.size} 个学生程序`)
      else if (!stopped) console.warn(`连不上服务器（${event.code} ${event.reason || '连接失败'}），${retryMs / 1000} 秒后重试`)
      connected = false
      for (const program of programs.values()) program.kill()
      programs.clear()
      if (stopped) return
      retryTimer = setTimeout(connect, retryMs)
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS)
    }
    ws.onerror = () => {}
  }

  async function handle(ws: WebSocket, message: HubMessage) {
    switch (message.t) {
      case 'pong':
        return
      case 'in':
        programs.get(message.id)?.write(message.line)
        return
      case 'kill':
        programs.get(message.id)?.kill()
        return
      case 'run':
        return run(ws, message)
      case 'grade':
        try {
          const result = await gradeLocally(message.files, decodeChecks(message.checks), message.sampleId)
          send(ws, { t: 'graded', id: message.id, result })
        } catch (error) {
          console.error('评分出错', error)
          send(ws, { t: 'gradeFailed', id: message.id, message: String(error) })
        }
        return
      case 'lang':
        send(ws, { t: 'lang', id: message.id, reply: await languageService.request(message.body) })
        return
    }
  }

  async function run(ws: WebSocket, message: Extract<HubMessage, { t: 'run' }>) {
    const { id } = message
    // 学生的数据库放进这次运行自己的目录，结束后比较前后，把改动发回服务器
    let dbDir: string | undefined
    let before: Record<string, string> = {}
    try {
      if (message.db) {
        await mkdir(config.runsDir, { recursive: true })
        dbDir = await mkdtemp(join(config.runsDir, 'rundb-'))
        await writeDbFiles(dbDir, message.db)
        before = (await readDbDir(dbDir, Infinity))!
      }
      const outcome = await runLocally({ files: message.files, env: message.env, dbDir })
      const program = outcome.program
      // 等编译的时候连接断了：程序不要了
      if (program && socket !== ws) program.kill()
      else if (program) programs.set(id, program)
      // 只取这几项：编译服务的结果里还有它自己的请求编号 id，展开的话会盖掉服务器给的编号
      const { ok, diagnostics, ms } = outcome.compiled
      send(ws, { t: 'started', id, program: !!program, ok, diagnostics, ms })
      if (!program) {
        if (dbDir) await rm(dbDir, { recursive: true, force: true })
        return
      }
      program.listen(
        (line) => send(ws, { t: 'out', id, line }),
        (line) => send(ws, { t: 'err', id, line }),
      )
      const exit = await program.exited
      programs.delete(id)
      let db = null
      if (dbDir) {
        db = diffDbFiles(before, (await readDbDir(dbDir, Infinity))!)
        await rm(dbDir, { recursive: true, force: true })
      }
      send(ws, { t: 'exit', id, code: exit.code, signal: exit.signal, db })
    } catch (error) {
      if (dbDir) await rm(dbDir, { recursive: true, force: true })
      send(ws, { t: 'startFailed', id, message: error instanceof Error ? error.message : String(error) })
    }
  }

  connect()

  return {
    get connected() {
      return connected
    },
    ready() {
      if (connected) return Promise.resolve()
      return new Promise((resolve) => readyWaiters.push(resolve))
    },
    async stop() {
      stopped = true
      clearTimeout(retryTimer)
      clearInterval(pingTimer)
      const running = [...programs.values()]
      for (const program of running) program.kill()
      await Promise.all(running.map((p) => p.exited))
      socket?.close()
    },
  }
}

/** bun server.js worker：准备好沙箱和常驻服务，连上服务器后一直运行 */
export async function runWorker() {
  if (!config.workerHubUrl || !config.workerToken) {
    console.error('计算节点要设置 WORKER_HUB_URL（wss://…/worker）和 WORKER_TOKEN')
    process.exit(1)
  }
  await cleanupStaleRuns()
  await checkSandbox()
  if (sandboxError) {
    // 沙箱不能用就不接活，免得服务器把学生程序交给一台不能隔离的机器
    console.error(sandboxError)
    process.exit(1)
  }
  await Promise.all([compileService.start(), languageService.start(), sqlService.start()])
  console.log('C# 编译服务已就绪，连接服务器')
  startWorker({ url: config.workerHubUrl, token: config.workerToken, version: config.appVersion })
}

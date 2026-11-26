// 计算节点（bun server.js worker）：放在学校的机器上，主动连服务器的 /worker，替服务器编译运行学生程序、评分、
// 提供语言服务。不对外开端口、不存数据：用到数据库的程序服务器自己运行，交过来的运行都不带数据库。
// 连不上或断了就每隔几秒重连；断开时结束这条连接上的所有学生程序（服务器那边已经当它们结束了）。
import { compileService } from './compile-service'
import { config } from './config'
import { gradeLocally } from './dispatch'
import type { ProgramHandle } from './executor'
import { runLocally } from './executor'
import { languageService } from './language-service'
import { cleanupStaleRuns } from './run-session'
import { checkSandbox, sandboxError } from './sandbox'
import { sqlService } from './sql-service'
import { decodeChecks, GRADE_CONCURRENCY_HEADER, type HubMessage, MAX_LINE, VERSION_HEADER, type WorkerMessage } from './worker-protocol'

/** 多久发一次心跳；多久没收到服务器的任何消息就当连接已经断了（服务器每次都回 pong） */
const PING_MS = 10_000
const DEAD_MS = 30_000
/**
 * 学生程序的输出往服务器发：链路上积压超过 MAX_BACKLOG 就先不读（程序写满管道后自己停下来等，像真的控制台），
 * 心跳不会排在一大堆输出后面超时；每个程序平均每秒最多 OUTPUT_RATE 字节（可以先冲 OUTPUT_BURST），
 * 一个学生的程序一直刷屏，不会占满整条链路
 */
const MAX_BACKLOG = 1024 * 1024
const OUTPUT_RATE = 512 * 1024
const OUTPUT_BURST = 4 * 1024 * 1024
/** 重连间隔：从 2 秒开始，每次翻倍，最多 30 秒 */
const RETRY_MIN_MS = 2000
const RETRY_MAX_MS = 30_000

export interface WorkerOptions {
  url: string
  token: string
  version: string
  /** 心跳间隔、多久没消息算断开（测试里调短） */
  pingMs?: number
  deadMs?: number
}

export interface Worker {
  /** 连上了没有 */
  readonly connected: boolean
  /** 等到连上 */
  ready(): Promise<void>
  /** 断开、不再重连，结束手上的学生程序 */
  stop(): Promise<void>
}

/**
 * 一条连接：服务器给的编号只在这条连接上有意义（服务器重启后编号从 1 重新开始），
 * 所以正在运行的程序按连接分开记，旧连接上还没收尾的运行碰不到新连接上同编号的程序
 */
interface Connection {
  ws: WebSocket
  /** 还连着 */
  alive: boolean
  /** 正在运行的程序：服务器给的编号 → 程序 */
  programs: Map<number, ProgramHandle>
  /** 还在编译时服务器就让结束的（服务器等启动超时了）：启动后马上结束 */
  cancelled: Set<number>
}

export function startWorker(options: WorkerOptions): Worker {
  let current: Connection | undefined
  let connected = false
  let stopped = false
  let retryMs = RETRY_MIN_MS
  let retryTimer: Timer | undefined
  let readyWaiters: (() => void)[] = []
  const pingMs = options.pingMs ?? PING_MS
  const deadMs = options.deadMs ?? DEAD_MS
  /** 所有连接上还没结束的程序（停止时等它们结束） */
  const running = new Set<ProgramHandle>()

  const send = (conn: Connection, message: WorkerMessage) => sendText(conn, JSON.stringify(message))
  const sendText = (conn: Connection, text: string) => {
    if (conn.alive && conn.ws.readyState === WebSocket.OPEN) conn.ws.send(text)
  }

  /** 转发一个程序的输出：超长的行丢掉，按速率和链路积压降速（返回的 Promise 完成前不读下一行） */
  function forwarder(conn: Connection, id: number) {
    let allowance = OUTPUT_BURST
    let last = Date.now()
    return async (isErr: boolean, line: string) => {
      let text = JSON.stringify({ t: isErr ? 'err' : 'out', id, line } satisfies WorkerMessage)
      let bytes = Buffer.byteLength(text)
      if (bytes > MAX_LINE) {
        text = JSON.stringify({ t: 'err', id, line: '程序一次输出的内容太长，已省略' } satisfies WorkerMessage)
        bytes = text.length
      }
      sendText(conn, text)
      const now = Date.now()
      allowance = Math.min(OUTPUT_BURST, allowance + ((now - last) / 1000) * OUTPUT_RATE) - bytes
      last = now
      if (allowance < 0) await Bun.sleep((-allowance / OUTPUT_RATE) * 1000)
      while (conn.alive && conn.ws.bufferedAmount > MAX_BACKLOG) await Bun.sleep(20)
    }
  }

  function connect() {
    if (stopped) return
    const ws = new WebSocket(options.url, {
      headers: {
        authorization: `Bearer ${options.token}`,
        [VERSION_HEADER]: options.version,
        [GRADE_CONCURRENCY_HEADER]: String(config.gradeConcurrency),
      },
    } as unknown as string[])
    const conn: Connection = { ws, alive: true, programs: new Map(), cancelled: new Set() }
    current = conn
    let lastHeard = Date.now()
    let pingTimer: Timer | undefined

    /** 这条连接不能用了：结束它上面的程序，过一会儿重连 */
    const lost = (reason: string) => {
      if (!conn.alive) return
      conn.alive = false
      clearInterval(pingTimer)
      const wasConnected = connected && current === conn
      if (current === conn) {
        current = undefined
        connected = false
      }
      try {
        // terminate 不等对方回应（网络断了时 close 要等好几分钟）；没有的话退回 close
        const terminate = (ws as WebSocket & { terminate?: () => void }).terminate
        if (terminate) terminate.call(ws)
        else ws.close()
      } catch {}
      if (wasConnected) console.warn(`和服务器的连接断了（${reason}），结束 ${conn.programs.size} 个学生程序`)
      else if (!stopped) console.warn(`连不上服务器（${reason}），${retryMs / 1000} 秒后重试`)
      for (const program of conn.programs.values()) program.kill()
      conn.programs.clear()
      if (stopped) return
      clearTimeout(retryTimer)
      retryTimer = setTimeout(connect, retryMs)
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS)
    }

    ws.onopen = () => {
      connected = true
      retryMs = RETRY_MIN_MS
      lastHeard = Date.now()
      console.log(`已连上服务器 ${options.url}`)
      for (const resolve of readyWaiters) resolve()
      readyWaiters = []
      pingTimer = setInterval(() => {
        if (Date.now() - lastHeard > deadMs) {
          lost(`${deadMs / 1000} 秒没收到服务器的消息`)
          return
        }
        send(conn, { t: 'ping' })
      }, pingMs)
    }
    ws.onmessage = (event) => {
      lastHeard = Date.now()
      let message: HubMessage
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      void handle(conn, message)
    }
    ws.onclose = (event) => lost(`${event.code} ${event.reason || '连接失败'}`)
    ws.onerror = () => {}
  }

  async function handle(conn: Connection, message: HubMessage) {
    switch (message.t) {
      case 'pong':
        return
      case 'in':
        conn.programs.get(message.id)?.write(message.line)
        return
      case 'kill': {
        const program = conn.programs.get(message.id)
        if (program) program.kill()
        else conn.cancelled.add(message.id)
        return
      }
      case 'run':
        return run(conn, message)
      case 'grade':
        try {
          const result = await gradeLocally(message.files, decodeChecks(message.checks), message.sampleId)
          send(conn, { t: 'graded', id: message.id, result })
        } catch (error) {
          console.error('评分出错', error)
          send(conn, { t: 'gradeFailed', id: message.id, message: String(error) })
        }
        return
      case 'lang':
        send(conn, { t: 'lang', id: message.id, reply: await languageService.request(message.body) })
        return
    }
  }

  async function run(conn: Connection, message: Extract<HubMessage, { t: 'run' }>) {
    const { id } = message
    let program: ProgramHandle | undefined
    try {
      const outcome = await runLocally({ files: message.files, env: message.env })
      program = outcome.program
      // 只取这几项：编译服务的结果里还有它自己的请求编号 id，展开的话会盖掉服务器给的编号
      const { ok, diagnostics, ms } = outcome.compiled
      send(conn, { t: 'started', id, program: !!program, ok, diagnostics, ms })
    } catch (error) {
      send(conn, { t: 'startFailed', id, message: error instanceof Error ? error.message : String(error) })
      return
    }
    if (!program) return
    running.add(program)
    // 编译期间连接断了，或者服务器已经不要了（等启动超时）：启动后马上结束
    if (!conn.alive || conn.cancelled.delete(id)) program.kill()
    else conn.programs.set(id, program)
    // 服务器那边也有这个时限；这里再兜一层，万一结束的消息丢了，程序也不会一直占着机器
    // 时限用服务器的（服务器的 .env 可能调过）
    const timeout = setTimeout(() => program.kill(), ((message.maxMinutes || config.maxRunMinutes) + 1) * 60_000)
    const forward = forwarder(conn, id)
    program.listen(
      (line) => forward(false, line),
      (line) => forward(true, line),
    )
    const exit = await program.exited
    clearTimeout(timeout)
    running.delete(program)
    if (conn.programs.get(id) === program) conn.programs.delete(id)
    send(conn, { t: 'exit', id, code: exit.code, signal: exit.signal })
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
      // 先断开：服务器马上知道，学生那边立刻提示"断开了连接，请重新运行"；再结束程序
      const conn = current
      if (conn) {
        conn.alive = false
        current = undefined
        connected = false
        conn.ws.close(1001, '计算节点停止')
      }
      const all = [...running]
      for (const program of all) program.kill()
      await Promise.all(all.map((p) => p.exited))
    },
  }
}

/** bun server.js worker：准备好沙箱和常驻服务，连上服务器后一直运行；收到 SIGTERM（docker stop）时先断开再退出 */
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
  const worker = startWorker({ url: config.workerHubUrl, token: config.workerToken, version: config.appVersion })
  // 容器里 bun 是 1 号进程，不处理 SIGTERM 的话 docker stop 要等 10 秒再强行结束
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log('计算节点停止')
      void worker.stop().finally(() => {
        compileService.stop()
        languageService.stop()
        sqlService.stop()
        process.exit(0)
      })
    })
  }
}

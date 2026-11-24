import type { ServerWebSocket } from 'bun'
import type { ClientMessage, ServerMessage } from '@iot/shared'
import { createAiQueue } from './ai-review'
import { createApp } from './app'
import { backupTo } from './backup'
import { ensureTeacher, tokenUser } from './auth'
import { compileService } from './compile-service'
import { languageService } from './language-service'
import { config } from './config'
import { openDatabase } from './db'
import { createGradingQueue } from './grading/queue'
import { restoreExperimentDatabases, userDatabaseDir } from './databases'
import { createLearningLog, validWorkKey } from './learning-log'
import { knownSample, sampleWiring } from './samples'
import { cleanupStaleRuns, RunSession } from './run-session'
import { sqlService } from './sql-service'
import { checkSandbox, sandboxError } from './sandbox'
import { runWorker } from './worker'
import { workerHub, type WorkerSocketData } from './worker-hub'
import { MAX_PAYLOAD } from './worker-protocol'
import { validFiles } from './works'

// 手动备份：bun server.js backup <目录>（deploy/backup.sh 调用），导出数据库后退出，不启动服务器
if (process.argv[2] === 'backup') {
  const target = process.argv[3]
  if (!target) throw new Error('用法：backup <目录>')
  await backupTo(target)
  console.log(`已备份到 ${target}`)
  process.exit(0)
}

// 计算节点：bun server.js worker（学校的机器上），连到服务器替它编译运行、评分，不启动网站（见 worker.ts）
if (process.argv[2] === 'worker') {
  await runWorker()
} else {
  await startServer()
}

async function startServer() {
  await cleanupStaleRuns()
  await checkSandbox()
  if (sandboxError) console.error(sandboxError)

  const db = openDatabase()
  ensureTeacher(db)
  const aiQueue = createAiQueue(db)
  const learningLog = createLearningLog(db)
  const app = createApp(
    db,
    createGradingQueue(db, (id) => aiQueue.enqueue(id)),
    aiQueue,
    learningLog,
  )

  interface SocketData {
    kind: 'browser'
    userId?: number
    /** 学生才记学习过程 */
    student?: boolean
    session?: RunSession
    /** 正在运行的是哪份作品（学生的，记过程用） */
    workKey?: string
    /** 这次运行已经记过的异常（定时器里反复抛同一个异常只记一次） */
    exceptions?: Set<string>
  }

  /** 浏览器发来的一条消息最多多少（作品最多约 1 MB 字，编码成 JSON 后最多几 MB） */
  const MAX_CLIENT_MESSAGE = 8 * 1024 * 1024

  /** 一次运行最多记几条不同的异常 */
  const MAX_EXCEPTIONS_PER_RUN = 5

  const server = Bun.serve({
    port: config.port,
    async fetch(req, server) {
      const url = new URL(req.url)
      // 计算节点连上来（令牌、版本对了才接受）
      if (url.pathname === '/worker') return workerHub.upgrade(req, server)
      if (url.pathname === '/ws') {
        // 浏览器的 WebSocket 不能带请求头，令牌放在网址参数里
        const user = await tokenUser(db, url.searchParams.get('token'))
        if (!user) return new Response('请先登录', { status: 401 })
        if (server.upgrade(req, { data: { kind: 'browser', userId: user.id, student: user.role === 'student' } satisfies SocketData })) return
        return new Response('WebSocket 升级失败', { status: 400 })
      }
      return app.fetch(req, server)
    },
    websocket: {
      data: {} as SocketData | WorkerSocketData,
      // 30 秒没收到数据就发一次 ping（浏览器自动回 pong）。线上前面有 Nginx Proxy Manager，
      // nginx 默认 60 秒没数据就断开 WebSocket，学生的窗体开着不操作一分钟程序就会被结束
      idleTimeout: 30,
      sendPings: true,
      // 计算节点发来的一条消息可能比较大（学生程序一次输出很多），默认 16 MB 超了会断开整条连接
      maxPayloadLength: MAX_PAYLOAD,
      open(ws) {
        if (ws.data.kind === 'worker') return workerHub.open(ws as ServerWebSocket<WorkerSocketData>)
        const data = ws.data
        const userId = data.userId!
        data.session = new RunSession(
          (message) => {
            ws.send(JSON.stringify(message))
            record(data, message)
          },
          () => userDatabaseDir(userId),
        )
      },
      async message(ws, raw) {
        if (ws.data.kind === 'worker') return workerHub.message(ws as ServerWebSocket<WorkerSocketData>, raw)
        // 计算节点要用大消息，maxPayloadLength 调大了；浏览器发来的正常消息（最大的是带作品的"运行"）远小于这个
        if ((typeof raw === 'string' ? raw.length : raw.byteLength) > MAX_CLIENT_MESSAGE) return
        let message: ClientMessage
        try {
          message = JSON.parse(String(raw))
        } catch {
          return
        }
        const session = ws.data.session
        if (!session) return
        if (message.type === 'run') {
          if (!validFiles(message.files)) {
            ws.send(JSON.stringify({ type: 'serverError', message: '作品格式不对或太大' } satisfies ServerMessage))
            return
          }
          ws.data.workKey = ws.data.student && validWorkKey(message.workKey) ? message.workKey : undefined
          ws.data.exceptions = new Set()
          if (ws.data.workKey) learningLog.snapshot(ws.data.userId!, ws.data.workKey, message.files)
          try {
            const sampleId = await knownSample(message.sampleId)
            if (sampleId) {
              // 建库失败不影响运行（程序连不上库时会报出来）
              await restoreExperimentDatabases(ws.data.userId!, sampleId, true).catch((error) => console.error('自动建实验数据库失败', error))
            }
            session.setWiring(await sampleWiring(sampleId))
            await session.start(message.files)
          } catch (error) {
            ws.send(JSON.stringify({ type: 'serverError', message: String(error) } satisfies ServerMessage))
          }
        } else if (message.type === 'experiment') {
          session.setWiring(await sampleWiring(await knownSample(message.sampleId)))
        } else if (message.type === 'stop') {
          await session.stop()
        } else if (message.type === 'boardInput') {
          session.boardInput(message)
        } else if (message.type === 'boardReset') {
          session.boardReset()
        } else {
          // 操作学生程序（点按钮、输入文字）也算在做
          if (ws.data.workKey) learningLog.touch(ws.data.userId!, ws.data.workKey)
          session.input(message)
        }
      },
      async close(ws) {
        if (ws.data.kind === 'worker') return workerHub.close(ws as ServerWebSocket<WorkerSocketData>)
        await ws.data.session?.dispose()
      },
    },
  })

  /** 学生运行程序时：编译结果、没处理的异常记进学习过程记录 */
  function record(data: SocketData, message: ServerMessage) {
    const workKey = data.workKey
    if (!workKey) return
    if (message.type === 'compiled') {
      learningLog.compiled(data.userId!, workKey, message.ok, message.diagnostics)
    } else if (message.type === 'exception') {
      const signature = `${message.message}|${message.file}|${message.line}`
      if (data.exceptions!.has(signature) || data.exceptions!.size >= MAX_EXCEPTIONS_PER_RUN) return
      data.exceptions!.add(signature)
      learningLog.event(data.userId!, workKey, { type: 'exception', message: message.message.slice(0, 500), file: message.file, line: message.line })
    }
  }

  console.log(`服务器已启动：http://localhost:${server.port}`)
  await Promise.all([compileService.start(), languageService.start(), sqlService.start()])
  console.log('C# 编译服务已就绪')
}

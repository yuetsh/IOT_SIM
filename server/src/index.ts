import type { ClientMessage, ServerMessage } from '@iot/shared'
import { createAiQueue } from './ai-review'
import { createApp } from './app'
import { ensureTeacher, tokenUser } from './auth'
import { compileService } from './compile-service'
import { languageService } from './language-service'
import { config } from './config'
import { openDatabase } from './db'
import { createGradingQueue } from './grading/queue'
import { cleanupStaleRuns, RunSession } from './run-session'
import { checkSandbox, sandboxError } from './sandbox'

await cleanupStaleRuns()
await checkSandbox()
if (sandboxError) console.error(sandboxError)

const db = openDatabase()
ensureTeacher(db)
const aiQueue = createAiQueue(db)
const app = createApp(db, createGradingQueue(db, (id) => aiQueue.enqueue(id)), aiQueue)

interface SocketData {
  session?: RunSession
}

const server = Bun.serve({
  port: config.port,
  async fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      // 浏览器的 WebSocket 不能带请求头，令牌放在网址参数里
      if (!(await tokenUser(db, url.searchParams.get('token')))) return new Response('请先登录', { status: 401 })
      if (server.upgrade(req, { data: {} })) return
      return new Response('WebSocket 升级失败', { status: 400 })
    }
    return app.fetch(req, server)
  },
  websocket: {
    data: {} as SocketData,
    open(ws) {
      ws.data.session = new RunSession((message) => ws.send(JSON.stringify(message)))
    },
    async message(ws, raw) {
      let message: ClientMessage
      try {
        message = JSON.parse(String(raw))
      } catch {
        return
      }
      const session = ws.data.session
      if (!session) return
      if (message.type === 'run') {
        try {
          await session.start(message.files)
        } catch (error) {
          ws.send(JSON.stringify({ type: 'serverError', message: String(error) } satisfies ServerMessage))
        }
      } else if (message.type === 'stop') {
        await session.stop()
      } else if (message.type === 'boardInput') {
        session.boardInput(message)
      } else if (message.type === 'boardReset') {
        session.boardReset()
      } else {
        session.input(message)
      }
    },
    async close(ws) {
      await ws.data.session?.dispose()
    },
  },
})

console.log(`服务器已启动：http://localhost:${server.port}`)
await Promise.all([compileService.start(), languageService.start()])
console.log('C# 编译服务已就绪')

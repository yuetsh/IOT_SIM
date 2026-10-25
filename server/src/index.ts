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
import { listSamples } from './samples'
import { cleanupStaleRuns, RunSession } from './run-session'
import { sqlService } from './sql-service'
import { checkSandbox, sandboxError } from './sandbox'

// 手动备份：bun server.js backup <目录>（deploy/backup.sh 调用），导出数据库后退出，不启动服务器
if (process.argv[2] === 'backup') {
  const target = process.argv[3]
  if (!target) throw new Error('用法：backup <目录>')
  await backupTo(target)
  console.log(`已备份到 ${target}`)
  process.exit(0)
}

await cleanupStaleRuns()
await checkSandbox()
if (sandboxError) console.error(sandboxError)

const db = openDatabase()
ensureTeacher(db)
const aiQueue = createAiQueue(db)
const app = createApp(db, createGradingQueue(db, (id) => aiQueue.enqueue(id)), aiQueue)

interface SocketData {
  userId?: number
  session?: RunSession
}

const server = Bun.serve({
  port: config.port,
  async fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      // 浏览器的 WebSocket 不能带请求头，令牌放在网址参数里
      const user = await tokenUser(db, url.searchParams.get('token'))
      if (!user) return new Response('请先登录', { status: 401 })
      if (server.upgrade(req, { data: { userId: user.id } })) return
      return new Response('WebSocket 升级失败', { status: 400 })
    }
    return app.fetch(req, server)
  },
  websocket: {
    data: {} as SocketData,
    open(ws) {
      const userId = ws.data.userId!
      ws.data.session = new RunSession((message) => ws.send(JSON.stringify(message)), () => userDatabaseDir(userId))
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
          const { sampleId } = message
          if (typeof sampleId === 'string' && (await listSamples()).some((s) => s.id === sampleId)) {
            // 建库失败不影响运行（程序连不上库时会报出来）
            await restoreExperimentDatabases(ws.data.userId!, sampleId, true).catch((error) => console.error('自动建实验数据库失败', error))
          }
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
await Promise.all([compileService.start(), languageService.start(), sqlService.start()])
console.log('C# 编译服务已就绪')

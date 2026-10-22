import { Hono } from 'hono'
import type { ClientMessage, ServerMessage } from '@iot/shared'
import { compileService } from './compile-service'
import { cleanupStaleRuns, RunSession } from './run-session'
import { listSamples, loadSample } from './samples'

await cleanupStaleRuns()

const app = new Hono()

app.get('/api/samples', async (c) => c.json(await listSamples()))

app.get('/api/samples/:id', async (c) => {
  const files = await loadSample(c.req.param('id'))
  return files ? c.json(files) : c.notFound()
})

interface SocketData {
  session?: RunSession
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch(req, server) {
    if (new URL(req.url).pathname === '/ws') {
      if (server.upgrade(req, { data: {} })) return
      return new Response('WebSocket 升级失败', { status: 400 })
    }
    return app.fetch(req)
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
await compileService.start()
console.log('C# 编译服务已就绪')

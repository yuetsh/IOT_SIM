import { Hono } from 'hono'
import type { Server } from 'bun'
import type { ClientMessage, ServerMessage } from '@iot/shared'
import { accessRequired, hasAccess, login, tooManyFailures } from './access'
import { compileService } from './compile-service'
import { config } from './config'
import { cleanupStaleRuns, RunSession } from './run-session'
import { listSamples, loadSample } from './samples'
import { checkSandbox, sandboxError } from './sandbox'
import { serveStatic } from './static'

await cleanupStaleRuns()
await checkSandbox()
if (sandboxError) console.error(sandboxError)

const app = new Hono<{ Bindings: Server<SocketData> }>()

/** 客户端 IP：经过 Caddy 转发时由 Caddy 填在 X-Real-IP 里（它已核对过前面代理的 X-Forwarded-For） */
function clientIp(req: Request, server: Server<SocketData>) {
  return req.headers.get('x-real-ip') || server.requestIP(req)?.address || ''
}

app.get('/api/auth', (c) => c.json({ required: accessRequired, ok: hasAccess(c.req.header('cookie') ?? null) }))

app.post('/api/login', async (c) => {
  const ip = clientIp(c.req.raw, c.env)
  if (tooManyFailures(ip)) return c.json({ ok: false, message: '输错次数太多，请 10 分钟后再试' }, 429)
  const { password } = await c.req.json<{ password?: string }>().catch(() => ({ password: undefined }))
  if (!login(c, String(password ?? ''), ip)) return c.json({ ok: false, message: '口令不对' }, 401)
  return c.json({ ok: true })
})

// 其余接口都要先输入口令
app.use('/api/*', async (c, next) => {
  if (!hasAccess(c.req.header('cookie') ?? null)) return c.json({ message: '请先输入访问口令' }, 401)
  await next()
})

app.get('/api/samples', async (c) => c.json(await listSamples()))

app.get('/api/samples/:id', async (c) => {
  const files = await loadSample(c.req.param('id'))
  return files ? c.json(files) : c.notFound()
})

// 打包好的网页（部署时）；开发时网页由 Vite 提供
app.get('*', (c) => serveStatic(new URL(c.req.url).pathname))

interface SocketData {
  session?: RunSession
}

const server = Bun.serve({
  port: config.port,
  fetch(req, server) {
    if (new URL(req.url).pathname === '/ws') {
      if (!hasAccess(req.headers.get('cookie'))) return new Response('请先输入访问口令', { status: 401 })
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
await compileService.start()
console.log('C# 编译服务已就绪')

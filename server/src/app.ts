// HTTP 接口。除登录外都要先登录；/api/teacher/* 只有老师能用。
import type { Database } from 'bun:sqlite'
import { Hono, type Context } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { login, logout, sessionMaxAge, SESSION_COOKIE, sessionToken, sessionUser, tooManyFailures, type User } from './auth'
import { createClass, deleteClass, deleteStudent, importStudents, listClasses, listStudents, renameClass, resetPassword, type ImportRow } from './classes'
import { listSamples, loadSample } from './samples'
import { serveStatic } from './static'
import { deleteWork, getWork, saveWork, validFiles } from './works'

/** Bun.serve 的 server 对象（测试里直接调用 app.fetch 时没有） */
interface Env {
  requestIP?: (req: Request) => { address: string } | null
}

type AppContext = Context<{ Bindings: Env; Variables: { user: User } }>

/** 客户端 IP：经过 Caddy 转发时由 Caddy 填在 X-Real-IP 里（它已核对过前面代理的 X-Forwarded-For） */
function clientIp(c: AppContext) {
  return c.req.header('x-real-ip') || c.env?.requestIP?.(c.req.raw)?.address || ''
}

const isHttps = (c: AppContext) => new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https'

/** 读取 JSON 请求体，格式不对时返回空对象 */
const body = <T>(c: AppContext) => c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>)

export function createApp(db: Database) {
  const app = new Hono<{ Bindings: Env; Variables: { user: User } }>()

  app.post('/api/login', async (c) => {
    const ip = clientIp(c)
    if (tooManyFailures(ip)) return c.json({ message: '输错次数太多，请 10 分钟后再试' }, 429)
    const { username, password } = await body<{ username: string; password: string }>(c)
    const token = login(db, String(username ?? ''), String(password ?? ''), ip)
    if (!token) return c.json({ message: '账号或密码不对' }, 401)
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure: isHttps(c), path: '/', maxAge: sessionMaxAge })
    return c.json({ user: sessionUser(db, token) })
  })

  app.post('/api/logout', (c) => {
    const token = sessionToken(c.req.header('cookie'))
    if (token) logout(db, token)
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({})
  })

  // 其余接口都要先登录
  app.use('/api/*', async (c, next) => {
    const user = sessionUser(db, sessionToken(c.req.header('cookie')))
    if (!user) return c.json({ message: '请先登录' }, 401)
    c.set('user', user)
    await next()
  })

  app.get('/api/me', (c) => c.json({ user: c.get('user') }))

  app.get('/api/samples', async (c) => c.json(await listSamples()))

  app.get('/api/samples/:id', async (c) => {
    const files = await loadSample(c.req.param('id'))
    return files ? c.json(files) : c.notFound()
  })

  // 自己的作品：key 如 "sample:p2-t1-LED显示屏"
  app.get('/api/works/:key', (c) => c.json(getWork(db, c.get('user').id, c.req.param('key'))))

  app.put('/api/works/:key', async (c) => {
    const { files } = await body<{ files: unknown }>(c)
    if (!validFiles(files)) return c.json({ message: '作品格式不对或太大' }, 400)
    return c.json({ updatedAt: saveWork(db, c.get('user').id, c.req.param('key'), files) })
  })

  app.delete('/api/works/:key', (c) => {
    deleteWork(db, c.get('user').id, c.req.param('key'))
    return c.json({})
  })

  // ---- 老师 ----
  app.use('/api/teacher/*', async (c, next) => {
    if (c.get('user').role !== 'teacher') return c.json({ message: '只有老师能使用' }, 403)
    await next()
  })

  const id = (c: AppContext) => Number(c.req.param('id'))
  const reply = (c: AppContext, result: { error?: string }) => (result.error ? c.json({ message: result.error }, 400) : c.json(result))

  app.get('/api/teacher/classes', (c) => c.json(listClasses(db)))

  app.post('/api/teacher/classes', async (c) => {
    const { name } = await body<{ name: string }>(c)
    const result = createClass(db, String(name ?? ''))
    return 'error' in result ? c.json({ message: result.error }, 400) : c.json(result)
  })

  app.patch('/api/teacher/classes/:id', async (c) => {
    const { name } = await body<{ name: string }>(c)
    return reply(c, renameClass(db, id(c), String(name ?? '')))
  })

  app.delete('/api/teacher/classes/:id', (c) => reply(c, deleteClass(db, id(c))))

  app.get('/api/teacher/classes/:id/students', (c) => c.json(listStudents(db, id(c))))

  app.post('/api/teacher/classes/:id/import', async (c) => {
    const { rows } = await body<{ rows: ImportRow[] }>(c)
    if (!Array.isArray(rows) || rows.some((r) => typeof r?.username !== 'string' || typeof r?.name !== 'string')) {
      return c.json({ message: '名单格式不对' }, 400)
    }
    if (!listClasses(db).some((cls) => cls.id === id(c))) return c.json({ message: '班级不存在' }, 404)
    return c.json(importStudents(db, id(c), rows))
  })

  app.post('/api/teacher/students/:id/reset-password', (c) => {
    const password = resetPassword(db, id(c))
    return password ? c.json({ password }) : c.json({ message: '学生不存在' }, 404)
  })

  app.delete('/api/teacher/students/:id', (c) => {
    deleteStudent(db, id(c))
    return c.json({})
  })

  app.all('/api/*', (c) => c.json({ message: '接口不存在' }, 404))

  // 打包好的网页（部署时）；开发时网页由 Vite 提供
  app.get('*', (c) => serveStatic(new URL(c.req.url).pathname))

  return app
}

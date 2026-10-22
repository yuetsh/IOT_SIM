// HTTP 接口。除登录外都要先登录；/api/teacher/* 只有老师能用。
import type { Database } from 'bun:sqlite'
import { Hono, type Context } from 'hono'
import { bearerToken, login, logout, refresh, tokenUser, tooManyFailures, type Tokens, type User } from './auth'
import { createClass, deleteClass, deleteStudent, importStudents, listClasses, listStudents, renameClass, resetPassword, type ImportRow } from './classes'
import type { Scoring, StartMode } from '@iot/shared'
import {
  assignmentTemplate,
  classSubmissions,
  createAssignment,
  createSubmission,
  deleteAssignment,
  getAssignment,
  latestSubmission,
  listAssignments,
  updateAssignment,
} from './assignments'
import { parseChecks } from './grading/checks'
import type { GradingQueue } from './grading/queue'
import { listSamples, loadChecks, loadSample } from './samples'
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

/** 读取 JSON 请求体，格式不对时返回空对象 */
const body = <T>(c: AppContext) => c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>)

export function createApp(db: Database, gradingQueue: GradingQueue) {
  const app = new Hono<{ Bindings: Env; Variables: { user: User } }>()

  app.post('/api/login', async (c) => {
    const ip = clientIp(c)
    if (tooManyFailures(ip)) return c.json({ message: '输错次数太多，请 10 分钟后再试' }, 429)
    const { username, password } = await body<{ username: string; password: string }>(c)
    const tokens = await login(db, String(username ?? ''), String(password ?? ''), ip)
    if (!tokens) return c.json({ message: '账号或密码不对' }, 401)
    return c.json(await withUser(tokens))
  })

  /** 返回令牌时一并返回用户信息，浏览器不用再查一次 */
  const withUser = async (tokens: Tokens) => ({ ...tokens, user: await tokenUser(db, tokens.accessToken) })

  // 用刷新令牌换新的访问令牌（刷新令牌也换新的）
  app.post('/api/refresh', async (c) => {
    const { refreshToken } = await body<{ refreshToken: string }>(c)
    const tokens = typeof refreshToken === 'string' ? await refresh(db, refreshToken) : null
    if (!tokens) return c.json({ message: '登录已过期，请重新登录' }, 401)
    return c.json(await withUser(tokens))
  })

  app.post('/api/logout', async (c) => {
    const { refreshToken } = await body<{ refreshToken: string }>(c)
    if (typeof refreshToken === 'string') logout(db, refreshToken)
    return c.json({})
  })

  // 其余接口都要先登录（请求头 Authorization: Bearer <令牌>）
  app.use('/api/*', async (c, next) => {
    const user = await tokenUser(db, bearerToken(c.req.header('authorization')))
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

  // ---- 作业（学生） ----
  /** 当前用户能不能看这个作业：老师都能看，学生只能看自己班的 */
  const id = (c: AppContext) => Number(c.req.param('id'))
  const reply = (c: AppContext, result: { error?: string }) => (result.error ? c.json({ message: result.error }, 400) : c.json(result))

  const visibleAssignment = (c: AppContext) => {
    const assignment = getAssignment(db, id(c))
    const user = c.get('user')
    return assignment && (user.role === 'teacher' || assignment.classId === user.classId) ? assignment : null
  }

  // 自己班的作业，带上自己最近一次提交的状态
  app.get('/api/assignments', (c) => {
    const user = c.get('user')
    if (user.classId === null) return c.json([])
    return c.json(
      listAssignments(db, user.classId).map((a) => {
        const latest = latestSubmission(db, a.id, user.id)
        return { ...a, latest: latest && { ...latest, result: null } }
      }),
    )
  })

  app.get('/api/assignments/:id', (c) => {
    const assignment = visibleAssignment(c)
    if (!assignment) return c.json({ message: '作业不存在' }, 404)
    return c.json({ assignment, template: assignmentTemplate(db, assignment.id), latest: latestSubmission(db, assignment.id, c.get('user').id) })
  })

  app.post('/api/assignments/:id/submit', async (c) => {
    const assignment = visibleAssignment(c)
    if (!assignment) return c.json({ message: '作业不存在' }, 404)
    const user = c.get('user')
    if (user.role === 'student' && assignment.deadline !== null && Date.now() > assignment.deadline) {
      return c.json({ message: '已经过了截止时间，不能再提交' }, 400)
    }
    const { files } = await body<{ files: unknown }>(c)
    if (!validFiles(files)) return c.json({ message: '作品格式不对或太大' }, 400)
    const submissionId = createSubmission(db, assignment.id, user.id, files)
    if (submissionId === null) return c.json({ message: '上一次提交还在评分，请等评分结束再提交' }, 409)
    gradingQueue.enqueue(submissionId)
    return c.json(latestSubmission(db, assignment.id, user.id))
  })

  app.get('/api/assignments/:id/submission', (c) => {
    const assignment = visibleAssignment(c)
    if (!assignment) return c.json({ message: '作业不存在' }, 404)
    return c.json(latestSubmission(db, assignment.id, c.get('user').id))
  })

  // ---- 老师 ----
  app.use('/api/teacher/*', async (c, next) => {
    if (c.get('user').role !== 'teacher') return c.json({ message: '只有老师能使用' }, 403)
    await next()
  })


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

  // 示例的自动评分项名称（布置作业时设置分值用）
  app.get('/api/teacher/samples/:id/checks', async (c) => {
    const checks = await loadChecks(c.req.param('id'))
    if (!checks) return c.json({ message: '这个实验还没有评分规则' }, 404)
    return c.json(parseChecks(checks).map((check) => check.title))
  })

  // 班级的作业，带上提交人数
  app.get('/api/teacher/classes/:id/assignments', (c) =>
    c.json(
      listAssignments(db, id(c)).map((a) => {
        const students = classSubmissions(db, a.id)
        return { ...a, studentCount: students.length, submittedCount: students.filter((s) => s.status).length }
      }),
    ),
  )

  app.post('/api/teacher/assignments', async (c) => {
    const a = await body<{ classId: number; sampleId: string; title: string; startMode: StartMode; template: unknown; scoring: Scoring; deadline: number | null }>(c)
    if (!listClasses(db).some((cls) => cls.id === a.classId)) return c.json({ message: '班级不存在' }, 404)
    const checks = typeof a.sampleId === 'string' ? await loadChecks(a.sampleId) : null
    if (!checks) return c.json({ message: '这个实验还没有评分规则' }, 400)
    if (a.startMode !== 'blank' && a.startMode !== 'ui') return c.json({ message: '起点只能是空白工程或界面已做好' }, 400)
    if (!validFiles(a.template)) return c.json({ message: '起点工程格式不对' }, 400)
    const result = createAssignment(db, {
      classId: a.classId!,
      sampleId: a.sampleId!,
      title: String(a.title ?? ''),
      startMode: a.startMode,
      template: a.template,
      checks,
      scoring: a.scoring as Scoring,
      deadline: typeof a.deadline === 'number' ? a.deadline : null,
    })
    return 'error' in result ? c.json({ message: result.error }, 400) : c.json(result)
  })

  app.patch('/api/teacher/assignments/:id', async (c) => {
    const a = await body<{ title: string; deadline: number | null; scoring: Scoring }>(c)
    return reply(c, updateAssignment(db, id(c), { title: String(a.title ?? ''), deadline: typeof a.deadline === 'number' ? a.deadline : null, scoring: a.scoring as Scoring }))
  })

  app.delete('/api/teacher/assignments/:id', (c) => {
    deleteAssignment(db, id(c))
    return c.json({})
  })

  // 全班每个学生最近一次提交的情况
  app.get('/api/teacher/assignments/:id/submissions', (c) => c.json(classSubmissions(db, id(c))))

  app.all('/api/*', (c) => c.json({ message: '接口不存在' }, 404))

  // 打包好的网页（部署时）；开发时网页由 Vite 提供
  app.get('*', (c) => serveStatic(new URL(c.req.url).pathname))

  return app
}

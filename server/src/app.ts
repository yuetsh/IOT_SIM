// HTTP 接口。除登录外都要先登录；/api/teacher/* 只有老师能用。
import type { Database } from 'bun:sqlite'
import { dirname } from 'node:path'
import { Hono, type Context } from 'hono'
import { bearerToken, login, logout, refresh, tokenUser, tooManyFailures, type Tokens, type User } from './auth'
import { createClass, deleteClass, deleteStudent, importStudents, listClasses, listStudents, renameClass, resetPassword, type ImportRow } from './classes'
import type { Scoring, StartMode } from '@iot/shared'
import {
  assignmentChecks,
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
import { aiEnabled, getAiReview, type AiQueue } from './ai-review'
import { parseChecks } from './grading/checks'
import { createSelfCheck } from './grading/selfcheck'
import { languageService } from './language-service'
import { getReview, gradebook, manualScore, saveReview, studentDetail, submissionFiles } from './reviews'
import type { GradingQueue } from './grading/queue'
import { config } from './config'
import { deleteUserDatabases, restoreExperimentDatabases, userDatabaseDir } from './databases'
import { listSamples, loadChecks, loadSample, loadTask } from './samples'
import { SqlError, sqlService } from './sql-service'
import { serveStatic } from './static'
import { deleteWork, getWork, saveWork, validFiles, validScreenshots } from './works'

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

export function createApp(db: Database, gradingQueue: GradingQueue, aiQueue: AiQueue) {
  const app = new Hono<{ Bindings: Env; Variables: { user: User } }>()

  app.post('/api/login', async (c) => {
    const ip = clientIp(c)
    const { username, password } = await body<{ username: string; password: string }>(c)
    const blocked = tooManyFailures(ip, String(username ?? ''))
    if (blocked) return c.json({ message: blocked }, 429)
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

  // 项目资源素材库（Properties.Resources 的图片、声音）：设计器预览用 <img> 直接显示，不需要登录
  app.get('/resources/:file', async (c) => {
    const name = c.req.param('file')
    if (!/^[\w.-]+$/.test(name)) return c.notFound()
    const file = Bun.file(`${dirname(config.runnerDll)}/Resources/gallery/${name}`)
    if (!(await file.exists())) return c.notFound()
    // 清单随部署更新（新素材、图片编号），每次都向服务器确认；图片缓存一小时
    return new Response(file, { headers: { 'Cache-Control': name === 'index.json' ? 'no-cache' : 'public, max-age=3600' } })
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

  // ---- 自测：提交前自己跑一遍评分，不计分、不留记录 ----
  const selfCheck = createSelfCheck()

  /** 实验的评价项（自动检查的功能项名称）：实验页的评价项面板、老师布置作业时用 */
  app.get('/api/samples/:id/checks', async (c) => {
    const checks = await loadChecks(c.req.param('id'))
    if (!checks) return c.json({ message: '这个实验还没有评分规则' }, 404)
    return c.json(parseChecks(checks).map((check) => check.title))
  })

  /** 实验的任务说明（Markdown）；没有时 task 为 null */
  app.get('/api/samples/:id/task', async (c) => c.json({ task: await loadTask(c.req.param('id')) }))

  app.post('/api/samples/:id/selfcheck', async (c) => {
    const sampleId = c.req.param('id')
    const yaml = (await listSamples()).some((s) => s.id === sampleId) ? await loadChecks(sampleId) : null
    if (!yaml) return c.json({ message: '这个实验没有评价项' }, 404)
    const { files } = await body<{ files: unknown }>(c)
    if (!validFiles(files)) return c.json({ message: '作品格式不对或太大' }, 400)
    if (!selfCheck.start(c.get('user').id, `sample:${sampleId}`, files, parseChecks(yaml), sampleId)) {
      return c.json({ message: '上一次检查还没完成' }, 409)
    }
    return c.json(selfCheck.get(c.get('user').id))
  })

  app.get('/api/selfcheck', (c) => c.json(selfCheck.get(c.get('user').id)))

  // 代码编辑器的语言服务：补全、悬停提示、参数提示、边写边检查
  const LANGUAGE_REQUESTS = new Set(['complete', 'completionDetail', 'hover', 'signature', 'diagnostics'])
  app.post('/api/language', async (c) => {
    const r = await body<{ type: string; session: string; files: unknown; file: string; line: number; column: number; index: number }>(c)
    if (!LANGUAGE_REQUESTS.has(String(r.type)) || typeof r.session !== 'string') return c.json({ message: '请求格式不对' }, 400)
    if (r.files !== undefined && !validFiles(r.files)) return c.json({ message: '作品格式不对或太大' }, 400)
    // 会话按用户区分，不同学生的工程不会混在一起
    const reply = await languageService.request({ ...r, session: `${c.get('user').id}:${r.session.slice(0, 64)}` })
    return c.json(reply ?? { type: 'empty' })
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

  // ---- 数据库页面（代替 SSMS）：每个用户只能访问自己的数据库 ----
  app.get('/api/db', async (c) => c.json(await sqlService.request({ type: 'explorer', dir: await userDatabaseDir(c.get('user').id) })))

  /** 执行 T-SQL；SQL 报错时返回 200 和 error（和 SSMS 的消息栏一样显示，不是请求失败） */
  app.post('/api/db/query', async (c) => {
    const { database, sql } = await body<{ database: string; sql: string }>(c)
    if (typeof sql !== 'string' || sql.length > 100_000 || typeof database !== 'string' || database.length > 64) return c.json({ message: '请求格式不对' }, 400)
    try {
      return c.json(await sqlService.request({ type: 'exec', dir: await userDatabaseDir(c.get('user').id), database, sql }))
    } catch (error) {
      if (error instanceof SqlError) return c.json({ type: 'error', number: error.number, message: error.message, line: error.line })
      throw error
    }
  })

  /** 有预置数据库的实验（数据库页面"恢复实验初始数据"的选项） */
  app.get('/api/db/experiments', async (c) => {
    const samples = await listSamples()
    const withDb = await Promise.all(samples.map(async (s) => ((await Bun.file(`${config.samplesDir}/${s.id}/database.sql`).exists()) ? s : null)))
    return c.json(withDb.filter((s) => s !== null))
  })

  app.post('/api/db/restore', async (c) => {
    const { sampleId } = await body<{ sampleId: string }>(c)
    if (typeof sampleId !== 'string' || !(await listSamples()).some((s) => s.id === sampleId)) return c.json({ message: '没有这个实验' }, 400)
    return c.json({ databases: await restoreExperimentDatabases(c.get('user').id, sampleId) })
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
        return { ...a, latest: latest && { ...latest, result: null }, manualScore: manualScore(getReview(db, a.id, user.id)) }
      }),
    )
  })

  app.get('/api/assignments/:id', async (c) => {
    const assignment = visibleAssignment(c)
    if (!assignment) return c.json({ message: '作业不存在' }, 404)
    const userId = c.get('user').id
    // 以前布置的作业没有保存任务说明，用实验现在的说明
    const task = assignment.task ?? (await loadTask(assignment.sampleId))
    return c.json({
      assignment: { ...assignment, task },
      template: assignmentTemplate(db, assignment.id),
      latest: latestSubmission(db, assignment.id, userId),
      review: getReview(db, assignment.id, userId),
    })
  })

  app.post('/api/assignments/:id/submit', async (c) => {
    const assignment = visibleAssignment(c)
    if (!assignment) return c.json({ message: '作业不存在' }, 404)
    const user = c.get('user')
    if (user.role === 'student' && assignment.deadline !== null && Date.now() > assignment.deadline) {
      return c.json({ message: '已经过了截止时间，不能再提交' }, 400)
    }
    const { files, screenshots = [] } = await body<{ files: unknown; screenshots: unknown }>(c)
    if (!validFiles(files)) return c.json({ message: '作品格式不对或太大' }, 400)
    if (!validScreenshots(screenshots)) return c.json({ message: '界面截图格式不对或太大' }, 400)
    const submissionId = createSubmission(db, assignment.id, user.id, files, screenshots)
    if (submissionId === null) return c.json({ message: '上一次提交还在评分，请等评分结束再提交' }, 409)
    gradingQueue.enqueue(submissionId)
    return c.json(latestSubmission(db, assignment.id, user.id))
  })

  app.post('/api/assignments/:id/selfcheck', async (c) => {
    const assignment = visibleAssignment(c)
    const checks = assignment && assignmentChecks(db, assignment.id)
    if (!assignment || !checks) return c.json({ message: '作业不存在' }, 404)
    const { files } = await body<{ files: unknown }>(c)
    if (!validFiles(files)) return c.json({ message: '作品格式不对或太大' }, 400)
    if (!selfCheck.start(c.get('user').id, `assignment:${assignment.id}`, files, checks, assignment.sampleId)) {
      return c.json({ message: '上一次检查还没完成' }, 409)
    }
    return c.json(selfCheck.get(c.get('user').id))
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

  app.delete('/api/teacher/students/:id', async (c) => {
    if (deleteStudent(db, id(c))) await deleteUserDatabases(id(c))
    return c.json({})
  })

  // 示例的自动评分项名称（布置作业时设置分值用）
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
    const a = await body<{
      classId: number
      sampleId: string
      title: string
      startMode: StartMode
      template: unknown
      scoring: Scoring
      deadline: number | null
      task: string | null
    }>(c)
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
      task: typeof a.task === 'string' ? a.task : null,
    })
    return 'error' in result ? c.json({ message: result.error }, 400) : c.json(result)
  })

  app.patch('/api/teacher/assignments/:id', async (c) => {
    const a = await body<{ title: string; deadline: number | null; scoring: Scoring; task: string | null }>(c)
    return reply(
      c,
      updateAssignment(db, id(c), {
        title: String(a.title ?? ''),
        deadline: typeof a.deadline === 'number' ? a.deadline : null,
        scoring: a.scoring as Scoring,
        task: typeof a.task === 'string' ? a.task : null,
      }),
    )
  })

  app.delete('/api/teacher/assignments/:id', (c) => {
    deleteAssignment(db, id(c))
    return c.json({})
  })

  // 全班每个学生最近一次提交的情况和老师评分
  app.get('/api/teacher/assignments/:id/submissions', (c) =>
    c.json(
      classSubmissions(db, id(c)).map((s) => {
        const review = getReview(db, id(c), s.userId)
        const ai = s.submissionId ? getAiReview(db, s.submissionId) : null
        return {
          ...s,
          manualScore: manualScore(review),
          review,
          aiStatus: ai?.status ?? null,
          aiManual: ai?.status === 'done' ? ai.scores.reduce((a, x) => a + x.score, 0) : null,
        }
      }),
    ),
  )

  // 评阅一个学生：最近一次提交（含代码和评分结果）、老师评阅
  app.get('/api/teacher/assignments/:id/students/:userId', (c) => {
    const assignment = getAssignment(db, id(c))
    const detail = assignment && studentDetail(db, assignment.id, Number(c.req.param('userId')))
    return detail ? c.json({ assignment, ...detail }) : c.json({ message: '找不到这个学生的作业' }, 404)
  })

  app.put('/api/teacher/assignments/:id/students/:userId/review', async (c) => {
    const { scores, comment } = await body<{ scores: unknown; comment: unknown }>(c)
    const userId = Number(c.req.param('userId'))
    const result = saveReview(db, id(c), userId, scores, comment)
    return result.error ? c.json({ message: result.error }, 400) : c.json(getReview(db, id(c), userId))
  })

  // 全部采纳 AI 建议：只处理老师还没评阅、最近一次提交已有 AI 建议的学生，不覆盖老师自己打的分
  app.post('/api/teacher/assignments/:id/adopt-ai', (c) => {
    let adopted = 0
    for (const s of classSubmissions(db, id(c))) {
      if (!s.submissionId || getReview(db, id(c), s.userId)) continue
      const ai = getAiReview(db, s.submissionId)
      if (ai?.status !== 'done') continue
      if (
        !saveReview(
          db,
          id(c),
          s.userId,
          ai.scores.map((x) => x.score),
          ai.comment,
        ).error
      )
        adopted++
    }
    return c.json({ adopted })
  })

  // 重新做 AI 评阅（出错时或老师想再评一次）
  app.post('/api/teacher/submissions/:id/ai-review', (c) => {
    if (!aiEnabled()) return c.json({ message: '没有配置 AI 评阅（DEEPSEEK_API_KEY）' }, 400)
    if (!submissionFiles(db, id(c))) return c.json({ message: '提交不存在' }, 404)
    aiQueue.enqueue(id(c))
    return c.json({})
  })

  // 一份提交的代码（老师在实验页里运行学生的程序）
  app.get('/api/teacher/submissions/:id', (c) => {
    const submission = submissionFiles(db, id(c))
    return submission ? c.json(submission) : c.json({ message: '提交不存在' }, 404)
  })

  app.get('/api/teacher/classes/:id/gradebook', (c) => c.json(gradebook(db, id(c))))

  app.all('/api/*', (c) => c.json({ message: '接口不存在' }, 404))

  // 打包好的网页（部署时）；开发时网页由 Vite 提供
  app.get('*', (c) => serveStatic(new URL(c.req.url).pathname))

  return app
}

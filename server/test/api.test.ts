// HTTP 接口测试：内存数据库，直接调用 app.fetch。
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { createAiQueue, normalizeAiResult } from '../src/ai-review'
import { createApp } from '../src/app'
import { ensureTeacher } from '../src/auth'
import { config } from '../src/config'
import { openDatabase } from '../src/db'
import { createGradingQueue, type GradingQueue } from '../src/grading/queue'
import { languageService } from '../src/language-service'
import { sqlService } from '../src/sql-service'
import { loadSample, loadTask } from '../src/samples'

let app: ReturnType<typeof createApp>
let queue: GradingQueue
let aiQueue: ReturnType<typeof createAiQueue>

beforeEach(() => {
  const db = openDatabase(':memory:')
  ensureTeacher(db)
  aiQueue = createAiQueue(db)
  queue = createGradingQueue(db, (id) => aiQueue.enqueue(id))
  app = createApp(db, queue, aiQueue)
})

/** 一个浏览器：记住访问令牌和刷新令牌 */
class Browser {
  accessToken = ''
  refreshToken = ''
  constructor(readonly ip = '10.0.0.1') {}

  async request(method: string, path: string, json?: unknown) {
    const headers: Record<string, string> = { 'x-real-ip': this.ip }
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`
    if (json !== undefined) headers['content-type'] = 'application/json'
    const response = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) }))
    const body = (await response.json()) as any
    if (body?.accessToken) {
      this.accessToken = body.accessToken
      this.refreshToken = body.refreshToken
    }
    return { status: response.status, body }
  }

  get = (path: string) => this.request('GET', path)
  post = (path: string, json: unknown = {}) => this.request('POST', path, json)
  put = (path: string, json: unknown) => this.request('PUT', path, json)
  patch = (path: string, json: unknown) => this.request('PATCH', path, json)
  delete = (path: string) => this.request('DELETE', path)

  login(username: string, password: string) {
    return this.post('/api/login', { username, password })
  }

  refresh(refreshToken = this.refreshToken) {
    return this.post('/api/refresh', { refreshToken })
  }
}

async function teacher() {
  const browser = new Browser()
  expect((await browser.login(config.teacherUsername, config.teacherPassword || 'admin')).status).toBe(200)
  return browser
}

/** 老师建一个班并导入名单，返回班级 id */
async function classWithStudents(t: Browser, rows: { username: string; name: string; password?: string }[]) {
  const { body } = await t.post('/api/teacher/classes', { name: '物联网 2401' })
  await t.post(`/api/teacher/classes/${body.id}/import`, { rows })
  return body.id as number
}

test('没登录时接口返回 401', async () => {
  const browser = new Browser()
  expect((await browser.get('/api/me')).status).toBe(401)
  expect((await browser.get('/api/samples')).status).toBe(401)
  expect((await browser.get('/api/works/sample:x')).status).toBe(401)
})

test('账号或密码不对时登录失败，老师登录后能看到自己的信息', async () => {
  const browser = new Browser()
  const wrong = await browser.login('admin', 'wrong')
  expect(wrong.status).toBe(401)
  expect(wrong.body.message).toBe('账号或密码不对')

  const t = await teacher()
  const me = await t.get('/api/me')
  expect(me.body.user).toMatchObject({ username: config.teacherUsername, role: 'teacher' })
})

test('同一个账号输错 10 次后暂停这个账号的登录，同一 IP 的其他同学不受影响', async () => {
  const t = await teacher()
  await classWithStudents(t, [
    { username: 'guessed', name: '甲', password: '123456' },
    { username: 'other', name: '乙', password: '654321' },
  ])
  const classmate = new Browser('10.0.0.66')
  for (let i = 0; i < 9; i++) await classmate.login('guessed', `00000${i}`)
  // 用自己的账号登录成功，不会清掉别人账号的失败次数
  expect((await classmate.login('other', '654321')).status).toBe(200)
  await classmate.login('guessed', '000009')
  const blocked = await new Browser('10.0.0.67').login('guessed', '123456')
  expect(blocked.status).toBe(429)
  expect(blocked.body.message).toContain('这个账号')
  expect((await new Browser('10.0.0.66').login('other', '654321')).status).toBe(200)
})

test('同一个 IP 输错 300 次后暂停登录，登录成功也不清零，别的 IP 不受影响', async () => {
  const t = await teacher()
  await classWithStudents(t, [{ username: 'mine', name: '甲', password: '111111' }])
  const attacker = new Browser('10.0.0.68')
  for (let i = 0; i < 300; i++) {
    await attacker.login(`nobody${i % 50}`, 'guess')
    if (i === 150) expect((await attacker.login('mine', '111111')).status).toBe(200)
  }
  expect((await attacker.login('mine', '111111')).status).toBe(429)
  expect((await new Browser('10.0.0.69').login('mine', '111111')).status).toBe(200)
})

describe('班级和名单', () => {
  test('新建班级，不能重名', async () => {
    const t = await teacher()
    expect((await t.post('/api/teacher/classes', { name: '物联网 2401' })).status).toBe(200)
    const duplicate = await t.post('/api/teacher/classes', { name: ' 物联网 2401 ' })
    expect(duplicate.status).toBe(400)
    expect(duplicate.body.message).toContain('已经有')
    expect((await t.get('/api/teacher/classes')).body).toEqual([{ id: 1, name: '物联网 2401', studentCount: 0 }])
  })

  test('导入名单：新学生没填密码时生成 6 位数字，有问题的行单独报出来', async () => {
    const t = await teacher()
    const { body: cls } = await t.post('/api/teacher/classes', { name: '物联网 2401' })
    const result = await t.post(`/api/teacher/classes/${cls.id}/import`, {
      rows: [
        { username: '2024001', name: '张三', password: 'abc123' },
        { username: '2024002', name: '李四' },
        { username: '2024001', name: '张三重复' },
        { username: '2024003', name: '' },
        { username: '2024 004', name: '空格' },
        { username: 'admin', name: '冒充老师' },
      ],
    })
    expect(result.body).toEqual({
      created: 2,
      updated: 0,
      errors: [
        { row: 3, message: '账号"2024001"在名单里重复' },
        { row: 4, message: '账号"2024003"的姓名为空' },
        { row: 5, message: '账号"2024 004"里有空格' },
        { row: 6, message: '"admin"是老师账号' },
      ],
    })
    const students = (await t.get(`/api/teacher/classes/${cls.id}/students`)).body
    expect(students.map((s: any) => [s.username, s.name])).toEqual([
      ['2024001', '张三'],
      ['2024002', '李四'],
    ])
    expect(students[0].password).toBe('abc123')
    expect(students[1].password).toMatch(/^\d{6}$/)
  })

  test('再次导入：更新姓名；密码留空时保留原密码', async () => {
    const t = await teacher()
    const classId = await classWithStudents(t, [{ username: '2024001', name: '张三', password: 'abc123' }])
    const result = await t.post(`/api/teacher/classes/${classId}/import`, { rows: [{ username: '2024001', name: '张叁' }] })
    expect(result.body).toMatchObject({ created: 0, updated: 1 })
    expect((await t.get(`/api/teacher/classes/${classId}/students`)).body[0]).toMatchObject({ name: '张叁', password: 'abc123' })
  })

  test('学生用老师发的密码登录，不能使用老师接口', async () => {
    const t = await teacher()
    await classWithStudents(t, [{ username: '2024001', name: '张三', password: 'abc123' }])
    const student = new Browser()
    const login = await student.login('2024001', 'abc123')
    expect(login.body.user).toMatchObject({ name: '张三', role: 'student', className: '物联网 2401' })
    expect((await student.get('/api/teacher/classes')).status).toBe(403)
  })

  test('重置密码后，学生已登录的浏览器要重新登录，新密码可以登录', async () => {
    const t = await teacher()
    const classId = await classWithStudents(t, [{ username: '2024001', name: '张三', password: 'abc123' }])
    const student = new Browser()
    await student.login('2024001', 'abc123')
    const [{ id }] = (await t.get(`/api/teacher/classes/${classId}/students`)).body
    const { body } = await t.post(`/api/teacher/students/${id}/reset-password`)
    expect(body.password).toMatch(/^\d{6}$/)
    expect((await student.get('/api/me')).status).toBe(401)
    expect((await student.refresh()).status).toBe(401)
    expect((await new Browser().login('2024001', 'abc123')).status).toBe(401)
    expect((await new Browser().login('2024001', body.password)).status).toBe(200)
  })

  test('班级里有学生时不能删除；删除学生后可以删除班级', async () => {
    const t = await teacher()
    const classId = await classWithStudents(t, [{ username: '2024001', name: '张三' }])
    expect((await t.delete(`/api/teacher/classes/${classId}`)).status).toBe(400)
    const [{ id }] = (await t.get(`/api/teacher/classes/${classId}/students`)).body
    await t.delete(`/api/teacher/students/${id}`)
    expect((await t.delete(`/api/teacher/classes/${classId}`)).status).toBe(200)
    expect((await t.get('/api/teacher/classes')).body).toEqual([])
  })
})

describe('作品', () => {
  const files = [{ path: 'Form1.cs', content: '// 我的代码' }]

  test('保存后再读取；每个人只能看到自己的作品；恢复原始代码会删除作品', async () => {
    const t = await teacher()
    await classWithStudents(t, [
      { username: 's1', name: '甲', password: 'p1' },
      { username: 's2', name: '乙', password: 'p2' },
    ])
    const s1 = new Browser()
    await s1.login('s1', 'p1')
    const key = encodeURIComponent('sample:p2-t1-LED显示屏')
    expect((await s1.get(`/api/works/${key}`)).body).toBeNull()
    expect((await s1.put(`/api/works/${key}`, { files })).status).toBe(200)
    expect((await s1.get(`/api/works/${key}`)).body.files).toEqual(files)

    const s2 = new Browser()
    await s2.login('s2', 'p2')
    expect((await s2.get(`/api/works/${key}`)).body).toBeNull()

    await s1.delete(`/api/works/${key}`)
    expect((await s1.get(`/api/works/${key}`)).body).toBeNull()
  })

  test('格式不对或太大的作品拒绝保存', async () => {
    const t = await teacher()
    expect((await t.put('/api/works/x', { files: 'not-a-list' })).status).toBe(400)
    expect((await t.put('/api/works/x', { files: [{ path: 'a.cs' }] })).status).toBe(400)
    expect((await t.put('/api/works/x', { files: [{ path: 'a.cs', content: 'x'.repeat(1_000_001) }] })).status).toBe(400)
  })
})

describe('令牌', () => {
  test('登录返回访问令牌和刷新令牌；访问令牌是 15 分钟有效的 JWT', async () => {
    const t = await teacher()
    const payload = JSON.parse(Buffer.from(t.accessToken.split('.')[1], 'base64url').toString())
    expect(payload.exp - payload.iat).toBe(15 * 60)
    expect(t.refreshToken).toMatch(/^[\w-]{43}$/)
  })

  test('刷新：换到新的一对令牌，旧的刷新令牌不能再用', async () => {
    const t = await teacher()
    const old = t.refreshToken
    const refreshed = await t.refresh()
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.user.role).toBe('teacher')
    expect(t.refreshToken).not.toBe(old)
    expect((await t.get('/api/me')).status).toBe(200)
    expect((await t.refresh(old)).status).toBe(401)
  })

  test('退出登录后刷新令牌作废', async () => {
    const t = await teacher()
    await t.post('/api/logout', { refreshToken: t.refreshToken })
    expect((await t.refresh()).status).toBe(401)
  })

  test('伪造或改过的访问令牌无效', async () => {
    const t = await teacher()
    const [header, payload, signature] = t.accessToken.split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sub: '999' })).toString('base64url')
    t.accessToken = `${header}.${forged}.${signature}`
    expect((await t.get('/api/me')).status).toBe(401)
    t.accessToken = 'not-a-token'
    expect((await t.get('/api/me')).status).toBe(401)
  })
})

describe('作业', () => {
  const SAMPLE = 'p4-t3-报警灯'
  const scoring = { auto: [10, 10], manual: [{ title: '窗体界面', points: 10 }] }

  /** 老师建班、导入一个学生、布置报警灯作业；返回老师、学生和作业 id */
  async function setup(deadline: number | null = null) {
    const t = await teacher()
    const classId = await classWithStudents(t, [{ username: 's1', name: '甲', password: 'p1' }])
    const template = (await loadSample(SAMPLE))!
    const created = await t.post('/api/teacher/assignments', { classId, sampleId: SAMPLE, title: '控制报警灯', startMode: 'ui', template, scoring, deadline })
    expect(created.status).toBe(200)
    const student = new Browser()
    await student.login('s1', 'p1')
    return { t, student, classId, assignmentId: created.body.id as number, files: template }
  }

  test('任务说明：布置时保存，老师可以改；没有保存的作业用实验现在的说明', async () => {
    const { t, student, classId, assignmentId } = await setup()
    // setup 没传任务说明（像加这个功能之前布置的作业）
    expect((await student.get(`/api/assignments/${assignmentId}`)).body.assignment.task).toBe(await loadTask(SAMPLE))

    await t.patch(`/api/teacher/assignments/${assignmentId}`, { title: '控制报警灯', deadline: null, scoring, task: '## 老师要求\n只做前 3 步' })
    expect((await student.get(`/api/assignments/${assignmentId}`)).body.assignment.task).toBe('## 老师要求\n只做前 3 步')

    const tooLong = await t.post('/api/teacher/assignments', {
      classId,
      sampleId: SAMPLE,
      title: '太长',
      startMode: 'ui',
      template: [],
      scoring,
      deadline: null,
      task: 'x'.repeat(20_001),
    })
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.message).toContain('任务说明')
  })

  test('分值项数要和评分规则一致', async () => {
    const t = await teacher()
    const classId = await classWithStudents(t, [])
    const result = await t.post('/api/teacher/assignments', {
      classId,
      sampleId: SAMPLE,
      title: '控制报警灯',
      startMode: 'ui',
      template: [],
      scoring: { auto: [10], manual: [] },
      deadline: null,
    })
    expect(result.status).toBe(400)
    expect(result.body.message).toBe('自动评分项应有 2 项')
    expect((await t.get(`/api/samples/${encodeURIComponent(SAMPLE)}/checks`)).body).toEqual(['能正确打开报警灯', '能正确关闭报警灯'])
  })

  test('学生能看到自己班的作业和起点工程，别的班看不到', async () => {
    const { t, assignmentId } = await setup()
    const s1 = new Browser()
    await s1.login('s1', 'p1')
    const list = (await s1.get('/api/assignments')).body
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ title: '控制报警灯', checkTitles: ['能正确打开报警灯', '能正确关闭报警灯'], latest: null })
    expect((await s1.get(`/api/assignments/${assignmentId}`)).body.template.length).toBeGreaterThan(0)

    const { body: other } = await t.post('/api/teacher/classes', { name: '另一个班' })
    await t.post(`/api/teacher/classes/${other.id}/import`, { rows: [{ username: 's2', name: '乙', password: 'p2' }] })
    const s2 = new Browser()
    await s2.login('s2', 'p2')
    expect((await s2.get('/api/assignments')).body).toEqual([])
    expect((await s2.get(`/api/assignments/${assignmentId}`)).status).toBe(404)
  })

  test('提交后排队评分，评完得到每项结果和分数；老师能看到提交情况', async () => {
    const { t, student, assignmentId, files } = await setup()
    const submitted = await student.post(`/api/assignments/${assignmentId}/submit`, { files })
    expect(submitted.body.status).toBe('pending')
    // 上一份还没评完时不能再交
    expect((await student.post(`/api/assignments/${assignmentId}/submit`, { files })).status).toBe(409)

    await queue.idle()
    const graded = (await student.get(`/api/assignments/${assignmentId}/submission`)).body
    expect(graded).toMatchObject({ status: 'done', autoScore: 20 })
    expect(graded.result.results.map((r: any) => r.passed)).toEqual([true, true])

    const submissions = (await t.get(`/api/teacher/assignments/${assignmentId}/submissions`)).body
    expect(submissions).toEqual([expect.objectContaining({ username: 's1', status: 'done', autoScore: 20, count: 1 })])
    expect((await t.get(`/api/teacher/classes/${(await t.get('/api/teacher/classes')).body[0].id}/assignments`)).body[0]).toMatchObject({
      studentCount: 1,
      submittedCount: 1,
    })
  }, 60000)

  test('只做对一部分时按通过的项得分；老师改分值后重新算分', async () => {
    const { t, student, assignmentId, files } = await setup()
    const broken = files.map((f) => (f.path === 'Form1.cs' ? { ...f, content: f.content.replace('AlarmOnOff("Alarm", false);', '') } : f))
    await student.post(`/api/assignments/${assignmentId}/submit`, { files: broken })
    await queue.idle()
    const graded = (await student.get(`/api/assignments/${assignmentId}/submission`)).body
    expect(graded.autoScore).toBe(10)
    expect(graded.result.results[1]).toMatchObject({ title: '能正确关闭报警灯', passed: false })

    await t.patch(`/api/teacher/assignments/${assignmentId}`, { title: '控制报警灯', deadline: null, scoring: { ...scoring, auto: [30, 20] } })
    expect((await student.get(`/api/assignments/${assignmentId}/submission`)).body.autoScore).toBe(30)
  }, 60000)

  test('自测：提交前自己检查，告诉哪项不通过；不计分、不留记录，同时只能一次', async () => {
    const { student, assignmentId, files } = await setup()
    const finished = async () => {
      for (let i = 0; i < 300; i++) {
        const { body } = await student.get('/api/selfcheck')
        if (body.status !== 'running') return body
        await Bun.sleep(200)
      }
    }
    const broken = files.map((f) => (f.path === 'Form1.cs' ? { ...f, content: f.content.replace('AlarmOnOff("Alarm", false);', '') } : f))
    const started = await student.post(`/api/assignments/${assignmentId}/selfcheck`, { files: broken })
    expect(started.body).toMatchObject({ status: 'running', target: `assignment:${assignmentId}` })
    expect((await student.post(`/api/assignments/${assignmentId}/selfcheck`, { files })).status).toBe(409)
    const result = await finished()
    expect(result.result.results.map((r: any) => r.passed)).toEqual([true, false])
    expect(result.result.results[1].message).toBeString()
    // 自测不算提交
    expect((await student.get(`/api/assignments/${assignmentId}/submission`)).body).toBeNull()

    // 自由练习：按实验的评分规则检查
    const sample = await student.post(`/api/samples/${encodeURIComponent(SAMPLE)}/selfcheck`, { files })
    expect(sample.body.target).toBe(`sample:${SAMPLE}`)
    expect((await finished()).result.results.map((r: any) => r.passed)).toEqual([true, true])
    expect((await student.post('/api/samples/no-such/selfcheck', { files })).status).toBe(404)
  }, 60000)

  test('过了截止时间不能提交', async () => {
    const { student, assignmentId, files } = await setup(Date.now() - 1000)
    const result = await student.post(`/api/assignments/${assignmentId}/submit`, { files })
    expect(result.status).toBe(400)
    expect(result.body.message).toBe('已经过了截止时间，不能再提交')
  })

  test('删除作业后学生看不到', async () => {
    const { t, student, assignmentId } = await setup()
    await t.delete(`/api/teacher/assignments/${assignmentId}`)
    expect((await student.get('/api/assignments')).body).toEqual([])
  })
})

describe('评阅与成绩', () => {
  const SAMPLE = 'p4-t3-报警灯'
  const scoring = {
    auto: [10, 10],
    manual: [
      { title: '窗体界面', points: 10 },
      { title: '注释', points: 5 },
    ],
  }

  async function submitted() {
    const t = await teacher()
    const classId = await classWithStudents(t, [
      { username: 's1', name: '甲', password: 'p1' },
      { username: 's2', name: '乙', password: 'p2' },
    ])
    const files = (await loadSample(SAMPLE))!
    const { body } = await t.post('/api/teacher/assignments', {
      classId,
      sampleId: SAMPLE,
      title: '报警灯',
      startMode: 'ui',
      template: files,
      scoring,
      deadline: null,
    })
    const student = new Browser()
    await student.login('s1', 'p1')
    await student.post(`/api/assignments/${body.id}/submit`, { files })
    await queue.idle()
    const userId = (await student.get('/api/me')).body.user.id as number
    return { t, student, classId, assignmentId: body.id as number, userId }
  }

  test('老师看到学生的代码和评分结果，打分、写评语；学生能看到老师的评分和评语', async () => {
    const { t, student, assignmentId, userId } = await submitted()
    const detail = (await t.get(`/api/teacher/assignments/${assignmentId}/students/${userId}`)).body
    expect(detail).toMatchObject({ student: { name: '甲' }, submission: { status: 'done', autoScore: 20 }, review: null, submissionCount: 1 })
    expect(detail.files.some((f: any) => f.path === 'Form1.cs')).toBe(true)

    // 超出满分拒绝
    const tooHigh = await t.put(`/api/teacher/assignments/${assignmentId}/students/${userId}/review`, { scores: [11, 5], comment: '' })
    expect(tooHigh.status).toBe(400)
    expect(tooHigh.body.message).toBe('"窗体界面"的得分要在 0 到 10 之间')

    const saved = await t.put(`/api/teacher/assignments/${assignmentId}/students/${userId}/review`, { scores: [8, null], comment: '界面整齐，注释还要补' })
    expect(saved.body).toMatchObject({ scores: [8, null], comment: '界面整齐，注释还要补' })

    expect((await student.get(`/api/assignments/${assignmentId}`)).body.review).toMatchObject({ scores: [8, null], comment: '界面整齐，注释还要补' })
    expect((await student.get('/api/assignments')).body[0].manualScore).toBe(8)
    expect((await t.get(`/api/teacher/assignments/${assignmentId}/submissions`)).body[0]).toMatchObject({
      username: 's1',
      manualScore: 8,
      review: { comment: '界面整齐，注释还要补' },
    })
  }, 60000)

  test('成绩表：总分 = 自动评分 + 老师评分；没提交的没有总分', async () => {
    const { t, classId, assignmentId, userId } = await submitted()
    await t.put(`/api/teacher/assignments/${assignmentId}/students/${userId}/review`, { scores: [8, 4], comment: '' })
    const book = (await t.get(`/api/teacher/classes/${classId}/gradebook`)).body
    expect(book.assignments).toEqual([{ id: assignmentId, title: '报警灯', total: 35 }])
    expect(book.students.map((s: any) => [s.name, s.scores[assignmentId].total])).toEqual([
      ['甲', 32],
      ['乙', null],
    ])
  }, 60000)

  test('老师减少评分项后，已打的分按新的评分项对齐', async () => {
    const { t, assignmentId, userId } = await submitted()
    await t.put(`/api/teacher/assignments/${assignmentId}/students/${userId}/review`, { scores: [8, 4], comment: '' })
    await t.patch(`/api/teacher/assignments/${assignmentId}`, {
      title: '报警灯',
      deadline: null,
      scoring: { auto: [10, 10], manual: [{ title: '窗体界面', points: 5 }] },
    })
    expect((await t.get(`/api/teacher/assignments/${assignmentId}/students/${userId}`)).body.review.scores).toEqual([5])
  }, 60000)

  test('老师能取到提交的代码（在实验页里运行）；学生不能', async () => {
    const { t, student, assignmentId, userId } = await submitted()
    const { submission } = (await t.get(`/api/teacher/assignments/${assignmentId}/students/${userId}`)).body
    const files = await t.get(`/api/teacher/submissions/${submission.id}`)
    expect(files.body).toMatchObject({ assignmentTitle: '报警灯', studentName: '甲' })
    expect((await student.get(`/api/teacher/submissions/${submission.id}`)).status).toBe(403)
  }, 60000)
})

describe('语言服务', () => {
  afterAll(() => languageService.stop())

  test('代码补全、边写边检查（中文提示）；请求格式不对拒绝；没登录不能用', async () => {
    const t = await teacher()
    const files = [
      {
        path: 'Program.cs',
        content: 'using System.Windows.Forms;\nstatic class P\n{\n    static void Main()\n    {\n        var b = new Button();\n        b.\n    }\n}\n',
      },
    ]
    const completions = await t.post('/api/language', { type: 'complete', session: 'tab1', files, file: 'Program.cs', line: 7, column: 11 })
    expect(completions.body.items.map((i: any) => i.label)).toEqual(expect.arrayContaining(['Text', 'Click', 'Enabled']))

    const check = await t.post('/api/language', { type: 'diagnostics', session: 'tab1', files })
    expect(check.body.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CS1002', hint: 'C# 每条语句末尾要有英文分号 ;' })]))

    expect((await t.post('/api/language', { type: 'run', session: 'tab1' })).status).toBe(400)
    expect((await new Browser().post('/api/language', { type: 'complete', session: 'tab1', files })).status).toBe(401)
  }, 60000)

  test('平台支持的旧版线程 API（Suspend / Resume / Abort）不提示"已过时"', async () => {
    const t = await teacher()
    const files = [
      {
        path: 'Program.cs',
        content:
          'using System.Threading;\nstatic class P\n{\n    static void Main()\n    {\n        var t = new Thread(() => Thread.Sleep(10));\n        t.Start();\n        t.Suspend();\n        t.Resume();\n        t.Abort();\n    }\n}\n',
      },
    ]
    const check = await t.post('/api/language', { type: 'diagnostics', session: 'tab2', files })
    expect(check.body.diagnostics).toEqual([])
  }, 60000)
})

describe('数据库页面', () => {
  const saved = config.dataDir
  // 测试的用户编号会和本机开发环境重复，数据库放到单独的目录
  beforeAll(async () => {
    config.dataDir = `${config.runsDir}/test-api-data`
    await rm(config.dataDir, { recursive: true, force: true })
  })
  afterAll(() => {
    config.dataDir = saved
    sqlService.stop()
  })

  test('建库建表、查询；SQL 报错和 SSMS 一样返回编号和信息；每个人只看到自己的库', async () => {
    const t = await teacher()
    await classWithStudents(t, [{ username: 's1', name: '甲', password: 'p1' }])
    const student = new Browser()
    await student.login('s1', 'p1')

    expect((await t.post('/api/db/query', { database: 'master', sql: 'CREATE DATABASE 测试库' })).body).toMatchObject({ type: 'result', affected: -1 })
    const created = await t.post('/api/db/query', {
      database: '测试库',
      sql: "CREATE TABLE T (ID int IDENTITY(1,1) PRIMARY KEY, name nvarchar(20)); INSERT INTO T (name) VALUES (N'张三'), (N'李四'); SELECT * FROM T WHERE name LIKE N'张%'",
    })
    expect(created.body).toMatchObject({
      type: 'result',
      database: '测试库',
      affected: 2,
      results: [
        {
          columns: [
            { name: 'ID', type: 'int' },
            { name: 'name', type: 'nvarchar(20)' },
          ],
          rows: [[1, '张三']],
          total: 1,
        },
      ],
    })

    const error = await t.post('/api/db/query', { database: '测试库', sql: 'SELECT * FROM 不存在的表' })
    expect(error.body).toEqual({ type: 'error', number: 208, message: "对象名 '不存在的表' 无效。", line: 1 })

    const explorer = (await t.get('/api/db')).body
    expect(explorer.databases).toEqual([
      {
        name: '测试库',
        tables: [
          {
            name: 'T',
            columns: [
              { name: 'ID', type: 'int', nullable: false, identity: true, primaryKey: true },
              { name: 'name', type: 'nvarchar(20)', nullable: true, identity: false, primaryKey: false },
            ],
          },
        ],
      },
    ])
    expect((await student.get('/api/db')).body.databases).toEqual([])
    expect((await new Browser().get('/api/db')).status).toBe(401)
  }, 60000)

  test('删除学生时删除他的库：编号重新用给新学生时看不到前一个人的库', async () => {
    const t = await teacher()
    const classId = await classWithStudents(t, [{ username: 's1', name: '甲', password: 'p1' }])
    const s1 = new Browser()
    await s1.login('s1', 'p1')
    await s1.post('/api/db/query', { database: 'master', sql: 'CREATE DATABASE 甲的库' })
    const [{ id }] = (await t.get(`/api/teacher/classes/${classId}/students`)).body
    await t.delete(`/api/teacher/students/${id}`)

    await t.post(`/api/teacher/classes/${classId}/import`, { rows: [{ username: 's2', name: '乙', password: 'p2' }] })
    expect((await t.get(`/api/teacher/classes/${classId}/students`)).body[0].id).toBe(id)
    const s2 = new Browser()
    await s2.login('s2', 'p2')
    expect((await s2.get('/api/db')).body.databases).toEqual([])
  }, 60000)

  test('恢复实验初始数据：只替换实验用到的库', async () => {
    const t = await teacher()
    await t.post('/api/db/query', { database: 'master', sql: 'CREATE DATABASE 我的库' })
    expect((await t.get('/api/db/experiments')).body.map((e: { id: string }) => e.id)).toContain('p6-t2-存储环境数据')
    expect((await t.post('/api/db/restore', { sampleId: 'p6-t2-存储环境数据' })).body).toEqual({ databases: ['环境数据表'] })
    const rows = await t.post('/api/db/query', { database: '环境数据表', sql: 'SELECT COUNT(*) FROM CampusEnvironment' })
    expect(rows.body.results[0].rows).toEqual([[3]])
    expect((await t.get('/api/db')).body.databases.map((d: { name: string }) => d.name)).toEqual(['我的库', '测试库', '环境数据表'])
    expect((await t.post('/api/db/restore', { sampleId: '../etc' })).status).toBe(400)
  }, 60000)
})

describe('AI 评阅', () => {
  const SAMPLE = 'p4-t3-报警灯'
  const scoring = {
    auto: [10, 10],
    manual: [
      { title: '窗体界面', points: 10 },
      { title: '注释规范', points: 5 },
    ],
  }
  /** 假的模型服务：记下收到的请求，返回固定的评分（第二项故意超出满分，检查服务器会限制） */
  const requests: any[] = []
  let fake: ReturnType<typeof Bun.serve>
  const saved = { key: config.aiApiKey, url: config.aiBaseUrl }

  beforeAll(() => {
    fake = Bun.serve({
      port: 0,
      async fetch(req) {
        requests.push(await req.json())
        const content = JSON.stringify({
          scores: [
            { item: '窗体界面', score: 8.6, reason: '布局整齐' },
            { item: '注释规范', score: 9, reason: '注释充分' },
          ],
          comment: '界面整齐，继续加油。',
        })
        return Response.json({ choices: [{ message: { content } }] })
      },
    })
    config.aiApiKey = 'test-key'
    config.aiBaseUrl = `http://localhost:${fake.port}`
  })

  afterAll(() => {
    fake.stop()
    config.aiApiKey = saved.key
    config.aiBaseUrl = saved.url
  })

  test('分数限制在 0 到满分并取整；评分项个数不对时报错', () => {
    const manual = [
      { title: 'A', points: 10 },
      { title: 'B', points: 5 },
    ]
    expect(normalizeAiResult({ scores: [{ score: 8.6, reason: 'x' }, { score: -1 }], comment: ' 好 ' }, manual)).toEqual({
      scores: [
        { score: 9, reason: 'x' },
        { score: 0, reason: '' },
      ],
      comment: '好',
    })
    expect(() => normalizeAiResult({ scores: [{ score: 1 }] }, manual)).toThrow('评分项个数不对')
  })

  test('自动评分后做 AI 评阅：老师看到建议分，"全部采纳"后学生才看到；发给模型的内容不含姓名', async () => {
    const t = await teacher()
    const classId = await classWithStudents(t, [{ username: 's1', name: '甲同学', password: 'p1' }])
    const files = (await loadSample(SAMPLE))!
    const { body } = await t.post('/api/teacher/assignments', {
      classId,
      sampleId: SAMPLE,
      title: '报警灯',
      startMode: 'ui',
      template: files,
      scoring,
      deadline: null,
    })
    const assignmentId = body.id as number
    const student = new Browser()
    await student.login('s1', 'p1')
    const png = Buffer.from('fake-png').toString('base64')
    await student.post(`/api/assignments/${assignmentId}/submit`, { files, screenshots: [{ form: 'Form1', png }] })
    await queue.idle()
    await aiQueue.idle()

    const userId = (await student.get('/api/me')).body.user.id
    const detail = (await t.get(`/api/teacher/assignments/${assignmentId}/students/${userId}`)).body
    expect(detail.aiReview).toMatchObject({
      status: 'done',
      scores: [
        { score: 9, reason: '布局整齐' },
        { score: 5, reason: '注释充分' },
      ],
      comment: '界面整齐，继续加油。',
    })
    expect(detail.screenshots).toEqual([{ form: 'Form1', png }])
    expect((await t.get(`/api/teacher/assignments/${assignmentId}/submissions`)).body[0]).toMatchObject({ aiStatus: 'done', aiManual: 14, review: null })
    expect((await t.get(`/api/teacher/classes/${classId}/gradebook`)).body.students[0].scores[assignmentId]).toMatchObject({ manual: null, aiManual: 14 })

    // 请求里有代码和截图，没有学生姓名
    const sent = JSON.stringify(requests.at(-1))
    expect(sent).toContain('AlarmOnOff')
    expect(sent).toContain(`data:image/png;base64,${png}`)
    expect(sent).not.toContain('甲同学')

    // 老师确认前学生看不到 AI 的建议
    expect((await student.get(`/api/assignments/${assignmentId}`)).body.review).toBeNull()
    expect((await t.post(`/api/teacher/assignments/${assignmentId}/adopt-ai`)).body).toEqual({ adopted: 1 })
    expect((await student.get(`/api/assignments/${assignmentId}`)).body.review).toMatchObject({ scores: [9, 5], comment: '界面整齐，继续加油。' })
    // 已经评阅过的不会再被覆盖
    expect((await t.post(`/api/teacher/assignments/${assignmentId}/adopt-ai`)).body).toEqual({ adopted: 0 })
  }, 60000)
})

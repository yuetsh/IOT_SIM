// HTTP 接口测试：内存数据库，直接调用 app.fetch。
import { beforeEach, describe, expect, test } from 'bun:test'
import { createApp } from '../src/app'
import { ensureTeacher } from '../src/auth'
import { config } from '../src/config'
import { openDatabase } from '../src/db'
import { createGradingQueue, type GradingQueue } from '../src/grading/queue'
import { loadSample } from '../src/samples'

let app: ReturnType<typeof createApp>
let queue: GradingQueue

beforeEach(() => {
  const db = openDatabase(':memory:')
  ensureTeacher(db)
  queue = createGradingQueue(db)
  app = createApp(db, queue)
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
    const response = await app.fetch(
      new Request(`http://localhost${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) }),
    )
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

test('同一个 IP 输错 30 次后暂停登录，别的 IP 不受影响', async () => {
  const attacker = new Browser('10.0.0.66')
  for (let i = 0; i < 30; i++) await attacker.login('admin', `guess${i}`)
  expect((await attacker.login('admin', 'whatever')).status).toBe(429)
  expect((await new Browser('10.0.0.67').login('admin', 'whatever')).status).toBe(401)
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
    expect((await t.get(`/api/teacher/samples/${encodeURIComponent(SAMPLE)}/checks`)).body).toEqual(['能正确打开报警灯', '能正确关闭报警灯'])
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

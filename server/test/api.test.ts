// HTTP 接口测试：内存数据库，直接调用 app.fetch。
import { beforeEach, describe, expect, test } from 'bun:test'
import { createApp } from '../src/app'
import { ensureTeacher } from '../src/auth'
import { config } from '../src/config'
import { openDatabase } from '../src/db'

let app: ReturnType<typeof createApp>

beforeEach(() => {
  const db = openDatabase(':memory:')
  ensureTeacher(db)
  app = createApp(db)
})

/** 一个浏览器：记住登录 cookie */
class Browser {
  cookie = ''
  constructor(readonly ip = '10.0.0.1') {}

  async request(method: string, path: string, json?: unknown) {
    const headers: Record<string, string> = { 'x-real-ip': this.ip }
    if (this.cookie) headers.cookie = this.cookie
    if (json !== undefined) headers['content-type'] = 'application/json'
    const response = await app.fetch(
      new Request(`http://localhost${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) }),
    )
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) this.cookie = setCookie.split(';')[0]
    return { status: response.status, body: (await response.json()) as any }
  }

  get = (path: string) => this.request('GET', path)
  post = (path: string, json: unknown = {}) => this.request('POST', path, json)
  put = (path: string, json: unknown) => this.request('PUT', path, json)
  patch = (path: string, json: unknown) => this.request('PATCH', path, json)
  delete = (path: string) => this.request('DELETE', path)

  login(username: string, password: string) {
    return this.post('/api/login', { username, password })
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

test('退出登录后会话失效', async () => {
  const t = await teacher()
  const cookie = t.cookie
  await t.post('/api/logout')
  t.cookie = cookie
  expect((await t.get('/api/me')).status).toBe(401)
})

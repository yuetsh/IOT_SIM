// 全班模拟：N 个虚拟学生像在课堂上一样使用平台，按环节统计每个学生等了多久。
// 和 load.ts 不同，它从外面通过 HTTP / WebSocket 访问一台正在运行的服务器，经过登录、语言服务、编译、评分队列的全过程。
//
// 环节（每个环节等全班做完再进入下一个，学生在 SPREAD 秒内陆续开始，像老师说"开始"之后的样子）：
//   登录 → 打开作业并保存 → 边写边检查 → 运行（到窗体出现）→ 点按钮到实训台响应 → 自己检查 → 提交并等自动评分
//
// 用法：bun test/classroom.ts [人数，默认 45]
//   环境变量：BASE（默认 http://localhost:3000）、TEACHER_USERNAME / TEACHER_PASSWORD（默认 admin / admin）、
//            SPREAD（秒，默认 10）、KEEP=1（结束后保留压测班级和账号）、
//            SAMPLE（实验，默认项目 3 任务 2；"点按钮"环节只对默认实验做）、CPUS（和服务器在同一台机器时填服务器用的核，如 0,1，每个环节显示这几个核的平均占用）
// 会建一个"压测班"和 N 个 loadtest 开头的学生账号，结束时删除。按服务器配置测试：taskset -c 0,1 bun src/index.ts
import type { ControlNode, ServerMessage, SourceFile } from '@iot/shared'

const COUNT = Number(process.argv[2] ?? 45)
const BASE = process.env.BASE ?? 'http://localhost:3000'
const SPREAD_MS = Number(process.env.SPREAD ?? 10) * 1000
const SAMPLE = process.env.SAMPLE ?? 'p3-t2-人体红外ZigBee联动'
const PASSWORD = 'loadtest-123'
const CPUS = process.env.CPUS?.split(',').map(Number) ?? []

/** /proc/stat 里这几个核的忙碌时间和总时间 */
async function cpuTimes() {
  const stat = await Bun.file('/proc/stat').text()
  let busy = 0
  let total = 0
  for (const cpu of CPUS) {
    const fields = new RegExp(`^cpu${cpu} (.*)$`, 'm').exec(stat)![1].trim().split(/\s+/).map(Number)
    const idle = fields[3] + fields[4]
    const sum = fields.reduce((a, b) => a + b, 0)
    busy += sum - idle
    total += sum
  }
  return { busy, total }
}

class Client {
  token = ''

  async request(method: string, path: string, json?: unknown) {
    const headers: Record<string, string> = {}
    if (this.token) headers.authorization = `Bearer ${this.token}`
    if (json !== undefined) headers['content-type'] = 'application/json'
    const response = await fetch(`${BASE}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) })
    const body = (await response.json().catch(() => null)) as any
    if (!response.ok) throw new Error(`${method} ${path}：${response.status} ${body?.message ?? ''}`)
    return body
  }

  async login(username: string, password: string) {
    this.token = (await this.request('POST', '/api/login', { username, password })).accessToken
  }
}

function findId(node: ControlNode, name: string): string | undefined {
  if (node.name === name) return node.id
  for (const child of node.children) {
    const id = findId(child, name)
    if (id) return id
  }
}

/** 一个学生的运行窗口：WebSocket 连接 + 收到的消息 */
class RunWindow {
  private readonly ws: WebSocket
  private listeners: ((m: ServerMessage) => void)[] = []
  form?: ControlNode
  compileMs?: number

  constructor(token: string) {
    this.ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`)
    this.ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage
      if (message.type === 'compiled') this.compileMs = message.ms
      for (const listener of this.listeners) listener(message)
    }
  }

  opened() {
    return new Promise<void>((resolve, reject) => {
      this.ws.onopen = () => resolve()
      this.ws.onerror = () => reject(new Error('WebSocket 连接失败'))
    })
  }

  send(message: object) {
    this.ws.send(JSON.stringify(message))
  }

  /** 等到某条消息出现；出错消息直接失败 */
  waitFor(match: (m: ServerMessage) => boolean, timeoutMs = 60_000) {
    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => done(new Error('超时')), timeoutMs)
      const listener = (m: ServerMessage) => {
        if (m.type === 'serverError' || m.type === 'exception') done(new Error(m.message))
        else if (m.type === 'compiled' && !m.ok) done(new Error('编译失败'))
        else if (match(m)) done(null, m)
      }
      const done = (error: Error | null, m?: ServerMessage) => {
        clearTimeout(timer)
        this.listeners = this.listeners.filter((l) => l !== listener)
        if (error) reject(error)
        else resolve(m!)
      }
      this.listeners.push(listener)
    })
  }

  action(name: string, action: object) {
    this.send({ type: 'action', id: findId(this.form!, name)!, ...action })
  }

  close() {
    this.ws.close()
  }
}

interface Student {
  username: string
  client: Client
  files: SourceFile[]
  window?: RunWindow
}

const elapsed = async (work: () => Promise<unknown>) => {
  const start = performance.now()
  await work()
  return performance.now() - start
}

/** 一个环节：每个学生在 SPREAD 内随机时刻开始，统计用时和失败 */
async function phase(name: string, students: Student[], work: (s: Student) => Promise<unknown>, spreadMs = SPREAD_MS) {
  const times: number[] = []
  const errors = new Map<string, number>()
  const start = performance.now()
  const cpuStart = CPUS.length ? await cpuTimes() : null
  await Promise.all(
    students.map(async (student) => {
      await Bun.sleep(Math.random() * spreadMs)
      try {
        times.push(await elapsed(() => work(student)))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.set(message, (errors.get(message) ?? 0) + 1)
      }
    }),
  )
  times.sort((a, b) => a - b)
  const cpuEnd = cpuStart && (await cpuTimes())
  const cpu = cpuStart && cpuEnd ? `  CPU ${Math.round(((cpuEnd.busy - cpuStart.busy) / (cpuEnd.total - cpuStart.total)) * 100)}%` : ''
  const pct = (p: number) => (times.length ? `${(times[Math.min(times.length - 1, Math.floor((times.length * p) / 100))] / 1000).toFixed(1)}s` : '-')
  console.log(
    `${name.padEnd(12, '　')} 成功 ${String(times.length).padStart(3)}/${students.length}  中位数 ${pct(50).padStart(6)}  P95 ${pct(95).padStart(6)}  最长 ${pct(100).padStart(6)}  整个环节 ${((performance.now() - start) / 1000).toFixed(1)}s${cpu}`,
  )
  for (const [message, count] of errors) console.log(`    失败 ${count} 次：${message}`)
}

/** 每秒查一次，直到 done 返回 true */
async function poll(read: () => Promise<boolean>, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs
  while (!(await read())) {
    if (Date.now() > deadline) throw new Error('超时')
    await Bun.sleep(1000)
  }
}

// ---- 准备：老师建班、导入学生、布置作业 ----
const teacher = new Client()
await teacher.login(process.env.TEACHER_USERNAME ?? 'admin', process.env.TEACHER_PASSWORD ?? 'admin')
const usernames = Array.from({ length: COUNT }, (_, i) => `loadtest${String(i + 1).padStart(3, '0')}`)
const { id: classId } = await teacher.request('POST', '/api/teacher/classes', { name: `压测班 ${new Date().toLocaleString('zh-CN')}` })
await teacher.request('POST', `/api/teacher/classes/${classId}/import`, {
  rows: usernames.map((username, i) => ({ username, name: `压测${i + 1}`, password: PASSWORD })),
})
const checks: string[] = await teacher.request('GET', `/api/samples/${encodeURIComponent(SAMPLE)}/checks`)
const template: SourceFile[] = await teacher.request('GET', `/api/samples/${encodeURIComponent(SAMPLE)}`)
const assignment = await teacher.request('POST', '/api/teacher/assignments', {
  classId,
  sampleId: SAMPLE,
  title: '压测',
  startMode: 'ui',
  template,
  scoring: { auto: checks.map(() => 10), manual: [] },
  deadline: null,
})
console.log(`${COUNT} 个学生，实验 ${SAMPLE}，服务器 ${BASE}，每个环节 ${SPREAD_MS / 1000} 秒内陆续开始\n`)

const students: Student[] = usernames.map((username) => ({ username, client: new Client(), files: [] }))

try {
  await phase('登录', students, (s) => s.client.login(s.username, PASSWORD))

  await phase('打开作业', students, async (s) => {
    const { template } = await s.client.request('GET', `/api/assignments/${assignment.id}`)
    s.files = template
    await s.client.request('PUT', `/api/works/${encodeURIComponent(`assignment:${assignment.id}`)}`, { files: s.files })
  })

  await phase('边写边检查', students, (s) => s.client.request('POST', '/api/language', { type: 'diagnostics', session: 'tab', files: s.files }))

  // 老师说"运行看看"：全班 SPREAD 内先后按 F5
  await phase('运行到窗体出现', students, async (s) => {
    const window = new RunWindow(s.client.token)
    s.window = window
    await window.opened()
    const shown = window.waitFor((m) => m.type === 'formShown')
    window.send({ type: 'run', files: s.files, sampleId: SAMPLE })
    window.form = ((await shown) as Extract<ServerMessage, { type: 'formShown' }>).form
  })

  if (!process.env.SAMPLE)
    await phase(
      '点按钮到实训台',
      students.filter((s) => s.window?.form),
      async (s) => {
        const window = s.window!
        window.action('com_lamp', { action: 'dropDown' })
        window.action('com_lamp', { action: 'select', index: 2 })
        window.action('btn_open', { action: 'click' })
        await Bun.sleep(300)
        // 设备消息由服务器记进实训台状态，再以 board 消息推给浏览器
        const lit = window.waitFor((m) => m.type === 'board' && m.state.zigbee[1] === true, 30_000)
        window.action('btn_lampOpen', { action: 'click' })
        await lit
      },
    )

  // 程序都还开着，再自己检查一遍（评分进程和正在运行的程序抢 CPU）
  await phase('自己检查', students, async (s) => {
    await s.client.request('POST', `/api/assignments/${assignment.id}/selfcheck`, { files: s.files })
    let state: any
    await poll(async () => (state = await s.client.request('GET', '/api/selfcheck'))?.status !== 'running')
    // 参考答案应该全部通过；机器太忙时定时器检查可能超时误判
    const failed = state.result?.results.filter((r: any) => !r.passed) ?? []
    if (state.status !== 'done' || failed.length > 0) throw new Error(`自测没通过：${failed.map((r: any) => r.message).join('；') || state.status}`)
  })

  for (const s of students) s.window?.close()

  await phase('提交到评完', students, async (s) => {
    await s.client.request('POST', `/api/assignments/${assignment.id}/submit`, { files: s.files })
    await poll(async () => {
      const latest = await s.client.request('GET', `/api/assignments/${assignment.id}/submission`)
      if (latest.status === 'error') throw new Error('评分出错')
      if (latest.status === 'done' && latest.autoScore !== checks.length * 10) throw new Error(`参考答案只得了 ${latest.autoScore} 分`)
      return latest.status === 'done'
    })
  })
} finally {
  for (const s of students) s.window?.close()
  if (!process.env.KEEP) {
    await teacher.request('DELETE', `/api/teacher/assignments/${assignment.id}`)
    for (const student of await teacher.request('GET', `/api/teacher/classes/${classId}/students`)) {
      await teacher.request('DELETE', `/api/teacher/students/${student.id}`)
    }
    await teacher.request('DELETE', `/api/teacher/classes/${classId}`)
  }
}

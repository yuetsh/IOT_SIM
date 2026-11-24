// 计算节点：同一个进程里起一个服务器端（/worker）和一个真的 worker，经 WebSocket 交给它编译运行、评分、语言服务；
// 用到数据库的程序留在服务器上；令牌、版本不对不接受；worker 断开、出错时改在本机做。
// 后面几组用假的服务器 / 假的 worker 制造故障：服务器不回应、启动前就被取消、worker 出错。
// 运行前先编译运行时：bun run build:runtime
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ControlNode, ServerMessage, SourceFile } from '@iot/shared'
import type { ServerWebSocket } from 'bun'
import { compileService } from '../src/compile-service'
import { config, ROOT } from '../src/config'
import { gradeFiles, languageRequest, usesDatabase } from '../src/dispatch'
import { parseChecks } from '../src/grading/checks'
import { languageService } from '../src/language-service'
import { RunSession } from '../src/run-session'
import { loadSample } from '../src/samples'
import { sqlService } from '../src/sql-service'
import { startWorker, type Worker } from '../src/worker'
import { workerHub, type WorkerSocketData } from '../src/worker-hub'
import { decodeChecks, encodeChecks, type HubMessage, MAX_PAYLOAD, VERSION_HEADER, type WorkerMessage } from '../src/worker-protocol'

const TOKEN = 'test-worker-token'
const VERSION = 'test-version'

let worker: Worker | undefined

/** 一个服务器端：/worker 交给 workerHub（和 index.ts 一样） */
function startHub() {
  const server = Bun.serve({
    port: 0,
    fetch(req, server) {
      if (new URL(req.url).pathname === '/worker') return workerHub.upgrade(req, server)
      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      data: {} as WorkerSocketData,
      maxPayloadLength: MAX_PAYLOAD,
      open: (ws: ServerWebSocket<WorkerSocketData>) => workerHub.open(ws),
      message: (ws: ServerWebSocket<WorkerSocketData>, raw) => workerHub.message(ws, raw),
      close: (ws: ServerWebSocket<WorkerSocketData>) => workerHub.close(ws),
    },
  })
  return { server, url: `ws://localhost:${server.port}/worker` }
}

let hub: ReturnType<typeof startHub>

beforeAll(() => {
  config.workerToken = TOKEN
  config.appVersion = VERSION
  hub = startHub()
})

afterAll(async () => {
  await worker?.stop()
  hub.server.stop(true)
  compileService.stop()
  languageService.stop()
  sqlService.stop()
  config.workerToken = ''
  config.appVersion = ''
})

/** 等到条件成立 */
async function until(condition: () => boolean, timeoutMs = 10000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('等待超时')
    await Bun.sleep(20)
  }
}

/** 一个浏览器会话：收到的消息都记下来 */
function session(dbDir?: string) {
  const messages: ServerMessage[] = []
  const run = new RunSession((m) => messages.push(m), dbDir ? async () => dbDir : undefined)
  const console = () => messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  const exited = () => until(() => messages.some((m) => m.type === 'exited'), 30000)
  return { run, messages, console, exited }
}

function program(body: string, usings = ''): SourceFile[] {
  return [
    {
      path: 'Program.cs',
      content: `using System;\nusing System.Linq;\n${usings}\nstatic class Program\n{\n    static void Main()\n    {\n${body}\n    }\n}\n`,
    },
  ]
}

function findByName(node: ControlNode, name: string): ControlNode | undefined {
  if (node.name === name) return node
  for (const child of node.children) {
    const found = findByName(child, name)
    if (found) return found
  }
}

test('评分规则（带正则）编码后原样还原', () => {
  const checks = parseChecks(`- title: t\n  steps:\n    - expect: { control: a, matches: '^\\d+$' }\n`)
  const back = decodeChecks(encodeChecks(checks))
  expect(back).toEqual(checks)
  expect(JSON.stringify(back)).toContain('matches')
})

test('用到数据库的程序：按代码里的 SqlConnection 等判断', () => {
  expect(usesDatabase(program('var c = new SqlConnection("");', 'using System.Data.SqlClient;'))).toBe(true)
  expect(usesDatabase(program('Console.WriteLine("SqlConnectionString");'))).toBe(false)
  expect(usesDatabase(program('Console.WriteLine(1);'))).toBe(false)
})

describe('连接', () => {
  test('令牌不对 401，版本不一样 409', async () => {
    const http = hub.url.replace('ws://', 'http://')
    const upgrade = { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' }
    const wrongToken = await fetch(http, { headers: { ...upgrade, authorization: 'Bearer nope', [VERSION_HEADER]: VERSION } })
    expect(wrongToken.status).toBe(401)
    const wrongVersion = await fetch(http, { headers: { ...upgrade, authorization: `Bearer ${TOKEN}`, [VERSION_HEADER]: 'old' } })
    expect(wrongVersion.status).toBe(409)
    expect(workerHub.available).toBe(false)
  })
})

describe.serial('交给计算节点', () => {
  beforeAll(async () => {
    worker = startWorker({ url: hub.url, token: TOKEN, version: VERSION })
    await worker.ready()
    await until(() => workerHub.available)
  })

  test('运行：编译、启动，输出经 worker 转回来', async () => {
    const runs = workerHub.stats.runs
    const s = session()
    await s.run.start(program('        Console.WriteLine("hello from worker " + (1 + 2));'))
    await s.exited()
    expect(workerHub.stats.runs).toBe(runs + 1)
    expect(s.messages.find((m) => m.type === 'compiled')).toMatchObject({ ok: true })
    expect(s.console()).toContain('hello from worker 3')
    expect(s.messages.find((m) => m.type === 'exited')).toMatchObject({ code: 0 })
  }, 30000)

  test('编译错误照常返回，不启动程序', async () => {
    const s = session()
    await s.run.start(program('        int x = "a";'))
    await until(() => s.messages.some((m) => m.type === 'status' && m.state === 'stopped'))
    const compiled = s.messages.find((m) => m.type === 'compiled')
    expect(compiled).toMatchObject({ ok: false })
    expect(compiled?.type === 'compiled' && compiled.diagnostics.some((d) => d.severity === 'error')).toBe(true)
  }, 30000)

  test('操作窗体：点按钮、输入文字经 worker 发给程序，提示框传回来', async () => {
    const s = session()
    await s.run.start((await loadSample('p1-t1-登录'))!)
    await until(() => s.messages.some((m) => m.type === 'formShown'), 30000)
    const form = s.messages.find((m) => m.type === 'formShown')!
    if (form.type !== 'formShown') throw new Error()
    const id = (name: string) => findByName(form.form, name)!.id
    s.run.input({ type: 'action', id: id('txtUserName'), action: 'text', value: 'nobody' })
    s.run.input({ type: 'action', id: id('txtPassword'), action: 'text', value: 'wrong' })
    s.run.input({ type: 'action', id: id('btnOk'), action: 'click' })
    await until(() => s.messages.some((m) => m.type === 'messageBox'))
    expect(s.messages.find((m) => m.type === 'messageBox')).toMatchObject({ text: expect.stringContaining('无效的密码或用户名') })
    await s.run.stop()
    expect(s.messages.at(-1)).toMatchObject({ type: 'status', state: 'stopped' })
  }, 30000)

  test('用到数据库的程序在服务器上运行，学生的库只在服务器上读写', async () => {
    const dbDir = resolve(ROOT, '.runs', 'test-worker-db')
    await rm(dbDir, { recursive: true, force: true })
    await mkdir(dbDir, { recursive: true })
    const usings = 'using System.Data.SqlClient;'
    const runs = workerHub.stats.runs
    const first = session(dbDir)
    await first.run.start(
      program(
        `        var master = new SqlConnection(@"Data Source=.;User ID=sa;Password=123456");
        master.Open();
        new SqlCommand("CREATE DATABASE 本机库", master).ExecuteNonQuery();
        master.Close();
        var conn = new SqlConnection(@"Data Source=.;Initial Catalog=本机库");
        conn.Open();
        new SqlCommand("CREATE TABLE t (v int)", conn).ExecuteNonQuery();
        new SqlCommand("INSERT INTO t VALUES (42)", conn).ExecuteNonQuery();
        conn.Close();
        Console.WriteLine("saved");`,
        usings,
      ),
    )
    await first.exited()
    expect(first.console()).toContain('saved')
    expect(await readdir(dbDir)).toContain('本机库.db')

    const second = session(dbDir)
    await second.run.start(
      program(
        `        var conn = new SqlConnection(@"Data Source=.;Initial Catalog=本机库");
        conn.Open();
        Console.WriteLine("value=" + new SqlCommand("SELECT v FROM t", conn).ExecuteScalar());`,
        usings,
      ),
    )
    await second.exited()
    expect(second.console()).toContain('value=42')
    // 两次都没有交给 worker
    expect(workerHub.stats.runs).toBe(runs)
  }, 60000)

  test('评分：整份交给 worker，结果和本机一样；用到数据库的实验也是（用实验的初始库，不碰学生的库）', async () => {
    for (const id of ['p1-t1-登录', 'p6-t2-存储环境数据']) {
      const grades = workerHub.stats.grades
      const checks = parseChecks(await Bun.file(resolve(ROOT, 'samples', id, 'checks.yaml')).text())
      const result = await gradeFiles((await loadSample(id))!, checks, id)
      expect(workerHub.stats.grades).toBe(grades + 1)
      expect(result.compiled).toBe(true)
      expect(result.results.filter((r) => !r.passed)).toEqual([])
    }
  }, 90000)

  test('语言服务：边写边检查交给 worker', async () => {
    const count = workerHub.stats.language
    const reply = await languageRequest({ type: 'diagnostics', session: 'worker-test', files: program('        int x = "a";') })
    expect(workerHub.stats.language).toBe(count + 1)
    expect(JSON.stringify(reply)).toContain('CS0029')
  }, 30000)

  test('程序一次输出太长（控制字符转义后变成 6 倍）：这一行丢掉并提示，和 worker 的连接不断', async () => {
    const s = session()
    await s.run.start(program('        Console.WriteLine(new string((char)1, 1000000));\n        Console.WriteLine("after");'))
    await s.exited()
    expect(s.messages.some((m) => m.type === 'serverError' && m.message.includes('太长'))).toBe(true)
    expect(s.console()).toContain('after')
    expect(workerHub.available).toBe(true)
  }, 60000)

  test('程序一直刷屏：输出被限速，worker 连接不断，别的学生的程序照常运行', async () => {
    const flood = session()
    await flood.run.start(program("        var chunk = new string('A', 1000);\n        while (true) Console.Write(chunk);"))
    await until(() => flood.messages.some((m) => m.type === 'status' && m.state === 'running'), 30000)
    const start = Date.now()
    await Bun.sleep(3000)
    const other = session()
    await other.run.start(program('        Console.WriteLine("still fine");'))
    await other.exited()
    expect(other.console()).toContain('still fine')
    const seconds = (Date.now() - start) / 1000
    // 先冲 4 MB，之后每秒 512 KB（再留一点余量）
    expect(flood.console().length).toBeLessThan(4 * 1024 * 1024 + seconds * 600 * 1024)
    expect(workerHub.available).toBe(true)
    await flood.run.stop()
  }, 60000)

  test('网络突然断开：正在运行的程序结束并提示，之后改在本机运行', async () => {
    const s = session()
    await s.run.start(program('        System.Threading.Thread.Sleep(60000);'))
    await until(() => s.messages.some((m) => m.type === 'status' && m.state === 'running'), 30000)
    // 服务器这边掐断连接（worker.stop() 是正常关闭）
    hub.server.stop(true)
    await s.exited()
    expect(s.console()).toContain('断开了连接')
    await until(() => !workerHub.available)

    const runs = workerHub.stats.runs
    const local = session()
    await local.run.start(program('        Console.WriteLine("local again");'))
    await local.exited()
    expect(local.console()).toContain('local again')
    expect(workerHub.stats.runs).toBe(runs)
    await worker!.stop()
    worker = undefined
  }, 60000)
})

describe.serial('假的服务器：worker 这边的故障处理', () => {
  test('服务器不回应（网络半断）：worker 很快放弃这条连接并重连', async () => {
    let opens = 0
    const fake = Bun.serve({
      port: 0,
      fetch: (req, server) => (server.upgrade(req) ? undefined : new Response('', { status: 400 })),
      websocket: { open: () => void opens++, message: () => {} },
    })
    const w = startWorker({ url: `ws://localhost:${fake.port}/worker`, token: TOKEN, version: VERSION, pingMs: 100, deadMs: 400 })
    try {
      // 400 毫秒没回应就放弃，2 秒后重连
      await until(() => opens >= 2, 6000)
    } finally {
      await w.stop()
      fake.stop(true)
    }
  }, 15000)

  test('还在编译时服务器就让结束（服务器等启动超时了）：启动后马上结束，不留在 worker 上', async () => {
    const received: WorkerMessage[] = []
    const fake = Bun.serve({
      port: 0,
      fetch: (req, server) => (server.upgrade(req) ? undefined : new Response('', { status: 400 })),
      websocket: {
        open(ws) {
          const files = program('        System.Threading.Thread.Sleep(60000);')
          ws.send(JSON.stringify({ t: 'run', id: 1, files, env: {}, maxMinutes: 60 } satisfies HubMessage))
          ws.send(JSON.stringify({ t: 'kill', id: 1 } satisfies HubMessage))
        },
        message: (_, raw) => void received.push(JSON.parse(String(raw))),
      },
    })
    const w = startWorker({ url: `ws://localhost:${fake.port}/worker`, token: TOKEN, version: VERSION })
    try {
      await until(() => received.some((m) => m.t === 'exit'), 30000)
      expect(received.find((m) => m.t === 'started')).toMatchObject({ id: 1, program: true, ok: true })
    } finally {
      await w.stop()
      fake.stop(true)
    }
  }, 40000)
})

describe.serial('假的 worker：服务器这边的故障处理', () => {
  let fakeHub: ReturnType<typeof startHub>
  let fakeWorker: WebSocket | undefined

  /** 连一个假 worker，收到服务器的消息时交给 onMessage 回复 */
  async function connectFake(onMessage: (message: HubMessage, reply: (m: WorkerMessage) => void) => void) {
    const ws = new WebSocket(fakeHub.url, { headers: { authorization: `Bearer ${TOKEN}`, [VERSION_HEADER]: VERSION } } as unknown as string[])
    ws.onmessage = (e) => onMessage(JSON.parse(String(e.data)), (m) => ws.send(JSON.stringify(m)))
    await until(() => workerHub.available)
    fakeWorker = ws
  }

  beforeAll(() => {
    fakeHub = startHub()
  })
  afterAll(() => {
    fakeWorker?.close()
    fakeHub.server.stop(true)
  })

  test('worker 那边出错（比如磁盘满）：改在本机运行、本机评分', async () => {
    await connectFake((m, reply) => {
      if (m.t === 'run') reply({ t: 'startFailed', id: m.id, message: 'ENOSPC: no space left on device' })
      if (m.t === 'grade') reply({ t: 'gradeFailed', id: m.id, message: 'ENOSPC: no space left on device' })
    })
    const s = session()
    await s.run.start(program('        Console.WriteLine("ran locally");'))
    await s.exited()
    expect(s.console()).toContain('ran locally')

    const id = 'p1-t1-登录'
    const checks = parseChecks(await Bun.file(resolve(ROOT, 'samples', id, 'checks.yaml')).text())
    const result = await gradeFiles((await loadSample(id))!, checks, id)
    expect(result.results.filter((r) => !r.passed)).toEqual([])
    fakeWorker!.close()
    await until(() => !workerHub.available)
  }, 60000)

  test('程序启动之后 worker 那边出错：当作程序结束，不会一直显示"运行中"', async () => {
    await connectFake((m, reply) => {
      if (m.t !== 'run') return
      reply({ t: 'started', id: m.id, program: true, ok: true, diagnostics: [], ms: 1 })
      reply({ t: 'out', id: m.id, line: JSON.stringify({ type: 'started', ms: 1 }) })
      setTimeout(() => reply({ t: 'startFailed', id: m.id, message: 'boom' }), 100)
    })
    const s = session()
    await s.run.start(program('        Console.WriteLine(1);'))
    await s.exited()
    expect(s.console()).toContain('断开了连接')
    // 停止、再运行都不会卡住
    await s.run.stop()
    fakeWorker!.close()
    await until(() => !workerHub.available)
  }, 30000)
})

// 计算节点：同一个进程里起一个服务器端（/worker）和一个真的 worker，经 WebSocket 交给它编译运行、评分、语言服务；
// 学生的数据库改动写回服务器；令牌、版本不对不接受；worker 断开时正在运行的程序结束，之后改在本机运行。
// 运行前先编译运行时：bun run build:runtime
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ControlNode, ServerMessage, SourceFile } from '@iot/shared'
import type { ServerWebSocket } from 'bun'
import { compileService } from '../src/compile-service'
import { config, ROOT } from '../src/config'
import { gradeFiles, languageRequest } from '../src/dispatch'
import { parseChecks } from '../src/grading/checks'
import { languageService } from '../src/language-service'
import { RunSession } from '../src/run-session'
import { loadSample } from '../src/samples'
import { sqlService } from '../src/sql-service'
import { startWorker, type Worker } from '../src/worker'
import { workerHub, type WorkerSocketData } from '../src/worker-hub'
import { decodeChecks, diffDbFiles, encodeChecks, VERSION_HEADER } from '../src/worker-protocol'

const TOKEN = 'test-worker-token'
const VERSION = 'test-version'

let server: ReturnType<typeof Bun.serve>
let worker: Worker | undefined
let url: string

beforeAll(() => {
  config.workerToken = TOKEN
  config.appVersion = VERSION
  server = Bun.serve({
    port: 0,
    fetch(req, server) {
      if (new URL(req.url).pathname === '/worker') return workerHub.upgrade(req, server)
      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      data: {} as WorkerSocketData,
      open: (ws: ServerWebSocket<WorkerSocketData>) => workerHub.open(ws),
      message: (ws: ServerWebSocket<WorkerSocketData>, raw) => workerHub.message(ws, raw),
      close: (ws: ServerWebSocket<WorkerSocketData>) => workerHub.close(ws),
    },
  })
  url = `ws://localhost:${server.port}/worker`
})

afterAll(async () => {
  await worker?.stop()
  server.stop(true)
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

async function connectWorker() {
  worker = startWorker({ url, token: TOKEN, version: VERSION })
  await worker.ready()
  await until(() => workerHub.available)
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
  const expectation = JSON.stringify(back).includes('matches')
  expect(expectation).toBe(true)
})

test('数据库目录前后比较：新增、改动给内容，删掉的给 null，没变不给', () => {
  expect(diffDbFiles({ a: 'x', b: 'y', c: 'z' }, { a: 'x', b: 'Y', d: 'w' })).toEqual({ b: 'Y', d: 'w', c: null })
  expect(diffDbFiles({ a: 'x' }, { a: 'x' })).toBeNull()
})

describe('连接', () => {
  test('令牌不对 401，版本不一样 409', async () => {
    const http = url.replace('ws://', 'http://')
    const upgrade = { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' }
    const wrongToken = await fetch(http, { headers: { ...upgrade, authorization: 'Bearer nope', [VERSION_HEADER]: VERSION } })
    expect(wrongToken.status).toBe(401)
    const wrongVersion = await fetch(http, { headers: { ...upgrade, authorization: `Bearer ${TOKEN}`, [VERSION_HEADER]: 'old' } })
    expect(wrongVersion.status).toBe(409)
    expect(workerHub.available).toBe(false)
  })
})

describe.serial('交给计算节点', () => {
  beforeAll(connectWorker)

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

  test('学生的数据库：在 worker 上建库写数据，结束后写回服务器，下次运行还在', async () => {
    const dbDir = resolve(ROOT, '.runs', 'test-worker-db')
    await rm(dbDir, { recursive: true, force: true })
    await mkdir(dbDir, { recursive: true })
    const usings = 'using System.Data.SqlClient;'
    const first = session(dbDir)
    await first.run.start(
      program(
        `        var master = new SqlConnection(@"Data Source=.;User ID=sa;Password=123456");
        master.Open();
        new SqlCommand("CREATE DATABASE 远程库", master).ExecuteNonQuery();
        master.Close();
        var conn = new SqlConnection(@"Data Source=.;Initial Catalog=远程库");
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
    expect(await readdir(dbDir)).toContain('远程库.db')

    const second = session(dbDir)
    await second.run.start(
      program(
        `        var conn = new SqlConnection(@"Data Source=.;Initial Catalog=远程库");
        conn.Open();
        Console.WriteLine("value=" + new SqlCommand("SELECT v FROM t", conn).ExecuteScalar());`,
        usings,
      ),
    )
    await second.exited()
    expect(second.console()).toContain('value=42')
  }, 60000)

  test('评分：整份交给 worker，结果和本机一样', async () => {
    const grades = workerHub.stats.grades
    const id = 'p1-t1-登录'
    const checks = parseChecks(await Bun.file(resolve(ROOT, 'samples', id, 'checks.yaml')).text())
    const result = await gradeFiles((await loadSample(id))!, checks, id)
    expect(workerHub.stats.grades).toBe(grades + 1)
    expect(result.compiled).toBe(true)
    expect(result.results.filter((r) => !r.passed)).toEqual([])
  }, 60000)

  test('语言服务：边写边检查交给 worker', async () => {
    const count = workerHub.stats.language
    const reply = await languageRequest({ type: 'diagnostics', session: 'worker-test', files: program('        int x = "a";') })
    expect(workerHub.stats.language).toBe(count + 1)
    expect(JSON.stringify(reply)).toContain('CS0029')
  }, 30000)

  test('worker 断开：正在运行的程序结束并提示，之后改在本机运行', async () => {
    const s = session()
    await s.run.start(program('        System.Threading.Thread.Sleep(60000);'))
    await until(() => s.messages.some((m) => m.type === 'status' && m.state === 'running'), 30000)
    // 模拟网络突然断开：服务器这边掐断连接（worker.stop() 是正常关闭，会先把程序结束的消息发回来）
    server.stop(true)
    await s.exited()
    expect(s.console()).toContain('断开了连接')
    await until(() => !workerHub.available)

    const runs = workerHub.stats.runs
    const local = session()
    await local.run.start(program('        Console.WriteLine("local again");'))
    await local.exited()
    expect(local.console()).toContain('local again')
    expect(workerHub.stats.runs).toBe(runs)
  }, 60000)
})

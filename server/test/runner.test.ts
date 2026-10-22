// 端到端测试：直接启动 C# 运行器，模拟浏览器操作，检查教材示例工程的行为。
// 运行前先编译运行时：bun run build:runtime
import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { cp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ControlNode, RunnerInput, RunnerMessage } from '@iot/shared'
import { compileService } from '../src/compile-service'
import { ROOT, RUNNER_DLL } from '../src/runner-process'

class Runner {
  readonly messages: RunnerMessage[] = []
  private proc?: Bun.Subprocess<'pipe', 'pipe', 'inherit'>
  private waiters: { match: (m: RunnerMessage) => boolean; resolve: (m: RunnerMessage) => void }[] = []

  /** 与服务器相同的流程：先由编译服务编译，成功后启动运行进程 */
  static async start(projectDir: string) {
    const runner = new Runner()
    const compiled = await compileService.compile(projectDir)
    runner.receive({ type: 'compiled', ...compiled })
    if (compiled.ok) {
      runner.proc = Bun.spawn(['dotnet', RUNNER_DLL, 'run', projectDir], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
      void runner.read()
    }
    return runner
  }

  private receive(message: RunnerMessage) {
    this.messages.push(message)
    this.waiters = this.waiters.filter((w) => {
      if (!w.match(message)) return true
      w.resolve(message)
      return false
    })
  }

  private async read() {
    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of this.proc!.stdout) {
      buffer += decoder.decode(chunk, { stream: true })
      let index: number
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 1)
        if (!line.trim()) continue
        this.receive(JSON.parse(line) as RunnerMessage)
      }
    }
  }

  /** 只等待从现在起新收到的消息（不算已经收到的） */
  next<T extends RunnerMessage['type']>(
    type: T,
    match: (m: Extract<RunnerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 15000,
  ): Promise<Extract<RunnerMessage, { type: T }>> {
    const from = this.messages.length
    return this.waitFor(type, (m) => this.messages.indexOf(m) >= from && match(m), timeoutMs)
  }

  /** 等待下一条满足条件的消息（已经收到的也算） */
  waitFor<T extends RunnerMessage['type']>(
    type: T,
    match: (m: Extract<RunnerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 15000,
  ): Promise<Extract<RunnerMessage, { type: T }>> {
    const isMatch = (m: RunnerMessage) => m.type === type && match(m as Extract<RunnerMessage, { type: T }>)
    const existing = this.messages.find(isMatch)
    if (existing) return Promise.resolve(existing as Extract<RunnerMessage, { type: T }>)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`等待 ${type} 超时`)), timeoutMs)
      this.waiters.push({
        match: isMatch,
        resolve: (m) => {
          clearTimeout(timer)
          resolve(m as Extract<RunnerMessage, { type: T }>)
        },
      })
    })
  }

  send(message: RunnerInput) {
    this.proc!.stdin.write(`${JSON.stringify(message)}\n`)
    this.proc!.stdin.flush()
  }

  kill() {
    this.proc?.kill()
  }
}

function findByName(node: ControlNode, name: string): ControlNode {
  if (node.name === name) return node
  for (const child of node.children) {
    const found = findByName(child, name)
    if (found.name === name) return found
  }
  return { id: '', type: '', name: '', props: {}, children: [] }
}

/** 编译产物写在工程目录里，所以把示例复制到临时目录再编译 */
async function prepareSample(id: string) {
  const dir = resolve(ROOT, '.runs', `test-${id}`)
  await rm(dir, { recursive: true, force: true })
  await cp(resolve(ROOT, 'samples', id), dir, { recursive: true })
  return dir
}

/** 启动示例并等窗体显示；返回按控件名查 id 的函数 */
async function startSample(id: string) {
  runner = await Runner.start(await prepareSample(id))
  const compiled = await runner.waitFor('compiled')
  expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  const { form } = await runner.waitFor('formShown')
  return { runner, form, id: (name: string) => findByName(form, name).id }
}

const ANALOG_DEFAULT = [25, 60, 500, 101, 60, 600, 3]
const DIGITAL_OFF = [false, false, false, false]

let runner: Runner | undefined
afterEach(() => runner?.kill())
afterAll(() => compileService.stop())

test('项目2 任务1：选串口、打开、推送文字到 LED 屏', async () => {
  runner = await Runner.start(await prepareSample('p2-t1-LED显示屏'))
  const compiled = await runner.waitFor('compiled')
  expect(compiled.diagnostics).toEqual([])
  const { form } = await runner.waitFor('formShown')
  expect(form.props.Text).toBe('LED显示屏')

  const id = (name: string) => findByName(form, name).id
  const comPort = id('com_Port')

  // 先推送、不打开串口：教材约定返回 "Error:发送失败"，学生代码弹出 MessageBox
  runner.send({ type: 'action', id: id('txt_SendText'), action: 'text', value: '欢迎学习物联网' })
  runner.send({ type: 'action', id: id('btn_Send'), action: 'click' })
  const box = await runner.waitFor('messageBox')
  expect(box.text).toBe('Error:发送失败')
  runner.send({ type: 'reply', requestId: box.requestId, result: 'OK' })

  // 点下拉框：Click 事件里填充串口列表
  runner.send({ type: 'action', id: comPort, action: 'dropDown' })
  const items = await runner.waitFor('patch', (m) => m.changes.some((c) => c.id === comPort && c.prop === 'Items'))
  const ports = items.changes.findLast((c) => c.id === comPort && c.prop === 'Items')!.value as string[]
  expect(ports).toContain('COM5')

  runner.send({ type: 'action', id: comPort, action: 'select', index: ports.indexOf('COM5') })
  runner.send({ type: 'action', id: id('btn_Open'), action: 'click' })
  runner.send({ type: 'action', id: id('btn_Send'), action: 'click' })

  const device = await runner.waitFor('device', (m) => m.device === 'led')
  expect(device.data).toBe('欢迎学习物联网')
  const led = id('led')
  const ledPatch = await runner.waitFor('patch', (m) => m.changes.some((c) => c.id === led && c.prop === 'LedText'))
  expect(ledPatch.changes.find((c) => c.id === led)!.value).toBe('欢迎学习物联网')

  // 关闭主窗体：程序结束
  runner.send({ type: 'action', id: form.id, action: 'close' })
  await runner.waitFor('formClosed')
}, 30000)

test('编译错误：书上常见的 True 大写给出中文提示', async () => {
  const dir = resolve(ROOT, '.runs/test-true')
  const sample = resolve(ROOT, 'samples/p2-t1-LED显示屏')
  for (const name of ['Program.cs', 'Form1.Designer.cs']) await Bun.write(`${dir}/${name}`, Bun.file(`${sample}/${name}`))
  const form1 = await Bun.file(`${sample}/Form1.cs`).text()
  await Bun.write(`${dir}/Form1.cs`, form1.replace('private void btn_Open_Click(object sender, EventArgs e)\n        {', 'private void btn_Open_Click(object sender, EventArgs e)\n        {\n            bool IsOpen = True;'))

  runner = await Runner.start(dir)
  const compiled = await runner.waitFor('compiled')
  expect(compiled.ok).toBe(false)
  const error = compiled.diagnostics.find((d) => d.code === 'CS0103')
  expect(error?.message).toContain('True')
  expect(error?.hint).toContain('小写')
}, 30000)

test('项目2 任务2：温度读数来自实训台，滑块变化后再次获取得到新值', async () => {
  const { runner, id } = await startSample('p2-t2-模拟量采集')
  const port = id('com_port')
  // 串口列表在 Load 里就已填好
  runner.send({ type: 'action', id: port, action: 'select', index: 1 })
  runner.send({ type: 'action', id: id('btn_Open'), action: 'click' })
  const textOf = (name: string) =>
    runner.next('patch', (m) => m.changes.some((c) => c.id === id(name) && c.prop === 'Text')).then(
      (m) => m.changes.findLast((c) => c.id === id(name) && c.prop === 'Text')!.value,
    )

  let temperature = textOf('txt_temperature')
  runner.send({ type: 'action', id: id('btn_get'), action: 'click' })
  expect(await temperature).toBe('25')

  runner.send({ type: 'board', analog: [31, 60, 300, 101, 60, 600, 3], digital: DIGITAL_OFF })
  temperature = textOf('txt_temperature')
  const light = textOf('txt_light')
  runner.send({ type: 'action', id: id('btn_get'), action: 'click' })
  expect(await temperature).toBe('31')
  expect(await light).toBe('300')
}, 30000)

test('项目3 任务1：单选按钮切换，事件顺序与 WinForms 一致，最终灯的状态正确', async () => {
  const { runner, id } = await startSample('p3-t1-ZigBee路灯')
  const lamp = id('lamp1')

  // 串口没打开时控制无效：没有继电器动作，但界面上的灯照样会亮（学生能看出两者不一致）
  runner.send({ type: 'action', id: id('rb_Open'), action: 'click' })
  await runner.waitFor('patch', (m) => m.changes.some((c) => c.id === lamp && c.prop === 'IsOn' && c.value === true))
  expect(runner.messages.some((m) => m.type === 'device')).toBe(false)

  runner.send({ type: 'action', id: id('com_port'), action: 'select', index: 3 })
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })

  // 选"关"：先触发"开"的 CheckedChanged（又开一次），再触发"关"的 CheckedChanged，最终关灯
  const relayOff = runner.next('device', (m) => m.device === 'zigbee' && (m.data as number[])[1] === 0)
  runner.send({ type: 'action', id: id('rb_Close'), action: 'click' })
  const devices: unknown[] = []
  await relayOff
  for (const m of runner.messages) if (m.type === 'device') devices.push(m.data)
  expect(devices).toEqual([
    [1, 1],
    [1, 0],
  ])
}, 30000)

test('项目3 任务2：勾选人体开关后，有人经过时 5 秒内路灯打开', async () => {
  const { runner, id } = await startSample('p3-t2-人体红外ZigBee联动')
  runner.send({ type: 'action', id: id('com_lamp'), action: 'select', index: 3 })
  runner.send({ type: 'action', id: id('com_environment'), action: 'select', index: 2 })
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })

  // 复选框的 Click 里读取 Checked：此时 Checked 必须已经是 true
  const disabled = runner.next('patch', (m) => m.changes.some((c) => c.id === id('btn_lampOpen') && c.prop === 'Enabled' && c.value === false))
  runner.send({ type: 'action', id: id('ch_bodyInfrared'), action: 'click' })
  await disabled

  runner.send({ type: 'board', analog: ANALOG_DEFAULT, digital: [true, false, false, false] })
  const on = await runner.next('device', (m) => m.device === 'zigbee', 7000)
  expect(on.data).toEqual([1, 1])
}, 30000)

test('项目1 任务1：多窗体——打开增加用户窗体、添加用户、关闭后登录成功，可以再次打开', async () => {
  const { runner, form: login, id } = await startSample('p1-t1-登录')
  expect(login.props.Text).toBe('登录')

  runner.send({ type: 'action', id: id('btnAdd'), action: 'click' })
  const { form: addUser } = await runner.waitFor('formShown', (m) => m.form.props.Text === '增加用户')
  const addId = (name: string) => findByName(addUser, name).id
  runner.send({ type: 'action', id: addId('txtNewUser1'), action: 'text', value: 'admin' })
  runner.send({ type: 'action', id: addId('txtPass1'), action: 'text', value: '123' })
  runner.send({ type: 'action', id: addId('txtPass2'), action: 'text', value: '123' })
  runner.send({ type: 'action', id: addId('btnOk'), action: 'click' })
  await runner.waitFor('formClosed', (m) => m.formId === addUser.id)

  runner.send({ type: 'action', id: id('txtUserName'), action: 'text', value: 'admin' })
  runner.send({ type: 'action', id: id('txtPassword'), action: 'text', value: '123' })
  runner.send({ type: 'action', id: id('btnOk'), action: 'click' })
  const box = await runner.waitFor('messageBox')
  expect(box.text).toBe('登录成功，欢迎进入！')
  runner.send({ type: 'reply', requestId: box.requestId, result: 'OK' })

  // 再次打开增加用户窗体：每次新建实例，不会因为上一个已释放而出错
  runner.send({ type: 'action', id: id('btnAdd'), action: 'click' })
  const second = await runner.next('formShown', (m) => m.form.props.Text === '增加用户')
  expect(second.form.id).not.toBe(addUser.id)
  expect(runner.messages.some((m) => m.type === 'exception')).toBe(false)
}, 30000)

describe('所有示例都能编译通过', async () => {
  const ids = (await Array.fromAsync(new Bun.Glob('*/meta.json').scan({ cwd: resolve(ROOT, 'samples') }))).map((p) => p.split('/')[0]).sort()
  for (const id of ids) {
    test(id, async () => {
      const result = await compileService.compile(await prepareSample(id))
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    }, 30000)
  }
})

test('项目1 任务2：计算器（装箱拆箱）和多态', async () => {
  const { runner, id } = await startSample('p1-t2-面向对象特性')
  const textOf = (name: string) =>
    runner.next('patch', (m) => m.changes.some((c) => c.id === id(name) && c.prop === 'Text')).then(
      (m) => m.changes.findLast((c) => c.id === id(name) && c.prop === 'Text')!.value,
    )
  runner.send({ type: 'action', id: id('txtNum1'), action: 'text', value: '7' })
  runner.send({ type: 'action', id: id('txtNum2'), action: 'text', value: '2' })
  runner.send({ type: 'action', id: id('cmboxType'), action: 'select', index: 3 })
  const result = textOf('txtResult')
  runner.send({ type: 'action', id: id('btnCalculate'), action: 'click' })
  expect(await result).toBe('3.5')

  const display = textOf('txtDispaly')
  runner.send({ type: 'action', id: id('btnDisplay'), action: 'click' })
  expect(await display).toBe('张三说的是汉语！\r\n李四说的是汉语！\r\nMary说的是英语！\r\nJimmy说的是英语！\r\n')
}, 30000)

/** 选 COM3、点"开启"，等定时器读到实训台上的传感器 */
async function openAdam4150(runner: Runner, id: (name: string) => string) {
  runner.send({ type: 'action', id: id('com_port'), action: 'select', index: 2 })
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })
}

test('项目4 任务1：红外对射被遮挡时显示"发现入侵"', async () => {
  const { runner, id } = await startSample('p4-t1-红外对射')
  await openAdam4150(runner, id)
  const even = (value: string) => runner.next('patch', (m) => m.changes.some((c) => c.id === id('txt_even') && c.value === value), 5000)
  await even('正常')
  runner.send({ type: 'board', analog: ANALOG_DEFAULT, digital: [false, false, false, true] })
  await even('发现入侵')
}, 30000)

test('项目4 任务3：开报警灯——实训台 DO0 动作，窗体上的报警灯亮', async () => {
  const { runner, id } = await startSample('p4-t3-报警灯')
  await openAdam4150(runner, id)
  const relay = runner.next('device', (m) => m.device === 'adam4150')
  const lamp = runner.next('patch', (m) => m.changes.some((c) => c.id === id('alarm1') && c.prop === 'IsOn' && c.value === true))
  runner.send({ type: 'action', id: id('btn_alarmOpen'), action: 'click' })
  expect((await relay).data).toEqual([0, 1])
  await lamp
}, 30000)

test('项目5 任务1：有火焰时显示"发现火情！"', async () => {
  const { runner, id } = await startSample('p5-t1-火焰')
  await openAdam4150(runner, id)
  runner.send({ type: 'board', analog: ANALOG_DEFAULT, digital: [false, true, false, false] })
  await runner.next('patch', (m) => m.changes.some((c) => c.id === id('txt_even') && c.value === '发现火情！'), 5000)
}, 30000)

// 端到端测试：直接启动 C# 运行器，模拟浏览器操作，检查教材示例工程的行为。
// 运行前先编译运行时：bun run build:runtime
import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ControlNode, RunnerInput, RunnerMessage } from '@iot/shared'
import { wallNow } from '../src/board'
import { compileService } from '../src/compile-service'
import { config, ROOT } from '../src/config'
import { cpuLimitMessage, runCommand } from '../src/sandbox'

class Runner {
  readonly messages: RunnerMessage[] = []
  private proc?: Bun.Subprocess<'pipe', 'pipe', 'inherit'>
  private reading?: Promise<void>
  private waiters: { match: (m: RunnerMessage) => boolean; resolve: (m: RunnerMessage) => void }[] = []

  /** 与服务器相同的流程：先由编译服务编译，成功后启动运行进程 */
  static async start(projectDir: string, dbDir?: string) {
    const runner = new Runner()
    const compiled = await compileService.compile(projectDir)
    runner.receive({ type: 'compiled', ...compiled })
    if (compiled.ok) {
      const { cmd, env } = runCommand(projectDir, {}, dbDir)
      runner.proc = Bun.spawn(cmd, { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit', env })
      runner.reading = runner.read()
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

  /** 等程序自己结束、输出全部读完 */
  async finished() {
    await this.proc!.exited
    await this.reading
    return { code: this.proc!.exitCode, signal: this.proc!.signalCode }
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
  await Bun.write(
    `${dir}/Form1.cs`,
    form1.replace(
      'private void btn_Open_Click(object sender, EventArgs e)\n        {',
      'private void btn_Open_Click(object sender, EventArgs e)\n        {\n            bool IsOpen = True;',
    ),
  )

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
  runner.send({ type: 'action', id: port, action: 'select', index: 0 })
  runner.send({ type: 'action', id: id('btn_Open'), action: 'click' })
  const textOf = (name: string) =>
    runner
      .next('patch', (m) => m.changes.some((c) => c.id === id(name) && c.prop === 'Text'))
      .then((m) => m.changes.findLast((c) => c.id === id(name) && c.prop === 'Text')!.value)

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

  runner.send({ type: 'action', id: id('com_port'), action: 'select', index: 2 })
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
  runner.send({ type: 'action', id: id('com_lamp'), action: 'select', index: 2 })
  runner.send({ type: 'action', id: id('com_environment'), action: 'select', index: 1 })
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
    test(
      id,
      async () => {
        const result = await compileService.compile(await prepareSample(id))
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
      },
      30000,
    )
  }
})

test('项目1 任务2：计算器（装箱拆箱）和多态', async () => {
  const { runner, id } = await startSample('p1-t2-面向对象特性')
  const textOf = (name: string) =>
    runner
      .next('patch', (m) => m.changes.some((c) => c.id === id(name) && c.prop === 'Text'))
      .then((m) => m.changes.findLast((c) => c.id === id(name) && c.prop === 'Text')!.value)
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
  runner.send({ type: 'action', id: id('com_port'), action: 'select', index: 1 })
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

test('项目4 任务2：打开摄像机显示画面，转动后画面变化，有人翻墙时画面变化，拍照保存到 Camera 文件夹', async () => {
  const { runner, id } = await startSample('p4-t2-网络摄像机')
  const pictures = () => runner.next('patch', (m) => m.changes.some((c) => c.id === id('pictureBox1') && c.prop === 'Image'), 5000)
  const imageOf = (patch: Extract<RunnerMessage, { type: 'patch' }>) =>
    patch.changes.find((c) => c.id === id('pictureBox1') && c.prop === 'Image')!.value as { key: string; width: number; height: number }

  runner.send({ type: 'action', id: id('txt_ip'), action: 'text', value: '192.168.2.50' })
  const first = pictures()
  const cameraOn = runner.next('device', (m) => m.device === 'camera' && m.action === 'on' && m.data === true)
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })
  await cameraOn
  const center = imageOf(await first)
  expect(center).toMatchObject({ width: 640, height: 480 })
  // 图片数据先于（或随）属性变化发给浏览器，同一张图只发一次
  const sent = runner.messages.filter((m) => m.type === 'blob' && m.key === center.key)
  expect(sent.length).toBe(1)
  expect(sent[0]).toMatchObject({ mime: 'image/jpeg' })

  const up = pictures()
  const pan = runner.next('device', (m) => m.device === 'camera' && m.action === 'pan')
  runner.send({ type: 'action', id: id('btn_up'), action: 'click' })
  expect((await pan).data).toEqual([3, 0])
  expect(imageOf(await up).key).not.toBe(center.key)

  const intruder = pictures()
  runner.send({ type: 'board', analog: ANALOG_DEFAULT, digital: [false, false, false, true] })
  const withIntruder = imageOf(await intruder)

  const saved = runner.next('imageSaved')
  runner.send({ type: 'action', id: id('btn_camera'), action: 'click' })
  const photo = await saved
  expect(photo.path).toMatch(/^Camera\/\d{8}_\d{2} \d{2} \d{2}\.jpg$/)
  expect(photo.image).toBe(withIntruder.key)
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

test('项目5 任务2：线程实时显示烟雾数据；关闭时线程挂起、再打开时继续；关闭窗体后程序正常结束', async () => {
  const { runner, id, form } = await startSample('p5-t2-烟雾')
  // 改写后的代码不再用过时的 API，不应出现"已过时"警告
  expect((await runner.waitFor('compiled')).diagnostics).toEqual([])
  const changed = (name: string, match: (value: unknown) => boolean = () => true, timeout = 5000) =>
    runner.next('patch', (m) => m.changes.some((c) => c.id === id(name) && match(c.value)), timeout)
  const normal = changed('txt_even', (v) => v === '正常')
  await openAdam4150(runner, id)
  await normal
  runner.send({ type: 'board', analog: ANALOG_DEFAULT, digital: [false, false, true, false] })
  await changed('txt_even', (v) => v === '发现烟情')

  // 关闭：线程挂起，时间不再更新
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })
  await changed('btn_open', (v) => v === '开启')
  await expect(changed('txt_time', undefined, 3000)).rejects.toThrow('超时')

  // 再打开：线程继续
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })
  await changed('txt_time', undefined, 3000)

  // 挂起后关闭窗体：先 Resume 再 Abort，程序正常结束
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })
  await changed('btn_open', (v) => v === '开启')
  runner.send({ type: 'action', id: form.id, action: 'close' })
  expect((await runner.finished()).code).toBe(0)
  expect(runner.messages.filter((m) => m.type === 'exception')).toEqual([])
}, 30000)

test('项目5 任务2：照书上直接 Abort 挂起的线程，和 .NET Framework 一样报错，并提示先 Resume', async () => {
  const dir = await prepareSample('p5-t2-烟雾')
  const file = `${dir}/Form1.cs`
  const code = await Bun.file(file).text()
  await Bun.write(file, code.replace(/if \(thd\.ThreadState == ThreadState\.Suspended\)\s*\{\s*thd\.Resume\(\);\s*\}/, ''))
  runner = await Runner.start(dir)
  const { form } = await runner.waitFor('formShown')
  const id = (name: string) => findByName(form, name).id
  await openAdam4150(runner, id)
  runner.send({ type: 'action', id: id('btn_open'), action: 'click' })
  await runner.waitFor('patch', (m) => m.changes.some((c) => c.id === id('btn_open') && c.value === '开启'))
  runner.send({ type: 'action', id: form.id, action: 'close' })
  const error = await runner.next('exception')
  expect(error.message).toContain('ThreadStateException')
  expect(error.message).toContain('先调用 Resume()')
}, 30000)

/** 把一段 Main 方法体写成工程并运行，收集它的控制台输出 */
async function runMain(name: string, body: string, usings = '', dbDir?: string) {
  const dir = resolve(ROOT, '.runs', `test-${name}`)
  await rm(dir, { recursive: true, force: true })
  await Bun.write(
    `${dir}/Program.cs`,
    `using System;\nusing System.IO;\nusing System.Linq;\n${usings}\nstatic class Program\n{\n    static void Main()\n    {\n${body}\n    }\n}\n`,
  )
  runner = await Runner.start(dir, dbDir)
  return { runner, dir }
}

test('旧版线程 API：Suspend / Resume / Abort、线程自己挂起、休眠中被终止、ThreadState', async () => {
  const { runner } = await runMain(
    'legacy-threads',
    `
        int count = 0;
        Thread worker = new Thread(() => { while (true) { count++; Thread.Sleep(20); } });
        Console.WriteLine("state0=" + worker.ThreadState);
        worker.Start();
        Thread.Sleep(200);
        worker.Suspend();
        Thread.Sleep(100);
        int frozen = count;
        Console.WriteLine("state1=" + worker.ThreadState);
        Thread.Sleep(200);
        Console.WriteLine("frozen=" + (count == frozen));
        try { worker.Abort(); } catch (ThreadStateException) { Console.WriteLine("abortSuspended=error"); }
        worker.Resume();
        Console.WriteLine("joined=" + worker.Join(1000) + "," + worker.ThreadState);

        Thread self = null;
        self = new Thread(() => { self.Suspend(); Console.WriteLine("self=resumed"); });
        self.Start();
        Thread.Sleep(100);
        Console.WriteLine("selfState=" + self.ThreadState);
        self.Resume();
        self.Join(1000);

        Thread sleeper = new Thread(new ThreadStart(Sleepy));
        sleeper.Start();
        Thread.Sleep(100);
        try { sleeper.Resume(); } catch (ThreadStateException) { Console.WriteLine("resumeRunning=error"); }
        sleeper.Abort();
        Console.WriteLine("sleeperJoined=" + sleeper.Join(1000));

        Thread unstarted = new Thread(Sleepy);
        unstarted.Abort();
        Console.WriteLine("unstarted=" + unstarted.ThreadState);

        var param = new Thread(o => Console.WriteLine("param=" + o));
        param.Start(42);
        param.Join();
    }

    static void Sleepy()
    {
        Thread.Sleep(100000);
        Console.WriteLine("sleeper=woke");`,
    'using System.Threading;',
  )
  expect((await runner.waitFor('compiled')).ok).toBe(true)
  await runner.finished()
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  expect(runner.messages.filter((m) => m.type === 'exception')).toEqual([])
  for (const line of [
    'state0=Unstarted',
    'state1=Suspended',
    'frozen=True',
    'abortSuspended=error',
    'joined=True,Stopped',
    'selfState=Suspended',
    'self=resumed',
    'resumeRunning=error',
    'sleeperJoined=True',
    'unstarted=Unstarted, AbortRequested',
    'param=42',
  ]) {
    expect(output).toContain(line)
  }
  expect(output).not.toContain('sleeper=woke')
}, 30000)

test('ListBox：点某一项先选中（SelectedIndexChanged）再触发 Click，Text 是选中项；双击触发 DoubleClick', async () => {
  const { runner } = await runMain(
    'listbox',
    `
        var form = new Form();
        var list = new ListBox { Name = "list" };
        list.Items.AddRange(new object[] { "甲", "乙", "丙" });
        list.SelectedIndexChanged += (s, e) => Console.WriteLine("changed=" + list.SelectedIndex + "," + list.Text);
        list.Click += (s, e) => Console.WriteLine("click");
        list.DoubleClick += (s, e) => { Console.WriteLine("double=" + list.SelectedItem); list.Items.RemoveAt(1); };
        form.Controls.Add(list);
        Application.Run(form);`,
    'using System.Windows.Forms;',
  )
  const { form } = await runner.waitFor('formShown')
  const list = findByName(form, 'list')
  expect(list.props.Items).toEqual(['甲', '乙', '丙'])
  runner.send({ type: 'action', id: list.id, action: 'select', index: 1 })
  await runner.waitFor('console', (m) => m.text === 'click\n')
  runner.send({ type: 'action', id: list.id, action: 'doubleClick' })
  // 删掉选中的项后取消选中，浏览器收到新的列表
  const patch = await runner.next('patch', (m) => m.changes.some((c) => c.prop === 'Items'))
  expect(patch.changes).toContainEqual({ id: list.id, prop: 'SelectedIndex', value: -1 })
  expect(patch.changes).toContainEqual({ id: list.id, prop: 'Items', value: ['甲', '丙'] })
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  expect(output).toBe('changed=1,乙\nclick\ndouble=乙\n')
}, 30000)

test('图片：程序所在目录可写，Image.Save / FromFile 往返，文件夹不存在时和 GDI+ 一样报一般性错误', async () => {
  const { runner } = await runMain(
    'image',
    `
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        Console.WriteLine("base=" + dir.EndsWith("/bin/Debug/") + "," + (Directory.GetCurrentDirectory() + "/" == dir));
        // 1×1 的 PNG
        byte[] png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
        Image image = Image.FromStream(new MemoryStream(png));
        Directory.CreateDirectory(dir + "Pics");
        image.Save(dir + "Pics/a.png", ImageFormat.Png);
        Image back = Image.FromFile("Pics/a.png");
        Console.WriteLine("size=" + back.Width + "x" + back.Height + "," + back.RawFormat);
        try { image.Save(dir + "NoSuchDir/b.png"); }
        catch (System.Runtime.InteropServices.ExternalException ex) { Console.WriteLine("error=" + ex.Message); }`,
    'using System.Drawing;\nusing System.Drawing.Imaging;',
  )
  expect((await runner.waitFor('compiled')).diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  await runner.finished()
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  expect(output).toContain('base=True,True')
  expect(output).toContain('size=1x1,Png')
  expect(output).toContain('error=GDI+ 中发生一般性错误。')
  expect(runner.messages.filter((m) => m.type === 'imageSaved').map((m) => (m as { path: string }).path)).toEqual(['Pics/a.png'])
}, 30000)

test('数据库：照书上的写法建库建表、插入、查询、SqlCommandBuilder 修改、删除、按时间段查询；报错和 SQL Server 一样', async () => {
  const dbDir = resolve(ROOT, '.runs', 'test-db-data')
  await rm(dbDir, { recursive: true, force: true })
  await mkdir(dbDir, { recursive: true })
  const { runner } = await runMain(
    'database',
    `
        var master = new SqlConnection(@"Data Source= PC-20150908SCJF\\SQLSERVER1026;User ID=sa;Password=123456");
        master.Open();
        new SqlCommand("CREATE DATABASE 环境数据表", master).ExecuteNonQuery();
        master.Close();

        string cs = @"Data Source=.;Initial Catalog=环境数据表;User ID=sa;Password=123456";
        var conn = new SqlConnection(cs);
        conn.Open();
        new SqlCommand("CREATE TABLE CampusEnvironment (ID int IDENTITY(1,1) PRIMARY KEY, light varchar(50), humidity varchar(50), temperature varchar(50), addtime datetime)", conn).ExecuteNonQuery();
        // 书上的写法：不写列名，值的顺序是温度、湿度、光照（和建表的列顺序不一样）
        string temperature = "25", humidity = "60", light = "500";
        int n = new SqlCommand("insert into CampusEnvironment  values (" + temperature + "," + humidity + "," + light + ", '" + new DateTime(2024, 1, 16, 9, 5, 3).ToString() + "')", conn).ExecuteNonQuery();
        Console.WriteLine("inserted=" + n);
        new SqlCommand("insert into CampusEnvironment (light, humidity, temperature, addtime) values ('300', '55', '18', '2024/1/20 14:42:00')", conn).ExecuteNonQuery();
        new SqlCommand("insert into CampusEnvironment (light, humidity, temperature, addtime) values ('100', '50', '20', '2024-01-25 08:00:00')", conn).ExecuteNonQuery();

        var adapter = new SqlDataAdapter(new SqlCommand("select ID as '编号',temperature as '温度',humidity as '湿度',light as '光照度', addtime as '时间' from CampusEnvironment", conn));
        var ds = new DataSet();
        adapter.Fill(ds);
        var t = ds.Tables[0];
        Console.WriteLine("columns=" + string.Join(",", t.Columns.Cast<DataColumn>().Select(c => c.ColumnName + ":" + c.DataType.Name)));
        Console.WriteLine("row0=" + string.Join("|", t.Rows[0].ItemArray));

        // 修改：改 DataTable 里的一格，SqlCommandBuilder 生成 UPDATE
        var builder = new SqlCommandBuilder(adapter);
        adapter.UpdateCommand = builder.GetUpdateCommand();
        t.Rows[0]["温度"] = "26";
        Console.WriteLine("updated=" + adapter.Update(t));
        Console.WriteLine("check=" + new SqlCommand("select temperature from CampusEnvironment where ID=1", conn).ExecuteScalar());

        Console.WriteLine("deleted=" + new SqlCommand("delete from CampusEnvironment where id=" + t.Rows[2][0].ToString(), conn).ExecuteNonQuery());

        // 任务 3：BETWEEN 拼接 DateTime.ToString()（中文格式）
        var ds2 = new DataSet();
        new SqlDataAdapter(new SqlCommand("select * from CampusEnvironment where addtime BETWEEN '" + new DateTime(2024, 1, 16).ToString() + "' AND '" + new DateTime(2024, 1, 18).ToString() + "'", conn)).Fill(ds2);
        Console.WriteLine("between=" + ds2.Tables[0].Rows.Count);
        var reader = new SqlCommand("select count(*), max(addtime), CONVERT(varchar(10), addtime, 120) as d from CampusEnvironment group by CONVERT(varchar(10), addtime, 120) order by d", conn).ExecuteReader();
        while (reader.Read()) Console.WriteLine("group=" + reader.GetInt32(0) + "," + reader.GetDateTime(1).ToString("HH:mm") + "," + reader["d"]);
        reader.Close();

        foreach (var sql in new[] { "select * from NoSuchTable", "selec * from CampusEnvironment", "insert into CampusEnvironment values (1, 2)", "insert into CampusEnvironment (ID, light) values (5, '1')", "select nosuch from CampusEnvironment", "insert into CampusEnvironment (addtime) values ('abc')" })
        {
            try { new SqlCommand(sql, conn).ExecuteNonQuery(); }
            catch (SqlException ex) { Console.WriteLine("error=" + ex.Number + " " + ex.Message); }
        }
        try { new SqlConnection("Data Source=.;Initial Catalog=NoDb").Open(); }
        catch (SqlException ex) { Console.WriteLine("error=" + ex.Number + " " + ex.Message); }`,
    'using System.Data;\nusing System.Data.SqlClient;',
    dbDir,
  )
  const compiled = await runner.waitFor('compiled')
  expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  await runner.finished()
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  const errors = runner.messages.filter((m) => m.type === 'exception')
  expect(errors).toEqual([])
  for (const line of [
    'inserted=1',
    'columns=编号:Int32,温度:String,湿度:String,光照度:String,时间:DateTime',
    // 书上的列顺序错位：光照存了温度的值
    'row0=1|500|60|25|2024/1/16 9:05:03',
    'updated=1',
    'check=26',
    'deleted=1',
    'between=1',
    'group=1,09:05,2024-01-16',
    'group=1,14:42,2024-01-20',
    "error=208 对象名 'NoSuchTable' 无效。",
    "error=102 'selec' 附近有语法错误。",
    'error=213 列名或所提供值的数目与表定义不匹配。',
    "error=544 当 IDENTITY_INSERT 设置为 OFF 时，不能为表 'CampusEnvironment' 中的标识列插入显式值。",
    "error=207 列名 'nosuch' 无效。",
    'error=241 从字符串转换日期和/或时间时，转换失败。',
    'error=4060 无法打开登录所请求的数据库 "NoDb"。登录失败。',
  ]) {
    expect(output).toContain(line)
  }
}, 30000)

test('虚拟时钟：拨时间、倍速后 DateTime.Now / Today 跟着走，恢复后是真实时间', async () => {
  const { runner } = await runMain(
    'clock',
    `
        for (int i = 0; i < 40; i++)
        {
            Console.WriteLine("now=" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " today=" + DateTime.Today.ToString("yyyy-MM-dd"));
            System.Threading.Thread.Sleep(100);
        }`,
  )
  expect((await runner.waitFor('compiled')).ok).toBe(true)
  await runner.waitFor('console')
  runner.send({ type: 'board', analog: ANALOG_DEFAULT, digital: DIGITAL_OFF, clock: { wall: '2024-01-16T06:44:58', realAt: Date.now(), speed: 60 } })
  // 60 倍速：真实的 1 秒是虚拟的 1 分钟
  await runner.next('console', (m) => /now=2024-01-16 06:4[6-9]/.test(m.text), 5000)
  runner.send({ type: 'board', analog: ANALOG_DEFAULT, digital: DIGITAL_OFF, clock: null })
  const real = await runner.next('console', (m) => !m.text.includes('2024-01-16'), 3000)
  // 学生程序按服务器配置的时区（config.timeZone）计时，CI 机器本身是 UTC
  expect(real.text).toContain(`today=${wallNow().slice(0, 10)}`)
  expect(runner.messages.some((m) => m.type === 'console' && m.text.includes('today=2024-01-16'))).toBe(true)
}, 30000)

test('颜色：分组框设成白字时，里面的标签沿用白字，文本框、列表框、下拉框还是白底黑字；只发显式设置的颜色', async () => {
  const { runner } = await runMain(
    'colors',
    `
        var form = new Form();
        var group = new GroupBox { ForeColor = Color.White, BackColor = Color.Navy };
        var label = new Label();
        var text = new TextBox { Name = "text" };
        var readOnly = new TextBox { ReadOnly = true };
        var list = new ListBox();
        var combo = new ComboBox();
        var red = new TextBox { Name = "red", ForeColor = Color.Red };
        group.Controls.AddRange(new Control[] { label, text, readOnly, list, combo, red });
        form.Controls.Add(group);
        Console.WriteLine(string.Join(",", new Control[] { label, text, list, combo, red }.Select(c => c.ForeColor.Name)));
        Console.WriteLine(string.Join(",", new Control[] { label, text, readOnly, list, combo }.Select(c => c.BackColor.Name)));
        Application.Run(form);`,
    'using System.Drawing;\nusing System.Windows.Forms;',
  )
  const { form } = await runner.waitFor('formShown')
  expect(findByName(form, 'text').props.ForeColor).toBeNull()
  expect(findByName(form, 'red').props.ForeColor).toBe('#ff0000')
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  expect(output).toBe('White,WindowText,WindowText,WindowText,Red\nNavy,Window,Control,Window,Window\n')
}, 30000)

test('禁用：分组框禁用后里面的控件 Enabled 读出 false、触发 EnabledChanged、点击不响应；重新启用后恢复', async () => {
  const { runner } = await runMain(
    'enabled',
    `
        var form = new Form();
        var group = new GroupBox { Name = "group" };
        var button = new Button { Name = "button" };
        var off = new Button { Enabled = false };
        group.Controls.Add(button);
        group.Controls.Add(off);
        form.Controls.Add(group);
        button.EnabledChanged += (s, e) => Console.WriteLine("button changed=" + button.Enabled);
        off.EnabledChanged += (s, e) => Console.WriteLine("off changed");
        button.Click += (s, e) => Console.WriteLine("click");
        var toggle = new Button { Name = "toggle" };
        toggle.Click += (s, e) => { group.Enabled = !group.Enabled; Console.WriteLine("group=" + group.Enabled + " button=" + button.Enabled + " off=" + off.Enabled); };
        form.Controls.Add(toggle);
        Application.Run(form);`,
    'using System.Windows.Forms;',
  )
  const { form } = await runner.waitFor('formShown')
  const click = (name: string) => runner.send({ type: 'action', id: findByName(form, name).id, action: 'click' })
  click('toggle')
  await runner.waitFor('console', (m) => m.text.startsWith('group=False'))
  click('button')
  click('toggle')
  await runner.waitFor('console', (m) => m.text.startsWith('group=True'))
  click('button')
  await runner.waitFor('console', (m) => m.text === 'click\n')
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  // 浏览器只收到分组框自己的 Enabled，子控件按父控件画成禁用
  expect(findByName(form, 'button').props.Enabled).toBe(true)
  expect(output).toBe(
    'button changed=False\ngroup=False button=False off=False\nbutton changed=True\ngroup=True button=True off=False\nclick\n',
  )
}, 30000)

test('透明背景：文本框、窗体等设透明背景色和 WinForms 一样报错，标签、面板可以', async () => {
  const { runner } = await runMain(
    'transparent',
    `
        foreach (var control in new Control[] { new TextBox(), new ComboBox(), new ListBox(), new Form(), new Label(), new Panel() })
        {
            try { control.BackColor = Color.Transparent; Console.WriteLine(control.GetType().Name + " ok"); }
            catch (ArgumentException ex) { Console.WriteLine(control.GetType().Name + " " + ex.Message); }
        }`,
    'using System.Drawing;\nusing System.Windows.Forms;',
  )
  await runner.finished()
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  expect(output).toBe(
    'TextBox 控件不支持透明的背景色。\nComboBox 控件不支持透明的背景色。\nListBox 控件不支持透明的背景色。\nForm 控件不支持透明的背景色。\nLabel ok\nPanel ok\n',
  )
}, 30000)

test('TrackBar：拖动时先 ValueChanged 再 Scroll，超出范围的值截到两端；代码设超出范围的 Value 报错', async () => {
  const { runner } = await runMain(
    'trackbar',
    `
        var form = new Form();
        var bar = new TrackBar { Name = "bar", Minimum = 18, Maximum = 32 };
        bar.ValueChanged += (s, e) => Console.WriteLine("changed=" + bar.Value);
        bar.Scroll += (s, e) => Console.WriteLine("scroll=" + bar.Value);
        form.Load += (s, e) =>
        {
            try { bar.Value = 40; } catch (ArgumentOutOfRangeException ex) { Console.WriteLine("error=" + ex.Message); }
        };
        form.Controls.Add(bar);
        Application.Run(form);`,
    'using System.Windows.Forms;',
  )
  const { form } = await runner.waitFor('formShown')
  const bar = findByName(form, 'bar')
  expect(bar.props).toMatchObject({ Minimum: 18, Maximum: 32, Value: 18 })
  runner.send({ type: 'action', id: bar.id, action: 'scroll', value: '26' })
  await runner.waitFor('console', (m) => m.text === 'scroll=26\n')
  runner.send({ type: 'action', id: bar.id, action: 'scroll', value: '99' })
  await runner.waitFor('console', (m) => m.text === 'scroll=32\n')
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  expect(output).toContain('error=“40”的值对于“Value”无效。')
  expect(output).toContain('changed=26\nscroll=26\nchanged=32\nscroll=32\n')
}, 30000)

test.skipIf(config.sandbox === 'none')(
  '沙箱：看不到服务器文件、别的运行目录、环境变量和其他进程，工程目录只读',
  async () => {
    process.env.SIM_TEST_SECRET = '不该被看到'
    const { runner } = await runMain(
      'sandbox',
      `
        Console.WriteLine("passwd=" + File.Exists("/etc/passwd"));
        Console.WriteLine("runs=" + Directory.Exists(${JSON.stringify(config.runsDir)}));
        Console.WriteLine("home=" + Directory.Exists("/home"));
        Console.WriteLine("secret=" + (Environment.GetEnvironmentVariable("SIM_TEST_SECRET") ?? "null"));
        Console.WriteLine("procs=" + Directory.GetDirectories("/proc").Count(d => char.IsDigit(Path.GetFileName(d)[0])));
        // 工程目录在沙箱里挂在 /sim/app（当前目录是可写的程序目录 bin/Debug，不是工程目录）
        try { File.WriteAllText("/sim/app/hack.txt", "x"); Console.WriteLine("write=ok"); } catch (Exception) { Console.WriteLine("write=denied"); }
        File.WriteAllText("/tmp/ok.txt", "x");
        Console.WriteLine("tmp=" + File.Exists("/tmp/ok.txt"));`,
    )
    expect((await runner.waitFor('compiled')).ok).toBe(true)
    await runner.finished()
    const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
    expect(output).toContain('passwd=False')
    expect(output).toContain('runs=False')
    expect(output).toContain('home=False')
    expect(output).toContain('secret=null')
    // 只能看到 bwrap 和自己
    expect(Number(/procs=(\d+)/.exec(output)?.[1])).toBeLessThanOrEqual(2)
    expect(output).toContain('write=denied')
    expect(output).toContain('tmp=True')
  },
  30000,
)

test('内存上限：不停分配内存的程序得到 OutOfMemoryException，而不是吃光服务器内存', async () => {
  const { runner } = await runMain(
    'heap',
    `
        var blocks = new System.Collections.Generic.List<byte[]>();
        try { while (true) blocks.Add(new byte[1 << 20]); }
        catch (OutOfMemoryException) { Console.WriteLine("oom=" + blocks.Count); }`,
  )
  await runner.finished()
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  const megabytes = Number(/oom=(\d+)/.exec(output)?.[1])
  expect(megabytes).toBeGreaterThan(50)
  expect(megabytes).toBeLessThanOrEqual(config.heapLimitMb)
}, 30000)

test('编译检查：网络、启动程序、反射、dynamic、AppDomain 给出中文报错；AssemblyInfo.cs 里的特性、BaseDirectory 不受影响', async () => {
  const dir = resolve(ROOT, '.runs/test-policy')
  await rm(dir, { recursive: true, force: true })
  await Bun.write(
    `${dir}/Program.cs`,
    `using System;
using System.Diagnostics;
using System.Net.Http;
static class Program
{
    static void Main()
    {
        Process.Start("sh");
        var client = new HttpClient();
        typeof(string).GetMethod("Trim", Type.EmptyTypes).Invoke("x", null);
        dynamic d = 1;
        string path = AppDomain.CurrentDomain.BaseDirectory + "Camera/";
        AppDomain.CurrentDomain.GetAssemblies();
    }
}
`,
  )
  await Bun.write(
    `${dir}/Properties/AssemblyInfo.cs`,
    `using System.Reflection;
using System.Runtime.InteropServices;
[assembly: AssemblyTitle("WindowsFormsApplication1")]
[assembly: ComVisible(false)]
[assembly: Guid("0a1b2c3d-1111-2222-3333-444455556666")]
`,
  )
  const result = await compileService.compile(dir)
  expect(result.ok).toBe(false)
  const denied = result.diagnostics.filter((d) => d.code === 'SIM001')
  expect(denied.map((d) => [d.line, d.message])).toEqual([
    [8, '平台不允许使用 System.Diagnostics.Process.Start（启动其他程序）'],
    [9, '平台不允许使用 System.Net.Http.HttpClient（网络访问）'],
    [10, '平台不允许使用 System.Reflection.MethodBase.Invoke（反射）'],
    [11, '平台不允许使用 dynamic（dynamic 动态调用）'],
    [13, '平台不允许使用 System.AppDomain.GetAssemblies（加载程序集）'],
  ])
  expect(result.diagnostics.filter((d) => d.file.includes('AssemblyInfo'))).toEqual([])
}, 30000)

test.skipIf(config.sandbox === 'none')(
  'CPU 时间上限：死循环的程序到时被结束，并提示检查死循环',
  async () => {
    const limit = config.cpuLimitSeconds
    config.cpuLimitSeconds = 2
    try {
      const { runner } = await runMain('cpu', '        long i = 0;\n        while (true) i++;')
      const { code, signal } = await runner.finished()
      expect(cpuLimitMessage(code, signal)).toContain('死循环')
    } finally {
      config.cpuLimitSeconds = limit
    }
  },
  30000,
)

test('运行时异常：常见的 .NET 异常配中文说明，带出错的文件、行号和方法', async () => {
  const { runner } = await runMain(
    'exception',
    `
        Console.WriteLine("start");
        int n = int.Parse("abc");`,
  )
  const error = await runner.next('exception')
  expect(error.message).toStartWith('文字转换成数字或日期时格式不对')
  expect(error.message).toContain('System.FormatException')
  expect(error).toMatchObject({ file: 'Program.cs', line: 11 })
  expect(error.detail).toBe('出错位置：Program.cs 第 11 行（Main 方法）')
}, 30000)

test('数据库：DATEADD、DATEDIFF、DATEPART 的日期单位写成关键字（day、hour）', async () => {
  const dbDir = resolve(ROOT, '.runs', 'test-dateadd-db')
  await rm(dbDir, { recursive: true, force: true })
  await mkdir(dbDir, { recursive: true })
  const { runner } = await runMain(
    'dateadd',
    `
        var master = new SqlConnection("Data Source=.;User ID=sa");
        master.Open();
        new SqlCommand("CREATE DATABASE T", master).ExecuteNonQuery();
        var conn = new SqlConnection("Data Source=.;Initial Catalog=T");
        conn.Open();
        foreach (var sql in new[] {
            "SELECT DATEADD(hour, 8, DATEADD(day, -7, '2024-01-16'))",
            "SELECT DATEDIFF(day, '2024-01-01 23:00', '2024-01-02 01:00')",
            "SELECT DATEPART(hh, '2024-01-16 09:05:03')",
        })
            Console.WriteLine("result=" + new SqlCommand(sql, conn).ExecuteScalar());`,
    'using System.Data.SqlClient;',
    dbDir,
  )
  await runner.finished()
  const output = runner.messages.flatMap((m) => (m.type === 'console' ? [m.text] : [])).join('')
  expect(runner.messages.filter((m) => m.type === 'exception')).toEqual([])
  expect(output).toBe('result=2024/1/9 8:00:00\nresult=1\nresult=9\n')
}, 30000)

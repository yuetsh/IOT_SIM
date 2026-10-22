// 端到端测试：直接启动 C# 运行器，模拟浏览器操作，检查教材项目 2 任务 1 的行为。
// 运行前先编译运行时：bun run build:runtime
import { afterAll, afterEach, expect, test } from 'bun:test'
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

let runner: Runner | undefined
afterEach(() => runner?.kill())
afterAll(() => compileService.stop())

test('项目2 任务1：选串口、打开、推送文字到 LED 屏', async () => {
  // 编译产物写在工程目录里，所以复制到临时目录再编译
  const dir = resolve(ROOT, '.runs/test-led')
  const sample = resolve(ROOT, 'samples/p2-t1-LED显示屏')
  for (const name of ['Program.cs', 'Form1.cs', 'Form1.Designer.cs']) await Bun.write(`${dir}/${name}`, Bun.file(`${sample}/${name}`))
  runner = await Runner.start(dir)
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

// 评分时驱动一个学生程序：在沙箱里启动，像浏览器一样维护控件树，按控件名操作控件、调节实训台。
// 提示框自动点第一个按钮（"确定"/"是"），免得程序一直等在 MessageBox.Show 上。
import type { Subprocess } from 'bun'
import type { ControlNode, RunnerInput, RunnerMessage, UserAction } from '@iot/shared'
import { Board, wallNow } from '../board'
import { readLines } from '../runner-process'
import { runCommand } from '../sandbox'
import type { Step } from './checks'

type BoardStep = Extract<Step, { kind: 'board' }>

export class ProgramDriver {
  readonly board = new Board()
  /** 当前显示的窗体，按显示先后排列 */
  readonly forms: ControlNode[] = []
  private readonly nodes = new Map<string, ControlNode>()
  private readonly parents = new Map<string, ControlNode>()
  readonly messageBoxes: { text: string; caption: string }[] = []
  /** 程序用 Image.Save 保存的图片路径 */
  readonly savedImages: string[] = []
  /** 媒体播放器播放过的文件名 */
  readonly played: string[] = []
  readonly exceptions: string[] = []
  console = ''
  exited = false
  private proc?: Subprocess<'pipe', 'pipe', 'pipe'>
  private listeners = new Set<() => void>()
  private lastMessageAt = Date.now()

  start(projectDir: string, dbDir?: string) {
    const { cmd, env } = runCommand(projectDir, { SIM_BOARD: JSON.stringify(this.board.runnerInputs()) }, dbDir)
    const proc = Bun.spawn(cmd, { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env })
    this.proc = proc
    void readLines(proc.stdout, (line) => {
      try {
        this.receive(JSON.parse(line) as RunnerMessage)
      } catch {
        this.console += `${line}\n`
      }
    })
    void new Response(proc.stderr).text()
    void proc.exited.then(() => {
      this.exited = true
      this.notify()
    })
  }

  stop() {
    this.proc?.kill()
  }

  private send(message: RunnerInput) {
    if (this.exited || !this.proc) return
    this.proc.stdin.write(`${JSON.stringify(message)}\n`)
    this.proc.stdin.flush()
  }

  private register(node: ControlNode, parent?: ControlNode) {
    this.nodes.set(node.id, node)
    if (parent) this.parents.set(node.id, parent)
    for (const child of node.children) this.register(child, node)
  }

  private unregister(node: ControlNode) {
    this.nodes.delete(node.id)
    this.parents.delete(node.id)
    for (const child of node.children) this.unregister(child)
  }

  private receive(message: RunnerMessage) {
    this.lastMessageAt = Date.now()
    switch (message.type) {
      case 'formShown':
        this.forms.push(message.form)
        this.register(message.form)
        break
      case 'formClosed': {
        const index = this.forms.findIndex((f) => f.id === message.formId)
        if (index >= 0) this.unregister(this.forms.splice(index, 1)[0])
        break
      }
      case 'patch':
        for (const change of message.changes) {
          const node = this.nodes.get(change.id)
          if (node) node.props[change.prop] = change.value
        }
        break
      case 'controlAdded': {
        const parent = this.nodes.get(message.parentId)
        if (!parent) break
        parent.children.splice(message.index, 0, message.node)
        this.register(message.node, parent)
        break
      }
      case 'controlRemoved': {
        const node = this.nodes.get(message.id)
        const parent = this.parents.get(message.id)
        if (!node) break
        if (parent) parent.children = parent.children.filter((c) => c.id !== node.id)
        this.unregister(node)
        break
      }
      case 'messageBox': {
        this.messageBoxes.push({ text: message.text, caption: message.caption })
        // 自动点第一个按钮
        const first = /^(OK|Yes|Retry|Abort)/.exec(message.buttons)?.[1] ?? 'OK'
        this.send({ type: 'reply', requestId: message.requestId, result: first })
        break
      }
      case 'device':
        this.board.applyDevice(message)
        break
      case 'imageSaved':
        this.savedImages.push(message.path)
        break
      case 'media':
        if (message.action === 'play' && message.name) this.played.push(message.name)
        break
      case 'console':
        this.console += message.text
        break
      case 'exception':
        this.exceptions.push(message.message)
        break
    }
    this.notify()
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }

  /** 按控件名找控件；多个窗体里有同名控件时取最后显示的窗体里的 */
  find(name: string): ControlNode | undefined {
    for (const form of [...this.forms].reverse()) {
      const found = findIn(form, name)
      if (found) return found
    }
  }

  /** 控件连同它所在的容器都可见（Visible 不是 false） */
  isVisible(node: ControlNode): boolean {
    for (let n: ControlNode | undefined = node; n; n = this.parents.get(n.id)) {
      if (n.props.Visible === false) return false
    }
    return true
  }

  act(node: ControlNode, action: UserAction) {
    // 和浏览器一样同步记下输入的文字（运行器不回传）
    if (action.action === 'text') node.props.Text = action.value
    this.send({ type: 'action', id: node.id, ...action })
  }

  /** 拨虚拟时钟到今天的某个时刻（服务器所在时区） */
  setClock(time: string, speed?: number) {
    this.board.setClock(`${wallNow().slice(0, 10)}T${time}`, speed)
    this.send(this.board.runnerInputs())
  }

  setBoard(step: BoardStep) {
    this.board.applyInput({ type: 'boardInput', analog: step.analog, digital: step.digital })
    this.send(this.board.runnerInputs())
  }

  /** 等到条件成立（立即检查，之后每收到一条消息检查一次），超时返回 false */
  waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
    if (condition()) return Promise.resolve(true)
    return new Promise((resolve) => {
      const done = (result: boolean) => {
        clearTimeout(timer)
        this.listeners.delete(check)
        resolve(result)
      }
      const check = () => {
        if (condition()) done(true)
      }
      const timer = setTimeout(() => done(condition()), timeoutMs)
      this.listeners.add(check)
    })
  }

  /** 等程序处理完刚才的操作：从现在起一段时间内没有新消息（最多等 maxMs） */
  async settle(quietMs = 150, maxMs = 2000) {
    const start = Date.now()
    const quietFor = () => Date.now() - Math.max(this.lastMessageAt, start)
    while (Date.now() - start < maxMs && quietFor() < quietMs) await Bun.sleep(quietMs - quietFor())
  }
}

function findIn(node: ControlNode, name: string): ControlNode | undefined {
  if (node.name === name) return node
  for (const child of node.children) {
    const found = findIn(child, name)
    if (found) return found
  }
}

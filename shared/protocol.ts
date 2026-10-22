// 浏览器、Bun 服务器、C# 运行器之间的消息协议。
// 运行器 ↔ 服务器：标准输入输出，每行一条 JSON。
// 服务器 ↔ 浏览器：WebSocket，每帧一条 JSON。
// C# 端的对应定义在 runtime/Sim.WinForms/Host/（Protocol.cs、各控件的 WriteProps），两边修改时要同步。

/** 学生工程里的一个源文件 */
export interface SourceFile {
  path: string
  content: string
}

export interface Diagnostic {
  file: string
  line: number
  column: number
  severity: 'error' | 'warning'
  code: string
  message: string
  /** 平台补充的中文提示，例如书上常见错误的说明 */
  hint?: string
}

/** 控件树节点。props 里的键名使用 WinForms 属性名，如 Text、Location、BackColor */
export interface ControlNode {
  id: string
  type: string
  name: string
  props: Record<string, unknown>
  children: ControlNode[]
}

export interface PropChange {
  id: string
  prop: string
  value: unknown
}

/** 运行器发出的消息 */
export type RunnerMessage =
  | { type: 'compiled'; ok: boolean; diagnostics: Diagnostic[]; ms: number }
  | { type: 'started'; ms: number }
  | { type: 'formShown'; form: ControlNode; modal: boolean }
  | { type: 'formClosed'; formId: string }
  | { type: 'patch'; changes: PropChange[] }
  | { type: 'controlAdded'; parentId: string; index: number; node: ControlNode }
  | { type: 'controlRemoved'; id: string }
  | { type: 'messageBox'; requestId: number; text: string; caption: string; buttons: string; icon: string }
  | { type: 'device'; device: string; action: string; data: unknown }
  | { type: 'console'; text: string }
  | { type: 'exception'; message: string; detail: string }
  | { type: 'exited'; code: number }

/**
 * 用户在浏览器里的操作。浏览器只描述"用户做了什么"，
 * 由运行器按真实 WinForms 的顺序决定触发哪些事件。
 */
export type UserAction =
  | { action: 'click' }
  | { action: 'text'; value: string }
  | { action: 'dropDown' }
  | { action: 'select'; index: number }
  | { action: 'mouseDown'; button: 'left' | 'right'; x: number; y: number }
  | { action: 'mouseUp'; button: 'left' | 'right'; x: number; y: number }
  | { action: 'close' }

/** 发给运行器的消息 */
export type RunnerInput =
  | ({ type: 'action'; id: string } & UserAction)
  | { type: 'reply'; requestId: number; result: unknown }
  | { type: 'stop' }

/** 浏览器发给服务器的消息 */
export type ClientMessage = { type: 'run'; files: SourceFile[] } | RunnerInput

/** 服务器发给浏览器的消息 */
export type ServerMessage =
  | RunnerMessage
  | { type: 'status'; state: 'compiling' | 'running' | 'stopped' }
  | { type: 'serverError'; message: string }

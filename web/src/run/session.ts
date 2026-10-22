import { reactive, shallowReactive } from 'vue'
import type {
  ClientMessage,
  ControlNode,
  Diagnostic,
  RunnerInput,
  ServerMessage,
  SourceFile,
  UserAction,
} from '@iot/shared'

export interface OpenForm {
  root: ControlNode
  modal: boolean
}

export interface PendingMessageBox {
  requestId: number
  text: string
  caption: string
  buttons: string
  icon: string
}

/** 浏览器端的运行状态：WebSocket 连接、打开的窗体、控件树、实训台设备状态 */
export function createRunSession() {
  const state = reactive({
    status: 'idle' as 'idle' | 'compiling' | 'running' | 'stopped',
    diagnostics: [] as Diagnostic[],
    console: '',
    errors: [] as string[],
    forms: [] as OpenForm[],
    messageBoxes: [] as PendingMessageBox[],
    devices: { ledText: '' },
    metrics: { compileMs: 0, startMs: 0, lastRoundTripMs: 0 },
  })
  /** id → 控件节点，patch 按 id 修改节点属性 */
  const nodes = shallowReactive(new Map<string, ControlNode>())
  let socket: WebSocket | undefined
  let actionSentAt = 0

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    socket = new WebSocket(`${protocol}://${location.host}/ws`)
    socket.onmessage = (event) => handle(JSON.parse(event.data) as ServerMessage)
    socket.onclose = () => {
      state.status = 'stopped'
      socket = undefined
    }
    return new Promise<void>((resolve) => socket!.addEventListener('open', () => resolve(), { once: true }))
  }

  function send(message: ClientMessage) {
    socket?.send(JSON.stringify(message))
  }

  async function run(files: SourceFile[]) {
    if (!socket) await connect()
    state.diagnostics = []
    state.console = ''
    state.errors = []
    state.forms = []
    state.messageBoxes = []
    state.devices.ledText = ''
    nodes.clear()
    send({ type: 'run', files })
  }

  function stop() {
    send({ type: 'stop' })
  }

  function act(id: string, action: UserAction) {
    actionSentAt = performance.now()
    send({ type: 'action', id, ...action } as RunnerInput)
  }

  function replyMessageBox(requestId: number, result: string) {
    state.messageBoxes = state.messageBoxes.filter((box) => box.requestId !== requestId)
    send({ type: 'reply', requestId, result })
  }

  function register(node: ControlNode) {
    nodes.set(node.id, node)
    for (const child of node.children) register(child)
  }

  function unregister(node: ControlNode) {
    nodes.delete(node.id)
    for (const child of node.children) unregister(child)
  }

  function handle(message: ServerMessage) {
    if (actionSentAt && message.type !== 'status') {
      state.metrics.lastRoundTripMs = Math.round(performance.now() - actionSentAt)
      actionSentAt = 0
    }
    switch (message.type) {
      case 'status':
        state.status = message.state
        break
      case 'compiled':
        state.diagnostics = message.diagnostics
        state.metrics.compileMs = message.ms
        break
      case 'started':
        state.metrics.startMs = message.ms
        break
      case 'formShown': {
        const root = reactive(message.form) as ControlNode
        register(root)
        state.forms.push({ root, modal: message.modal })
        break
      }
      case 'formClosed': {
        const form = state.forms.find((f) => f.root.id === message.formId)
        if (form) unregister(form.root)
        state.forms = state.forms.filter((f) => f.root.id !== message.formId)
        break
      }
      case 'patch':
        for (const change of message.changes) {
          const node = nodes.get(change.id)
          if (node) node.props[change.prop] = change.value
        }
        break
      case 'controlAdded': {
        const parent = nodes.get(message.parentId)
        if (!parent) break
        const node = reactive(message.node) as ControlNode
        parent.children.splice(message.index, 0, node)
        register(node)
        break
      }
      case 'controlRemoved': {
        const node = nodes.get(message.id)
        if (!node) break
        for (const parent of nodes.values()) {
          const index = parent.children.indexOf(node)
          if (index >= 0) parent.children.splice(index, 1)
        }
        unregister(node)
        break
      }
      case 'messageBox':
        state.messageBoxes.push(message)
        break
      case 'device':
        if (message.device === 'led' && message.action === 'text') state.devices.ledText = String(message.data)
        break
      case 'console':
        state.console += message.text
        break
      case 'exception':
        state.errors.push(`${message.message}\n${message.detail}`)
        break
      case 'serverError':
        state.errors.push(message.message)
        break
      case 'exited':
        state.forms = []
        state.messageBoxes = []
        break
    }
  }

  return { state, run, stop, act, replyMessageBox }
}

export type RunSession = ReturnType<typeof createRunSession>

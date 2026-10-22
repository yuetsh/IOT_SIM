import { reactive, shallowReactive } from 'vue'
import { validAccessToken } from '../tokens'
import type {
  BoardState,
  ClientMessage,
  ControlNode,
  Diagnostic,
  ServerMessage,
  SourceFile,
  UserAction,
} from '@iot/shared'

export interface OpenForm {
  root: ControlNode
  modal: boolean
}

/** 学生程序保存的图片（如摄像头照片），path 相对程序所在目录 */
export interface SavedImage {
  path: string
  image: string
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
    /** 虚拟实训台，由服务器推送；连接建立前为 null */
    board: null as BoardState | null,
    /** 本次运行保存的图片，显示在运行区的照片列表里；下次运行时清空 */
    savedImages: [] as SavedImage[],
    metrics: { compileMs: 0, startMs: 0, lastRoundTripMs: 0 },
  })
  /** id → 控件节点，patch 按 id 修改节点属性 */
  const nodes = shallowReactive(new Map<string, ControlNode>())
  /** 图片编号 → 网址（blob:）。运行器每张图只发一次，控件属性里只带编号 */
  const images = shallowReactive(new Map<string, string>())
  let socket: WebSocket | undefined
  /** 正在建立或已建立的连接；同时多处调用 connect() 时共用同一个 */
  let connecting: Promise<void> | undefined
  let actionSentAt = 0

  function connect() {
    connecting ??= validAccessToken().then(
      (token) =>
        new Promise<void>((resolve) => {
          const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
          // 浏览器的 WebSocket 不能带请求头，访问令牌放在网址参数里（只在建立连接时检查）
          const ws = new WebSocket(`${protocol}://${location.host}/ws?token=${encodeURIComponent(token ?? '')}`)
          socket = ws
          ws.onmessage = (event) => handle(JSON.parse(event.data) as ServerMessage)
          ws.onopen = () => resolve()
          ws.onclose = () => {
            state.status = 'stopped'
            state.board = null
            socket = undefined
            connecting = undefined
            resolve()
          }
        }),
    )
    return connecting
  }

  function send(message: ClientMessage) {
    socket?.send(JSON.stringify(message))
  }

  async function run(files: SourceFile[]) {
    await connect()
    state.diagnostics = []
    state.console = ''
    state.errors = []
    state.forms = []
    state.messageBoxes = []
    state.savedImages = []
    nodes.clear()
    for (const url of images.values()) URL.revokeObjectURL(url)
    images.clear()
    send({ type: 'run', files })
  }

  /** 调节实训台环境（滑块、传感器开关） */
  function setBoard(input: Omit<Extract<ClientMessage, { type: 'boardInput' }>, 'type'>) {
    send({ type: 'boardInput', ...input })
  }

  function resetBoard() {
    send({ type: 'boardReset' })
  }

  function stop() {
    send({ type: 'stop' })
  }

  function act(id: string, action: UserAction) {
    actionSentAt = performance.now()
    // 输入的文字运行器不再回传，这里同步记下；否则程序再把 Text 设成原来的值时，属性"没变"，输入框不会刷新
    if (action.action === 'text') {
      const node = nodes.get(id)
      if (node) node.props.Text = action.value
    }
    send({ type: 'action', id, ...action } as ClientMessage)
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
      case 'image': {
        const bytes = Uint8Array.from(atob(message.data), (c) => c.charCodeAt(0))
        images.set(message.key, URL.createObjectURL(new Blob([bytes], { type: message.mime })))
        break
      }
      case 'imageSaved':
        state.savedImages.push({ path: message.path, image: message.image })
        break
      case 'board':
        state.board = message.state
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

  /** 离开页面时断开连接：服务器随即结束正在运行的程序 */
  function close() {
    socket?.close()
  }

  return { state, images, connect, run, stop, act, replyMessageBox, setBoard, resetBoard, close }
}

export type RunSession = ReturnType<typeof createRunSession>

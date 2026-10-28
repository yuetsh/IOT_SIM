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

/**
 * 虚拟实训台（按教材实训台布局图）。每个浏览器会话一台，状态由服务器统一保存：
 * 输入（传感器读数）由网页上的滑块和开关设定，推给学生程序；输出（灯、继电器、LED 屏）由学生程序控制。
 */
export interface BoardState {
  /** ADAM-4017 模拟量，按教材整数取值 */
  analog: {
    temperature: number // Vin0 温度 ℃
    humidity: number // Vin1 湿度 %
    light: number // Vin2 光照 lx
    airPressure: number // Vin3 气压 kPa
    airQuality: number // Vin4 空气质量
    co2: number // Vin5 CO2 ppm
    wind: number // Vin6 风速 m/s
  }
  /** ADAM-4150 数字量输入 */
  digital: {
    bodyInfrared: boolean // DI0 人体红外
    fire: boolean // DI1 火焰
    smoke: boolean // DI2 烟雾
    infrared: boolean // DI3 红外对射
  }
  /** ADAM-4150 继电器 DO0–DO4：DO0 报警灯、DO1 照明灯、DO2 路灯、DO3 插座 1、DO4 插座 2 */
  relays: boolean[]
  /** ZigBee 继电器节点 0、1（教材用节点 1 控制路灯） */
  zigbee: boolean[]
  ledText: string
  /** 网络摄像机：是否在传画面，云台位置（左右 0–6、上下 0–2，开始时在正中） */
  camera: { on: boolean; x: number; y: number }
  /** 虚拟时钟；null 表示真实时间 */
  clock: VirtualClock | null
  /** 接线：每台串口设备接在哪个串口，随实验而定（示例 meta.json 的 wiring） */
  wiring: Wiring
  /** 学生程序在哪个串口上打开了各设备（Open / OpenLedCom）；没打开或已 Close 为 null，程序结束时清空 */
  opened: Record<PortDevice, string | null>
  /** 串口没打开（或已关闭）时程序还在读写的设备（读数据、控制继电器、推送文字）；打开后、程序结束时清除 */
  usedUnopened: PortDevice[]
}

/** 实训台上经串口服务器连到电脑的设备 */
export type PortDevice = 'adam4017' | 'adam4150' | 'zigbee' | 'led'
export const PORT_DEVICES: PortDevice[] = ['adam4017', 'adam4150', 'zigbee', 'led']
export const PORT_DEVICE_NAMES: Record<PortDevice, string> = { adam4017: 'ADAM-4017+', adam4150: 'ADAM-4150', zigbee: 'ZigBee 协调器', led: 'LED 屏' }
/** 串口服务器的四个口（电脑自带的 COM1 不接设备，GetPortNames 也不返回） */
export const BOARD_PORTS = ['COM2', 'COM3', 'COM4', 'COM5']

export type Wiring = Record<PortDevice, string>

/**
 * 教材实训台布局图的接线：ADAM-4017+、ADAM-4150 各经一个 485/232 转换器接串口服务器，ZigBee 协调器、LED 屏直接接（项目 8 的 AppSet 也是这样）。
 * 485 是总线，两个模块地址不同（4150 为 1、4017+ 为 2），也可以并在同一个口上：项目 7 的书上代码就在一个串口上打开两个模块。
 */
export const DEFAULT_WIRING: Wiring = { adam4017: 'COM2', adam4150: 'COM3', zigbee: 'COM4', led: 'COM5' }

/**
 * 串口问题，设备因此没有反应（和真机一样不报错）：opened 是程序打开的串口名（打开错了），null 表示串口没打开程序就在读写它。
 * Windows 的串口名不分大小写
 */
export interface PortProblem {
  device: PortDevice
  opened: string | null
  wired: string
}

export function portProblems(state: Pick<BoardState, 'wiring' | 'opened' | 'usedUnopened'>): PortProblem[] {
  return PORT_DEVICES.flatMap((device): PortProblem[] => {
    const opened = state.opened[device]
    const wired = state.wiring[device]
    if (opened === null) return state.usedUnopened.includes(device) ? [{ device, opened, wired }] : []
    return opened.trim().toUpperCase() !== wired ? [{ device, opened, wired }] : []
  })
}

/** 一句话说明串口问题，如"程序在 COM2 上打开 ADAM-4150，它接在 COM3" */
export function describePortProblem(p: PortProblem) {
  const name = PORT_DEVICE_NAMES[p.device]
  // 名字以中文结尾时直接接"的"（"LED 屏的串口"），以字母、数字结尾时空一格（"ADAM-4150 的串口"）
  const owner = /[\x00-\x7f]$/.test(name) ? `${name} 的` : `${name}的`
  if (p.opened === null) return `${owner}串口没有打开，程序却在读写它（它接在 ${p.wired}）`
  return p.opened.trim() ? `程序在 ${p.opened.trim()} 上打开 ${name}，它接在 ${p.wired}` : `程序没有选串口就打开了 ${name}，它接在 ${p.wired}`
}

/**
 * 虚拟时钟：从真实时刻 realAt（毫秒时间戳）起，墙上时间从 wall（本地时间 yyyy-MM-ddTHH:mm:ss）开始按 speed 倍速走。
 * 学生程序的 DateTime.Now 跟着它（教材项目 7 按时刻切换情景模式）。
 */
export interface VirtualClock {
  wall: string
  realAt: number
  speed: number
}

/** 虚拟时钟现在的墙上时间（yyyy-MM-ddTHH:mm:ss）；按 UTC 做加减，只用来算时刻，不涉及时区 */
export function clockWall(clock: VirtualClock, now = Date.now()) {
  return new Date(Date.parse(`${clock.wall}Z`) + (now - clock.realAt) * clock.speed).toISOString().slice(0, 19)
}

export type AnalogKey = keyof BoardState['analog']
export type DigitalKey = keyof BoardState['digital']

/** 4017 通道顺序（Vin0–Vin6）和 4150 输入通道顺序（DI0–DI3），C# 端按通道号读取 */
export const ANALOG_CHANNELS: AnalogKey[] = ['temperature', 'humidity', 'light', 'airPressure', 'airQuality', 'co2', 'wind']
export const DIGITAL_CHANNELS: DigitalKey[] = ['bodyInfrared', 'fire', 'smoke', 'infrared']

/** 各模拟量的单位和滑块范围。光照上限取 2000 lx：教材里的阈值都在 200–800 之间 */
export const ANALOG_INFO: Record<AnalogKey, { label: string; unit: string; min: number; max: number }> = {
  temperature: { label: '温度', unit: '℃', min: -20, max: 60 },
  humidity: { label: '湿度', unit: '%', min: 0, max: 100 },
  light: { label: '光照', unit: 'lx', min: 0, max: 2000 },
  airPressure: { label: '气压', unit: 'kPa', min: 80, max: 120 },
  airQuality: { label: '空气质量', unit: '', min: 0, max: 500 },
  co2: { label: 'CO₂', unit: 'ppm', min: 300, max: 5000 },
  wind: { label: '风速', unit: 'm/s', min: 0, max: 30 },
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
  /** 图片、声音数据（base64），同一份数据只发一次；控件属性、imageSaved、media 里用 key 引用 */
  | { type: 'blob'; key: string; mime: string; data: string }
  /** 媒体播放器（教材项目 7 的广播）：开始 / 停止播放；name 是文件名，id 是播放器控件 */
  | { type: 'media'; id: string; action: 'play' | 'stop'; key?: string; name?: string }
  /** 学生程序用 Image.Save 保存了图片；path 相对程序所在目录，如 Camera/20241022_10 30 00.jpg */
  | { type: 'imageSaved'; path: string; image: string }
  /**
   * 学生程序操作了实训台输出：led/text、adam4150/do、zigbee/relay、camera/on、camera/pan，data 见 DeviceCtrlHelper.cs、IPCameraHelper.cs；
   * 以及打开、关闭串口设备：adam4017/open（data 是串口名）、adam4017/close，串口没打开时程序还在读写：adam4017/unopened（每次打开后最多报一次），4150、zigbee、led 同样
   */
  | { type: 'device'; device: string; action: string; data: unknown }
  | { type: 'console'; text: string }
  /** 学生程序没有处理的异常；file、line 是出错的那行学生代码（找得到时才有），网页上点击可以跳过去 */
  | { type: 'exception'; message: string; detail: string; file?: string; line?: number }
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
  | { action: 'doubleClick' }
  /** DataGridView：点、双击、修改单元格；column 为 -1 表示行标题 */
  | { action: 'cellClick'; row: number; column: number }
  | { action: 'cellDoubleClick'; row: number; column: number }
  | { action: 'cellEdit'; row: number; column: number; value: string }
  /** DateTimePicker 选了日期或时间：value 是本地时间 yyyy-MM-ddTHH:mm:ss */
  | { action: 'pick'; value: string }
  /** TrackBar 拖动滑块、点轨道或按方向键：value 是新值 */
  | { action: 'scroll'; value: string }
  | { action: 'mouseDown'; button: 'left' | 'right'; x: number; y: number }
  | { action: 'mouseUp'; button: 'left' | 'right'; x: number; y: number }
  | { action: 'close' }

/** 发给运行器的消息 */
export type RunnerInput =
  | ({ type: 'action'; id: string } & UserAction)
  | { type: 'reply'; requestId: number; result: unknown }
  /** 实训台传感器读数，按通道号排列（见 ANALOG_CHANNELS、DIGITAL_CHANNELS），以及虚拟时钟、接线（不带时表示不变） */
  | { type: 'board'; analog: number[]; digital: boolean[]; clock?: VirtualClock | null; wiring?: Wiring }
  | { type: 'stop' }

/** 浏览器发给服务器的消息 */
export type ClientMessage =
  /** sampleId：当前实验，第一次运行时自动建好实验预置的数据库（学生还没有这些库时） */
  | { type: 'run'; files: SourceFile[]; sampleId?: string }
  /** 打开了哪个实验：实训台换成这个实验的接线（没有 sampleId 时用默认接线） */
  | { type: 'experiment'; sampleId?: string }
  /** 调节实训台环境：拖动滑块、触发传感器 */
  /** clock：拨到某个时刻（time：yyyy-MM-ddTHH:mm:ss）、改倍速，或 null 恢复真实时间 */
  | { type: 'boardInput'; analog?: Partial<BoardState['analog']>; digital?: Partial<BoardState['digital']>; clock?: { time?: string; speed?: number } | null }
  /** 实训台复位：关掉所有灯和继电器、清空 LED 屏，传感器恢复默认 */
  | { type: 'boardReset' }
  | Exclude<RunnerInput, { type: 'board' }>

/** 服务器发给浏览器的消息 */
export type ServerMessage =
  | RunnerMessage
  | { type: 'board'; state: BoardState }
  | { type: 'status'; state: 'compiling' | 'running' | 'stopped' }
  | { type: 'serverError'; message: string }

export * from './grading'
export * from './conventions'

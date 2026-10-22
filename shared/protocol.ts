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
  /** 学生程序操作了实训台输出：led/text、adam4150/do、zigbee/relay，data 见 DeviceCtrlHelper.cs */
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
  /** 实训台传感器读数，按通道号排列（见 ANALOG_CHANNELS、DIGITAL_CHANNELS） */
  | { type: 'board'; analog: number[]; digital: boolean[] }
  | { type: 'stop' }

/** 浏览器发给服务器的消息 */
export type ClientMessage =
  | { type: 'run'; files: SourceFile[] }
  /** 调节实训台环境：拖动滑块、触发传感器 */
  | { type: 'boardInput'; analog?: Partial<BoardState['analog']>; digital?: Partial<BoardState['digital']> }
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

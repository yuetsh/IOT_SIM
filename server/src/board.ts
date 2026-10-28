import {
  clockWall,
  ANALOG_CHANNELS,
  ANALOG_INFO,
  type BoardState,
  type ClientMessage,
  DEFAULT_WIRING,
  DIGITAL_CHANNELS,
  PORT_DEVICES,
  type PortDevice,
  type RunnerInput,
  type RunnerMessage,
  type Wiring,
} from '@iot/shared'
import { config } from './config'

export function defaultBoardState(): BoardState {
  return {
    analog: { temperature: 25, humidity: 60, light: 500, airPressure: 101, airQuality: 60, co2: 600, wind: 3 },
    digital: { bodyInfrared: false, fire: false, smoke: false, infrared: false },
    relays: [false, false, false, false, false],
    zigbee: [false, false],
    ledText: '',
    camera: { on: false, x: 3, y: 1 },
    clock: null,
    wiring: { ...DEFAULT_WIRING },
    opened: closedPorts(),
    usedUnopened: [],
  }
}

function closedPorts(): BoardState['opened'] {
  return { adam4017: null, adam4150: null, zigbee: null, led: null }
}

/** 一个浏览器会话的虚拟实训台。多次运行之间保留状态，和真实实训台断电前继电器保持原状一样 */
export class Board {
  state = defaultBoardState()

  /** 发给运行器的传感器读数，按通道号排列 */
  runnerInputs(): Extract<RunnerInput, { type: 'board' }> {
    return {
      type: 'board',
      analog: ANALOG_CHANNELS.map((key) => this.state.analog[key]),
      digital: DIGITAL_CHANNELS.map((key) => this.state.digital[key]),
      clock: this.state.clock,
      wiring: this.state.wiring,
    }
  }

  /** 换成某个实验的接线；返回 true 表示有变化 */
  setWiring(wiring: Wiring) {
    if (PORT_DEVICES.every((device) => this.state.wiring[device] === wiring[device])) return false
    this.state.wiring = { ...wiring }
    return true
  }

  /** 浏览器调节环境；返回 true 表示传感器读数有变化 */
  applyInput(message: Extract<ClientMessage, { type: 'boardInput' }>) {
    let changed = false
    for (const [key, value] of Object.entries(message.analog ?? {})) {
      const name = key as keyof BoardState['analog']
      if (!(name in ANALOG_INFO) || typeof value !== 'number' || !Number.isFinite(value)) continue
      const { min, max } = ANALOG_INFO[name]
      // 教材类库返回整数字符串，这里保证读数是整数
      this.state.analog[name] = Math.round(Math.min(max, Math.max(min, value)))
      changed = true
    }
    for (const [key, value] of Object.entries(message.digital ?? {})) {
      const name = key as keyof BoardState['digital']
      if (!(name in this.state.digital) || typeof value !== 'boolean') continue
      this.state.digital[name] = value
      changed = true
    }
    if (message.clock === null) {
      changed ||= this.state.clock !== null
      this.state.clock = null
    } else if (message.clock && typeof message.clock === 'object') {
      changed = this.setClock(message.clock.time, message.clock.speed) || changed
    }
    return changed
  }

  /**
   * 拨虚拟时钟：time 是墙上时间（yyyy-MM-ddTHH:mm:ss，不给就从现在的时刻接着走），speed 是倍速（不给就保持原来的）。
   * 恢复真实时间是 clock = null。
   */
  setClock(time: string | undefined, speed: number | undefined) {
    if (time !== undefined && (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(time) || Number.isNaN(Date.parse(`${time}Z`))))
      return false
    if (speed !== undefined && (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 1 || speed > 3600)) return false
    const now = Date.now()
    this.state.clock = {
      wall: time ?? (this.state.clock ? clockWall(this.state.clock, now) : wallNow()),
      realAt: now,
      speed: speed ?? this.state.clock?.speed ?? 1,
    }
    return true
  }

  /** 学生程序控制了输出设备；返回 true 表示实训台状态有变化 */
  applyDevice(message: Extract<RunnerMessage, { type: 'device' }>) {
    const device = message.device as PortDevice
    if (PORT_DEVICES.includes(device) && (message.action === 'open' || message.action === 'close')) {
      this.state.opened[device] = message.action === 'open' ? String(message.data ?? '') : null
      if (message.action === 'open') this.state.usedUnopened = this.state.usedUnopened.filter((d) => d !== device)
      return true
    }
    if (PORT_DEVICES.includes(device) && message.action === 'unopened') {
      if (this.state.usedUnopened.includes(device)) return false
      this.state.usedUnopened = [...this.state.usedUnopened, device]
      return true
    }
    switch (`${message.device}/${message.action}`) {
      case 'led/text':
        this.state.ledText = String(message.data ?? '')
        return true
      case 'adam4150/do': {
        const [channel, on] = message.data as [number, number]
        if (channel < 0 || channel >= this.state.relays.length) return false
        this.state.relays[channel] = on === 1
        return true
      }
      case 'zigbee/relay': {
        const [relay, on] = message.data as [number, number]
        if (relay < 0 || relay >= this.state.zigbee.length) return false
        this.state.zigbee[relay] = on === 1
        return true
      }
      case 'camera/on':
        this.state.camera.on = message.data === true
        return true
      case 'camera/pan': {
        const [x, y] = message.data as [number, number]
        this.state.camera.x = x
        this.state.camera.y = y
        return true
      }
      default:
        return false
    }
  }

  /** 学生程序结束：摄像头不再传画面，云台回到正中（下次运行的程序从正中开始）；打开的串口随程序关闭 */
  programExited() {
    this.state.camera = { on: false, x: 3, y: 1 }
    this.state.opened = closedPorts()
    this.state.usedUnopened = []
  }

  /** 复位不改接线（接线跟着实验走），也不动正在运行的程序打开的串口 */
  reset() {
    this.state = { ...defaultBoardState(), wiring: this.state.wiring, opened: this.state.opened, usedUnopened: this.state.usedUnopened }
  }
}

/** 服务器所在时区（config.timeZone）现在的墙上时间 yyyy-MM-ddTHH:mm:ss */
export function wallNow(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .replace(' ', 'T')
}

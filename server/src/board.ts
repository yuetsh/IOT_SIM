import {
  ANALOG_CHANNELS,
  ANALOG_INFO,
  type BoardState,
  type ClientMessage,
  DIGITAL_CHANNELS,
  type RunnerInput,
  type RunnerMessage,
} from '@iot/shared'

export function defaultBoardState(): BoardState {
  return {
    analog: { temperature: 25, humidity: 60, light: 500, airPressure: 101, airQuality: 60, co2: 600, wind: 3 },
    digital: { bodyInfrared: false, fire: false, smoke: false, infrared: false },
    relays: [false, false, false, false, false],
    zigbee: [false, false],
    ledText: '',
  }
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
    }
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
    return changed
  }

  /** 学生程序控制了输出设备；返回 true 表示实训台状态有变化 */
  applyDevice(message: Extract<RunnerMessage, { type: 'device' }>) {
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
      default:
        return false
    }
  }

  reset() {
    this.state = defaultBoardState()
  }
}

// 实训台接线在网页上的显示：串口服务器上每个口接了哪些设备。
// 串口下拉框展开时也用灰字标出来：运行区 provide，ControlView inject；设计器里没有实训台，用默认接线。
import type { InjectionKey, Ref } from 'vue'
import { BOARD_PORTS, DEFAULT_WIRING, PORT_DEVICE_NAMES, PORT_DEVICES, type PortDevice, type Wiring } from '@iot/shared'

/** 接在这个串口上的设备（项目 7 的 COM2 上并着 4017+ 和 4150） */
export function devicesOn(wiring: Wiring, port: string): PortDevice[] {
  return PORT_DEVICES.filter((device) => wiring[device] === port)
}

/** 串口 → 设备名，如 { COM2: 'ADAM-4017+、ADAM-4150' }；没接设备的口不列出 */
export function portLabels(wiring: Wiring = DEFAULT_WIRING): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const port of BOARD_PORTS) {
    const names = devicesOn(wiring, port).map((device) => PORT_DEVICE_NAMES[device])
    if (names.length) labels[port] = names.join('、')
  }
  return labels
}

export const PORT_LABELS: InjectionKey<Ref<Record<string, string>>> = Symbol('portLabels')

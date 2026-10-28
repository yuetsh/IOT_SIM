import { expect, test } from 'bun:test'
import { DEFAULT_WIRING, describePortProblem, portProblems } from '@iot/shared'
import { Board } from '../src/board'
import { sampleWiring } from '../src/samples'

test('滑块输入取整并限制在范围内，开关输入只接受布尔值', () => {
  const board = new Board()
  expect(board.applyInput({ type: 'boardInput', analog: { temperature: 31.6, light: 99999 } })).toBe(true)
  expect(board.state.analog.temperature).toBe(32)
  expect(board.state.analog.light).toBe(2000)

  board.applyInput({ type: 'boardInput', digital: { fire: true, smoke: 'yes' as unknown as boolean } })
  expect(board.state.digital.fire).toBe(true)
  expect(board.state.digital.smoke).toBe(false)

  // 发给运行器的读数按通道号排列：Vin0 温度、Vin1 湿度、Vin2 光照……；DI0 人体红外、DI1 火焰……
  const inputs = board.runnerInputs()
  expect(inputs.analog.slice(0, 3)).toEqual([32, 60, 2000])
  expect(inputs.digital).toEqual([false, true, false, false])
})

test('学生程序控制输出设备：LED 屏、4150 继电器、ZigBee 继电器', () => {
  const board = new Board()
  expect(board.applyDevice({ type: 'device', device: 'led', action: 'text', data: '欢迎' })).toBe(true)
  expect(board.applyDevice({ type: 'device', device: 'adam4150', action: 'do', data: [0, 1] })).toBe(true)
  expect(board.applyDevice({ type: 'device', device: 'zigbee', action: 'relay', data: [1, 1] })).toBe(true)
  expect(board.applyDevice({ type: 'device', device: 'adam4150', action: 'do', data: [9, 1] })).toBe(false)
  expect(board.state.ledText).toBe('欢迎')
  expect(board.state.relays[0]).toBe(true)
  expect(board.state.zigbee).toEqual([false, true])

  board.reset()
  expect(board.state.relays.every((on) => !on)).toBe(true)
  expect(board.state.ledText).toBe('')
})

test('接线：记下程序打开的串口，指出打开错了的设备；复位不改接线，程序结束时串口关闭', () => {
  const board = new Board()
  board.applyDevice({ type: 'device', device: 'adam4017', action: 'open', data: 'COM2' })
  board.applyDevice({ type: 'device', device: 'adam4150', action: 'open', data: 'com2' })
  board.applyDevice({ type: 'device', device: 'led', action: 'open', data: '' })
  expect(portProblems(board.state).map(describePortProblem)).toEqual([
    '程序在 com2 上打开 ADAM-4150，它接在 COM3',
    '程序没有选串口就打开了 LED 屏，它接在 COM5',
  ])

  // 项目 7：4150 并到 COM2 的 485 总线上
  expect(board.setWiring({ ...DEFAULT_WIRING, adam4150: 'COM2' })).toBe(true)
  expect(board.setWiring({ ...DEFAULT_WIRING, adam4150: 'COM2' })).toBe(false)
  expect(board.runnerInputs().wiring?.adam4150).toBe('COM2')
  expect(portProblems(board.state).map((w) => w.device)).toEqual(['led'])

  board.applyDevice({ type: 'device', device: 'led', action: 'close', data: null })
  expect(portProblems(board.state)).toEqual([])
  board.reset()
  expect(board.state.wiring.adam4150).toBe('COM2')
  expect(board.state.opened.adam4017).toBe('COM2')
  board.programExited()
  expect(Object.values(board.state.opened).every((port) => port === null)).toBe(true)
})

test('串口没打开（或已关闭）时程序还在读写设备：提示一次，打开后、程序结束时清除', () => {
  const board = new Board()
  expect(board.applyDevice({ type: 'device', device: 'adam4150', action: 'unopened', data: null })).toBe(true)
  expect(board.applyDevice({ type: 'device', device: 'adam4150', action: 'unopened', data: null })).toBe(false)
  expect(portProblems(board.state).map(describePortProblem)).toEqual(['ADAM-4150 的串口没有打开，程序却在读写它（它接在 COM3）'])

  board.applyDevice({ type: 'device', device: 'adam4150', action: 'open', data: 'COM3' })
  expect(portProblems(board.state)).toEqual([])
  board.applyDevice({ type: 'device', device: 'adam4150', action: 'close', data: null })
  board.applyDevice({ type: 'device', device: 'adam4150', action: 'unopened', data: null })
  expect(portProblems(board.state).map((p) => p.device)).toEqual(['adam4150'])
  board.programExited()
  expect(portProblems(board.state)).toEqual([])
})

test('实验的接线：项目 7 把 4150 并到 COM2，其他实验和未知实验用默认接线', async () => {
  expect(await sampleWiring('p7-t1-智慧教室')).toEqual({ ...DEFAULT_WIRING, adam4150: 'COM2' })
  expect(await sampleWiring('p4-t3-报警灯')).toEqual(DEFAULT_WIRING)
  expect(await sampleWiring('../p7-t1-智慧教室')).toEqual(DEFAULT_WIRING)
  expect(await sampleWiring()).toEqual(DEFAULT_WIRING)
})

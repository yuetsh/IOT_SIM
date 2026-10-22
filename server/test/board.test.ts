import { expect, test } from 'bun:test'
import { Board } from '../src/board'

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

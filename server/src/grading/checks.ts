// 评分规则（每个实验的 checks.yaml）：书上评价表的功能项，每项是一串操作步骤和期望结果。
// 规则写错时报出是哪一项、哪一步，方便改。
import { ANALOG_INFO, type AnalogKey, DIGITAL_CHANNELS, type DigitalKey } from '@iot/shared'

export interface Check {
  title: string
  steps: Step[]
}

export type Step =
  | { kind: 'click'; control: string }
  | { kind: 'text'; control: string; value: string }
  | { kind: 'select'; control: string; item: string }
  /** 点数据表格的单元格；column 是列号或列标题 */
  | { kind: 'cell'; control: string; row: number; column: number | string }
  /** 在数据表格的单元格里输入新值 */
  | { kind: 'edit'; control: string; row: number; column: number | string; value: string }
  /** 在日期时间选择器里选日期（和时间）：2024-01-15 或 2024-01-15 08:30:00 */
  | { kind: 'pick'; control: string; value: string }
  | { kind: 'board'; analog: Partial<Record<AnalogKey, number>>; digital: Partial<Record<DigitalKey, boolean>> }
  | { kind: 'wait'; ms: number }
  /** desc：给学生看的期望说明，如"显示当前时间"，不写就按期望自动生成 */
  | { kind: 'expect'; expect: Expectation; within: number; desc?: string }

export type Expectation =
  /** 控件属性等于某个值：text → Text，ledText → LedText（LED 控件），enabled → Enabled，checked → Checked，on → IsOn（灯泡、报警灯） */
  | { kind: 'prop'; control: string; prop: string; value: unknown }
  /** 控件文字包含某段文字；列表框是任意一个列表项包含 */
  | { kind: 'contains'; control: string; text: string }
  | { kind: 'matches'; control: string; pattern: RegExp; source: string }
  /** 一段时间内控件文字不变（比如定时器已经停止） */
  | { kind: 'unchanged'; control: string; ms: number }
  | { kind: 'led'; text: string }
  | { kind: 'relay'; index: number; on: boolean }
  | { kind: 'zigbee'; index: number; on: boolean }
  | { kind: 'messageBox'; text: string }
  /** 图片框里显示了图片 */
  | { kind: 'image'; control: string }
  /** 摄像头在传画面（on）/ 已关闭（off），或云台比开始时朝某个方向转过 */
  | { kind: 'camera'; state: 'on' | 'off' | 'up' | 'down' | 'left' | 'right' }
  /** 程序用 Image.Save 保存了图片，路径包含这段文字（如 Camera/） */
  | { kind: 'savedImage'; path: string }
  /** 数据表格里有（present）/ 没有一行同时满足这些"列标题=值" */
  | { kind: 'row'; control: string; cells: Record<string, string>; present: boolean }
  | { kind: 'console'; text: string }

/** 期望默认最多等多久（毫秒）；依赖定时器的检查在规则里写 within */
const DEFAULT_WITHIN = 2000

const PROP_KEYS: Record<string, string> = { text: 'Text', ledText: 'LedText', enabled: 'Enabled', checked: 'Checked', on: 'IsOn' }
const STRING_PROPS = new Set(['Text', 'LedText'])

/** "6s"、"500ms" 或毫秒数 */
function duration(value: unknown, where: string): number {
  if (typeof value === 'number' && value >= 0) return value
  const m = typeof value === 'string' ? /^(\d+(?:\.\d+)?)\s*(ms|s)$/.exec(value.trim()) : null
  if (!m) throw new Error(`${where}：时长要写成 6s 或 500ms，现在是 ${JSON.stringify(value)}`)
  return Number(m[1]) * (m[2] === 's' ? 1000 : 1)
}

function str(value: unknown, where: string, what: string): string {
  if (typeof value === 'string' && value) return value
  if (typeof value === 'number') return String(value)
  throw new Error(`${where}：缺少${what}`)
}

function bool(value: unknown, where: string, what: string): boolean {
  if (typeof value === 'boolean') return value
  throw new Error(`${where}：${what}要写 true 或 false`)
}

function parseExpectation(raw: Record<string, unknown>, where: string): Expectation {
  if ('led' in raw) return { kind: 'led', text: str(raw.led, where, ' LED 屏应显示的文字') }
  if ('messageBox' in raw) return { kind: 'messageBox', text: str(raw.messageBox, where, '提示框应包含的文字') }
  if ('console' in raw) return { kind: 'console', text: str(raw.console, where, '控制台应输出的文字') }
  if ('camera' in raw) {
    const state = String(raw.camera)
    if (!['on', 'off', 'up', 'down', 'left', 'right'].includes(state)) throw new Error(`${where}：camera 要写 on、off、up、down、left 或 right`)
    return { kind: 'camera', state: state as Extract<Expectation, { kind: 'camera' }>['state'] }
  }
  if ('savedImage' in raw) return { kind: 'savedImage', path: str(raw.savedImage, where, '保存的图片路径应包含的文字') }
  if ('relay' in raw) return { kind: 'relay', index: Number(raw.relay), on: bool(raw.on, where, 'on') }
  if ('zigbee' in raw) return { kind: 'zigbee', index: Number(raw.zigbee), on: bool(raw.on, where, 'on') }

  const control = str(raw.control, where, '控件名 control')
  if ('contains' in raw) return { kind: 'contains', control, text: str(raw.contains, where, 'contains') }
  if ('matches' in raw) {
    const source = str(raw.matches, where, 'matches')
    return { kind: 'matches', control, pattern: new RegExp(source), source }
  }
  if ('unchanged' in raw) return { kind: 'unchanged', control, ms: duration(raw.unchanged, where) }
  if ('row' in raw || 'noRow' in raw) {
    const list = raw.row ?? raw.noRow
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${where}：row 要写成 [列标题=值, ...]`)
    const cells: Record<string, string> = {}
    for (const item of list) {
      const [key, ...rest] = String(item).split('=')
      if (!key || rest.length === 0) throw new Error(`${where}：row 里的 ${item} 要写成 列标题=值`)
      cells[key.trim()] = rest.join('=').trim()
    }
    return { kind: 'row', control, cells, present: 'row' in raw }
  }
  if ('image' in raw) return { kind: 'image', control }
  for (const [key, prop] of Object.entries(PROP_KEYS)) {
    if (key in raw) return { kind: 'prop', control, prop, value: STRING_PROPS.has(prop) ? String(raw[key]) : bool(raw[key], where, key) }
  }
  throw new Error(`${where}：不认识的期望 ${JSON.stringify(raw)}`)
}

function parseBoard(raw: Record<string, unknown>, where: string): Step {
  const analog: Partial<Record<AnalogKey, number>> = {}
  const digital: Partial<Record<DigitalKey, boolean>> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key in ANALOG_INFO && typeof value === 'number') analog[key as AnalogKey] = value
    else if ((DIGITAL_CHANNELS as readonly string[]).includes(key) && typeof value === 'boolean') digital[key as DigitalKey] = value
    else throw new Error(`${where}：实训台没有 ${key}，或者值的类型不对（模拟量写数字，开关量写 true / false）`)
  }
  return { kind: 'board', analog, digital }
}

function parseStep(raw: unknown, where: string): Step {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${where}：每一步要写成"操作: 内容"`)
  const [[kind, value], ...rest] = Object.entries(raw as Record<string, unknown>)
  if (kind === 'expect' && rest.length === 0) {
    const body = value as Record<string, unknown>
    const { within, desc, ...expectation } = body
    return {
      kind: 'expect',
      expect: parseExpectation(expectation, where),
      within: within === undefined ? DEFAULT_WITHIN : duration(within, where),
      ...(desc === undefined ? {} : { desc: String(desc) }),
    }
  }
  if (rest.length > 0) throw new Error(`${where}：一步只能写一个操作`)
  const obj = (value ?? {}) as Record<string, unknown>
  switch (kind) {
    case 'click':
      return { kind, control: str(value, where, '要点击的控件名') }
    case 'text':
      return { kind, control: str(obj.control, where, '控件名 control'), value: String(obj.value ?? '') }
    case 'select':
      return { kind, control: str(obj.control, where, '控件名 control'), item: str(obj.item, where, '要选的项 item') }
    case 'pick': {
      const value = str(obj.value, where, '日期 value')
      if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(value)) throw new Error(`${where}：日期要写成 2024-01-15 或 2024-01-15 08:30:00`)
      return { kind, control: str(obj.control, where, '控件名 control'), value }
    }
    case 'cell':
    case 'edit': {
      const control = str(obj.control, where, '控件名 control')
      if (typeof obj.row !== 'number') throw new Error(`${where}：row 要写行号（从 0 开始）`)
      const column = typeof obj.column === 'number' ? obj.column : str(obj.column, where, '列号或列标题 column')
      return kind === 'cell' ? { kind, control, row: obj.row, column } : { kind, control, row: obj.row, column, value: String(obj.value ?? '') }
    }
    case 'board':
      return parseBoard(obj, where)
    case 'wait':
      return { kind, ms: duration(value, where) }
    default:
      throw new Error(`${where}：不认识的操作 ${kind}`)
  }
}

/** 解析 checks.yaml 的内容 */
export function parseChecks(yaml: string): Check[] {
  const raw = Bun.YAML.parse(yaml)
  if (!Array.isArray(raw)) throw new Error('评分规则应该是一个列表，每项以"- title:"开头')
  return raw.map((item: { title?: unknown; steps?: unknown }, i: number) => {
    const title = str(item?.title, `第 ${i + 1} 项`, '名称 title')
    if (!Array.isArray(item.steps) || item.steps.length === 0) throw new Error(`第 ${i + 1} 项"${title}"：缺少步骤 steps`)
    return { title, steps: item.steps.map((step, j) => parseStep(step, `第 ${i + 1} 项"${title}"第 ${j + 1} 步`)) }
  })
}

// 自动评分：编译一次学生工程，每个检查项各启动一次程序，按步骤操作并核对结果。
// 检查大部分时间在等定时器，CPU 主要花在编译和启动程序上；2 核的服务器全站同时跑 GRADE_CONCURRENCY 个检查，其余排队。
import type { CheckResult, ControlNode, GradeResult } from '@iot/shared'
import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { config } from '../config'
import { compileService } from '../compile-service'
import { gradingDatabaseDir } from '../databases'
import type { Check, Expectation, Step } from './checks'
import { ProgramDriver } from './driver'

const GRADE_CONCURRENCY = 6
/** 点数据表格的单元格前，最多等多久让那一行出现（程序可能还在查询数据库、刷新表格） */
const GRID_WAIT = 5000
/** 程序启动后多久内应该显示出窗体 */
const START_TIMEOUT = 10_000

const RELAY_NAMES = ['报警灯', '照明灯', '路灯', '插座 1', '插座 2']
const ZIGBEE_NAMES = ['ZigBee 节点 0', '照明灯 1']
/** 摄像头云台开始时的位置（见 IPCameraHelper.cs） */
const CAMERA_START = { x: 3, y: 1 }
const CAMERA_WORDS = { on: '开启（传送画面）', off: '关闭', up: '向上转', down: '向下转', left: '向左转', right: '向右转' }

// ---------- 并发限制 ----------
let running = 0
const waiting: (() => void)[] = []

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= GRADE_CONCURRENCY) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await task()
  } finally {
    running--
    waiting.shift()?.()
  }
}

/** 给学生工程评分；dir 是已写好源文件的工程目录，sampleId 决定用哪个实验的预置数据库（每个检查项一份） */
export async function grade(dir: string, checks: Check[], sampleId?: string): Promise<GradeResult> {
  const start = Date.now()
  const compiled = await compileService.compile(dir)
  if (!compiled.ok) {
    return {
      compiled: false,
      results: checks.map((c) => ({ title: c.title, passed: false, message: '编译没有通过，先改正编译错误' })),
      ms: Date.now() - start,
    }
  }
  const results = await Promise.all(checks.map((check) => withSlot(() => runCheck(dir, check, sampleId))))
  return { compiled: true, results, ms: Date.now() - start }
}

class Failure extends Error {}

async function runCheck(dir: string, check: Check, sampleId?: string): Promise<CheckResult> {
  const driver = new ProgramDriver()
  const dbDir = sampleId ? await gradingDatabaseDir(sampleId) : undefined
  try {
    driver.start(dir, dbDir)
    if (!(await driver.waitFor(() => driver.forms.length > 0 || driver.exited, START_TIMEOUT)) || driver.forms.length === 0) {
      throw new Failure(driver.exceptions[0] ? `程序出错：${driver.exceptions[0]}` : '程序启动后没有显示窗体')
    }
    for (const step of check.steps) {
      await runStep(driver, step)
      if (driver.exceptions.length > 0) throw new Failure(`程序出错：${driver.exceptions[0]}`)
    }
    return { title: check.title, passed: true }
  } catch (error) {
    if (error instanceof Failure) {
      // 程序抛了异常时，它才是不通过的根本原因（异常消息可能比失败的检查晚到一点）
      const message = driver.exceptions[0] ? `程序出错：${driver.exceptions[0]}` : error.message
      return { title: check.title, passed: false, message }
    }
    throw error
  } finally {
    driver.stop()
    if (dbDir) await rm(dbDir, { recursive: true, force: true })
  }
}

/**
 * 素材库图片的编号：运行器按图片内容的 SHA-1 给图片编号（Image.SimKey），
 * 所以拿素材文件算出的编号和控件属性里的编号相同，就是显示了这张素材。
 */
const galleryKeys = new Map<string, string | null>()

async function galleryKey(name: string): Promise<string | null> {
  if (!galleryKeys.has(name)) {
    const file = Bun.file(`${dirname(config.runnerDll)}/Resources/gallery/${name}.png`)
    const key = (await file.exists()) ? new Bun.CryptoHasher('sha1').update(await file.arrayBuffer()).digest('hex') : null
    galleryKeys.set(name, key)
  }
  return galleryKeys.get(name)!
}

function need(driver: ProgramDriver, name: string): ControlNode {
  const node = driver.find(name)
  if (!node) throw new Failure(`找不到名为 ${name} 的控件（书上规定的控件名，注意大小写）`)
  return node
}

async function runStep(driver: ProgramDriver, step: Step) {
  switch (step.kind) {
    case 'click': {
      const node = need(driver, step.control)
      if (node.props.Enabled === false) throw new Failure(`${step.control} 是灰色的（Enabled 为 false），点不了`)
      // 和浏览器一样：图片框先收到鼠标按下、松开，再收到单击（教材项目 8 的方向键在按下、松开时转动摄像机）
      if (node.type === 'PictureBox') {
        driver.act(node, { action: 'mouseDown', button: 'left', x: 1, y: 1 })
        driver.act(node, { action: 'mouseUp', button: 'left', x: 1, y: 1 })
      }
      driver.act(node, { action: 'click' })
      await driver.settle()
      break
    }
    case 'text':
      driver.act(need(driver, step.control), { action: 'text', value: step.value })
      await driver.settle()
      break
    case 'select': {
      const node = need(driver, step.control)
      if (node.type !== 'ComboBox') throw new Failure(`${step.control} 不是下拉框`)
      // 和浏览器一样先展开（教材在下拉框的 Click 里填充串口列表），再选
      driver.act(node, { action: 'dropDown' })
      await driver.settle()
      const items = ((node.props.Items as unknown[] | undefined) ?? []).map(String)
      const index = items.indexOf(step.item)
      if (index < 0) {
        // 串口列表是空的：最常见的原因是没有填充
        const hint = items.length === 0 && /^COM\d+$/.test(step.item) ? '。串口列表要在窗体的 Load 事件或下拉框的 Click 事件里用 SerialPort.GetPortNames() 填充' : ''
        throw new Failure(`下拉框 ${step.control} 里没有"${step.item}"（现在的选项：${items.length ? items.join('、') : '空'}）${hint}`)
      }
      driver.act(node, { action: 'select', index })
      await driver.settle()
      break
    }
    case 'cell':
    case 'edit': {
      const node = need(driver, step.control)
      if (node.type !== 'DataGridView') throw new Failure(`${step.control} 不是数据表格`)
      // 上一步（如保存后重新查询）可能还在刷新表格：等这一行出现
      await driver.waitFor(() => gridRows(need(driver, step.control)).length > step.row, GRID_WAIT)
      const rows = gridRows(node)
      if (step.row >= rows.length) throw new Failure(`数据表格 ${step.control} 里没有第 ${step.row + 1} 行（现在有 ${rows.length} 行数据）`)
      const column = typeof step.column === 'number' ? step.column : gridColumns(node).findIndex((c) => c.header === step.column || c.name === step.column)
      if (column < 0) throw new Failure(`数据表格 ${step.control} 里没有"${step.column}"列（现在的列：${gridColumns(node).map((c) => c.header).join('、') || '没有'}）`)
      driver.act(node, { action: 'cellClick', row: step.row, column })
      if (step.kind === 'edit') driver.act(node, { action: 'cellEdit', row: step.row, column, value: step.value })
      await driver.settle()
      break
    }
    case 'pick': {
      const node = need(driver, step.control)
      if (node.type !== 'DateTimePicker') throw new Failure(`${step.control} 不是日期时间选择器`)
      // 只给日期时：时间取中午，查询"某天到某天"时不受时分影响
      const [date, time = '12:00:00'] = step.value.split(' ')
      driver.act(node, { action: 'pick', value: `${date}T${time.length === 5 ? `${time}:00` : time}` })
      await driver.settle()
      break
    }
    case 'board':
      driver.setBoard(step)
      await driver.settle()
      break
    case 'clock':
      driver.setClock(step.time, step.speed)
      await driver.settle()
      break
    case 'wait':
      await Bun.sleep(step.ms)
      break
    case 'expect':
      await expectStep(driver, step)
      break
  }
}

interface GridColumn {
  name: string
  header: string
}

function gridColumns(node: ControlNode): GridColumn[] {
  return (node.props.Columns as GridColumn[] | undefined) ?? []
}

/** 数据表格的数据行（不含最下面供新增的空行），每行按列序号排列的显示文字 */
function gridRows(node: ControlNode): string[][] {
  const rows = (node.props.Rows as { items: { cells: unknown[]; isNew: boolean }[] } | undefined)?.items ?? []
  return rows.filter((r) => !r.isNew).map((r) => r.cells.map((c) => (c === true ? 'True' : c === false ? 'False' : String(c ?? ''))))
}

function rowMatches(node: ControlNode, cells: Record<string, string>) {
  const columns = gridColumns(node)
  const index = Object.keys(cells).map((key) => columns.findIndex((c) => c.header === key || c.name === key))
  if (index.some((i) => i < 0)) return false
  return gridRows(node).some((row) => Object.values(cells).every((value, i) => row[index[i]] === value))
}

const seconds = (ms: number) => `${Math.round(ms / 100) / 10} 秒`
const quote = (value: unknown) => (value === undefined || value === null || value === '' ? '空的' : `"${String(value)}"`)

async function expectStep(driver: ProgramDriver, step: Extract<Step, { kind: 'expect' }>) {
  const { expect: e, within } = step
  const wait = within > 2000 ? `${seconds(within)}内` : ''

  if (e.kind === 'unchanged') {
    const node = need(driver, e.control)
    const before = node.props.Text
    await Bun.sleep(e.ms)
    if (node.props.Text !== before) {
      throw new Failure(`期望 ${e.control} ${step.desc ?? `在 ${seconds(e.ms)}内保持不变`}，实际从${quote(before)}变成了${quote(node.props.Text)}`)
    }
    return
  }

  let key: string | undefined
  if (e.kind === 'image' && e.name) {
    const found = await galleryKey(e.name)
    if (!found) throw new Error(`评分规则写错了：素材库里没有图片 ${e.name}`)
    key = found
  }
  const ok = await driver.waitFor(() => satisfied(driver, e, key), within)
  if (!ok) throw new Failure(describeFailure(driver, e, step.desc, wait))
}

/** 列表框的 Text 只是选中的那一项，检查"包含"时看所有列表项 */
function listItems(node: ControlNode | undefined): string[] | undefined {
  return node?.type === 'ListBox' ? ((node.props.Items as unknown[] | undefined) ?? []).map(String) : undefined
}

/** 控件属性里的图片（{ key, width, height }） */
const imageKey = (value: unknown) => (value as { key?: string } | null | undefined)?.key

function satisfied(driver: ProgramDriver, e: Exclude<Expectation, { kind: 'unchanged' }>, imageName?: string): boolean {
  const props = (name: string) => driver.find(name)?.props
  switch (e.kind) {
    case 'prop': {
      if (e.prop !== 'Visible') return props(e.control)?.[e.prop] === e.value
      const node = driver.find(e.control)
      return node !== undefined && driver.isVisible(node) === e.value
    }
    case 'contains': {
      const items = listItems(driver.find(e.control))
      return items ? items.some((item) => item.includes(e.text)) : String(props(e.control)?.Text ?? '').includes(e.text)
    }
    case 'matches':
      return e.pattern.test(String(props(e.control)?.Text ?? ''))
    case 'led':
      return driver.board.state.ledText.includes(e.text)
    case 'relay':
      return driver.board.state.relays[e.index] === e.on
    case 'zigbee':
      return driver.board.state.zigbee[e.index] === e.on
    case 'messageBox':
      return driver.messageBoxes.some((box) => box.text.includes(e.text))
    case 'console':
      return driver.console.includes(e.text)
    case 'image': {
      const key = imageKey(props(e.control)?.[e.prop])
      return imageName ? key === imageName : Boolean(key)
    }
    case 'window':
      return driver.forms.some((f) => f.name === e.name) === e.open
    case 'exited':
      return driver.exited
    case 'chart': {
      const series = chartSeries(driver.find(e.control))
      return series.length > 0 && series.every((s) => s.points.length >= e.points)
    }
    case 'camera': {
      const { on, x, y } = driver.board.state.camera
      return { on, off: !on, up: y < CAMERA_START.y, down: y > CAMERA_START.y, left: x < CAMERA_START.x, right: x > CAMERA_START.x }[e.state]
    }
    case 'savedImage':
      return driver.savedImages.some((path) => path.includes(e.path))
    case 'media':
      return driver.played.includes(e.name)
    case 'row': {
      const node = driver.find(e.control)
      return node !== undefined && rowMatches(node, e.cells) === e.present
    }
  }
}

function chartSeries(node: ControlNode | undefined): { name: string; points: unknown[] }[] {
  return (node?.props.Chart as { series?: { name: string; points: unknown[] }[] } | undefined)?.series ?? []
}

function describeFailure(driver: ProgramDriver, e: Exclude<Expectation, { kind: 'unchanged' }>, desc: string | undefined, wait: string): string {
  const prefix = wait ? `${wait}` : ''
  const onOff = (on: boolean) => (on ? '打开' : '关闭')
  switch (e.kind) {
    case 'prop': {
      const actual = need(driver, e.control).props[e.prop]
      if (e.prop === 'Text' || e.prop === 'LedText') return `期望${prefix} ${e.control} ${desc ?? `显示"${e.value}"`}，实际是${quote(actual)}`
      if (e.prop === 'Enabled') return `期望${prefix} ${e.control} ${desc ?? (e.value ? '可用' : '变成灰色不可用')}，实际${actual === false ? '不可用' : '可用'}`
      if (e.prop === 'Visible') return `期望${prefix} ${e.control} ${desc ?? (e.value ? '显示出来' : '隐藏')}，实际${driver.isVisible(need(driver, e.control)) ? '显示着' : '是隐藏的'}`
      if (e.prop === 'Checked') return `期望${prefix} ${e.control} ${desc ?? (e.value ? '被选中' : '没有被选中')}，实际${actual ? '被选中' : '没有被选中'}`
      if (e.prop === 'IsOn') return `期望${prefix}窗体上的 ${e.control} ${desc ?? (e.value ? '亮' : '灭')}，实际是${actual ? '亮' : '灭'}的`
      if (e.prop === 'Value') return `期望${prefix} ${e.control} ${desc ?? `的值是 ${String(e.value)}`}，实际是 ${String(actual)}`
      return `期望${prefix} ${e.control} 的 ${e.prop} 是 ${String(e.value)}，实际是 ${String(actual)}`
    }
    case 'contains': {
      const node = need(driver, e.control)
      const items = listItems(node)
      if (items) return `期望${prefix} ${e.control} ${desc ?? `的列表项包含"${e.text}"`}，实际${items.length ? `列表里是 ${items.map((i) => `"${i}"`).join('、')}` : '列表是空的'}`
      return `期望${prefix} ${e.control} ${desc ?? `的文字包含"${e.text}"`}，实际是${quote(node.props.Text)}`
    }
    case 'matches':
      return `期望${prefix} ${e.control} ${desc ?? `的文字符合 ${e.pattern}`}，实际是${quote(need(driver, e.control).props.Text)}`
    case 'led':
      return `期望${prefix}实训台 LED 屏${desc ?? `显示"${e.text}"`}，实际${driver.board.state.ledText ? `显示"${driver.board.state.ledText}"` : '什么也没显示'}`
    case 'relay':
      return `期望${prefix}实训台的${RELAY_NAMES[e.index] ?? `DO${e.index}`}（ADAM-4150 DO${e.index}）${desc ?? onOff(e.on)}，实际是${onOff(driver.board.state.relays[e.index])}的`
    case 'zigbee':
      return `期望${prefix}实训台的${ZIGBEE_NAMES[e.index] ?? `ZigBee 继电器 ${e.index}`}${desc ?? onOff(e.on)}，实际是${onOff(driver.board.state.zigbee[e.index])}的`
    case 'messageBox': {
      const shown = driver.messageBoxes.map((b) => `"${b.text}"`).join('、')
      return `期望${prefix}弹出${desc ?? `包含"${e.text}"的提示框`}，${shown ? `实际弹出的是 ${shown}` : '实际没有弹出提示框'}`
    }
    case 'console':
      return `期望${prefix}控制台${desc ?? `输出"${e.text}"`}，实际输出${quote(driver.console.trim())}`
    case 'image': {
      const what = e.prop === 'Image' ? '图片' : '背景图片'
      const has = Boolean(imageKey(need(driver, e.control).props[e.prop]))
      if (!e.name) return `期望${prefix} ${e.control} ${desc ?? `显示${what}`}，实际没有${what}`
      return `期望${prefix} ${e.control} ${desc ?? `的${what}是 ${e.name}`}，实际${has ? '是别的图片' : `没有${what}`}`
    }
    case 'window':
      return `期望${prefix}${desc ?? (e.open ? `打开 ${e.name} 窗体` : `关闭 ${e.name} 窗体`)}，实际${e.open ? '没有打开' : '还开着'}（现在打开的窗体：${driver.forms.map((f) => f.name).join('、') || '没有'}）`
    case 'exited':
      return `期望${prefix}${desc ?? '程序退出'}，实际程序还在运行（打开的窗体：${driver.forms.map((f) => f.name).join('、') || '没有'}）`
    case 'chart': {
      const series = chartSeries(driver.find(e.control))
      const actual = series.length ? series.map((s) => `${s.name} ${s.points.length} 个`).join('、') : '没有数据'
      return `期望${prefix}图表 ${e.control} ${desc ?? `每条曲线至少有 ${e.points} 个数据点`}，实际${actual}`
    }
    case 'camera':
      return `期望${prefix}网络摄像机${desc ?? CAMERA_WORDS[e.state]}，实际${driver.board.state.camera.on ? '开着' : '没有开启'}${e.state === 'on' || e.state === 'off' ? '' : '、云台没有朝这个方向转'}`
    case 'savedImage': {
      const saved = driver.savedImages.map((p) => `"${p}"`).join('、')
      return `期望${prefix}${desc ?? `保存图片到"${e.path}"`}，${saved ? `实际保存的是 ${saved}` : '实际没有保存图片'}`
    }
    case 'media':
      return `期望${prefix}${desc ?? `播放 ${e.name}`}，${driver.played.length ? `实际播放的是 ${driver.played.join('、')}` : '实际没有播放声音'}`
    case 'row': {
      const node = need(driver, e.control)
      const wanted = Object.entries(e.cells).map(([k, v]) => `${k}=${v}`).join('，')
      const columns = gridColumns(node)
      const missing = Object.keys(e.cells).filter((key) => !columns.some((c) => c.header === key || c.name === key))
      if (missing.length) return `期望${prefix}数据表格 ${e.control} 里有"${missing.join('、')}"列，实际的列是 ${columns.map((c) => c.header).join('、') || '（没有数据）'}`
      const rows = gridRows(node)
      const shown = rows.slice(0, 5).map((r) => r.join(' | ')).join('；')
      return `期望${prefix}数据表格 ${e.control} ${desc ?? (e.present ? `有一行 ${wanted}` : `没有 ${wanted} 的行`)}，实际表格里${rows.length ? `是：${shown}${rows.length > 5 ? ' ……' : ''}` : '没有数据'}`
    }
  }
}

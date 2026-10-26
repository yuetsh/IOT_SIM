// 对 Designer.cs 文档的编辑操作。每个操作返回新文档，不修改传入的文档。
// 修改过的语句清掉原文（text），生成时按 VS 格式重写；其余语句原样保留。
import { type ControlDef, controlDef, isContainerType } from './catalog'
import { CHART_TYPE, DEFAULT_CHART, removeChartDeclarations, writeChart } from './chart'
import type { Block, DesignerDocument, Stmt } from './document'
import { renderValue, type Value } from './values'

export interface ControlInfo {
  name: string
  type: string
  /** 所在容器：'' 表示直接放在窗体上；null 表示不在窗体上（如 Timer 组件） */
  parent: string | null
}

// ---------- 查询 ----------

export function listControls(doc: DesignerDocument): ControlInfo[] {
  const parents = new Map<string, string>()
  for (const block of doc.blocks) {
    for (const stmt of block.stmts) if (stmt.kind === 'add') parents.set(stmt.child, stmt.target)
  }
  return doc.prologue.flatMap((stmt) => (stmt.kind === 'create' ? [{ name: stmt.name, type: stmt.type, parent: parents.get(stmt.name) ?? null }] : []))
}

/** 某个容器里的子控件，按 Controls.Add 的顺序（第一个在最上层） */
export function childrenOf(doc: DesignerDocument, parent: string): string[] {
  return findBlock(doc, parent)?.stmts.flatMap((s) => (s.kind === 'add' ? [s.child] : [])) ?? []
}

export function findBlock(doc: DesignerDocument, target: string): Block | undefined {
  const name = target || doc.formName
  return doc.blocks.find((b) => b.name === name)
}

export function getPropText(doc: DesignerDocument, target: string, path: string): string | undefined {
  const stmt = findBlock(doc, target)?.stmts.find((s) => s.kind === 'prop' && s.path === path)
  return stmt?.kind === 'prop' ? stmt.value : undefined
}

export function getEventHandler(doc: DesignerDocument, target: string, event: string): string | undefined {
  const stmt = findBlock(doc, target)?.stmts.find((s) => s.kind === 'event' && s.event === event)
  return stmt?.kind === 'event' ? stmt.handler : undefined
}

export function getItems(doc: DesignerDocument, target: string): string[] {
  const stmt = findBlock(doc, target)?.stmts.find((s) => s.kind === 'items')
  return stmt?.kind === 'items' ? stmt.items : []
}

export function typeOf(doc: DesignerDocument, name: string) {
  return listControls(doc).find((c) => c.name === name)?.type
}

// ---------- 修改 ----------

function clone(doc: DesignerDocument): DesignerDocument {
  return structuredClone(doc)
}

/** 取得控件（或窗体）的属性块；没有就新建，位置在窗体块之前（与 VS 一样按创建顺序排列） */
function ensureBlock(doc: DesignerDocument, target: string): Block {
  const existing = findBlock(doc, target)
  if (existing) return existing
  const block: Block = { name: target || doc.formName, stmts: [] }
  const formIndex = doc.blocks.findIndex((b) => b.name === doc.formName)
  doc.blocks.splice(formIndex < 0 ? doc.blocks.length : formIndex, 0, block)
  return block
}

/** VS 按属性名排序输出：Controls.Add 当作 "Controls"、Items.AddRange 当作 "Items"，事件排在所有属性之后 */
function sortKey(stmt: Stmt): string | undefined {
  if (stmt.kind === 'prop') return stmt.path
  if (stmt.kind === 'add') return 'Controls'
  if (stmt.kind === 'items') return 'Items'
  return undefined
}

function insertSorted(block: Block, stmt: Stmt) {
  const key = sortKey(stmt)!
  let index = block.stmts.findIndex((s) => s.kind === 'event' || (sortKey(s) !== undefined && sortKey(s)! > key))
  if (index < 0) index = block.stmts.length
  block.stmts.splice(index, 0, stmt)
}

export function setProp(doc: DesignerDocument, target: string, path: string, value: Value | null): DesignerDocument {
  const next = clone(doc)
  applyProp(next, target, path, value)
  if (path === 'AutoSize') syncLayout(next)
  return next
}

function applyProp(doc: DesignerDocument, target: string, path: string, value: Value | null) {
  const block = ensureBlock(doc, target)
  const index = block.stmts.findIndex((s) => s.kind === 'prop' && s.path === path)
  if (value === null) {
    if (index >= 0) block.stmts.splice(index, 1)
    return
  }
  const text = renderValue(value)
  if (index >= 0) {
    const stmt = block.stmts[index] as Extract<Stmt, { kind: 'prop' }>
    if (stmt.value !== text) block.stmts[index] = { kind: 'prop', target: stmt.target, path, value: text }
    return
  }
  insertSorted(block, { kind: 'prop', target, path, value: text })
}

export function setItems(doc: DesignerDocument, target: string, items: string[]): DesignerDocument {
  const next = clone(doc)
  const block = ensureBlock(next, target)
  const index = block.stmts.findIndex((s) => s.kind === 'items')
  if (index >= 0) block.stmts.splice(index, 1)
  if (items.length) insertSorted(block, { kind: 'items', target, items: items.map((s) => renderValue({ kind: 'string', value: s })) })
  return next
}

/** 设置事件处理方法；handler 为 null 时删除这个事件绑定 */
export function setEvent(doc: DesignerDocument, target: string, event: string, delegate: string, handler: string | null): DesignerDocument {
  const next = clone(doc)
  const block = ensureBlock(next, target)
  const index = block.stmts.findIndex((s) => s.kind === 'event' && s.event === event)
  if (index >= 0) block.stmts.splice(index, 1)
  if (handler) {
    const stmt: Stmt = { kind: 'event', target, event, delegate, handler }
    // 事件排在属性之后，按事件名排序
    let at = block.stmts.findIndex((s) => s.kind === 'event' && s.event > event)
    if (at < 0) at = block.stmts.length
    block.stmts.splice(index >= 0 ? index : at, 0, stmt)
  }
  return next
}

const KEYWORDS = new Set(
  'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while'.split(
    ' ',
  ),
)

/** 检查控件名是否可用；可用返回 null，否则返回原因 */
export function checkName(doc: DesignerDocument, name: string, current?: string): string | null {
  if (!/^[A-Za-z_一-龥][A-Za-z0-9_一-龥]*$/.test(name)) return '名称只能由字母、数字、下划线组成，且不能以数字开头'
  if (KEYWORDS.has(name)) return `“${name}”是 C# 的关键字，不能作为名称`
  if (name !== current && (name === doc.formName || name === doc.className || name === 'components' || listControls(doc).some((c) => c.name === name))) {
    return `已经有名为“${name}”的控件`
  }
  return null
}

export function uniqueName(doc: DesignerDocument, prefix: string) {
  for (let n = 1; ; n++) if (checkName(doc, `${prefix}${n}`) === null) return `${prefix}${n}`
}

/** 往容器里添加控件（parent 为 '' 表示窗体）；组件（如 Timer）不放进容器。返回新文档和控件名 */
export function addControl(
  doc: DesignerDocument,
  def: ControlDef,
  parent: string,
  location: { x: number; y: number },
): { doc: DesignerDocument; name: string } {
  const next = clone(doc)
  const name = uniqueName(next, def.namePrefix)

  // 组件需要 components 容器：this.timer1 = new System.Windows.Forms.Timer(this.components);
  if (def.component && !next.prologue.some((s) => s.kind === 'raw' && s.text.startsWith('this.components = new'))) {
    next.prologue.unshift({ kind: 'raw', text: 'this.components = new System.ComponentModel.Container();' })
  }
  const create: Stmt = { kind: 'create', name, type: def.type, args: def.component ? 'this.components' : '' }
  const lastCreate = next.prologue.findLastIndex((s) => s.kind === 'create')
  const componentsAt = next.prologue.findIndex((s) => s.kind === 'raw' && s.text.startsWith('this.components = new'))
  next.prologue.splice(lastCreate >= 0 ? lastCreate + 1 : componentsAt + 1, 0, create)

  const block = ensureBlock(next, name)
  const props: [string, Value][] = [...def.initial(name)]
  if (!def.component) {
    props.push(['Location', { kind: 'point', x: Math.round(location.x), y: Math.round(location.y) }])
    props.push(['Name', { kind: 'string', value: name }])
    props.push(['TabIndex', { kind: 'int', value: childrenOf(next, parent).length }])
  }
  for (const [path, value] of props) insertSorted(block, { kind: 'prop', target: name, path, value: renderValue(value) })

  if (!def.component) insertChild(next, parent, name)
  next.tail = addField(next.tail, def.type, name, next.eol)
  syncLayout(next)
  // 图表和 VS 一样带一个图表区、一个图例、一个系列
  return { doc: def.type === CHART_TYPE ? writeChart(next, name, DEFAULT_CHART) : next, name }
}

/** 新加入的子控件在最上层：Controls.Add 放在已有的 Controls.Add 之前 */
function insertChild(doc: DesignerDocument, parent: string, child: string) {
  const block = ensureBlock(doc, parent)
  const stmt: Stmt = { kind: 'add', target: parent, child }
  const first = block.stmts.findIndex((s) => s.kind === 'add')
  if (first >= 0) block.stmts.splice(first, 0, stmt)
  else insertSorted(block, stmt)
}

/** 删除控件及其包含的全部子控件。事件处理方法留在代码里（和 VS 一样） */
export function removeControl(doc: DesignerDocument, name: string): DesignerDocument {
  const next = clone(doc)
  const doomed = new Set<string>()
  const collect = (n: string) => {
    doomed.add(n)
    for (const child of childrenOf(next, n)) collect(child)
  }
  collect(name)
  // 图表的图表区、图例、系列是 InitializeComponent 开头的局部变量，一起删掉
  for (const n of doomed) if (typeOf(next, n) === CHART_TYPE) next.prologue = removeChartDeclarations(next, n).prologue
  const keep = (s: Stmt) =>
    !((s.kind === 'create' && doomed.has(s.name)) || (s.kind === 'add' && doomed.has(s.child)) || (s.kind === 'layout' && doomed.has(s.target)))
  next.prologue = next.prologue.filter(keep)
  next.epilogue = next.epilogue.filter(keep)
  next.blocks = next.blocks.filter((b) => !doomed.has(b.name))
  for (const block of next.blocks) block.stmts = block.stmts.filter(keep)
  for (const n of doomed) next.tail = removeField(next.tail, n)
  syncLayout(next)
  return next
}

/** 改名：更新所有引用这个控件的语句和字段声明。代码文件里的引用需要学生自己改 */
export function renameControl(doc: DesignerDocument, from: string, to: string): DesignerDocument {
  const next = clone(doc)
  const fix = (s: Stmt): Stmt => {
    switch (s.kind) {
      case 'create':
        return s.name === from ? { ...s, name: to, text: undefined } : s
      case 'prop':
        if (s.target !== from) return s
        return s.path === 'Name'
          ? { ...s, target: to, value: renderValue({ kind: 'string', value: to }), text: undefined }
          : { ...s, target: to, text: undefined }
      case 'event':
      case 'items':
        return s.target === from ? { ...s, target: to, text: undefined } : s
      case 'add':
        return s.target === from || s.child === from
          ? { ...s, target: s.target === from ? to : s.target, child: s.child === from ? to : s.child, text: undefined }
          : s
      case 'layout':
        return s.target === from ? { ...s, target: to, text: undefined } : s
      case 'raw':
        return s.text.includes(`this.${from}`)
          ? { kind: 'raw', text: s.text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])this\\.${from}(?![\\p{L}\\p{N}_])`, 'gu'), `this.${to}`) }
          : s
    }
  }
  next.prologue = next.prologue.map(fix)
  next.epilogue = next.epilogue.map(fix)
  for (const block of next.blocks) {
    if (block.name === from) block.name = to
    block.stmts = block.stmts.map(fix)
  }
  next.tail = next.tail.replace(new RegExp(`(private [\\p{L}\\p{N}_.]+ )${from};`, 'u'), `$1${to};`)
  return next
}

/** 移动控件：可以换到另一个容器里（location 是相对新容器的坐标） */
export function moveControl(doc: DesignerDocument, name: string, parent: string, location: { x: number; y: number }): DesignerDocument {
  let next = clone(doc)
  const current = listControls(next).find((c) => c.name === name)?.parent
  if (current !== null && current !== undefined && current !== parent) {
    for (const block of next.blocks) block.stmts = block.stmts.filter((s) => !(s.kind === 'add' && s.child === name))
    insertChild(next, parent, name)
    syncLayout(next)
  }
  applyProp(next, name, 'Location', { kind: 'point', x: Math.round(location.x), y: Math.round(location.y) })
  return next
}

// ---------- 布局语句 ----------

/**
 * 按 VS 的规则维护 SuspendLayout / ResumeLayout / PerformLayout：
 * 有子控件的容器在开头 SuspendLayout、末尾 ResumeLayout(false)；
 * 子控件里有 AutoSize 的，末尾再加 PerformLayout()。已有的语句不调整顺序，只增删。
 */
export function syncLayout(doc: DesignerDocument) {
  const containers = [
    '',
    ...listControls(doc)
      .filter((c) => isContainerType(c.type))
      .map((c) => c.name),
  ]
  for (const container of containers) {
    const children = childrenOf(doc, container)
    const hasChildren = children.length > 0 || container === ''
    const autoChild = children.some((child) => isAutoSized(doc, child))
    if (container === '') {
      // 窗体：SuspendLayout / ResumeLayout 总是有；PerformLayout 取决于直接子控件
      ensureLayout(doc, '', 'SuspendLayout', true)
      ensureLayout(doc, '', 'ResumeLayout', true)
      ensureLayout(doc, '', 'PerformLayout', autoChild)
      continue
    }
    ensureLayout(doc, container, 'SuspendLayout', hasChildren)
    ensureLayout(doc, container, 'ResumeLayout', hasChildren)
    ensureLayout(doc, container, 'PerformLayout', hasChildren && autoChild)
  }
}

/**
 * 子控件是否自动调整大小（VS 据此决定是否输出 PerformLayout）。
 * 除了 AutoSize = true，TextBox、TrackBar 的 AutoSize 默认就是 true（多行 TextBox 也算，只是不生效），
 * PictureBox 的 SizeMode 也可以是 AutoSize。
 */
function isAutoSized(doc: DesignerDocument, name: string) {
  const autoSize = getPropText(doc, name, 'AutoSize')
  if (autoSize !== undefined) return autoSize === 'true'
  switch (typeOf(doc, name)) {
    case 'System.Windows.Forms.TextBox':
    case 'System.Windows.Forms.TrackBar':
      return true
    case 'System.Windows.Forms.PictureBox':
      return getPropText(doc, name, 'SizeMode')?.endsWith('.AutoSize') === true
    default:
      return false
  }
}

function ensureLayout(doc: DesignerDocument, target: string, op: 'SuspendLayout' | 'ResumeLayout' | 'PerformLayout', wanted: boolean) {
  const list = op === 'SuspendLayout' ? doc.prologue : doc.epilogue
  const index = list.findIndex((s) => s.kind === 'layout' && s.target === target && s.op === op)
  if (!wanted) {
    if (index >= 0) list.splice(index, 1)
    return
  }
  if (index >= 0) return
  const stmt: Stmt = { kind: 'layout', target, op }
  if (op === 'SuspendLayout') {
    // 窗体的 SuspendLayout 在最后；容器的排在 BeginInit 和窗体的 SuspendLayout 之前
    const at = target === '' ? -1 : list.findIndex((s) => s.kind === 'layout' && (s.op === 'BeginInit' || s.target === ''))
    list.splice(at < 0 ? list.length : at, 0, stmt)
  } else if (target === '') {
    // 窗体的 ResumeLayout(false) 在 EndInit 之后，PerformLayout 紧跟其后
    const resume = list.findIndex((s) => s.kind === 'layout' && s.target === '' && s.op === 'ResumeLayout')
    list.splice(op === 'PerformLayout' && resume >= 0 ? resume + 1 : list.length, 0, stmt)
  } else {
    // 容器：ResumeLayout(false) + PerformLayout() 成对，排在 EndInit 和窗体的 ResumeLayout 之前
    const resume = list.findIndex((s) => s.kind === 'layout' && s.target === target && s.op === 'ResumeLayout')
    const at = op === 'PerformLayout' && resume >= 0 ? resume + 1 : list.findIndex((s) => s.kind === 'layout' && (s.op === 'EndInit' || s.target === ''))
    list.splice(at < 0 ? list.length : at, 0, stmt)
  }
}

// ---------- 字段声明 ----------

const FIELD = /^([ \t]*)private ([\p{L}\p{N}_.]+) ([\p{L}\p{N}_]+);[ \t]*$/gmu

function addField(tail: string, type: string, name: string, eol: string) {
  const fields = [...tail.matchAll(FIELD)]
  const last = fields.at(-1)
  if (last) {
    const lineEnd = tail.indexOf('\n', last.index! + last[0].length)
    const at = lineEnd < 0 ? tail.length : lineEnd + 1
    return `${tail.slice(0, at)}${last[1]}private ${type} ${name};${eol}${tail.slice(at)}`
  }
  // 还没有字段：放在 #endregion 之后
  const region = /#endregion[^\n]*\n/.exec(tail)
  if (!region) return tail
  const at = region.index + region[0].length
  return `${tail.slice(0, at)}${eol}        private ${type} ${name};${eol}${tail.slice(at)}`
}

function removeField(tail: string, name: string) {
  return tail.replace(new RegExp(`^[ \\t]*private [\\p{L}\\p{N}_.]+ ${name};[ \\t]*\\r?\\n`, 'mu'), '')
}

/** 窗体或控件的显示名：窗体用类名 */
export function displayType(doc: DesignerDocument, name: string) {
  if (name === '') return 'Form'
  const type = typeOf(doc, name)
  return type ? controlDef(type).label : ''
}

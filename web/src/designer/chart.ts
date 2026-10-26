// 图表（Chart）的图表区、图例和系列。VS 把它们写成 InitializeComponent 开头的局部变量
//   System.Windows.Forms.DataVisualization.Charting.Series series1 = new ...Series();
// 加上图表属性块里的 series1.Name = "Series1"; this.chart1.Series.Add(series1); 等语句。
// 这些语句在文档里是原样保留的 raw 语句；这里把它们读成数据（"系列和图例"对话框编辑），改完按 VS 的格式和顺序写回。
// 对话框不管的属性（如教材的 legend3.TitleForeColor）原样保留。
import type { DesignerDocument, Stmt } from './document'
import { parseValue, renderValue } from './values'

export const CHARTING = 'System.Windows.Forms.DataVisualization.Charting'
export const CHART_TYPE = `${CHARTING}.Chart`

type Kind = 'ChartArea' | 'Legend' | 'Series' | 'Title'
const COLLECTION: Record<Kind, string> = { ChartArea: 'ChartAreas', Legend: 'Legends', Series: 'Series', Title: 'Titles' }
const KINDS = Object.keys(COLLECTION) as Kind[]

export interface ChartSeries {
  name: string
  /** SeriesChartType 的成员名，如 Line、Column */
  chartType: string
  chartArea: string
  legend: string
  legendText: string
  isVisibleInLegend: boolean
  /** 数据绑定：X 值、Y 值来自数据源的哪一列 */
  xValueMember: string
  yValueMembers: string
}

export interface ChartModel {
  areas: string[]
  legends: string[]
  series: ChartSeries[]
}

/** 常用的图表类型（对话框的选项）；SeriesChartType 的默认值是 Column */
export const CHART_TYPES: Record<string, string> = {
  Column: '柱形图',
  Bar: '条形图',
  Line: '折线图',
  Spline: '平滑折线图',
  Area: '面积图',
  Point: '散点图',
  Pie: '饼图',
  Doughnut: '圆环图',
  StackedColumn: '堆积柱形图',
  StepLine: '阶梯线图',
  Radar: '雷达图',
}

/** 拖入新图表时和 VS 一样带一个图表区、一个图例、一个系列 */
export const DEFAULT_CHART: ChartModel = {
  areas: ['ChartArea1'],
  legends: ['Legend1'],
  series: [
    {
      name: 'Series1',
      chartType: 'Column',
      chartArea: 'ChartArea1',
      legend: 'Legend1',
      legendText: '',
      isVisibleInLegend: true,
      xValueMember: '',
      yValueMembers: '',
    },
  ],
}

interface ChartObject {
  kind: Kind
  variable: string
  /** 属性名 → C# 原文，按 VS 的顺序（属性名排序）写出 */
  props: Map<string, string>
}

const DECLARATION = new RegExp(`^${CHARTING.replaceAll('.', '\\.')}\\.(\\w+) ([\\p{L}\\p{N}_]+) = new ${CHARTING.replaceAll('.', '\\.')}\\.\\1\\(\\);$`, 'u')
const ASSIGN = /^([\p{L}\p{N}_]+)\.(\w+) = (.*);$/su
const addPattern = (chart: string) => new RegExp(`^this\\.${chart}\\.(\\w+)\\.Add\\(([\\p{L}\\p{N}_]+)\\);$`, 'u')

function blockOf(doc: DesignerDocument, chart: string) {
  return doc.blocks.find((b) => b.name === chart)
}

/** 读出图表的各个对象（按加入图表的顺序） */
function readObjects(doc: DesignerDocument, chart: string): ChartObject[] {
  const declared = new Map<string, Kind>()
  for (const stmt of doc.prologue) {
    const m = stmt.kind === 'raw' ? DECLARATION.exec(stmt.text) : null
    if (m && (KINDS as string[]).includes(m[1])) declared.set(m[2], m[1] as Kind)
  }
  const objects = new Map<string, ChartObject>()
  const stmts = blockOf(doc, chart)?.stmts ?? []
  const add = addPattern(chart)
  for (const stmt of stmts) {
    const m = stmt.kind === 'raw' ? add.exec(stmt.text) : null
    const kind = m ? declared.get(m[2]) : undefined
    if (m && kind && COLLECTION[kind] === m[1]) objects.set(m[2], { kind, variable: m[2], props: new Map() })
  }
  for (const stmt of stmts) {
    const m = stmt.kind === 'raw' ? ASSIGN.exec(stmt.text) : null
    if (m && objects.has(m[1])) objects.get(m[1])!.props.set(m[2], m[3])
  }
  return [...objects.values()]
}

const text = (value: string | undefined) => {
  if (value === undefined) return ''
  const v = parseValue(value)
  return v.kind === 'string' ? v.value : ''
}
const member = (value: string | undefined, fallback: string) => {
  if (value === undefined) return fallback
  const v = parseValue(value)
  return v.kind === 'enum' ? v.member : (/\.(\w+)$/.exec(value)?.[1] ?? fallback)
}

export function readChart(doc: DesignerDocument, chart: string): ChartModel {
  const objects = readObjects(doc, chart)
  const of = (kind: Kind) => objects.filter((o) => o.kind === kind)
  return {
    areas: of('ChartArea').map((o) => text(o.props.get('Name'))),
    legends: of('Legend').map((o) => text(o.props.get('Name'))),
    series: of('Series').map((o) => ({
      name: text(o.props.get('Name')),
      chartType: member(o.props.get('ChartType'), 'Column'),
      chartArea: text(o.props.get('ChartArea')),
      legend: text(o.props.get('Legend')),
      legendText: text(o.props.get('LegendText')),
      isVisibleInLegend: o.props.get('IsVisibleInLegend') !== 'false',
      xValueMember: text(o.props.get('XValueMember')),
      yValueMembers: text(o.props.get('YValueMembers')),
    })),
  }
}

const quote = (value: string) => renderValue({ kind: 'string', value })

/** 对话框管理的属性：空值或默认值不写（和 VS 一样） */
function managedProps(kind: Kind, name: string, series?: ChartSeries): [string, string | null][] {
  const props: [string, string | null][] = [['Name', quote(name)]]
  if (kind === 'Series' && series) {
    props.push(
      ['ChartArea', series.chartArea ? quote(series.chartArea) : null],
      ['ChartType', series.chartType === 'Column' ? null : `${CHARTING}.SeriesChartType.${series.chartType}`],
      ['IsVisibleInLegend', series.isVisibleInLegend ? null : 'false'],
      ['Legend', series.legend ? quote(series.legend) : null],
      ['LegendText', series.legendText ? quote(series.legendText) : null],
      ['XValueMember', series.xValueMember ? quote(series.xValueMember) : null],
      ['YValueMembers', series.yValueMembers ? quote(series.yValueMembers) : null],
    )
  }
  return props
}

const PREFIX: Record<Kind, string> = { ChartArea: 'chartArea', Legend: 'legend', Series: 'series', Title: 'title' }

/** 把对话框编辑后的数据写回文档（返回新文档；名字相同的对象沿用原来的变量和其他属性） */
export function writeChart(doc: DesignerDocument, chart: string, model: ChartModel): DesignerDocument {
  const next: DesignerDocument = structuredClone(doc)
  const old = readObjects(next, chart)
  const oldVars = new Set(old.map((o) => o.variable))

  // 变量名：VS 按类型在整个 InitializeComponent 里编号（chartArea1、legend1、series1……）
  const used = new Set<string>()
  for (const stmt of next.prologue) {
    const m = stmt.kind === 'raw' ? DECLARATION.exec(stmt.text) : null
    if (m && !oldVars.has(m[2])) used.add(m[2])
  }
  const fresh = (kind: Kind) => {
    for (let i = 1; ; i++) {
      const name = `${PREFIX[kind]}${i}`
      if (!used.has(name)) return name
    }
  }
  const objects: ChartObject[] = []
  const place = (kind: Kind, name: string, series?: ChartSeries) => {
    const previous = old.find((o) => o.kind === kind && text(o.props.get('Name')) === name && !used.has(o.variable))
    const variable = previous?.variable ?? fresh(kind)
    used.add(variable)
    const props = new Map(previous?.props)
    for (const [key, value] of managedProps(kind, name, series)) {
      if (value === null) props.delete(key)
      else props.set(key, value)
    }
    objects.push({ kind, variable, props })
  }
  for (const name of model.areas) place('ChartArea', name)
  for (const name of model.legends) place('Legend', name)
  // 对话框不编辑标题：原样保留
  for (const title of old.filter((o) => o.kind === 'Title')) {
    used.add(title.variable)
    objects.push(title)
  }
  for (const series of model.series) place('Series', series.name, series)

  // 局部变量声明：去掉旧的，按图表区、图例、标题、系列的顺序放在其他图表的声明后面（没有时放在 components 后面或最前面）
  const declarationOf = (o: ChartObject): Stmt => ({ kind: 'raw', text: `${CHARTING}.${o.kind} ${o.variable} = new ${CHARTING}.${o.kind}();` })
  const isOld = (s: Stmt) => s.kind === 'raw' && oldVars.has(DECLARATION.exec(s.text)?.[2] ?? '')
  next.prologue = next.prologue.filter((s) => !isOld(s))
  const lastDecl = next.prologue.findLastIndex((s) => s.kind === 'raw' && DECLARATION.test(s.text))
  const components = next.prologue.findIndex((s) => s.kind === 'raw' && s.text.startsWith('this.components = new'))
  const order: Kind[] = ['ChartArea', 'Legend', 'Title', 'Series']
  const sorted = order.flatMap((kind) => objects.filter((o) => o.kind === kind))
  next.prologue.splice(lastDecl >= 0 ? lastDecl + 1 : components + 1, 0, ...sorted.map(declarationOf))

  // 图表属性块：去掉旧的对象语句，每类对象作为一组，按集合名插到属性排序的位置（ChartAreas、Legends、Series、Titles）
  const block = next.blocks.find((b) => b.name === chart)
  if (!block) return next
  const add = addPattern(chart)
  block.stmts = block.stmts.filter((s) => {
    if (s.kind !== 'raw') return true
    const assign = ASSIGN.exec(s.text)
    return !(add.test(s.text) || (assign && oldVars.has(assign[1])))
  })
  for (const kind of order) {
    // 先写这一类所有对象的属性，再依次 Add（VS 的顺序）
    const ofKind = objects.filter((o) => o.kind === kind)
    const group: Stmt[] = [
      ...ofKind.flatMap((o) =>
        [...o.props].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, value]): Stmt => ({ kind: 'raw', text: `${o.variable}.${key} = ${value};` })),
      ),
      ...ofKind.map((o): Stmt => ({ kind: 'raw', text: `this.${chart}.${COLLECTION[kind]}.Add(${o.variable});` })),
    ]
    if (group.length === 0) continue
    const collection = COLLECTION[kind]
    let at = block.stmts.findIndex((s) => (s.kind === 'prop' && s.path > collection) || s.kind === 'event')
    if (at < 0) at = block.stmts.length
    block.stmts.splice(at, 0, ...group)
  }
  return next
}

/** 删除图表时一起删掉它的局部变量声明 */
export function removeChartDeclarations(doc: DesignerDocument, chart: string): DesignerDocument {
  const vars = new Set(readObjects(doc, chart).map((o) => o.variable))
  if (vars.size === 0) return doc
  return { ...doc, prologue: doc.prologue.filter((s) => !(s.kind === 'raw' && vars.has(DECLARATION.exec(s.text)?.[2] ?? ''))) }
}

/** 设计器预览：和 VS 一样用示例数据画出各个系列 */
export function previewChart(model: ChartModel) {
  const sample = [3, 5, 4, 6, 5]
  return {
    series: model.series.map((s, i) => ({
      name: s.name,
      type: s.chartType,
      legend: s.legendText || s.name,
      inLegend: s.isVisibleInLegend && s.legend !== '',
      color: null,
      width: 1,
      labels: false,
      points: sample.map((y, j) => ({ x: j + 1, y: y + i * 2 })),
    })),
    titles: [],
    legendDocking: 'Right',
    yMin: null,
    yMax: null,
  }
}

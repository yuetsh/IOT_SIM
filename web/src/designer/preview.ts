// 把设计器文档转换成与运行时相同格式的控件树，直接用运行时的 ControlView 渲染，
// 保证设计时看到的样子和运行时一致。
import type { ControlNode } from '@iot/shared'
import { controlDef } from './catalog'
import type { DesignerDocument } from './document'
import { childrenOf, findBlock, getItems, listControls } from './edit'
import { parseValue, type Value } from './values'

/** 窗体在预览树里的 id；控件的 id 就是控件名 */
export const FORM_ID = '__form'

/** 运行时控件树里的类型名：System.Windows.Forms.Button → Button，教材控件库保留完整类名 */
function clientType(type: string) {
  return type.startsWith('System.Windows.Forms.') ? type.slice('System.Windows.Forms.'.length) : type
}

/** 把 Value 转换成运行时消息里的属性值格式（见 web/src/winforms/format.ts） */
export function runtimeValue(value: Value): unknown {
  switch (value.kind) {
    case 'string':
    case 'char':
      return value.value
    case 'bool':
    case 'int':
    case 'float':
      return value.value
    case 'point':
      return { x: value.x, y: value.y }
    case 'size':
      return { width: value.width, height: value.height }
    case 'color':
      return value.css
    case 'font':
      return { family: value.family, size: value.size, bold: value.bold, italic: value.italic, underline: value.underline, strikeout: value.strikeout }
    case 'enum':
      return value.member
    case 'raw':
      return undefined
  }
}

function propsOf(doc: DesignerDocument, target: string): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const stmt of findBlock(doc, target)?.stmts ?? []) {
    if (stmt.kind !== 'prop' || stmt.path.includes('.')) continue
    const value = runtimeValue(parseValue(stmt.value))
    if (value !== undefined) props[stmt.path] = value
  }
  return props
}

/** 教材控件在 Designer.cs 里不写、但运行时构造函数会设置的外观 */
const DEVICE_DEFAULTS: Record<string, Record<string, unknown>> = {
  'WinFormsDeviceControlLibrary.LED': { BackColor: '#000000', ForeColor: '#ff0000', Font: { family: '宋体', size: 70, bold: false, italic: false, underline: false, strikeout: false } },
  'WinFormsDeviceControlLibrary.Lamp': { BackColor: '#ffffff' },
  'WinFormsDeviceControlLibrary.Alarm': { BackColor: '#ffffff' },
}

export function previewTree(doc: DesignerDocument): ControlNode {
  const types = new Map(listControls(doc).map((c) => [c.name, c.type]))
  const build = (name: string): ControlNode => {
    const type = types.get(name)!
    const props: Record<string, unknown> = { ...DEVICE_DEFAULTS[type], ...propsOf(doc, name) }
    // 设计时即使 Visible = false 也显示出来（和 VS 一样），方便选中和编辑
    props.Visible = true
    if (type === 'System.Windows.Forms.ComboBox') props.Items = getItems(doc, name).map((item) => {
      const v = parseValue(item)
      return v.kind === 'string' ? v.value : item
    })
    // 设计器里不需要滚动：LED 只显示黑底
    if (type === 'WinFormsDeviceControlLibrary.LED') props.LedText = ''
    return { id: name, type: clientType(type), name, props, children: childrenOf(doc, name).filter((c) => types.has(c)).map(build) }
  }
  const formProps = propsOf(doc, '')
  return {
    id: FORM_ID,
    type: 'Form',
    name: doc.formName,
    props: { ClientSize: { width: 300, height: 300 }, ...formProps, Visible: true },
    children: childrenOf(doc, '').filter((c) => types.has(c)).map(build),
  }
}

/** 非可视组件（Timer 等），显示在窗体下方的组件栏 */
export function componentsOf(doc: DesignerDocument) {
  return listControls(doc).filter((c) => c.parent === null && controlDef(c.type).component === true)
}

// 设计器里的停靠布局：和 VS 一样，改了停靠、大小等之后立即把停靠的控件排好，位置大小写进 Designer.cs。
// 规则和运行时（runtime/Sim.WinForms/Forms/Control.cs 的 PerformLayout）相同：按 Controls 集合从后往前，
// 上 / 下 / 左 / 右依次贴边并占掉那一条，填充占剩下的全部。设计时不可见的控件也照样占位（VS 设计器里看得见它们）。
import type { DesignerDocument } from './document'
import { childrenOf, getPropText, setProp, typeOf } from './edit'
import { parseValue } from './values'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function sizeOf(doc: DesignerDocument, name: string, path = 'Size') {
  const text = getPropText(doc, name, path)
  const value = text === undefined ? undefined : parseValue(text)
  return value?.kind === 'size' ? { width: value.width, height: value.height } : undefined
}

function pointOf(doc: DesignerDocument, name: string) {
  const text = getPropText(doc, name, 'Location')
  const value = text === undefined ? undefined : parseValue(text)
  return value?.kind === 'point' ? { x: value.x, y: value.y } : { x: 0, y: 0 }
}

function dockOf(doc: DesignerDocument, name: string) {
  const text = getPropText(doc, name, 'Dock')
  const value = text === undefined ? undefined : parseValue(text)
  return value?.kind === 'enum' ? value.member : 'None'
}

/** new System.Windows.Forms.Padding(2) 或 (1, 2, 3, 4) */
function paddingOf(doc: DesignerDocument, name: string) {
  const m = /Padding\((\d+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)/.exec(getPropText(doc, name, 'Padding') ?? '')
  if (!m) return { left: 0, top: 0, right: 0, bottom: 0 }
  return m[2] === undefined
    ? { left: +m[1], top: +m[1], right: +m[1], bottom: +m[1] }
    : { left: +m[1], top: +m[2], right: +m[3], bottom: +m[4] }
}

/** 容器里用来停靠的区域：客户区去掉内边距；带边框的面板去掉边框，分组框去掉边框和标题 */
function displayRect(doc: DesignerDocument, container: string): Rect | undefined {
  const size = container === '' ? sizeOf(doc, '', 'ClientSize') : sizeOf(doc, container)
  if (!size) return undefined
  const pad = paddingOf(doc, container)
  let rect = { x: pad.left, y: pad.top, width: size.width - pad.left - pad.right, height: size.height - pad.top - pad.bottom }
  const type = container === '' ? '' : typeOf(doc, container)
  if (type === 'System.Windows.Forms.GroupBox') rect = { x: rect.x + 3, y: rect.y + 17, width: rect.width - 6, height: rect.height - 20 }
  if (type === 'System.Windows.Forms.Panel') {
    const border = (getPropText(doc, container, 'BorderStyle') ?? '').split('.').at(-1)
    const inset = border === 'FixedSingle' ? 1 : border === 'Fixed3D' ? 2 : 0
    rect = { ...rect, width: rect.width - 2 * inset, height: rect.height - 2 * inset }
  }
  return { ...rect, width: Math.max(0, rect.width), height: Math.max(0, rect.height) }
}

/** 把整个窗体的停靠控件排好；没有停靠控件或位置已经对时原样返回 */
export function dockLayout(doc: DesignerDocument): DesignerDocument {
  let next = doc

  const place = (name: string, bounds: Rect) => {
    const point = pointOf(next, name)
    if (point.x !== bounds.x || point.y !== bounds.y) next = setProp(next, name, 'Location', { kind: 'point', x: bounds.x, y: bounds.y })
    const size = sizeOf(next, name)
    if (size?.width !== bounds.width || size?.height !== bounds.height) next = setProp(next, name, 'Size', { kind: 'size', width: bounds.width, height: bounds.height })
  }

  const layout = (container: string) => {
    const children = childrenOf(next, container)
    let rect = displayRect(next, container)
    if (rect) {
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i]
        const dock = dockOf(next, child)
        if (dock === 'None') continue
        const size = sizeOf(next, child) ?? { width: 0, height: 0 }
        switch (dock) {
          case 'Top':
            place(child, { x: rect.x, y: rect.y, width: rect.width, height: size.height })
            rect = { ...rect, y: rect.y + size.height, height: Math.max(0, rect.height - size.height) }
            break
          case 'Bottom':
            place(child, { x: rect.x, y: rect.y + rect.height - size.height, width: rect.width, height: size.height })
            rect = { ...rect, height: Math.max(0, rect.height - size.height) }
            break
          case 'Left':
            place(child, { x: rect.x, y: rect.y, width: size.width, height: rect.height })
            rect = { ...rect, x: rect.x + size.width, width: Math.max(0, rect.width - size.width) }
            break
          case 'Right':
            place(child, { x: rect.x + rect.width - size.width, y: rect.y, width: size.width, height: rect.height })
            rect = { ...rect, width: Math.max(0, rect.width - size.width) }
            break
          default:
            place(child, rect)
        }
      }
    }
    for (const child of children) layout(child)
  }

  layout('')
  return next
}

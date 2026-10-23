// 把运行器发来的 WinForms 属性值转换成 CSS。
// 运行器的序列化格式：Point → {x,y}，Size → {width,height}，
// Color → CSS 颜色字符串（未设置时为 null，表示继承父控件），Font → FontValue。
import type { CSSProperties, InjectionKey, Ref } from 'vue'

export interface PointValue {
  x: number
  y: number
}

export interface SizeValue {
  width: number
  height: number
}

export interface FontValue {
  family: string
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikeout: boolean
}

/** Windows 中文字体在网页上的替代字体 */
const FONT_FALLBACKS: Record<string, string> = {
  宋体: '"SimSun", "Songti SC", "Noto Serif CJK SC", "Noto Serif SC", serif',
  SimSun: '"SimSun", "Songti SC", "Noto Serif CJK SC", "Noto Serif SC", serif',
  黑体: '"SimHei", "Heiti SC", "Noto Sans CJK SC", "Noto Sans SC", sans-serif',
  楷体: '"KaiTi", "Kaiti SC", "AR PL UKai CN", serif',
  微软雅黑: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", sans-serif',
  'Microsoft YaHei': '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", sans-serif',
}

export function fontCss(font: FontValue | null | undefined): CSSProperties {
  if (!font) return {}
  const decorations = [font.underline && 'underline', font.strikeout && 'line-through'].filter(Boolean)
  return {
    fontFamily: FONT_FALLBACKS[font.family] ?? `"${font.family}", ${FONT_FALLBACKS.宋体}`,
    // WinForms 字号单位是磅，96 DPI 下 1pt = 4/3 px
    fontSize: `${(font.size * 4) / 3}px`,
    fontWeight: font.bold ? 'bold' : undefined,
    fontStyle: font.italic ? 'italic' : undefined,
    textDecoration: decorations.length ? decorations.join(' ') : undefined,
  }
}

/**
 * 父控件的背景色（BackColor 是"环境属性"：控件没设置时沿用父控件的）。
 * 父控件有背景图片时，没设置背景色的子控件在 WinForms 里画的是父控件的背景色而不是那张图，
 * 所以这些控件要自己涂上这个颜色；"transparent" 表示父控件是透明的（Color.Transparent），子控件也透明。
 */
export const AMBIENT_BACK_COLOR: InjectionKey<Readonly<Ref<string>>> = Symbol('ambientBackColor')
export const DEFAULT_BACK_COLOR = '#f0f0f0'

/** 背景色沿用父控件的控件（按钮、文本框等有自己的默认底色） */
export const AMBIENT_BACK_TYPES = new Set(['Label', 'Panel', 'GroupBox', 'CheckBox', 'RadioButton', 'PictureBox', 'TrackBar'])

/** 控件外框：绝对定位，坐标相对父控件的客户区 */
export function boxCss(props: Record<string, unknown>, autoSize = false): CSSProperties {
  const location = (props.Location as PointValue | undefined) ?? { x: 0, y: 0 }
  const size = props.Size as SizeValue | undefined
  return {
    left: `${location.x}px`,
    top: `${location.y}px`,
    width: autoSize || !size ? undefined : `${size.width}px`,
    height: autoSize || !size ? undefined : `${size.height}px`,
    color: (props.ForeColor as string | null) ?? undefined,
    backgroundColor: (props.BackColor as string | null) ?? undefined,
    display: props.Visible === false ? 'none' : undefined,
    ...fontCss(props.Font as FontValue | null),
  }
}

/** 去掉助记符：WinForms 里 "用户名称(&U)" 显示为 "用户名称(U)"，"&&" 显示为 "&" */
export function displayText(text: unknown): string {
  return String(text ?? '').replace(/&(&?)/g, (_, amp) => amp)
}

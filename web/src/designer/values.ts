// 属性值的 C# 表达式 ⇄ 结构化值。读入时尽量识别；识别不了的保留原文（属性窗口里只读显示）。
// 写出时按 VS 设计器的格式，例如 new System.Drawing.Point(12, 12)、"文字"、System.Drawing.Color.White。

export type Value =
  | { kind: 'string'; value: string }
  | { kind: 'char'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'int'; value: number }
  | { kind: 'float'; value: number }
  | { kind: 'point'; x: number; y: number }
  | { kind: 'size'; width: number; height: number }
  | { kind: 'color'; css: string; name?: string; r: number; g: number; b: number; a: number }
  | { kind: 'font'; family: string; size: number; bold: boolean; italic: boolean; underline: boolean; strikeout: boolean; charset?: number }
  | { kind: 'enum'; type: string; member: string }
  | { kind: 'raw'; text: string }

// ---------- 读 ----------

export function parseValue(text: string): Value {
  const t = text.trim()
  let m: RegExpExecArray | null
  if (/^"(?:[^"\\]|\\.)*"$/.test(t)) return { kind: 'string', value: unescapeString(t.slice(1, -1)) }
  if (/^@"(?:[^"]|"")*"$/.test(t)) return { kind: 'string', value: t.slice(2, -1).replace(/""/g, '"') }
  if (/^'(?:[^'\\]|\\.)'$/.test(t)) return { kind: 'char', value: unescapeString(t.slice(1, -1)) }
  if (t === 'true' || t === 'false') return { kind: 'bool', value: t === 'true' }
  if (/^-?\d+$/.test(t)) return { kind: 'int', value: Number(t) }
  if ((m = /^(-?\d+(?:\.\d+)?)[Ff]$/.exec(t))) return { kind: 'float', value: Number(m[1]) }
  if ((m = /^new System\.Drawing\.Point\((-?\d+), (-?\d+)\)$/.exec(t))) return { kind: 'point', x: +m[1], y: +m[2] }
  if ((m = /^new System\.Drawing\.Size\((-?\d+), (-?\d+)\)$/.exec(t))) return { kind: 'size', width: +m[1], height: +m[2] }
  if ((m = /^System\.Drawing\.(?:Color|SystemColors)\.(\w+)$/.exec(t))) return namedColor(m[1])
  if ((m = /^System\.Drawing\.Color\.FromArgb\(([\s\S]+)\)$/.exec(t))) {
    // VS 的写法是 ((int)(((byte)(53))))，手写的可能是 53
    const parts = m[1].includes('(byte)') ? byteParts(m[1]) : m[1].split(',').map((n) => Number(n.trim()))
    if (parts.length === 3) return rgb(parts[0], parts[1], parts[2])
    if (parts.length === 4) return rgb(parts[1], parts[2], parts[3], parts[0])
  }
  if ((m = /^new System\.Drawing\.Font\("((?:[^"\\]|\\.)*)", (\d+(?:\.\d+)?)F(.*)\)$/.exec(t))) {
    const rest = m[3]
    const charset = /\(\(byte\)\((\d+)\)\)/.exec(rest)
    return {
      kind: 'font',
      family: unescapeString(m[1]),
      size: Number(m[2]),
      bold: rest.includes('FontStyle.Bold'),
      italic: rest.includes('FontStyle.Italic'),
      underline: rest.includes('FontStyle.Underline'),
      strikeout: rest.includes('FontStyle.Strikeout'),
      charset: charset ? Number(charset[1]) : undefined,
    }
  }
  if ((m = /^((?:System|WinFormsDeviceControlLibrary)(?:\.\w+)+)\.(\w+)$/.exec(t))) return { kind: 'enum', type: m[1], member: m[2] }
  return { kind: 'raw', text: t }
}

/** 从 ((int)(((byte)(53)))) 这样的写法中逐个分量取出数值 */
function byteParts(args: string) {
  return [...args.matchAll(/\(byte\)\((\d+)\)/g)].map((x) => Number(x[1]))
}

function unescapeString(s: string) {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, c: string) => {
    if (c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16))
    return ({ n: '\n', r: '\r', t: '\t', '0': '\0', '\\': '\\', '"': '"', "'": "'" } as Record<string, string>)[c] ?? c
  })
}

// ---------- 写 ----------

export function renderValue(value: Value): string {
  switch (value.kind) {
    case 'string':
      return `"${escapeString(value.value)}"`
    case 'char':
      return `'${value.value === "'" ? "\\'" : escapeString(value.value)}'`
    case 'bool':
      return String(value.value)
    case 'int':
      return String(Math.round(value.value))
    case 'float':
      return `${value.value}F`
    case 'point':
      return `new System.Drawing.Point(${value.x}, ${value.y})`
    case 'size':
      return `new System.Drawing.Size(${value.width}, ${value.height})`
    case 'color':
      if (value.name) return `System.Drawing.${SYSTEM_COLORS[value.name] ? 'SystemColors' : 'Color'}.${value.name}`
      return value.a === 255
        ? `System.Drawing.Color.FromArgb(${[value.r, value.g, value.b].map(byteArg).join(', ')})`
        : `System.Drawing.Color.FromArgb(${[value.a, value.r, value.g, value.b].map(byteArg).join(', ')})`
    case 'font': {
      const styles = [
        value.bold && 'Bold',
        value.italic && 'Italic',
        value.underline && 'Underline',
        value.strikeout && 'Strikeout',
      ].filter(Boolean) as string[]
      const style = styles.length ? styles.map((s) => `System.Drawing.FontStyle.${s}`).join(' | ') : 'System.Drawing.FontStyle.Regular'
      // 与中文 Windows 上的 VS 一致：带 GB2312 字符集 134
      return `new System.Drawing.Font("${escapeString(value.family)}", ${value.size}F, ${style}, System.Drawing.GraphicsUnit.Point, ((byte)(${value.charset ?? 134})))`
    }
    case 'enum':
      return `${value.type}.${value.member}`
    case 'raw':
      return value.text
  }
}

const byteArg = (n: number) => `((int)(((byte)(${n}))))`

function escapeString(s: string) {
  return s.replace(/[\\"\r\n\t\0]/g, (c) => ({ '\\': '\\\\', '"': '\\"', '\r': '\\r', '\n': '\\n', '\t': '\\t', '\0': '\\0' })[c]!)
}

// ---------- 颜色 ----------

/** 常用的命名颜色（System.Drawing.Color），属性窗口里提供这些选项 */
export const NAMED_COLORS: Record<string, string> = {
  Transparent: 'transparent',
  Black: '#000000',
  White: '#ffffff',
  Red: '#ff0000',
  Green: '#008000',
  Blue: '#0000ff',
  Yellow: '#ffff00',
  Orange: '#ffa500',
  Gray: '#808080',
  DimGray: '#696969',
  Silver: '#c0c0c0',
  LightGray: '#d3d3d3',
  DarkBlue: '#00008b',
  SkyBlue: '#87ceeb',
  LightGreen: '#90ee90',
  Lime: '#00ff00',
  Purple: '#800080',
  Brown: '#a52a2a',
  Pink: '#ffc0cb',
  Cyan: '#00ffff',
}

/** 系统颜色（System.Drawing.SystemColors），按 Windows 10 默认主题取值 */
const SYSTEM_COLORS: Record<string, string> = {
  Control: '#f0f0f0',
  ControlText: '#000000',
  Window: '#ffffff',
  WindowText: '#000000',
  ControlDark: '#a0a0a0',
  ControlLight: '#e3e3e3',
  Highlight: '#0078d7',
  HighlightText: '#ffffff',
  GrayText: '#6d6d6d',
  InactiveCaption: '#bfcddb',
}

function namedColor(name: string): Value {
  const css = NAMED_COLORS[name] ?? SYSTEM_COLORS[name] ?? cssNamed(name)
  if (css === 'transparent') return { kind: 'color', css, name, r: 255, g: 255, b: 255, a: 0 }
  const [r, g, b] = hexToRgb(css)
  return { kind: 'color', css, name, r, g, b, a: 255 }
}

/** 不在列表里的颜色名（如 Color.Gold）交给浏览器：CSS 颜色名和 .NET 的颜色名基本一致 */
function cssNamed(name: string) {
  return name.toLowerCase()
}

export function rgb(r: number, g: number, b: number, a = 255): Value {
  const css = a === 255 ? `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}` : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
  return { kind: 'color', css, r, g, b, a }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

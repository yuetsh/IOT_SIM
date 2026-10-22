// Designer.cs 的读写：把 InitializeComponent 解析成一条条语句，每条保留原文。
// 没修改过的语句原样输出，修改过的按 VS 的格式重新生成，所以 VS 生成的文件读入后再写出，内容逐字节不变。
// 只认 VS 生成的标准结构（和 VS 一样）；结构不对时抛出 DesignerParseError，设计器提示无法打开。

export class DesignerParseError extends Error {}

export type Stmt =
  /** this.x = new T(...) */
  | { kind: 'create'; name: string; type: string; args: string; text?: string }
  /** this[.x].Path = value；target 为 '' 表示窗体本身 */
  | { kind: 'prop'; target: string; path: string; value: string; text?: string }
  /** this[.x].Event += new Delegate(this.handler) */
  | { kind: 'event'; target: string; event: string; delegate: string; handler: string; text?: string }
  /** this[.x].Controls.Add(this.child) */
  | { kind: 'add'; target: string; child: string; text?: string }
  /** this.x.Items.AddRange(new object[] { ... })，items 是每一项的 C# 字面量原文 */
  | { kind: 'items'; target: string; items: string[]; text?: string }
  /** SuspendLayout / ResumeLayout(false) / PerformLayout / BeginInit / EndInit */
  | { kind: 'layout'; target: string; op: LayoutOp; text?: string }
  /** 其他语句（局部变量、图表的 Series 设置等），原样保留 */
  | { kind: 'raw'; text: string }

export type LayoutOp = 'SuspendLayout' | 'ResumeLayout' | 'PerformLayout' | 'BeginInit' | 'EndInit'

export interface Block {
  /** 控件名；窗体的块用窗体类名 */
  name: string
  stmts: Stmt[]
}

export interface DesignerDocument {
  /** 窗体的 Name（窗体属性块的名字，即最后一个块）；通常与类名相同，但也可能不同（如教材的 AddUser 窗体叫 frmExam_5_82） */
  formName: string
  /** partial class 后面的窗体类名 */
  className: string
  /** InitializeComponent 方法体之前的全部原文（含方法体的 "{" 和换行） */
  head: string
  /** 第一个注释块之前的语句：components、创建控件、SuspendLayout、BeginInit 等 */
  prologue: Stmt[]
  /** 各控件的属性块（含窗体），顺序与文件一致 */
  blocks: Block[]
  /** 窗体块之后的 ResumeLayout、PerformLayout、EndInit */
  epilogue: Stmt[]
  /** 最后一条语句之后到文件末尾的原文（含方法的 "}"、#endregion、字段声明） */
  tail: string
  eol: string
  indent: string
}

// ---------- 语句切分 ----------

interface Piece {
  kind: 'stmt' | 'comment'
  text: string
}

/** 把方法体切成语句和注释行；语句以顶层的 ";" 结束，跳过字符串、字符和注释里的符号 */
function splitBody(body: string): Piece[] {
  const pieces: Piece[] = []
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (body.startsWith('//', i)) {
      const end = body.indexOf('\n', i)
      const stop = end < 0 ? body.length : end
      pieces.push({ kind: 'comment', text: body.slice(i, stop).replace(/\r$/, '') })
      i = stop
      continue
    }
    const start = i
    let depth = 0
    while (i < body.length) {
      const c = body[i]
      if (c === '"' || c === "'") {
        i = skipLiteral(body, i)
        continue
      }
      if (c === '@' && body[i + 1] === '"') {
        i = skipVerbatim(body, i + 1)
        continue
      }
      if (c === '(' || c === '{' || c === '[') depth++
      else if (c === ')' || c === '}' || c === ']') depth--
      else if (c === ';' && depth === 0) {
        pieces.push({ kind: 'stmt', text: body.slice(start, i + 1) })
        i++
        break
      }
      i++
    }
    if (i >= body.length && !body.slice(start).trim().endsWith(';') && body.slice(start).trim()) {
      throw new DesignerParseError(`语句没有以分号结束：${body.slice(start, start + 40)}`)
    }
  }
  return pieces
}

function skipLiteral(text: string, i: number) {
  const quote = text[i]
  i++
  while (i < text.length && text[i] !== quote) {
    if (text[i] === '\\') i++
    if (text[i] === '\n') throw new DesignerParseError('字符串没有结束')
    i++
  }
  return i + 1
}

function skipVerbatim(text: string, i: number) {
  i++
  while (i < text.length) {
    if (text[i] === '"') {
      if (text[i + 1] === '"') i += 2
      else return i + 1
    } else i++
  }
  throw new DesignerParseError('字符串没有结束')
}

// ---------- 解析 ----------

const CREATE = /^this\.(\w+) = new ([\w.]+)\(([^()]*)\);$/
const LAYOUT = /^this\.(?:(\w+)\.)?(SuspendLayout|ResumeLayout|PerformLayout)\((?:false)?\);$/
const INIT = /^\(\(System\.ComponentModel\.ISupportInitialize\)\(this\.(\w+)\)\)\.(BeginInit|EndInit)\(\);$/
const EVENT = /^this\.(?:(\w+)\.)?(\w+) \+= new ([\w.]+)\(this\.(\w+)\);$/
const ADD = /^this\.(?:(\w+)\.)?Controls\.Add\(this\.(\w+)\);$/
const ITEMS = /^this\.(\w+)\.Items\.AddRange\(new object\[\] \{([\s\S]*)\}\);$/
const PROP = /^this\.([\w.]+) = ([\s\S]+);$/

/** 一个 Designer.cs 文件里窗体类的名字：partial class 后面的标识符 */
function findFormName(text: string) {
  const match = /partial\s+class\s+(\w+)/.exec(text)
  if (!match) throw new DesignerParseError('找不到 partial class 声明')
  return match[1]
}

export function parseDesigner(text: string): DesignerDocument {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const className = findFormName(text)
  const method = /private\s+void\s+InitializeComponent\s*\(\s*\)\s*\{[^\S\n]*\r?\n/.exec(text)
  if (!method) throw new DesignerParseError('找不到 InitializeComponent 方法')
  const bodyStart = method.index + method[0].length
  const bodyEnd = findMethodEnd(text, bodyStart)
  const body = text.slice(bodyStart, bodyEnd)
  const pieces = splitBody(body)

  // 找到最后一条语句在 body 里的结束位置，之后的原文（空行 + "}"）归入 tail
  const lastStmt = [...pieces].reverse().find((p) => p.kind === 'stmt')
  const lastEnd = lastStmt ? body.lastIndexOf(lastStmt.text) + lastStmt.text.length : 0
  const tail = body.slice(lastEnd).replace(/^[^\S\n]*\r?\n/, '') + text.slice(bodyEnd)
  const indentMatch = /^([ \t]*)\S/m.exec(body)
  const indent = indentMatch ? indentMatch[1] : '            '

  // 第一遍：找出所有创建的控件。只有声明了字段的才算控件——
  // 窗体属性也可能写成 this.ClientSize = new System.Drawing.Size(...)，形式和创建控件一样
  const fields = new Set([...text.matchAll(/^\s*private\s+[\w.]+\s+(\w+)\s*;/gm)].map((m) => m[1]))
  const controls = new Set<string>()
  for (const piece of pieces) {
    const m = piece.kind === 'stmt' ? CREATE.exec(piece.text) : null
    if (m && m[1] !== 'components' && fields.has(m[1])) controls.add(m[1])
  }

  const doc: DesignerDocument = { formName: className, className, head: text.slice(0, bodyStart), prologue: [], blocks: [], epilogue: [], tail, eol, indent }
  let block: Block | undefined
  let headerLines: string[] = []

  for (const piece of pieces) {
    if (piece.kind === 'comment') {
      headerLines.push(piece.text)
      // VS 的块头是三行注释："// "、"// 名字"、"// "
      if (headerLines.length === 3) {
        const name = /^\/\/ (\w+)$/.exec(headerLines[1])?.[1]
        if (!name || headerLines[0].trim() !== '//' || headerLines[2].trim() !== '//') {
          throw new DesignerParseError(`无法识别的注释：${headerLines.join(' ')}`)
        }
        block = { name, stmts: [] }
        doc.blocks.push(block)
        headerLines = []
      }
      continue
    }
    if (headerLines.length) throw new DesignerParseError(`无法识别的注释：${headerLines.join(' ')}`)
    const stmt = classify(piece.text, controls)
    if (block) block.stmts.push(stmt)
    else doc.prologue.push(stmt)
  }

  // 最后一个块是窗体本身；块末尾的 ResumeLayout / PerformLayout / EndInit 归入 epilogue
  const formBlock = doc.blocks.at(-1)
  if (formBlock) {
    doc.formName = formBlock.name
    while (formBlock.stmts.length && formBlock.stmts.at(-1)!.kind === 'layout') {
      doc.epilogue.unshift(formBlock.stmts.pop()!)
    }
  }
  return doc
}

function classify(text: string, controls: Set<string>): Stmt {
  let m: RegExpExecArray | null
  if ((m = CREATE.exec(text)) && controls.has(m[1])) return { kind: 'create', name: m[1], type: m[2], args: m[3], text }
  if ((m = LAYOUT.exec(text))) return { kind: 'layout', target: m[1] ?? '', op: m[2] as LayoutOp, text }
  if ((m = INIT.exec(text))) return { kind: 'layout', target: m[1], op: m[2] as LayoutOp, text }
  if ((m = EVENT.exec(text))) return { kind: 'event', target: targetOf(m[1], controls), event: m[2], delegate: m[3], handler: m[4], text }
  if ((m = ADD.exec(text))) return { kind: 'add', target: targetOf(m[1], controls), child: m[2], text }
  if ((m = ITEMS.exec(text)) && controls.has(m[1])) return { kind: 'items', target: m[1], items: splitItems(m[2]), text }
  if ((m = PROP.exec(text))) {
    const [first, ...rest] = m[1].split('.')
    if (controls.has(first) && rest.length) return { kind: 'prop', target: first, path: rest.join('.'), value: m[2], text }
    return { kind: 'prop', target: '', path: m[1], value: m[2], text }
  }
  return { kind: 'raw', text }
}

/** this.x.Event：x 是控件名时是控件的事件；否则（如 this.Load）是窗体的事件 */
function targetOf(name: string | undefined, controls: Set<string>) {
  if (!name) return ''
  if (controls.has(name)) return name
  throw new DesignerParseError(`代码引用了不存在的控件 ${name}`)
}

/** 拆分 new object[] { "a", "b" } 里的各项（逗号分隔，跳过字符串里的逗号） */
function splitItems(inner: string): string[] {
  const items: string[] = []
  let i = 0
  let start = 0
  while (i < inner.length) {
    const c = inner[i]
    if (c === '"' || c === "'") {
      i = skipLiteral(inner, i)
      continue
    }
    if (c === ',') {
      items.push(inner.slice(start, i).trim())
      start = i + 1
    }
    i++
  }
  const last = inner.slice(start).trim()
  if (last) items.push(last)
  return items
}

/** 从方法体开始位置找到与之匹配的 "}"（跳过字符串和注释） */
function findMethodEnd(text: string, start: number) {
  let depth = 1
  let i = start
  while (i < text.length) {
    const c = text[i]
    if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i)
      i = end < 0 ? text.length : end
      continue
    }
    if (c === '"' || c === "'") {
      i = skipLiteral(text, i)
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        // 回到这一行的行首，"}" 前的缩进归入 tail
        return text.lastIndexOf('\n', i) + 1
      }
    }
    i++
  }
  throw new DesignerParseError('InitializeComponent 方法没有结束')
}

// ---------- 生成 ----------

export function renderStmt(stmt: Stmt, indent = '            ', eol = '\n'): string {
  if (stmt.text !== undefined) return stmt.text
  const self = (target: string) => (target ? `this.${target}` : 'this')
  switch (stmt.kind) {
    case 'create':
      return `this.${stmt.name} = new ${stmt.type}(${stmt.args});`
    case 'prop':
      return `${self(stmt.target)}.${stmt.path} = ${stmt.value};`
    case 'event':
      return `${self(stmt.target)}.${stmt.event} += new ${stmt.delegate}(this.${stmt.handler});`
    case 'add':
      return `${self(stmt.target)}.Controls.Add(this.${stmt.child});`
    case 'items': {
      // VS 的格式：每项单独一行，与语句同样缩进，最后一项后紧跟 "});"
      const lines = stmt.items.map((item, i) => indent + item + (i < stmt.items.length - 1 ? ',' : '});'))
      return `this.${stmt.target}.Items.AddRange(new object[] {${eol}${lines.join(eol)}`
    }
    case 'layout':
      if (stmt.op === 'BeginInit' || stmt.op === 'EndInit') {
        return `((System.ComponentModel.ISupportInitialize)(this.${stmt.target})).${stmt.op}();`
      }
      return `${self(stmt.target)}.${stmt.op}(${stmt.op === 'ResumeLayout' ? 'false' : ''});`
    case 'raw':
      return stmt.text
  }
}

export function generateDesigner(doc: DesignerDocument): string {
  const { indent, eol } = doc
  const lines: string[] = []
  const emit = (stmt: Stmt) => lines.push(indent + renderStmt(stmt, indent, eol))
  doc.prologue.forEach(emit)
  for (const block of doc.blocks) {
    lines.push(`${indent}// `, `${indent}// ${block.name}`, `${indent}// `)
    block.stmts.forEach(emit)
  }
  doc.epilogue.forEach(emit)
  return doc.head + lines.join(eol) + eol + doc.tail
}

// 窗体代码文件（如 Form1.cs）的修改：双击控件或事件时，插入事件处理方法，并返回光标应放的行号。

export interface HandlerResult {
  code: string
  /** 方法体内空行的行号（从 1 开始），编辑器跳到这里 */
  line: number
}

/** 方法已经存在时只返回它的位置；否则插在窗体类的最后，格式与 VS 一致 */
export function ensureHandler(code: string, className: string, handler: string, args: string): HandlerResult {
  const existing = new RegExp(`void\\s+${handler}\\s*\\(`).exec(code)
  if (existing) return { code, line: lineOf(code, existing.index) + 2 }

  const eol = code.includes('\r\n') ? '\r\n' : '\n'
  const close = classClosingBrace(code, className)
  if (close < 0) throw new Error(`在代码文件中找不到类 ${className}`)
  const lineStart = code.lastIndexOf('\n', close) + 1
  const classIndent = /^[ \t]*/.exec(code.slice(lineStart))![0]
  const indent = `${classIndent}    `
  // 类里已有成员时，与上一个成员之间空一行
  const before = code.slice(0, lineStart)
  const hasMembers = !/\{\s*$/.test(before)
  const method = [
    ...(hasMembers ? [''] : []),
    `${indent}private void ${handler}(object sender, ${args} e)`,
    `${indent}{`,
    '',
    `${indent}}`,
  ].join(eol)
  const next = `${before}${method}${eol}${code.slice(lineStart)}`
  return { code: next, line: lineOf(next, before.length) + (hasMembers ? 3 : 2) }
}

function lineOf(text: string, index: number) {
  let line = 1
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++
  return line
}

/** 找到 class className 的类体结束 "}" 的位置（跳过字符串、字符和注释） */
export function classClosingBrace(code: string, className: string): number {
  const decl = new RegExp(`(?<![\\p{L}\\p{N}_])class\\s+${className}(?![\\p{L}\\p{N}_])`, 'u').exec(code)
  if (!decl) return -1
  let i = code.indexOf('{', decl.index)
  if (i < 0) return -1
  let depth = 0
  while (i < code.length) {
    const c = code[i]
    if (code.startsWith('//', i)) {
      const end = code.indexOf('\n', i)
      i = end < 0 ? code.length : end
      continue
    }
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2)
      i = end < 0 ? code.length : end + 2
      continue
    }
    if (c === '@' && code[i + 1] === '"') {
      i += 2
      while (i < code.length && !(code[i] === '"' && code[i + 1] !== '"')) i += code[i] === '"' ? 2 : 1
      i++
      continue
    }
    if (c === '"' || c === "'") {
      i++
      while (i < code.length && code[i] !== c && code[i] !== '\n') i += code[i] === '\\' ? 2 : 1
      i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
    i++
  }
  return -1
}

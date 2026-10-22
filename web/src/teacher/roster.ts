// 读取老师上传的学生名单（CSV）。名单通常由 Excel 导出：
// 中文 Windows 上"CSV（逗号分隔）"是 GBK 编码，"CSV UTF-8"带 BOM，两种都要支持；
// 第一行可能是表头（学号、姓名、密码），没有表头时按"账号、姓名、密码"的顺序读。

export interface RosterRow {
  username: string
  name: string
  password: string
  /** 这一行的问题；有问题的行不导入 */
  problem?: string
}

/** 文件内容转成文字：先按 UTF-8 解码，不是合法的 UTF-8 就按 GBK（GB18030）解码 */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('gb18030').decode(bytes)
  }
}

/** 按 CSV 规则拆成表格：支持双引号包起来的字段（里面可以有逗号、换行、两个双引号表示一个） */
export function parseCsv(text: string): string[][] {
  const table: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      table.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field || row.length) {
    row.push(field)
    table.push(row)
  }
  // 去掉空行（Excel 导出的文件常在末尾多出空行）
  return table.filter((r) => r.some((cell) => cell.trim()))
}

const HEADERS = {
  username: ['账号', '帐号', '用户名', '学号', 'username', 'account'],
  name: ['姓名', '名字', '真实姓名', 'name'],
  password: ['密码', 'password'],
}

/** 表格转成名单：识别表头，检查每行的问题 */
export function toRoster(table: string[][]): RosterRow[] {
  if (table.length === 0) return []
  const header = table[0].map((cell) => cell.trim().toLowerCase())
  const column = (aliases: string[]) => header.findIndex((cell) => aliases.includes(cell))
  const hasHeader = column(HEADERS.username) >= 0 && column(HEADERS.name) >= 0
  const index = hasHeader
    ? { username: column(HEADERS.username), name: column(HEADERS.name), password: column(HEADERS.password) }
    : { username: 0, name: 1, password: 2 }

  return table.slice(hasHeader ? 1 : 0).map((cells) => {
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '')
    const row: RosterRow = { username: cell(index.username), name: cell(index.name), password: cell(index.password) }
    // Excel 会把长数字（如 12 位学号）显示成科学计数法，导出 CSV 时也照样写出去
    if (/^\d+(\.\d+)?e\+\d+$/i.test(row.username)) {
      row.problem = '账号变成了科学计数法：在 Excel 里把这一列设为"文本"格式、重新输入后再导出'
    } else if (!row.username) {
      row.problem = '账号为空'
    } else if (!row.name) {
      row.problem = '姓名为空'
    }
    return row
  })
}

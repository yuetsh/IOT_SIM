// 读取老师上传的学生名单（CSV）。名单通常由 Excel 导出：
// 中文 Windows 上"CSV（逗号分隔）"是 GBK 编码，"CSV UTF-8"带 BOM，两种都要支持；
// 名单只有"用户名、密码"两列，平台里的姓名就用用户名；第一行可能是表头，没有表头时按"用户名、密码"的顺序读。
// 以前的名单有"姓名"列的，照样读进来。学校别的平台的用户名在姓名前带着班级代号（ks241张三），
// 这里有班级，代号去掉，学生只用姓名登录。

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

/** 去掉姓名前面的班级代号（字母加数字）：ks241张三 → 张三；不是"代号 + 汉字"的用户名不变 */
export function stripClassCode(username: string) {
  return username.replace(/^[A-Za-z]+\d+(?=\p{Script=Han})/u, '')
}

/** 表格转成名单：识别表头，检查每行的问题 */
export function toRoster(table: string[][]): RosterRow[] {
  if (table.length === 0) return []
  const header = table[0].map((cell) => cell.trim().toLowerCase())
  const column = (aliases: string[]) => header.findIndex((cell) => aliases.includes(cell))
  const hasHeader = column(HEADERS.username) >= 0
  const index = hasHeader
    ? { username: column(HEADERS.username), name: column(HEADERS.name), password: column(HEADERS.password) }
    : { username: 0, name: -1, password: 1 }

  const seen = new Set<string>()
  return table.slice(hasHeader ? 1 : 0).map((cells) => {
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '')
    const username = stripClassCode(cell(index.username))
    const row: RosterRow = { username, name: index.name >= 0 ? cell(index.name) : username, password: cell(index.password) }
    // Excel 会把长数字（如 12 位学号）显示成科学计数法，导出 CSV 时也照样写出去
    if (/^\d+(\.\d+)?e\+\d+$/i.test(row.username)) {
      row.problem = '用户名变成了科学计数法：在 Excel 里把这一列设为"文本"格式、重新输入后再导出'
    } else if (!row.username) {
      row.problem = '用户名为空'
    } else if (!row.name) {
      row.problem = '姓名为空'
    } else if (seen.has(row.username)) {
      row.problem = '名单里有同名的，在用户名后面加数字区分，如"张三2"'
    }
    seen.add(row.username)
    return row
  })
}

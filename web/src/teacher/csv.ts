// 下载 CSV：开头带 BOM，Excel 打开时中文不乱码。
// 账号、密码这类纯数字的文字用 textCell 包一下，Excel 不会把它变成数字（丢掉开头的 0、变成科学计数法）。
export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const quote = (value: string | number | null) => {
    const cell = value === null ? '' : String(value)
    return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell
  }
  const text = '﻿' + rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n'
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

/** 纯数字时前面加制表符，Excel 按文字处理；姓名等其他文字原样输出，不留多余的空白 */
export const textCell = (value: string) => (/^\d+$/.test(value) ? `\t${value}` : value)

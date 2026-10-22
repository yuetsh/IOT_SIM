// 下载 CSV：开头带 BOM，Excel 打开时中文不乱码。
// 学号、密码等长数字前加制表符（cell 以 \t 开头），Excel 不会把它变成科学计数法。
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

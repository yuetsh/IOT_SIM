// 任务说明用的 Markdown 子集，转成 HTML：标题（# ## ###）、段落、无序 / 有序列表（缩进的 - 是下一级）、表格、引用（> 提示框）、**加粗**、`代码`。
// 老师可以改写任务说明，所以先把文字里的 HTML 全部转义，只输出这里生成的标签，不会被插入脚本。

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 行内：`代码` 里的内容原样显示，其余部分处理 **加粗** */
function inline(text: string): string {
  return text
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.length > 2 && part.startsWith('`') && part.endsWith('`')
        ? `<code>${escapeHtml(part.slice(1, -1))}</code>`
        : escapeHtml(part).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'),
    )
    .join('')
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())

const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

/** 列表项的内容：续行里以 - 开头的是下一级列表，其余续行换行接在后面 */
function listItemHtml(text: string): string {
  const [head, ...rest] = text.split('\n')
  let html = inline(head)
  let sub: string[] = []
  const flush = () => {
    if (sub.length) html += `<ul>${sub.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`
    sub = []
  }
  for (const line of rest) {
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) sub.push(bullet[1])
    else {
      flush()
      html += `<br>${inline(line)}`
    }
  }
  flush()
  return html
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      // 面板里地方小：# 和 ## 都是小标题
      const level = heading[1].length === 3 ? 'h5' : 'h4'
      out.push(`<${level}>${inline(heading[2])}</${level}>`)
      i++
      continue
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const head = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]))
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      )
      continue
    }
    const listItem = /^\s*(?:([-*])|(\d+)[.、])\s+(.*)$/
    const first = listItem.exec(line)
    if (first) {
      const ordered = !first[1]
      const items: string[] = []
      while (i < lines.length) {
        const item = listItem.exec(lines[i])
        if (items.length && /^\s{2,}\S/.test(lines[i])) {
          // 缩进的行（续行或下一级列表）接在上一项后面
          items[items.length - 1] += `\n${lines[i].trim()}`
          i++
        } else if (item && !item[1] === ordered) {
          items.push(item[3])
          i++
        } else break
      }
      const tag = ordered ? 'ol' : 'ul'
      const start = ordered && first[2] !== '1' ? ` start="${Number(first[2])}"` : ''
      out.push(`<${tag}${start}>${items.map((t) => `<li>${listItemHtml(t)}</li>`).join('')}</${tag}>`)
      continue
    }
    if (line.startsWith('>')) {
      const quoted: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) quoted.push(lines[i++].replace(/^>\s?/, ''))
      out.push(`<blockquote>${quoted.map(inline).join('<br>')}</blockquote>`)
      continue
    }
    // 段落：到空行、标题、列表、表格、引用为止，段内换行保留
    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !listItem.test(lines[i]) &&
      !lines[i].startsWith('>') &&
      !(lines[i].trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paragraph.push(lines[i++])
    }
    out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`)
  }
  return out.join('')
}

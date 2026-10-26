import { describe, expect, test } from 'bun:test'
import { renderMarkdown } from './markdown'

describe('任务说明的 Markdown', () => {
  test('标题、段落（段内换行保留）、加粗、代码', () => {
    expect(renderMarkdown('## 任务目标\n\n勾选**人体开关**后，\n每 5 秒检查一次 `timer1`')).toBe(
      '<h4>任务目标</h4><p>勾选<b>人体开关</b>后，<br>每 5 秒检查一次 <code>timer1</code></p>',
    )
  })

  test('无序、有序列表，缩进的续行接在上一项', () => {
    expect(renderMarkdown('- 甲\n- 乙\n  续行\n\n1. 一\n2. 二')).toBe('<ul><li>甲</li><li>乙<br>续行</li></ul><ol><li>一</li><li>二</li></ol>')
    expect(renderMarkdown('3. 接着第 3 步')).toBe('<ol start="3"><li>接着第 3 步</li></ol>')
    expect(renderMarkdown('1. 勾选的 Click：\n   - 勾上时：启动\n   - 取消时：停止\n   最后刷新\n2. 下一步')).toBe(
      '<ol><li>勾选的 Click：<ul><li>勾上时：启动</li><li>取消时：停止</li></ul><br>最后刷新</li><li>下一步</li></ol>',
    )
    expect(renderMarkdown('- 甲\n  - 甲1\n- 乙')).toBe('<ul><li>甲<ul><li>甲1</li></ul></li><li>乙</li></ul>')
  })

  test('表格：列数以表头为准', () => {
    expect(renderMarkdown('| 控件 | 名称 |\n|---|---|\n| 按钮 | `btn_open` |\n| 复选框 |')).toBe(
      '<table><thead><tr><th>控件</th><th>名称</th></tr></thead><tbody><tr><td>按钮</td><td><code>btn_open</code></td></tr><tr><td>复选框</td><td></td></tr></tbody></table>',
    )
  })

  test('引用变成提示框', () => {
    expect(renderMarkdown('> 书上写成了 `True`\n> 要改成小写')).toBe('<blockquote>书上写成了 <code>True</code><br>要改成小写</blockquote>')
  })

  test('HTML 一律转义，不会插入标签或脚本', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n- <img src=x onerror=alert(1)>\n| <b> |\n|---|\n| `<i>` |')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<code>&lt;i&gt;</code>')
  })
})

// 示例的任务说明（task.md）：表格里写的控件名都要在示例的 Designer.cs 里有，学生照着改名不会被带错。
import { expect, test } from 'bun:test'
import { listSamples, loadSample, loadTask } from '../src/samples'

/** 控件表格（表头有"名称"）里那一列用 `反引号` 写的名字 */
function tableNames(task: string): string[] {
  const names: string[] = []
  let column = -1
  for (const line of task.split('\n')) {
    if (!line.trim().startsWith('|')) {
      column = -1
      continue
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|')
    const header = cells.findIndex((c) => c.includes('名称'))
    if (header >= 0) column = header
    else if (column >= 0) names.push(...[...(cells[column] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]))
  }
  return names
}

test('任务说明里的控件名都在示例的界面里', async () => {
  let checked = 0
  for (const { id } of await listSamples()) {
    const task = await loadTask(id)
    if (!task) continue
    const designer = (await loadSample(id))!.filter((f) => f.path.endsWith('.Designer.cs'))
    const names = tableNames(task)
    expect(names.length, `${id} 的任务说明没有控件表格`).toBeGreaterThan(0)
    for (const name of names) {
      // 窗体本身写的是类名，控件是 this.名字
      const found = designer.some((f) => f.content.includes(`this.${name} `) || f.content.includes(`partial class ${name}`))
      expect(found, `${id}：任务说明里的 ${name} 在 Designer.cs 里找不到`).toBe(true)
    }
    checked++
  }
  expect(checked).toBeGreaterThan(0)
})

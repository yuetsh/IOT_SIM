/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { createDesignerHistory } from './history'

function setup() {
  const files = new Map([
    ['F.Designer.cs', 'd0'],
    ['F.cs', 'c0'],
  ])
  const history = createDesignerHistory({ read: (p) => files.get(p) ?? '', write: (p, c) => files.set(p, c) })
  /** 模拟设计器的一次改动 */
  const change = (designer: string, code?: string) => {
    history.record('F.Designer.cs', {
      designerBefore: files.get('F.Designer.cs')!,
      designerAfter: designer,
      ...(code !== undefined ? { codeBefore: files.get('F.cs')!, codeAfter: code } : {}),
    })
    files.set('F.Designer.cs', designer)
    if (code !== undefined) files.set('F.cs', code)
  }
  return { files, history, change }
}

test('撤销、重做依次恢复 Designer.cs；新的改动清空重做', () => {
  const { files, history, change } = setup()
  change('d1')
  change('d2')
  expect(history.undo('F.Designer.cs', 'F.cs')).toBe(true)
  expect(files.get('F.Designer.cs')).toBe('d1')
  expect(history.undo('F.Designer.cs', 'F.cs')).toBe(true)
  expect(files.get('F.Designer.cs')).toBe('d0')
  expect(history.canUndo('F.Designer.cs')).toBe(false)
  expect(history.redo('F.Designer.cs', 'F.cs')).toBe(true)
  expect(files.get('F.Designer.cs')).toBe('d1')
  change('d3')
  expect(history.canRedo('F.Designer.cs')).toBe(false)
})

test('撤销"生成事件处理方法"：事件绑定和插入的方法一起撤掉', () => {
  const { files, history, change } = setup()
  change('d1+event', 'c0+handler')
  history.undo('F.Designer.cs', 'F.cs')
  expect(files.get('F.Designer.cs')).toBe('d0')
  expect(files.get('F.cs')).toBe('c0')
  history.redo('F.Designer.cs', 'F.cs')
  expect(files.get('F.cs')).toBe('c0+handler')
})

test('学生已经在生成的方法里写了代码：撤销只回退设计，不动代码', () => {
  const { files, history, change } = setup()
  change('d1+event', 'c0+handler')
  files.set('F.cs', 'c0+handler+学生写的代码')
  history.undo('F.Designer.cs', 'F.cs')
  expect(files.get('F.Designer.cs')).toBe('d0')
  expect(files.get('F.cs')).toBe('c0+handler+学生写的代码')
})

test('Designer.cs 在代码页里被手动改过：历史失效并清空，不覆盖手改的内容', () => {
  const { files, history, change } = setup()
  change('d1')
  files.set('F.Designer.cs', 'd1 手动改过')
  expect(history.undo('F.Designer.cs', 'F.cs')).toBe(false)
  expect(files.get('F.Designer.cs')).toBe('d1 手动改过')
  expect(history.canUndo('F.Designer.cs')).toBe(false)
})

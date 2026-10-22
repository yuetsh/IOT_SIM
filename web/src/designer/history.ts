// 窗体设计器的撤销 / 重做。每个窗体（按 Designer.cs 路径）一份历史，保存在页面层，切换标签页不会丢。
// 每一步记录 Designer.cs 改动前后的内容；如果这一步还往窗体代码里插入了事件处理方法，代码文件的前后内容也一起记下。
import { reactive } from 'vue'

export interface Step {
  designerBefore: string
  designerAfter: string
  /** 只有这一步改了窗体代码（插入事件处理方法）时才有 */
  codeBefore?: string
  codeAfter?: string
}

interface Stacks {
  undo: Step[]
  redo: Step[]
}

const LIMIT = 100

export interface FileAccess {
  read(path: string): string
  write(path: string, content: string): void
}

export function createDesignerHistory(files: FileAccess) {
  const stacks = reactive(new Map<string, Stacks>())

  function of(designer: string): Stacks {
    let s = stacks.get(designer)
    if (!s) {
      s = { undo: [], redo: [] }
      stacks.set(designer, s)
    }
    return s
  }

  function record(designer: string, step: Step) {
    const s = of(designer)
    s.undo.push(step)
    if (s.undo.length > LIMIT) s.undo.shift()
    s.redo = []
  }

  /**
   * 撤销或重做一步。Designer.cs 在代码页里被手动改过（和历史记录对不上）时，这个窗体的历史失效、清空，返回 false。
   * 代码文件只在内容仍是这一步的结果时才回退——学生已经在生成的方法里写了代码，就不去动它。
   */
  function apply(designer: string, code: string, direction: 'undo' | 'redo'): boolean {
    const s = of(designer)
    const from = direction === 'undo' ? s.undo : s.redo
    const to = direction === 'undo' ? s.redo : s.undo
    const step = from.at(-1)
    if (!step) return false
    const [expected, target] = direction === 'undo' ? [step.designerAfter, step.designerBefore] : [step.designerBefore, step.designerAfter]
    if (files.read(designer) !== expected) {
      clear(designer)
      return false
    }
    from.pop()
    files.write(designer, target)
    if (step.codeBefore !== undefined && step.codeAfter !== undefined) {
      const [codeExpected, codeTarget] = direction === 'undo' ? [step.codeAfter, step.codeBefore] : [step.codeBefore, step.codeAfter]
      if (files.read(code) === codeExpected) files.write(code, codeTarget)
    }
    to.push(step)
    return true
  }

  function clear(designer?: string) {
    if (designer) stacks.delete(designer)
    else stacks.clear()
  }

  return {
    record,
    undo: (designer: string, code: string) => apply(designer, code, 'undo'),
    redo: (designer: string, code: string) => apply(designer, code, 'redo'),
    canUndo: (designer: string) => (stacks.get(designer)?.undo.length ?? 0) > 0,
    canRedo: (designer: string) => (stacks.get(designer)?.redo.length ?? 0) > 0,
    clear,
  }
}

export type DesignerHistory = ReturnType<typeof createDesignerHistory>

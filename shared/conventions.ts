// 规范提示：给老师评"注释、命名"时参考，不计分。
// - 控件命名：在代码里用到、却还是默认名字（button1、textBox1……）的控件。书上要求"控件缩写 + 有意义的英文"，
//   如 btn_Open；只放在界面上、代码里不用的标签、分组框可以保留默认名字（书上也是这样），
//   教材自带的设备控件（lamp1、alarm1）书上就这样命名，也不提示。
// - 注释：学生自己写的代码文件（不含 Designer.cs、Program.cs）里有多少行注释。
import type { SourceFile } from './protocol'

export interface ConventionHint {
  level: 'warn' | 'info'
  text: string
}

const DEFAULT_NAME = /^(button|label|textBox|comboBox|checkBox|radioButton|listBox)\d+$/

const studentCode = (files: SourceFile[]) => files.filter((f) => f.path.endsWith('.cs') && !f.path.endsWith('.Designer.cs') && f.path !== 'Program.cs')

export function conventionHints(files: SourceFile[]): ConventionHint[] {
  const hints: ConventionHint[] = []
  const code = studentCode(files)
  const codeText = code.map((f) => f.content).join('\n')

  const designers = files.filter((f) => f.path.endsWith('.Designer.cs')).map((f) => f.content)
  const controls = designers.flatMap((text) => [...text.matchAll(/^\s*private\s+[\w.]+\s+(\w+);/gm)].map((m) => m[1]))
  // 绑定了事件（this.button1.Click += ...）或在代码里用到，就算"用到"
  const withEvents = new Set(designers.flatMap((text) => [...text.matchAll(/this\.(\w+)\.\w+\s*\+=/g)].map((m) => m[1])))
  const usedInCode = (name: string) => new RegExp(`(?<![\\w])${name}(?![\\w])`).test(codeText)
  const defaults = controls.filter((name) => DEFAULT_NAME.test(name) && (withEvents.has(name) || usedInCode(name)))
  if (defaults.length) {
    hints.push({ level: 'warn', text: `代码里用到的控件还是默认名字：${defaults.join('、')}（书上要求"控件缩写 + 有意义的英文"，如 btn_Open）` })
  }

  let comments = 0
  let lines = 0
  for (const line of codeText.split('\n').map((l) => l.trim())) {
    if (!line || line === '{' || line === '}' || line.startsWith('using ')) continue
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) comments++
    else {
      lines++
      if (line.includes('//')) comments++
    }
  }
  if (lines > 0) {
    hints.push(comments === 0 ? { level: 'warn', text: `没有写注释（代码 ${lines} 行）` } : { level: 'info', text: `注释 ${comments} 行，代码 ${lines} 行` })
  }
  return hints
}

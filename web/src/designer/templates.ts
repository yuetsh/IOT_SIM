// 工程模板：新建窗体（与 VS 中文版新建窗体并保存一次后相同的两个文件）、窗体改名，以及布置作业时学生的起点工程。
import type { SourceFile } from '@iot/shared'
import { renameIdentifier } from './code'
import { generateDesigner, parseDesigner } from './document'
import { renderValue } from './values'

/** 工程的命名空间：取 Program.cs（没有就取任意 .cs）里的 namespace */
export function projectNamespace(files: SourceFile[]): string {
  const ordered = [...files].sort((a, b) => Number(b.path === 'Program.cs') - Number(a.path === 'Program.cs'))
  for (const file of ordered) {
    const m = /^\s*namespace\s+([\p{L}\p{N}_.]+)/mu.exec(file.content)
    if (m) return m[1]
  }
  return 'WindowsFormsApplication1'
}

/** 下一个可用的窗体名：Form2、Form3…… */
export function nextFormName(files: SourceFile[]): string {
  for (let n = 2; ; n++) if (!formNameTaken(files, `Form${n}`)) return `Form${n}`
}

/** 窗体名是否已被使用（同名文件或同名类） */
export function formNameTaken(files: SourceFile[], name: string): boolean {
  return files.some(
    (f) =>
      f.path === `${name}.cs` || f.path === `${name}.Designer.cs` || new RegExp(`(?<![\\p{L}\\p{N}_])class\\s+${name}(?![\\p{L}\\p{N}_])`, 'u').test(f.content),
  )
}

/**
 * 新建类时输入的名字有什么问题（没有问题返回 null）。可以带文件夹，如 SQLHelpers/SQLHelper：
 * 和 VS 一样，文件放进文件夹，文件夹也是命名空间的一段。
 */
export function classPathError(files: SourceFile[], input: string): string | null {
  const path = input.trim().replace(/\\/g, '/').replace(/\.cs$/i, '')
  if (!path) return '请输入类名'
  const parts = path.split('/')
  if (parts.some((p) => !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(p))) return '类名和文件夹名只能用字母、汉字、数字、下划线，且不能以数字开头'
  if (parts[0] === 'Properties') return 'Properties 文件夹由平台管理，请换一个文件夹'
  if (files.some((f) => f.path.toLowerCase() === `${path}.cs`.toLowerCase())) return `已经有 ${path}.cs 了`
  if (formNameTaken(files, parts.at(-1)!)) return `已经有名为“${parts.at(-1)}”的类或窗体`
  return null
}

/** 新建类（VS 的"添加 → 类"）：和 VS 2012 的模板一样 */
export function newClassFile(namespace: string, input: string): SourceFile {
  const path = input.trim().replace(/\\/g, '/').replace(/\.cs$/i, '')
  const parts = path.split('/')
  const name = parts.pop()!
  const content = `using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ${[namespace, ...parts].join('.')}
{
    class ${name}
    {
    }
}
`
  return { path: `${path}.cs`, content }
}

/** Program.cs 里 Application.Run(new X()) 启动的窗体类名 */
export function startupForm(files: SourceFile[]): string | undefined {
  const program = files.find((f) => f.path === 'Program.cs')
  return program && /Application\.Run\(\s*new\s+([\p{L}\p{N}_]+)\s*\(/u.exec(program.content)?.[1]
}

/** VS 的属性块头：三行注释，第一、三行是 "// "（末尾带空格） */
function blockHeader(name: string) {
  return ['            // ', `            // ${name}`, '            // '].join('\n')
}

export function newFormFiles(namespace: string, name: string): SourceFile[] {
  const code = `using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ${namespace}
{
    public partial class ${name} : Form
    {
        public ${name}()
        {
            InitializeComponent();
        }
    }
}
`
  const designer = `namespace ${namespace}
{
    partial class ${name}
    {
        /// <summary>
        /// 必需的设计器变量。
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// 清理所有正在使用的资源。
        /// </summary>
        /// <param name="disposing">如果应释放托管资源，为 true；否则为 false。</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows 窗体设计器生成的代码

        /// <summary>
        /// 设计器支持所需的方法 - 不要
        /// 使用代码编辑器修改此方法的内容。
        /// </summary>
        private void InitializeComponent()
        {
            this.SuspendLayout();
${blockHeader(name)}
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(284, 261);
            this.Name = "${name}";
            this.Text = "${name}";
            this.ResumeLayout(false);

        }

        #endregion
    }
}
`
  return [
    { path: `${name}.cs`, content: code },
    { path: `${name}.Designer.cs`, content: designer },
  ]
}

export type StartMode = 'blank' | 'ui'

/**
 * 布置作业时学生的起点工程（由参考答案生成）：
 * - blank：空白工程，只有 Program.cs 和一个空的 Form1，学生从搭界面做起；
 * - ui：界面已做好，保留每个窗体的控件和属性，去掉事件绑定，窗体代码只剩构造函数，
 *   学生在设计器里双击控件生成事件处理方法、写代码。其他类（如 PublicData）也要学生自己写。
 */
export function assignmentTemplate(files: SourceFile[], mode: StartMode): SourceFile[] {
  const namespace = projectNamespace(files)
  const program = files.find((f) => f.path === 'Program.cs')
  if (mode === 'blank') {
    const startup = startupForm(files)
    const programText = program && startup ? program.content.replace(new RegExp(`new\\s+${startup}\\s*\\(`, 'u'), 'new Form1(') : undefined
    return [...(programText ? [{ path: 'Program.cs', content: programText }] : []), ...newFormFiles(namespace, 'Form1')]
  }
  const result: SourceFile[] = program ? [{ ...program }] : []
  // 界面里的图片引用了项目资源，资源类一起带上（空白工程由学生自己按书上的步骤添加）
  const resources = files.find((f) => f.path.startsWith('Properties/') && f.path.endsWith('.Designer.cs'))
  if (resources) result.push({ ...resources })
  for (const designer of files.filter((f) => isFormDesigner(f.path))) {
    const doc = parseDesigner(designer.content)
    for (const block of doc.blocks) block.stmts = block.stmts.filter((s) => s.kind !== 'event')
    const [code] = newFormFiles(namespace, doc.className)
    result.push({ path: designer.path.replace(/\.Designer\.cs$/, '.cs'), content: code.content }, { path: designer.path, content: generateDesigner(doc) })
  }
  return result
}

/**
 * 窗体改名（属性窗口里窗体的"名称"）：和 VS 一样，类名、构造函数和各文件里的 new X()、X 类型的变量都改，
 * Designer.cs 里窗体的块头注释和 this.Name 也改；两个文件跟着改名。
 * 事件处理方法名（如 Form1_Load）和字符串里的文字不动，VS 也不改。
 */
export function renameForm(files: SourceFile[], designerPath: string, to: string): SourceFile[] {
  const designer = files.find((f) => f.path === designerPath)
  if (!designer) return files
  const from = parseDesigner(designer.content).className
  const codePath = designerPath.replace(/\.Designer\.cs$/, '.cs')
  const dir = designerPath.slice(0, designerPath.lastIndexOf('/') + 1)
  return files.map((f) => {
    if (!f.path.endsWith('.cs')) return f
    const content = renameIdentifier(f.content, from, to)
    if (f.path === codePath) return { path: `${dir}${to}.cs`, content }
    if (f.path !== designerPath) return content === f.content ? f : { ...f, content }
    const doc = parseDesigner(content)
    const formBlock = doc.blocks.at(-1)
    if (formBlock) {
      formBlock.name = to
      formBlock.stmts = formBlock.stmts.map((s) =>
        s.kind === 'prop' && s.target === '' && s.path === 'Name' ? { ...s, value: renderValue({ kind: 'string', value: to }), text: undefined } : s,
      )
    }
    doc.formName = to
    return { path: `${dir}${to}.Designer.cs`, content: generateDesigner(doc) }
  })
}

/** 窗体的 Designer.cs（Properties/ 下平台生成的 Resources.Designer.cs 不是窗体） */
export const isFormDesigner = (path: string) => path.endsWith('.Designer.cs') && !path.startsWith('Properties/')

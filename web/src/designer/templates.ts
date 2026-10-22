// 新建窗体：生成与 VS（中文版、.NET Framework 4.5）新建窗体并保存一次后相同的两个文件。
import type { SourceFile } from '@iot/shared'

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
  return files.some((f) => f.path === `${name}.cs` || f.path === `${name}.Designer.cs` || new RegExp(`(?<![\\p{L}\\p{N}_])class\\s+${name}(?![\\p{L}\\p{N}_])`, 'u').test(f.content))
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

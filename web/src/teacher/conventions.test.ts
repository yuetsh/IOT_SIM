/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { conventionHints } from '@iot/shared'

const designer = (fields: string) => ({ path: 'Form1.Designer.cs', content: `partial class Form1\n{\n${fields}\n}` })

test('代码里用到的控件还是默认名字时提示；界面上的标签、教材的设备控件不提示', () => {
  const files = [
    designer(
      [
        'private System.Windows.Forms.Button button1;',
        'private System.Windows.Forms.Label label1;',
        'private System.Windows.Forms.TextBox txt_SendText;',
        'private WinFormsDeviceControlLibrary.Lamp lamp1;',
        'this.button1.Click += new System.EventHandler(this.button1_Click);',
      ].join('\n'),
    ),
    { path: 'Form1.cs', content: 'void button1_Click()\n{\n    // 打开灯\n    lamp1.OnOff(true);\n    txt_SendText.Text = "";\n}' },
  ]
  expect(conventionHints(files)).toEqual([
    { level: 'warn', text: '代码里用到的控件还是默认名字：button1（书上要求"控件缩写 + 有意义的英文"，如 btn_Open）' },
    { level: 'info', text: '注释 1 行，代码 3 行' },
  ])
})

test('没有注释时提示；Designer.cs 和 Program.cs 不算学生写的代码', () => {
  const files = [
    { path: 'Program.cs', content: '// 程序入口\nstatic void Main() { }' },
    { path: 'Form1.cs', content: 'public Form1()\n{\n    InitializeComponent();\n}' },
  ]
  expect(conventionHints(files)).toEqual([{ level: 'warn', text: '没有写注释（代码 2 行）' }])
})

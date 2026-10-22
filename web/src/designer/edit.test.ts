/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { controlDef } from './catalog'
import { generateDesigner, parseDesigner } from './document'
import { addControl, childrenOf, getPropText, listControls, moveControl, removeControl, renameControl, setEvent, setItems, setProp, syncLayout } from './edit'

const ROOT = resolve(import.meta.dir, '../../..')
const REFERENCE_DIR = resolve(ROOT, 'docs/物联网编程与应用配套/物联网编程与应用')

async function designerFiles(dir: string) {
  const files: string[] = []
  for await (const path of new Bun.Glob('**/*.Designer.cs').scan({ cwd: dir })) {
    if (path.includes('/obj/') || path.includes('/Properties/')) continue
    files.push(resolve(dir, path))
  }
  return files.sort()
}

describe('布局语句的规则与 VS 一致：对现有文件执行一遍不产生任何变化', async () => {
  const files = [...(await designerFiles(resolve(ROOT, 'samples'))), ...(existsSync(REFERENCE_DIR) ? await designerFiles(REFERENCE_DIR) : [])]
  for (const file of files) {
    test(file.replace(`${ROOT}/`, ''), async () => {
      const text = await Bun.file(file).text()
      const doc = parseDesigner(text)
      syncLayout(doc)
      expect(generateDesigner(doc)).toBe(text)
    })
  }
})

const LED_SAMPLE = resolve(ROOT, 'samples/p2-t1-LED显示屏/Form1.Designer.cs')

test('往分组框里添加按钮：创建语句、属性块、Controls.Add、字段声明都按 VS 格式写入', async () => {
  const doc = parseDesigner(await Bun.file(LED_SAMPLE).text())
  const { doc: next, name } = addControl(doc, controlDef('System.Windows.Forms.Button'), 'groupBox1', { x: 20, y: 100 })
  expect(name).toBe('button1')
  const text = generateDesigner(next)
  expect(text).toContain('            this.button1 = new System.Windows.Forms.Button();\n')
  expect(text).toContain(
    [
      '            // ',
      '            // button1',
      '            // ',
      '            this.button1.Location = new System.Drawing.Point(20, 100);',
      '            this.button1.Name = "button1";',
      '            this.button1.Size = new System.Drawing.Size(75, 23);',
      '            this.button1.TabIndex = 6;',
      '            this.button1.Text = "button1";',
      '            this.button1.UseVisualStyleBackColor = true;',
    ].join('\n'),
  )
  // 新控件在最上层：Controls.Add 排在第一个
  expect(childrenOf(next, 'groupBox1')[0]).toBe('button1')
  expect(text).toContain('        private System.Windows.Forms.Button button1;\n')
  // 属性块在窗体块之前
  expect(text.indexOf('// button1')).toBeLessThan(text.indexOf('// Form1'))
})

test('添加 Timer：自动加上 components 容器，不放进窗体', async () => {
  const doc = parseDesigner(await Bun.file(LED_SAMPLE).text())
  const { doc: next } = addControl(doc, controlDef('System.Windows.Forms.Timer'), '', { x: 0, y: 0 })
  const text = generateDesigner(next)
  expect(text).toContain('            this.components = new System.ComponentModel.Container();\n')
  expect(text).toContain('this.timer1 = new System.Windows.Forms.Timer(this.components);')
  expect(listControls(next).find((c) => c.name === 'timer1')?.parent).toBeNull()
})

test('第一次往空的分组框里放控件：补上 SuspendLayout / ResumeLayout / PerformLayout', async () => {
  let doc = parseDesigner(await Bun.file(LED_SAMPLE).text())
  doc = addControl(doc, controlDef('System.Windows.Forms.GroupBox'), '', { x: 12, y: 150 }).doc
  expect(generateDesigner(doc)).not.toContain('this.groupBox2.SuspendLayout();')
  doc = addControl(doc, controlDef('System.Windows.Forms.Label'), 'groupBox2', { x: 6, y: 20 }).doc
  const text = generateDesigner(doc)
  expect(text).toContain('this.groupBox2.SuspendLayout();')
  expect(text).toContain('            this.groupBox2.ResumeLayout(false);\n            this.groupBox2.PerformLayout();')
  // 标签是 AutoSize，窗体本身没有直接的 AutoSize 子控件
  expect(text).not.toContain('            this.PerformLayout();')
})

test('设置、修改、删除属性；改动的语句按排序插入', async () => {
  let doc = parseDesigner(await Bun.file(LED_SAMPLE).text())
  doc = setProp(doc, 'btn_Send', 'Text', { kind: 'string', value: '发送 "LED"' })
  doc = setProp(doc, 'btn_Send', 'BackColor', { kind: 'color', css: '#ff0000', name: 'Red', r: 255, g: 0, b: 0, a: 255 })
  const text = generateDesigner(doc)
  expect(text).toContain('this.btn_Send.Text = "发送 \\"LED\\"";')
  // BackColor 排在 Location 之前
  expect(text).toContain('            this.btn_Send.BackColor = System.Drawing.Color.Red;\n            this.btn_Send.Location')
  doc = setProp(doc, 'btn_Send', 'BackColor', null)
  expect(generateDesigner(doc)).not.toContain('btn_Send.BackColor')
})

test('改名：所有引用和字段声明一起改', async () => {
  const doc = renameControl(parseDesigner(await Bun.file(LED_SAMPLE).text()), 'btn_Send', 'btnSend')
  const text = generateDesigner(doc)
  expect(text).not.toContain('btn_Send.')
  expect(text).toContain('this.btnSend.Name = "btnSend";')
  expect(text).toContain('this.groupBox1.Controls.Add(this.btnSend);')
  expect(text).toContain('private System.Windows.Forms.Button btnSend;')
  // 事件处理方法名不变（和 VS 一样）
  expect(text).toContain('this.btnSend.Click += new System.EventHandler(this.btn_Send_Click);')
})

test('删除分组框：连同里面的控件和字段一起删除，布局语句同步', async () => {
  const doc = removeControl(parseDesigner(await Bun.file(LED_SAMPLE).text()), 'groupBox1')
  const text = generateDesigner(doc)
  for (const name of ['groupBox1', 'btn_Send', 'com_Port', 'label1']) expect(text).not.toContain(`this.${name}`)
  expect(text).not.toContain('private System.Windows.Forms.Button btn_Send;')
  expect(listControls(doc).map((c) => c.name)).toEqual(['led'])
})

test('把控件从分组框拖到窗体上', async () => {
  const doc = moveControl(parseDesigner(await Bun.file(LED_SAMPLE).text()), 'btn_Send', '', { x: 30, y: 200 })
  expect(childrenOf(doc, '')).toContain('btn_Send')
  expect(childrenOf(doc, 'groupBox1')).not.toContain('btn_Send')
  expect(getPropText(doc, 'btn_Send', 'Location')).toBe('new System.Drawing.Point(30, 200)')
})

test('事件绑定与下拉框列表项', async () => {
  let doc = parseDesigner(await Bun.file(LED_SAMPLE).text())
  doc = setEvent(doc, '', 'Load', 'System.EventHandler', 'Form1_Load')
  doc = setItems(doc, 'com_Port', ['COM1', 'COM2'])
  const text = generateDesigner(doc)
  expect(text).toContain('            this.Text = "LED显示屏";\n            this.Load += new System.EventHandler(this.Form1_Load);')
  expect(text).toContain('this.com_Port.Items.AddRange(new object[] {\n            "COM1",\n            "COM2"});')
  // 列表项排在 FormattingEnabled 之后、Location 之前
  expect(text.indexOf('Items.AddRange')).toBeGreaterThan(text.indexOf('com_Port.FormattingEnabled'))
  expect(text.indexOf('Items.AddRange')).toBeLessThan(text.indexOf('com_Port.Location'))
})

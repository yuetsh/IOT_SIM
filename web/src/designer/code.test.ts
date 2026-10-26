/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { ensureHandler } from './code'

const FORM1 = resolve(import.meta.dir, '../../../samples/p2-t1-LED显示屏/Form1.cs')

test('插入事件处理方法：放在类的最后，与上一个方法空一行，返回方法体内的行号', async () => {
  const code = await Bun.file(FORM1).text()
  const { code: next, line } = ensureHandler(code, 'Form1', 'Form1_Load', 'EventArgs')
  const lines = next.split('\n')
  expect(lines.slice(line - 4, line + 1)).toEqual(['', '        private void Form1_Load(object sender, EventArgs e)', '        {', '', '        }'])
  // 方法的 "}" 之后就是类的 "}"
  expect(lines[line + 1]).toBe('    }')
})

test('方法已经存在：不重复插入，只返回它的位置', async () => {
  const code = await Bun.file(FORM1).text()
  const { code: next, line } = ensureHandler(code, 'Form1', 'btn_Send_Click', 'EventArgs')
  expect(next).toBe(code)
  expect(next.split('\n')[line - 3]).toContain('private void btn_Send_Click')
})

test('类里还没有成员时不留多余空行', () => {
  const code = 'namespace A\n{\n    public partial class F : Form\n    {\n    }\n}\n'
  const { code: next, line } = ensureHandler(code, 'F', 'F_Load', 'EventArgs')
  expect(next).toBe(
    'namespace A\n{\n    public partial class F : Form\n    {\n        private void F_Load(object sender, EventArgs e)\n        {\n\n        }\n    }\n}\n',
  )
  expect(line).toBe(7)
})

test('字符串和注释里的大括号不影响查找类的结尾', () => {
  const code = 'class F\n{\n    string s = "}{";\n    // }\n    char c = \'}\';\n}\n'
  const { code: next } = ensureHandler(code, 'F', 'F_Load', 'EventArgs')
  expect(next.endsWith("    char c = '}';\n\n    private void F_Load(object sender, EventArgs e)\n    {\n\n    }\n}\n")).toBe(true)
})

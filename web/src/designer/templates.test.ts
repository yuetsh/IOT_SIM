/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { generateDesigner, parseDesigner } from './document'
import { addControl } from './edit'
import { controlDef } from './catalog'
import { formNameTaken, newFormFiles, nextFormName, projectNamespace, startupForm } from './templates'

const files = [
  { path: 'Program.cs', content: 'namespace 登录\n{\n    static class Program\n    {\n        static void Main()\n        {\n            Application.Run(new Login());\n        }\n    }\n}\n' },
  { path: 'Login.cs', content: 'namespace 登录\n{\n    public partial class Login : Form\n    {\n    }\n}\n' },
]

test('新窗体沿用工程的命名空间，名字不与已有窗体重复', () => {
  expect(projectNamespace(files)).toBe('登录')
  expect(nextFormName(files)).toBe('Form2')
  expect(formNameTaken(files, 'Login')).toBe(true)
  expect(startupForm(files)).toBe('Login')
})

test('新窗体的 Designer.cs 能被设计器打开，添加控件后格式正确', () => {
  const [, designer] = newFormFiles('登录', 'AddUser')
  const doc = parseDesigner(designer.content)
  expect(generateDesigner(doc)).toBe(designer.content)
  expect(doc.formName).toBe('AddUser')
  const text = generateDesigner(addControl(doc, controlDef('System.Windows.Forms.Button'), '', { x: 10, y: 10 }).doc)
  expect(text).toContain('            this.button1 = new System.Windows.Forms.Button();\n            this.SuspendLayout();')
  expect(text).toContain('            this.Controls.Add(this.button1);\n            this.Name = "AddUser";')
  expect(text).toContain('        #endregion\n\n        private System.Windows.Forms.Button button1;\n    }')
})

/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { generateDesigner, parseDesigner } from './document'
import { addControl } from './edit'
import { controlDef } from './catalog'
import { assignmentTemplate, formNameTaken, newFormFiles, nextFormName, projectNamespace, startupForm } from './templates'

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

/** 读取 samples/ 下的示例工程 */
async function sample(id: string) {
  const dir = `${import.meta.dir}/../../../samples/${id}`
  const paths = await Array.fromAsync(new Bun.Glob('**/*.cs').scan({ cwd: dir }))
  return Promise.all(paths.sort().map(async (path) => ({ path, content: await Bun.file(`${dir}/${path}`).text() })))
}

test('作业起点"界面已做好"：保留控件和属性，去掉事件绑定和事件处理方法', async () => {
  const files = assignmentTemplate(await sample('p2-t1-LED显示屏'), 'ui')
  expect(files.map((f) => f.path).sort()).toEqual(['Form1.Designer.cs', 'Form1.cs', 'Program.cs'])
  const designer = files.find((f) => f.path === 'Form1.Designer.cs')!.content
  expect(designer).toContain('this.btn_Open = new System.Windows.Forms.Button();')
  expect(designer).toContain('this.btn_Open.Text = "打　开";')
  expect(designer).not.toContain('+=')
  const code = files.find((f) => f.path === 'Form1.cs')!.content
  expect(code).toContain('namespace LED显示屏')
  expect(code).not.toContain('btn_Open_Click')
})

test('作业起点"界面已做好"：多个窗体都保留，其他类（PublicData）由学生自己写', async () => {
  const files = assignmentTemplate(await sample('p1-t1-登录'), 'ui')
  expect(files.map((f) => f.path).sort()).toEqual(['AddUser.Designer.cs', 'AddUser.cs', 'Login.Designer.cs', 'Login.cs', 'Program.cs'])
  expect(files.find((f) => f.path === 'AddUser.cs')!.content).toContain('public partial class AddUser : Form')
})

test('作业起点"界面已做好"：图片引用了项目资源时带上资源类，资源类不当作窗体', async () => {
  const files = assignmentTemplate(await sample('p7-t1-智慧教室'), 'ui')
  expect(files.map((f) => f.path).sort()).toEqual(['Program.cs', 'Properties/Resources.Designer.cs', '教室情景模式.Designer.cs', '教室情景模式.cs'])
  expect(files.find((f) => f.path === '教室情景模式.Designer.cs')!.content).toContain('global::教室情景模式.Properties.Resources.switch_off')
})

test('作业起点"空白工程"：Program.cs 启动空的 Form1', async () => {
  const files = assignmentTemplate(await sample('p2-t2-模拟量采集'), 'blank')
  expect(files.map((f) => f.path).sort()).toEqual(['Form1.Designer.cs', 'Form1.cs', 'Program.cs'])
  const program = files.find((f) => f.path === 'Program.cs')!.content
  expect(program).toContain('Application.Run(new Form1())')
  expect(files.find((f) => f.path === 'Form1.Designer.cs')!.content).not.toContain('com_port')
})

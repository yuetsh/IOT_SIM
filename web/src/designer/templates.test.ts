/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { generateDesigner, parseDesigner } from './document'
import { addControl } from './edit'
import { controlDef } from './catalog'
import { assignmentTemplate, classPathError, formNameTaken, newClassFile, newFormFiles, nextFormName, projectNamespace, renameForm, startupForm } from './templates'

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

test('新建类：可以带文件夹，文件夹也是命名空间的一段；名字不能重复', () => {
  const files = [{ path: 'Program.cs', content: 'namespace 智慧校园\n{\n    static class Program { }\n}\n' }, { path: 'AppSet.cs', content: 'class AppSet { }' }]
  expect(newClassFile('智慧校园', 'SQLHelpers/SQLHelper')).toEqual({
    path: 'SQLHelpers/SQLHelper.cs',
    content: 'using System;\nusing System.Collections.Generic;\nusing System.Linq;\nusing System.Text;\nusing System.Threading.Tasks;\n\nnamespace 智慧校园.SQLHelpers\n{\n    class SQLHelper\n    {\n    }\n}\n',
  })
  expect(newClassFile('智慧校园', 'RecordClass.cs').path).toBe('RecordClass.cs')
  expect(classPathError(files, 'SQLHelpers/SQLBLL')).toBeNull()
  expect(classPathError(files, 'AppSet')).toBe('已经有 AppSet.cs 了')
  expect(classPathError(files, 'Other/AppSet')).toBe('已经有名为“AppSet”的类或窗体')
  expect(classPathError(files, '1abc')).toContain('不能以数字开头')
  expect(classPathError(files, 'Properties/X')).toContain('平台管理')
})

test('窗体改名：类名、构造函数、Program.cs 和两个文件名一起改，方法名和字符串不动', async () => {
  const blank = assignmentTemplate(await sample('p8-t1-主界面'), 'blank')
  const code = blank.find((f) => f.path === 'Form1.cs')!
  code.content = code.content.replace('InitializeComponent();', 'InitializeComponent();\n            MessageBox.Show("Form1"); // Form1\n        }\n\n        private void Form1_Load(object sender, EventArgs e)\n        {\n            Form1 other = new Form1();')
  const files = renameForm(blank, 'Form1.Designer.cs', 'Main')
  expect(files.map((f) => f.path).sort()).toEqual(['Main.Designer.cs', 'Main.cs', 'Program.cs'])
  expect(files.find((f) => f.path === 'Program.cs')!.content).toContain('Application.Run(new Main())')
  const main = files.find((f) => f.path === 'Main.cs')!.content
  expect(main).toContain('public partial class Main : Form')
  expect(main).toContain('public Main()')
  expect(main).toContain('MessageBox.Show("Form1"); // Form1')
  expect(main).toContain('private void Form1_Load(object sender, EventArgs e)')
  expect(main).toContain('Main other = new Main();')
  const designer = files.find((f) => f.path === 'Main.Designer.cs')!.content
  const doc = parseDesigner(designer)
  expect(doc.className).toBe('Main')
  expect(doc.formName).toBe('Main')
  expect(designer).toContain('            // \n            // Main\n            // \n')
  expect(designer).toContain('this.Name = "Main";')
  // 窗体标题是 Text，VS 改名时也不改
  expect(designer).toContain('this.Text = "Form1";')
  expect(startupForm(files)).toBe('Main')
})

// 按需加载 Monaco（0.57 的模块布局）：编辑器 API + 全部编辑功能（查找、折叠、括号匹配等）+ C# 和 SQL 语法高亮，
// 不加载其他几十种语言和 JS/TS/CSS 语言服务，体积小很多。
// 中文界面（查找替换、右键菜单、提示文字）：必须在编辑器模块之前加载，编辑器模块加载时就会取界面文字
import 'monaco-editor/nls/lang/zh-cn'
import * as monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/features/register.all'
import 'monaco-editor/languages/definitions/csharp/register'
import 'monaco-editor/languages/definitions/sql/register'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

export { monaco }

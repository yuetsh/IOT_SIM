// C# 语言功能：代码补全、悬停提示、参数提示、边写边检查。由服务器上的 Roslyn 语言服务计算（和 VS 的 IntelliSense 同一套引擎）。
// 请求带上整个工程的文件；服务器按浏览器标签页（session）保存工程，只更新有变化的文件。
import type { Diagnostic, SourceFile } from '@iot/shared'
import { api } from '../api'
import { monaco } from './monaco'

/** 每个浏览器标签页一个会话 */
const session = crypto.randomUUID()

/** 当前工程的文件，由代码编辑器设置 */
let currentFiles: () => SourceFile[] = () => []

export function setLanguageFiles(files: () => SourceFile[]) {
  currentFiles = files
}

/** 模型对应的文件路径（模型用 Uri.file(path) 创建） */
const pathOf = (model: monaco.editor.ITextModel) => model.uri.path.replace(/^\//, '')

interface Range {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

function request<T>(body: Record<string, unknown>): Promise<T | null> {
  return api<T & { type: string }>('POST', '/api/language', { ...body, session })
    .then((r) => (r.type === 'empty' ? null : r))
    .catch(() => null)
}

const toRange = (r: Range) => new monaco.Range(r.startLine, r.startColumn, r.endLine, r.endColumn)

const Kind = monaco.languages.CompletionItemKind
/** Roslyn 补全项的标签（第一个标签是种类）对应 Monaco 的图标 */
const KINDS: Record<string, monaco.languages.CompletionItemKind> = {
  Class: Kind.Class,
  Structure: Kind.Struct,
  Interface: Kind.Interface,
  Enum: Kind.Enum,
  EnumMember: Kind.EnumMember,
  Delegate: Kind.Function,
  Event: Kind.Event,
  Field: Kind.Field,
  Constant: Kind.Constant,
  Property: Kind.Property,
  Method: Kind.Method,
  ExtensionMethod: Kind.Method,
  Local: Kind.Variable,
  Parameter: Kind.Variable,
  RangeVariable: Kind.Variable,
  Namespace: Kind.Module,
  Keyword: Kind.Keyword,
  Snippet: Kind.Snippet,
  TypeParameter: Kind.TypeParameter,
  Label: Kind.Reference,
}

interface Completions {
  range: Range
  items: { label: string; insert: string; filter: string; sort: string; kind: string; detail: string }[]
}

type Item = monaco.languages.CompletionItem & { index: number }

let registered = false

/** 注册到 Monaco（全局只需一次） */
export function registerLanguageFeatures() {
  if (registered) return
  registered = true

  monaco.languages.registerCompletionItemProvider('csharp', {
    triggerCharacters: ['.'],
    async provideCompletionItems(model, position) {
      const result = await request<Completions>({
        type: 'complete',
        files: currentFiles(),
        file: pathOf(model),
        line: position.lineNumber,
        column: position.column,
      })
      if (!result) return { suggestions: [] }
      const range = toRange(result.range)
      return {
        suggestions: result.items.map((item, index): Item => ({
          index,
          label: item.label,
          insertText: item.insert,
          filterText: item.filter,
          sortText: item.sort,
          kind: KINDS[item.kind] ?? Kind.Text,
          detail: item.detail || undefined,
          range,
        })),
      }
    },
    // 选中某一项时再取它的签名和说明
    async resolveCompletionItem(item) {
      const result = await request<{ text: string | null }>({ type: 'completionDetail', index: (item as Item).index })
      if (result?.text) item.documentation = { value: '```csharp\n' + result.text + '\n```' }
      return item
    },
  })

  monaco.languages.registerHoverProvider('csharp', {
    async provideHover(model, position) {
      const result = await request<{ text: string | null; range: Range }>({
        type: 'hover',
        files: currentFiles(),
        file: pathOf(model),
        line: position.lineNumber,
        column: position.column,
      })
      if (!result?.text) return null
      // 第一段是签名，用代码格式显示；后面是说明文字
      const [signature, ...rest] = result.text.split('\n\n')
      return {
        range: toRange(result.range),
        contents: [{ value: '```csharp\n' + signature + '\n```' }, ...rest.map((value) => ({ value }))],
      }
    },
  })

  monaco.languages.registerSignatureHelpProvider('csharp', {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],
    async provideSignatureHelp(model, position) {
      const result = await request<{
        signatures: { label: string; parameters: [number, number][] }[]
        activeSignature: number
        activeParameter: number
      }>({ type: 'signature', files: currentFiles(), file: pathOf(model), line: position.lineNumber, column: position.column })
      if (!result || result.signatures.length === 0) return null
      return {
        value: {
          signatures: result.signatures.map((s) => ({ label: s.label, parameters: s.parameters.map((label) => ({ label })) })),
          activeSignature: result.activeSignature,
          activeParameter: result.activeParameter,
        },
        dispose() {},
      }
    },
  })
}

/** 整个工程的编译错误和警告（不生成程序集）；出错时返回 null */
export async function checkProject(): Promise<Diagnostic[] | null> {
  const result = await request<{ diagnostics: Diagnostic[] }>({ type: 'diagnostics', files: currentFiles() })
  return result?.diagnostics ?? null
}

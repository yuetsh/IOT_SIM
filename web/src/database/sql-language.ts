// 查询窗口的自动补全注册到 Monaco。每个查询窗口（模型）有自己的当前数据库，由 QueryTab 设置取表结构的函数。
import { monaco } from '../editor/monaco'
import { sqlSuggestions, type SqlSchema, type SuggestionKind } from './completion'

const schemas = new Map<string, () => SqlSchema>()

const Kind = monaco.languages.CompletionItemKind
const KINDS: Record<SuggestionKind, monaco.languages.CompletionItemKind> = {
  keyword: Kind.Keyword,
  function: Kind.Function,
  type: Kind.TypeParameter,
  table: Kind.Class,
  column: Kind.Field,
  database: Kind.Module,
}

let registered = false

/** 设置模型的表结构（取当前数据库的表）；返回取消函数，关闭查询窗口时调用 */
export function setSqlSchema(model: monaco.editor.ITextModel, schema: () => SqlSchema) {
  register()
  const key = model.uri.toString()
  schemas.set(key, schema)
  return () => schemas.delete(key)
}

function register() {
  if (registered) return
  registered = true
  monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems(model, position, context) {
      const schema = schemas.get(model.uri.toString())
      if (!schema) return { suggestions: [] }
      const word = model.getWordUntilPosition(position)
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, position.column)
      const items = sqlSuggestions(model.getValue(), model.getOffsetAt(position), schema(), context.triggerCharacter)
      return {
        suggestions: items.map((item) => ({
          label: { label: item.label, description: item.detail },
          kind: KINDS[item.kind],
          insertText: item.insert,
          insertTextRules: item.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          sortText: item.sort,
          filterText: item.label,
          detail: item.detail,
          range,
        })),
      }
    },
  })
}

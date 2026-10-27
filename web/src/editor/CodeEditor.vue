<script setup lang="ts">
// 代码编辑器：每个文件一个 Monaco 模型（各自保留撤销记录），切换标签页时换模型。
// 编译错误以波浪线标在代码里：点"运行"时的编译结果，以及停止输入一会儿后的自动检查结果，以较新的为准。
// 代码补全、悬停提示、参数提示见 language.ts。F5 / Shift+F5 由页面统一处理，这里不再单独绑定。
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Diagnostic, SourceFile } from '@iot/shared'
import { checkProject, registerLanguageFeatures, setLanguageFiles } from './language'
import { monaco } from './monaco'

const props = defineProps<{
  files: SourceFile[]
  activeFile?: string
  diagnostics: Diagnostic[]
  /** 只读（老师查看学生提交的代码） */
  readOnly?: boolean
}>()

const emit = defineEmits<{
  change: [path: string, content: string]
}>()

const container = ref<HTMLElement>()
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor>()
const models = new Map<string, monaco.editor.ITextModel>()

function modelFor(file: SourceFile) {
  let model = models.get(file.path)
  if (!model) {
    model = monaco.editor.createModel(file.content, 'csharp', monaco.Uri.file(file.path))
    model.onDidChangeContent(() => {
      emit('change', file.path, model!.getValue())
      scheduleCheck()
    })
    models.set(file.path, model)
  } else if (model.getValue() !== file.content) {
    // 外部换了内容（切换示例、恢复原始代码）
    model.setValue(file.content)
  }
  return model
}

/** 文件列表变化时：为新文件建模型，删掉已不存在的文件的模型 */
function syncModels() {
  const paths = new Set(props.files.map((f) => f.path))
  for (const [path, model] of models) {
    if (!paths.has(path)) {
      model.dispose()
      models.delete(path)
    }
  }
  for (const file of props.files) modelFor(file)
}

function showActive() {
  const file = props.files.find((f) => f.path === props.activeFile)
  if (!editor.value || !file) return
  const model = modelFor(file)
  if (editor.value.getModel() !== model) editor.value.setModel(model)
}

/** 当前显示的错误：新的编译结果或自动检查结果到来时替换 */
let shown: Diagnostic[] = props.diagnostics

function applyMarkers() {
  for (const [path, model] of models) {
    const markers = shown
      .filter((d) => d.file === path)
      .map((d) => ({
        severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: d.hint ? `${d.message}\n提示：${d.hint}` : d.message,
        code: d.code,
        startLineNumber: d.line,
        startColumn: d.column,
        endLineNumber: d.line,
        // 编译器只给出起点；标到该行的下一个词结尾，至少一个字符
        endColumn: model.getWordAtPosition({ lineNumber: d.line, column: d.column })?.endColumn ?? d.column + 1,
      }))
    monaco.editor.setModelMarkers(model, 'csharp-compiler', markers)
  }
}

/** 跳到某个文件的某一行（点击下方的错误信息时调用） */
function reveal(path: string, line: number, column: number) {
  const file = props.files.find((f) => f.path === path)
  if (!editor.value || !file) return
  editor.value.setModel(modelFor(file))
  editor.value.setPosition({ lineNumber: line, column })
  editor.value.revealLineInCenter(line)
  editor.value.focus()
}

defineExpose({ reveal })

// ---------- 边写边检查：停止输入 1 秒后检查整个工程 ----------
const CHECK_DELAY_MS = 1000
let checkTimer: ReturnType<typeof setTimeout> | undefined

function scheduleCheck() {
  if (props.readOnly) return
  clearTimeout(checkTimer)
  checkTimer = setTimeout(() => void check(), CHECK_DELAY_MS)
}

async function check() {
  const versions = new Map([...models].map(([path, model]) => [path, model.getVersionId()]))
  const result = await checkProject()
  // 检查期间又改了代码：这次的结果作废，等下一次
  if (!result || [...models].some(([path, model]) => versions.get(path) !== model.getVersionId())) return
  shown = result
  applyMarkers()
}

onMounted(() => {
  registerLanguageFeatures()
  setLanguageFiles(() => props.files)
  editor.value = monaco.editor.create(container.value!, {
    language: 'csharp',
    theme: 'vs',
    automaticLayout: true,
    fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, "Noto Sans Mono CJK SC", monospace',
    fontSize: 14,
    // 关闭连字：避免 >= 显示成 ≥，学生照着输入时出错
    fontLigatures: false,
    tabSize: 4,
    insertSpaces: true,
    minimap: { enabled: false },
    // 顶部不固定显示所在的类和方法：点报错跳到文件开头附近的行时，那一行会被它挡住
    stickyScroll: { enabled: false },
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
    unicodeHighlight: { ambiguousCharacters: false },
    readOnly: props.readOnly,
  })
  syncModels()
  showActive()
  applyMarkers()
})

watch(
  () => props.files,
  () => {
    syncModels()
    showActive()
    applyMarkers()
  },
)
watch(() => props.activeFile, showActive)
watch(
  () => props.diagnostics,
  (diagnostics) => {
    shown = diagnostics
    applyMarkers()
  },
)

onBeforeUnmount(() => {
  clearTimeout(checkTimer)
  editor.value?.dispose()
  for (const model of models.values()) model.dispose()
  models.clear()
})
</script>

<template>
  <div class="code-editor">
    <div v-if="activeFile?.endsWith('.Designer.cs')" class="designer-note">此文件由窗体设计器生成，一般不要手动修改；控件的属性和事件请在设计器里设置。</div>
    <div ref="container" class="monaco-host" />
  </div>
</template>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 1px solid #e5e7eb;
}

.designer-note {
  padding: 4px 8px;
  background: #fffbe6;
  border-bottom: 1px solid #f5e6a8;
  color: #8a6d00;
  font-size: 12px;
}

.monaco-host {
  flex: 1;
  min-height: 0;
}
</style>

<script setup lang="ts">
// 主页面：选择示例工程 → 编辑代码 → 运行 → 在网页里操作学生的窗体和虚拟实训台。
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { NButton, NConfigProvider, NPopconfirm, NSelect, NTab, NTabs, NTag, zhCN } from 'naive-ui'
import type { SourceFile } from '@iot/shared'
import FormDesigner from './designer/FormDesigner.vue'
import CodeEditor from './editor/CodeEditor.vue'
import { clearDraft, loadDraft, saveDraft } from './editor/drafts'
import { createRunSession } from './run/session'
import TrainingBoard from './scene/TrainingBoard.vue'
import FormWindow from './winforms/FormWindow.vue'
import MessageBoxDialog from './winforms/MessageBoxDialog.vue'

const session = createRunSession()
const { state } = session

const samples = ref<{ label: string; value: string }[]>([])
const sampleId = ref<string>()
const files = ref<SourceFile[]>([])
/** 当前标签页：文件路径，或 "设计:X.Designer.cs" 表示窗体 X 的设计器 */
const activeTab = ref<string>()
const DESIGN = '设计:'

/** 每个 X.Designer.cs 对应一个设计器标签页，和它的代码文件 X.cs */
const forms = computed(() =>
  files.value
    .filter((f) => f.path.endsWith('.Designer.cs'))
    .map((f) => ({ tab: DESIGN + f.path, designer: f.path, code: f.path.replace(/\.Designer\.cs$/, '.cs') })),
)
const tabs = computed(() => [
  ...forms.value.map((f) => ({ name: f.tab, label: `${f.code} [设计]` })),
  ...files.value.map((f) => ({ name: f.path, label: f.path })),
])
const activeForm = computed(() => forms.value.find((f) => f.tab === activeTab.value))
/** 代码编辑器显示的文件：设计器打开时保持上一次的代码文件 */
const activeFile = computed(() => (activeForm.value ? undefined : activeTab.value))
const fileText = (path: string) => files.value.find((f) => f.path === path)?.content ?? ''
/** 当前代码是否和示例原始代码不同（来自浏览器里保存的草稿） */
const modified = ref(false)
const editorRef = ref<InstanceType<typeof CodeEditor>>()
let saveTimer: ReturnType<typeof setTimeout> | undefined

const STATUS_TEXT = { idle: '未运行', compiling: '编译中…', running: '运行中', stopped: '已停止' } as const
const statusType = computed(() => ({ idle: 'default', compiling: 'warning', running: 'success', stopped: 'default' })[state.status] as 'default' | 'warning' | 'success')
const running = computed(() => state.status === 'compiling' || state.status === 'running')

/**
 * F5 运行、Shift+F5 停止，与 Visual Studio 一致。在整个页面上生效，
 * 并阻止浏览器默认的"F5 刷新页面"（否则学生按习惯按下 F5，正在运行的程序和窗体都会丢失）。
 */
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'F5') return
  event.preventDefault()
  event.stopPropagation()
  if (event.shiftKey) session.stop()
  else run()
}

onMounted(() => window.addEventListener('keydown', onKeyDown, { capture: true }))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown, { capture: true }))

onMounted(async () => {
  // 一打开页面就连接服务器，实训台在运行程序之前就能显示和调节
  void session.connect()
  const list: { id: string; title: string }[] = await (await fetch('/api/samples')).json()
  samples.value = list.map((s) => ({ label: s.title, value: s.id }))
  // 网址里带 ?sample=示例编号 时直接打开该示例（便于老师把链接发给学生）
  const requested = new URLSearchParams(location.search).get('sample')
  const initial = list.find((s) => s.id === requested) ?? list[0]
  if (initial) await loadSample(initial.id)
})

async function loadSample(id: string, discardDraft = false) {
  sampleId.value = id
  history.replaceState(null, '', `?sample=${encodeURIComponent(id)}`)
  if (discardDraft) clearDraft(id)
  const draft = discardDraft ? null : loadDraft(id)
  modified.value = draft !== null
  files.value = draft ?? (await (await fetch(`/api/samples/${encodeURIComponent(id)}`)).json())
  // 和 VS 一样，默认打开主窗体的设计器
  activeTab.value = forms.value[0]?.tab ?? files.value.find((f) => f.path !== 'Program.cs')?.path ?? files.value[0]?.path
}

function updateFile(path: string, content: string) {
  const file = files.value.find((f) => f.path === path)
  if (!file || file.content === content) return
  file.content = content
  modified.value = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => sampleId.value && saveDraft(sampleId.value, files.value), 500)
}

/** 设计器改动了 Designer.cs（以及插入事件处理方法时的代码文件） */
function onDesignerUpdate(designerText: string, codeText?: string) {
  const form = activeForm.value
  if (!form) return
  updateFile(form.designer, designerText)
  if (codeText !== undefined) updateFile(form.code, codeText)
}

/** 设计器里双击控件或事件：切到代码文件并跳到事件处理方法 */
async function openCode(line: number) {
  const form = activeForm.value
  if (!form) return
  activeTab.value = form.code
  await nextTick()
  editorRef.value?.reveal(form.code, line, 13)
}

async function showDiagnostic(file: string, line: number, column: number) {
  activeTab.value = file
  await nextTick()
  editorRef.value?.reveal(file, line, column)
}

function restoreOriginal() {
  if (sampleId.value) void loadSample(sampleId.value, true)
}

function run() {
  if (running.value) return
  session.run(files.value.map((f) => ({ ...f })))
}
</script>

<template>
  <NConfigProvider :locale="zhCN">
    <div class="page">
      <header class="toolbar">
        <strong>物联网编程仿真平台</strong>
        <NSelect
          class="sample-select"
          :value="sampleId"
          :options="samples"
          placeholder="选择示例工程"
          @update:value="loadSample"
        />
        <NButton type="primary" :disabled="running" title="F5" @click="run">▶ 运行</NButton>
        <NButton :disabled="!running" title="Shift+F5" @click="session.stop">■ 停止</NButton>
        <NPopconfirm v-if="modified" positive-text="恢复" negative-text="取消" @positive-click="restoreOriginal">
          <template #trigger>
            <NButton quaternary size="small">恢复原始代码</NButton>
          </template>
          你对这个示例的修改将全部丢弃，确定恢复吗？
        </NPopconfirm>
        <NTag :type="statusType">{{ STATUS_TEXT[state.status] }}</NTag>
        <span class="metrics">
          编译 {{ state.metrics.compileMs }} ms · 启动 {{ state.metrics.startMs }} ms · 最近一次操作往返
          {{ state.metrics.lastRoundTripMs }} ms
        </span>
      </header>

      <main class="workspace" :class="{ designing: activeForm }">
        <section class="editor">
          <NTabs v-model:value="activeTab" type="card" size="small">
            <NTab v-for="tab in tabs" :key="tab.name" :name="tab.name">{{ tab.label }}</NTab>
          </NTabs>
          <FormDesigner
            v-if="activeForm"
            class="code"
            :designer-text="fileText(activeForm.designer)"
            :code-text="fileText(activeForm.code)"
            @update="onDesignerUpdate"
            @open-code="openCode"
          />
          <CodeEditor
            v-show="!activeForm"
            ref="editorRef"
            class="code"
            :files="files"
            :active-file="activeFile"
            :diagnostics="state.diagnostics"
            @change="updateFile"
          />
        </section>

        <section class="run-area">
          <div class="desktop">
            <FormWindow
              v-for="(form, index) in state.forms"
              :key="form.root.id"
              :form="form.root"
              :modal="form.modal"
              :offset="index"
              :act="session.act"
            />
            <MessageBoxDialog
              v-for="box in state.messageBoxes"
              :key="box.requestId"
              :box="box"
              @reply="session.replyMessageBox(box.requestId, $event)"
            />
            <div v-if="state.forms.length === 0" class="desktop-hint">点击"运行"后，学生程序的窗体会显示在这里</div>
          </div>
          <TrainingBoard :board="state.board" @set="session.setBoard" @reset="session.resetBoard" />
          <div class="output">
            <div
              v-for="(d, i) in state.diagnostics"
              :key="`d${i}`"
              :class="['diag', d.severity]"
              title="点击跳到出错的代码"
              @click="showDiagnostic(d.file, d.line, d.column)"
            >
              {{ d.file }}({{ d.line }},{{ d.column }}) {{ d.code }}：{{ d.message }}
              <div v-if="d.hint" class="hint">提示：{{ d.hint }}</div>
            </div>
            <pre v-for="(e, i) in state.errors" :key="`e${i}`" class="error">{{ e }}</pre>
            <pre v-if="state.console" class="console">{{ state.console }}</pre>
          </div>
        </section>
      </main>
    </div>
  </NConfigProvider>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
}
</style>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.sample-select {
  width: 240px;
}

.metrics {
  margin-left: auto;
  color: #6b7280;
  font-size: 12px;
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(360px, 2fr) 3fr;
  min-height: 0;
}

/* 设计器需要工具箱、窗体和属性窗口，左栏放宽 */
.workspace.designing {
  grid-template-columns: minmax(0, 3fr) minmax(360px, 2fr);
}

.editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.code {
  flex: 1;
  min-height: 0;
}

.run-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  min-width: 0;
  overflow: auto;
}

.desktop {
  position: relative;
  flex: 1;
  min-height: 320px;
  background: #2d6aa3;
  border-radius: 4px;
  /* 窗体比桌面区域大时可以滚动查看 */
  overflow: auto;
}

.desktop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(255 255 255 / 0.7);
}

.output {
  max-height: 180px;
  overflow: auto;
  font-size: 12px;
}

.diag {
  cursor: pointer;
}

.diag:hover {
  text-decoration: underline;
}

.diag.error,
.error {
  color: #b91c1c;
}

.diag.warning {
  color: #a16207;
}

.hint {
  color: #2563eb;
  padding-left: 1em;
}

.console {
  background: #111827;
  color: #e5e7eb;
  padding: 6px;
  margin: 0;
}
</style>

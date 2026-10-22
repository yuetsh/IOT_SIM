<script setup lang="ts">
// 第 0 阶段的验证页面：选择示例工程 → 编辑代码 → 运行 → 在网页里操作学生的窗体。
import { computed, onMounted, ref } from 'vue'
import { NButton, NConfigProvider, NSelect, NTabPane, NTabs, NTag, zhCN } from 'naive-ui'
import type { SourceFile } from '@iot/shared'
import { createRunSession } from './run/session'
import TrainingBoard from './scene/TrainingBoard.vue'
import FormWindow from './winforms/FormWindow.vue'
import MessageBoxDialog from './winforms/MessageBoxDialog.vue'

const session = createRunSession()
const { state } = session

const samples = ref<{ label: string; value: string }[]>([])
const sampleId = ref<string>()
const files = ref<SourceFile[]>([])
const activeFile = ref<string>()

const STATUS_TEXT = { idle: '未运行', compiling: '编译中…', running: '运行中', stopped: '已停止' } as const
const statusType = computed(() => ({ idle: 'default', compiling: 'warning', running: 'success', stopped: 'default' })[state.status] as 'default' | 'warning' | 'success')
const running = computed(() => state.status === 'compiling' || state.status === 'running')

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

async function loadSample(id: string) {
  sampleId.value = id
  history.replaceState(null, '', `?sample=${encodeURIComponent(id)}`)
  files.value = await (await fetch(`/api/samples/${encodeURIComponent(id)}`)).json()
  // 默认打开窗体的代码文件（不一定叫 Form1.cs，如教材的 frm_analog.cs）
  activeFile.value =
    files.value.find((f) => !f.path.endsWith('.Designer.cs') && f.path !== 'Program.cs')?.path ?? files.value[0]?.path
}

function updateFile(path: string, content: string) {
  const file = files.value.find((f) => f.path === path)
  if (file) file.content = content
}

function run() {
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
        <NButton type="primary" :disabled="running" @click="run">▶ 运行</NButton>
        <NButton :disabled="!running" @click="session.stop">■ 停止</NButton>
        <NTag :type="statusType">{{ STATUS_TEXT[state.status] }}</NTag>
        <span class="metrics">
          编译 {{ state.metrics.compileMs }} ms · 启动 {{ state.metrics.startMs }} ms · 最近一次操作往返
          {{ state.metrics.lastRoundTripMs }} ms
        </span>
      </header>

      <main class="workspace">
        <section class="editor">
          <NTabs v-model:value="activeFile" type="card" size="small">
            <NTabPane v-for="file in files" :key="file.path" :name="file.path" :tab="file.path">
              <textarea
                class="code"
                spellcheck="false"
                :value="file.content"
                @input="updateFile(file.path, ($event.target as HTMLTextAreaElement).value)"
              />
            </NTabPane>
          </NTabs>
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
            <div v-for="(d, i) in state.diagnostics" :key="`d${i}`" :class="['diag', d.severity]">
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

.editor {
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.code {
  width: 100%;
  height: calc(100vh - 120px);
  box-sizing: border-box;
  font-family: "JetBrains Mono", "Cascadia Code", Consolas, "Noto Sans Mono CJK SC", monospace;
  font-size: 13px;
  line-height: 1.5;
  tab-size: 4;
  /* 关闭连字：避免 >= 显示成 ≥，学生照着输入时出错 */
  font-variant-ligatures: none;
  border: 1px solid #e5e7eb;
  padding: 8px;
  resize: none;
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

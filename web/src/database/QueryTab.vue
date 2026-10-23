<script setup lang="ts">
// 查询窗口（仿 SSMS）：选数据库、写 T-SQL、F5 执行（选中一部分时只执行选中的），下面是结果和消息。
// USE 语句会切换当前数据库，和 SSMS 一样执行后下拉框跟着变。
import { NButton, NSelect, NTab, NTabs } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { monaco } from '../editor/monaco'
import ResultGrid from './ResultGrid.vue'
import { messages, runQuery, type QueryReply } from './sql'

const props = defineProps<{ databases: string[]; initialSql?: string; runOnOpen?: boolean }>()
const database = defineModel<string>('database', { required: true })
const emit = defineEmits<{ changed: [] }>()

const container = ref<HTMLDivElement>()
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor>()
const reply = ref<QueryReply | null>(null)
const running = ref(false)
const view = ref<'results' | 'messages'>('results')

const options = computed(() => ['master', ...props.databases].map((name) => ({ label: name, value: name })))
const messageLines = computed(() => (reply.value ? messages(reply.value) : []))

async function execute() {
  if (!editor.value || running.value) return
  const model = editor.value.getModel()!
  const selection = editor.value.getSelection()
  const sql = selection && !selection.isEmpty() ? model.getValueInRange(selection) : model.getValue()
  if (!sql.trim()) return
  running.value = true
  try {
    reply.value = await runQuery(database.value, sql)
    if (reply.value.type === 'result') {
      database.value = reply.value.database
      view.value = reply.value.results.length > 0 ? 'results' : 'messages'
      // 可能建了库、建了表：让对象资源管理器刷新
      if (/\b(create|drop|alter)\b/i.test(sql)) emit('changed')
    } else {
      view.value = 'messages'
    }
  } catch (error) {
    reply.value = { type: 'error', number: 0, message: (error as Error).message, line: 1 }
    view.value = 'messages'
  } finally {
    running.value = false
  }
}

/** 这个查询窗口是当前标签页时，在页面任何地方按 F5 都执行（并阻止浏览器刷新），和 SSMS 一样 */
function f5(event: KeyboardEvent) {
  if (event.key !== 'F5' || event.defaultPrevented || !container.value?.offsetParent) return
  event.preventDefault()
  void execute()
}

onMounted(() => {
  window.addEventListener('keydown', f5)
  editor.value = monaco.editor.create(container.value!, {
    value: props.initialSql ?? '',
    language: 'sql',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    scrollBeyondLastLine: false,
    tabSize: 4,
  })
  editor.value.addCommand(monaco.KeyCode.F5, () => void execute())
  editor.value.focus()
  if (props.runOnOpen) void execute()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', f5)
  editor.value?.getModel()?.dispose()
  editor.value?.dispose()
})
</script>

<template>
  <div class="query">
    <div class="bar">
      <NSelect v-model:value="database" :options="options" size="small" style="width: 180px" />
      <NButton size="small" type="primary" :loading="running" title="F5（选中一部分时只执行选中的语句）" @click="execute">▶ 执行</NButton>
      <span v-if="reply?.type === 'result'" class="time">用时 {{ reply.ms }} ms</span>
    </div>
    <div ref="container" class="editor" />
    <div v-if="reply" class="output">
      <NTabs v-model:value="view" size="small" type="line">
        <NTab name="results" :disabled="reply.type !== 'result' || reply.results.length === 0">结果</NTab>
        <NTab name="messages">消息</NTab>
      </NTabs>
      <div v-if="view === 'results' && reply.type === 'result'" class="results">
        <ResultGrid v-for="(result, i) in reply.results" :key="i" :result="result" />
      </div>
      <div v-else class="messages">
        <pre v-for="(line, i) in messageLines" :key="i" :class="{ error: line.error }">{{ line.text }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.query {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #e5e7eb;
}

.time {
  color: #6b7280;
  font-size: 12px;
}

.editor {
  flex: 1 1 45%;
  min-height: 120px;
}

.output {
  flex: 1 1 55%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e5e7eb;
  padding: 0 8px 8px;
}

.results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.messages {
  flex: 1;
  overflow: auto;
}

.messages pre {
  margin: 4px 0;
  font-size: 13px;
  white-space: pre-wrap;
}

.messages pre.error {
  color: #b91c1c;
}
</style>

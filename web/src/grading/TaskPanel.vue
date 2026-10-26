<script setup lang="ts">
// 任务面板：上面是任务说明（task.md，作业则是布置时的说明），下面是评价项——这个实验（或作业）自动检查的功能项；
// "自己检查"在服务器上运行学生现在的程序逐项检查，告诉他哪几项不通过、为什么。不计分、不留记录，提交作业另算。
// 面板不遮挡页面，打开着也能接着搭界面、写代码。
import { NButton, NDrawer, NDrawerContent, NSpin } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { SelfCheck, SourceFile } from '@iot/shared'
import { api } from '../api'
import { renderMarkdown } from './markdown'

const props = defineProps<{
  show: boolean
  /** 任务说明（Markdown），没有时为 null */
  task: string | null
  /** 检查项名称（没有评分规则时为空） */
  titles: string[]
  /** sample:实验编号 或 assignment:作业编号，和服务器返回的 target 对应 */
  target: string
  /** 开始检查的接口（/api/samples/:id/selfcheck 或 /api/assignments/:id/selfcheck） */
  url: string
  /** 学生现在的代码 */
  files: SourceFile[]
  /** 开始检查前调用（先把没保存的改动存好） */
  beforeStart?: () => Promise<void>
  /** 作业的各项分值（自由练习没有） */
  points?: number[]
}>()
const emit = defineEmits<{ 'update:show': [show: boolean] }>()

const state = ref<SelfCheck | null>(null)
const error = ref('')
/** 开始检查时的代码；之后改过代码就提示结果可能过时（刷新页面后不知道，不提示） */
const checkedFiles = ref<string>()
const current = computed(() => (state.value?.target === props.target ? state.value : null))
const running = computed(() => current.value?.status === 'running')
const outdated = computed(() => checkedFiles.value !== undefined && current.value?.status === 'done' && checkedFiles.value !== JSON.stringify(props.files))
const passed = computed(() => current.value?.result?.results.filter((r) => r.passed).length ?? 0)
const taskHtml = computed(() => (props.task ? renderMarkdown(props.task) : ''))

let timer: ReturnType<typeof setTimeout> | undefined
async function refresh() {
  clearTimeout(timer)
  state.value = await api<SelfCheck | null>('GET', '/api/selfcheck').catch(() => state.value)
  if (state.value?.status === 'running') timer = setTimeout(refresh, 2000)
}
onBeforeUnmount(() => clearTimeout(timer))

watch(
  () => props.show,
  (show) => {
    if (show && props.titles.length) void refresh()
  },
  { immediate: true },
)

async function start() {
  error.value = ''
  try {
    await props.beforeStart?.()
    checkedFiles.value = JSON.stringify(props.files)
    state.value = await api<SelfCheck>('POST', props.url, { files: props.files })
    timer = setTimeout(refresh, 2000)
  } catch (e) {
    error.value = (e as Error).message
  }
}

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <NDrawer
    :show="show"
    :default-width="460"
    resizable
    placement="right"
    :show-mask="false"
    :trap-focus="false"
    :block-scroll="false"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent title="任务" closable>
      <!-- renderMarkdown 先转义全部 HTML，只输出它自己生成的标签 -->
      <div v-if="taskHtml" class="task" v-html="taskHtml" />
      <template v-if="titles.length">
        <h4 class="section">评价项</h4>
        <p class="note">
          下面这些功能项由平台自动检查。点"自己检查"，平台会运行你现在的程序，逐项操作、核对结果， 告诉你哪几项还没做好。<b>不计分、不留记录</b>，可以随时检查。
        </p>
        <div class="actions">
          <NButton type="primary" :loading="running" :disabled="running || titles.length === 0" @click="start">自己检查</NButton>
          <span v-if="running" class="status"><NSpin size="small" /> 正在检查，每项都要启动一次程序，请稍等…</span>
          <span v-else-if="current?.status === 'done' && current.result" class="status">
            {{ formatTime(current.startedAt) }} 检查：通过 <b>{{ passed }}</b> / {{ current.result.results.length }} 项
          </span>
          <span v-else-if="current?.status === 'error'" class="status error">检查时服务器出错了，请再试一次</span>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="outdated" class="outdated">检查之后代码改过了，结果可能已经过时</div>
        <div v-if="current?.result && !current.result.compiled" class="error">编译没有通过，先改正编译错误</div>

        <ul class="items">
          <li v-for="(title, i) in titles" :key="i" :class="current?.result && !running ? (current.result.results[i]?.passed ? 'passed' : 'failed') : ''">
            <span class="mark">{{ current?.result && !running ? (current.result.results[i]?.passed ? '✓' : '✗') : '·' }}</span>
            <div>
              <div class="title">
                {{ title }}<span v-if="points" class="points">{{ points[i] }} 分</span>
              </div>
              <div v-if="current?.result && !running && current.result.results[i]?.message" class="message">
                {{ current.result.results[i].message }}
              </div>
            </div>
          </li>
        </ul>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.task {
  font-size: 14px;
  line-height: 1.7;
  color: #1f2937;
}

.task :deep(h4),
.section {
  margin: 16px 0 6px;
  font-size: 15px;
}

.task :deep(h4:first-child) {
  margin-top: 0;
}

.task :deep(h5) {
  margin: 12px 0 4px;
  font-size: 14px;
}

.task :deep(p),
.task :deep(ul),
.task :deep(ol) {
  margin: 4px 0;
}

.task :deep(ul),
.task :deep(ol) {
  padding-left: 20px;
}

.task :deep(code) {
  padding: 0 3px;
  border-radius: 3px;
  background: #f3f4f6;
  font-size: 13px;
}

.task :deep(table) {
  width: 100%;
  margin: 6px 0;
  border-collapse: collapse;
  font-size: 13px;
}

.task :deep(th),
.task :deep(td) {
  padding: 3px 6px;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.task :deep(th) {
  background: #f9fafb;
}

/* 控件类型和控件名不折行，说明列让出宽度 */
.task :deep(th),
.task :deep(td:first-child),
.task :deep(td code) {
  white-space: nowrap;
}

.task :deep(blockquote) {
  margin: 8px 0;
  padding: 6px 10px;
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
  font-size: 13px;
}

.section {
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.task + .section {
  margin-top: 20px;
}

.note {
  margin: 0 0 12px;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
}

.error {
  color: #b91c1c;
  font-size: 13px;
}

.outdated {
  margin: 4px 0;
  color: #a16207;
  font-size: 13px;
}

.items {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.items li {
  display: flex;
  gap: 8px;
}

.mark {
  width: 1em;
  flex: none;
  font-weight: bold;
  color: #9ca3af;
}

.passed .mark {
  color: #16a34a;
}

.failed .mark {
  color: #dc2626;
}

.points {
  margin-left: 8px;
  color: #6b7280;
}

.message {
  margin-top: 2px;
  color: #b91c1c;
}
</style>

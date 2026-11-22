<script setup lang="ts">
// 过程回放（评阅页的"过程回放"标签页）：一步步看学生做这个作业时代码是怎么改的。
// 第 0 步是布置的起点工程，之后每一步是学生运行时存的代码快照（同一份作品至少隔一分钟存一份），最后是提交的代码。
// 右边是和上一步比改了什么（Monaco 的对比编辑器），左边是这一步运行之后发生了什么：编译出错、运行出错、自己检查、提交。
// 点报错跳到那一行。快照 2026-11-22 才开始存。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { NButton, NEmpty, NSlider, NSpin, NSwitch, NTag } from 'naive-ui'
import type { LearningEvent, SourceFile, WorkHistory } from '@iot/shared'
import { api } from '../api'
import { RESOURCES_FILE } from '../designer/resources'
import { monaco } from '../editor/monaco'

const props = defineProps<{
  assignmentId: string
  userId: number
  /** 最近一次提交的代码和时间，作为最后一步 */
  submitted: { at: number; files: SourceFile[] } | null
}>()

interface Step {
  /** 起点没有时间 */
  at: number | null
  label: string
  files: Map<string, string>
  /** 这一步之后（到下一步之前）发生的事 */
  happened: Happening[]
}

type Happening = { at: number } & (LearningEvent | { type: 'submit'; status: string; autoScore: number | null })

const loading = ref(true)
const error = ref('')
const steps = ref<Step[]>([])
const index = ref(0)
const activePath = ref<string>()
const sideBySide = ref(false)

onMounted(async () => {
  try {
    build(await api<WorkHistory>('GET', `/api/teacher/assignments/${props.assignmentId}/students/${props.userId}/history`))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

/** 起点 + 按顺序还原的快照 + 最后一次提交，再把事件分到各步 */
function build(history: WorkHistory) {
  const visible = (path: string) => path.endsWith('.cs') && path !== RESOURCES_FILE
  const list: Step[] = [{ at: null, label: '布置的起点', files: new Map(history.template.map((f) => [f.path, f.content])), happened: [] }]
  let files = new Map<string, string>()
  for (const s of history.snapshots) {
    files = s.full ? new Map() : new Map(files)
    for (const path of s.deleted) files.delete(path)
    for (const [path, content] of Object.entries(s.files)) files.set(path, content)
    list.push({ at: s.at, label: '运行', files, happened: [] })
  }
  if (props.submitted) {
    // 提交的代码和最后一份快照一样时不重复
    const same = sameFiles(new Map(props.submitted.files.map((f) => [f.path, f.content])), list.at(-1)!.files)
    if (!same) list.push({ at: props.submitted.at, label: '最后一次提交', files: new Map(props.submitted.files.map((f) => [f.path, f.content])), happened: [] })
  }
  list.sort((a, b) => (a.at ?? -Infinity) - (b.at ?? -Infinity))
  for (const step of list) for (const path of [...step.files.keys()]) if (!visible(path)) step.files.delete(path)

  const happenings: Happening[] = [
    ...history.events.map((e) => ({ at: e.at, ...e.event })),
    ...history.submissions.map((s) => ({ at: s.at, type: 'submit' as const, status: s.status, autoScore: s.autoScore })),
  ].sort((a, b) => a.at - b.at)
  for (const h of happenings) {
    // 归到时间不晚于它的最后一步（快照在运行前存，编译结果紧跟在后面）
    let i = 0
    list.forEach((s, k) => {
      if (s.at === null || s.at <= h.at) i = k
    })
    list[i].happened.push(h)
  }
  steps.value = list
  index.value = list.length - 1
}

function sameFiles(a: Map<string, string>, b: Map<string, string>) {
  return a.size === b.size && [...a].every(([path, content]) => b.get(path) === content)
}

const step = computed(() => steps.value[index.value] as Step | undefined)
const previous = computed(() => (index.value > 0 ? steps.value[index.value - 1] : undefined))
const startAt = computed(() => steps.value.find((s) => s.at !== null)?.at ?? null)

/** 这一步的文件，改过的标出来 */
const fileTabs = computed(() => {
  const s = step.value
  if (!s) return []
  const before = previous.value?.files
  const paths = [...new Set([...s.files.keys(), ...(before?.keys() ?? [])])].sort((a, b) => a.localeCompare(b))
  return paths.map((path) => ({
    path,
    changed: !!before && before.get(path) !== s.files.get(path),
    deleted: !s.files.has(path),
  }))
})

// 换了一步：留在原来的文件上（它还在的话），否则看第一个改过的文件
watch(fileTabs, (tabs) => {
  if (activePath.value && tabs.some((t) => t.path === activePath.value && t.changed)) return
  activePath.value = (
    tabs.find((t) => t.changed) ??
    tabs.find((t) => t.path === activePath.value) ??
    tabs.find((t) => !t.path.endsWith('.Designer.cs')) ??
    tabs[0]
  )?.path
})

const formatClock = (ms: number) => new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
function stepTime(s: Step) {
  if (s.at === null) return ''
  const minutes = startAt.value === null ? 0 : Math.round((s.at - startAt.value) / 60_000)
  return `${formatClock(s.at)}（第 ${minutes} 分钟）`
}

// ---------- 播放 ----------
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function togglePlay() {
  playing.value = !playing.value
  clearInterval(timer)
  if (!playing.value) return
  if (index.value >= steps.value.length - 1) index.value = 0
  timer = setInterval(() => {
    if (index.value >= steps.value.length - 1) {
      playing.value = false
      clearInterval(timer)
      return
    }
    index.value++
  }, 1500)
}
onBeforeUnmount(() => clearInterval(timer))

function go(delta: number) {
  index.value = Math.min(Math.max(index.value + delta, 0), steps.value.length - 1)
}

// ---------- 对比编辑器 ----------
const container = ref<HTMLElement>()
const diff = shallowRef<monaco.editor.IStandaloneDiffEditor>()
let models: monaco.editor.ITextModel[] = []

function showDiff() {
  const editor = diff.value
  const s = step.value
  const path = activePath.value
  if (!editor || !s || !path) return
  // 不带文件地址的模型：不和评阅页代码区的模型冲突，也不触发语言服务
  // 起点没有上一步，两边一样；这一步新加的文件，左边是空的
  const before = previous.value ? (previous.value.files.get(path) ?? '') : (s.files.get(path) ?? '')
  const original = monaco.editor.createModel(before, 'csharp')
  const modified = monaco.editor.createModel(s.files.get(path) ?? '', 'csharp')
  editor.setModel({ original, modified })
  for (const m of models) m.dispose()
  models = [original, modified]
}

onMounted(() => {
  watch(
    container,
    (el) => {
      if (!el || diff.value) return
      diff.value = monaco.editor.createDiffEditor(el, {
        readOnly: true,
        originalEditable: false,
        renderSideBySide: sideBySide.value,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        renderOverviewRuler: false,
        // 没改的部分折叠起来，只露出改动附近几行（点折叠条可以展开）
        hideUnchangedRegions: { enabled: true, contextLineCount: 3, minimumLineCount: 5, revealLineCount: 20 },
      })
      showDiff()
    },
    { flush: 'post' },
  )
})
watch([index, activePath], showDiff, { flush: 'post' })
watch(sideBySide, (value) => diff.value?.updateOptions({ renderSideBySide: value }))
onBeforeUnmount(() => {
  diff.value?.dispose()
  for (const m of models) m.dispose()
})

/** 点报错：切到那个文件，跳到那一行 */
function reveal(file: string | undefined, line: number | undefined) {
  if (!file || !line) return
  if (fileTabs.value.some((t) => t.path === file)) activePath.value = file
  setTimeout(() => {
    const editor = diff.value?.getModifiedEditor()
    editor?.revealLineInCenter(line)
    editor?.setPosition({ lineNumber: line, column: 1 })
  })
}

function describe(h: Happening): { text: string; type: 'default' | 'success' | 'error' | 'warning' | 'info' } {
  switch (h.type) {
    case 'open':
      return { text: '打开作业', type: 'default' }
    case 'reset':
      return { text: '恢复了原始代码', type: 'warning' }
    case 'compile':
      return h.ok ? { text: '运行，编译通过', type: 'success' } : { text: `运行，编译没通过（${h.errorCount} 个错误）`, type: 'error' }
    case 'exception':
      return { text: '运行出错', type: 'error' }
    case 'selfcheck': {
      const passed = h.results.filter((r) => r.passed).length
      return { text: `自己检查：通过 ${passed} / ${h.results.length} 项`, type: passed === h.results.length ? 'success' : 'warning' }
    }
    case 'submit':
      return { text: h.status === 'done' ? `提交，自动评分 ${h.autoScore} 分` : '提交', type: 'info' }
  }
}

const formatSeconds = (ms: number) => new Date(ms).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
</script>

<template>
  <div class="replay">
    <NSpin v-if="loading" class="loading" />
    <div v-else-if="error" class="muted center">{{ error }}</div>
    <template v-else-if="step">
      <div class="bar">
        <NButton size="small" :disabled="index === 0" @click="go(-1)">上一步</NButton>
        <NButton size="small" :type="playing ? 'warning' : 'primary'" :disabled="steps.length < 2" @click="togglePlay">{{
          playing ? '暂停' : '▶ 播放'
        }}</NButton>
        <NButton size="small" :disabled="index === steps.length - 1" @click="go(1)">下一步</NButton>
        <NSlider v-model:value="index" class="slider" :min="0" :max="steps.length - 1" :step="1" :tooltip="false" :disabled="steps.length < 2" />
        <span class="where">
          第 {{ index }} / {{ steps.length - 1 }} 步 · <b>{{ step.label }}</b> {{ stepTime(step) }}
        </span>
        <span class="toggle">并排对比 <NSwitch v-model:value="sideBySide" size="small" /></span>
      </div>
      <div v-if="steps.length === 1" class="note">
        这个学生做这个作业时还没有代码快照（快照在每次运行时存，2026 年 11 月 22 日开始记录），只能看到起点<template v-if="submitted">和提交的代码</template>。
      </div>

      <div class="body">
        <aside class="happened">
          <h4>{{ index === 0 ? '开始之前' : '这一步运行之后' }}</h4>
          <NEmpty v-if="!step.happened.length" size="small" description="没有记录" />
          <ul v-else>
            <li v-for="(h, i) in step.happened" :key="i">
              <div class="what">
                <NTag size="tiny" :type="describe(h).type">{{ describe(h).text }}</NTag>
                <span class="muted">{{ formatSeconds(h.at) }}</span>
              </div>
              <template v-if="h.type === 'compile'">
                <button v-for="(e, k) in h.errors" :key="k" class="error" @click="reveal(e.file, e.line)">
                  {{ e.file }} 第 {{ e.line }} 行 <code>{{ e.code }}</code> {{ e.message }}
                </button>
              </template>
              <button v-else-if="h.type === 'exception'" class="error" @click="reveal(h.file, h.line)">
                {{ h.message }}<template v-if="h.file">（{{ h.file }} 第 {{ h.line }} 行）</template>
              </button>
              <template v-else-if="h.type === 'selfcheck'">
                <div v-for="r in h.results.filter((x) => !x.passed)" :key="r.title" class="failed">✗ {{ r.title }}</div>
              </template>
            </li>
          </ul>
        </aside>

        <section class="code">
          <div class="tabs">
            <button
              v-for="t in fileTabs"
              :key="t.path"
              class="tab"
              :class="{ active: t.path === activePath, changed: t.changed, deleted: t.deleted }"
              :title="t.deleted ? '这一步删掉了' : t.changed ? '这一步改过' : ''"
              @click="activePath = t.path"
            >
              {{ t.path }}<span v-if="t.changed" class="dot">●</span>
            </button>
          </div>
          <div ref="container" class="diff" />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.replay {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.loading,
.center {
  margin: 40px auto;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #e5e7eb;
}

.slider {
  flex: 1;
  min-width: 120px;
  margin: 0 8px;
}

.where {
  font-size: 13px;
  white-space: nowrap;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

.note {
  padding: 6px 10px;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  font-size: 13px;
}

.body {
  flex: 1;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 0;
}

.happened {
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  overflow: auto;
  font-size: 12px;
}

.happened h4 {
  margin: 0 0 6px;
  font-size: 13px;
}

.happened ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.happened li {
  margin-bottom: 8px;
}

.what {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
}

.error {
  display: block;
  width: 100%;
  margin-top: 2px;
  padding: 2px 4px;
  background: none;
  border: none;
  border-radius: 3px;
  color: #b91c1c;
  font: inherit;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.error:hover {
  background: #fef2f2;
}

.failed {
  margin-top: 2px;
  color: #b45309;
}

.code {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px 6px 0;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  padding: 3px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.tab.active {
  background: #fff;
  font-weight: 600;
}

.tab.deleted {
  color: #9ca3af;
  text-decoration: line-through;
}

.dot {
  margin-left: 4px;
  color: #f59e0b;
  font-size: 10px;
}

.diff {
  flex: 1;
  min-height: 0;
}

.muted {
  color: #6b7280;
}
</style>

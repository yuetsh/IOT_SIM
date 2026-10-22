<script setup lang="ts">
// 评阅一个作业：左边是全班学生（提交状态、自动评分、老师评分），右边是选中学生的界面截图、运行区、代码，
// 以及自动评分结果、规范提示、AI 建议和老师评分。"运行"标签页里直接运行学生的程序（换学生时自动停止）；
// "在新标签页运行"打开完整的实验页，地方更大。
// AI 建议只是参考：老师采纳（或修改后保存）才成为老师评分，学生才能看到。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NEmpty, NInput, NInputNumber, NSpin, NTab, NTabs, NTag, useDialog, useMessage } from 'naive-ui'
import type { AiReview, Assignment, Review, Screenshot, SourceFile, Submission } from '@iot/shared'
import { api } from '../api'
import { currentUser, logout } from '../auth'
import CodeEditor from '../editor/CodeEditor.vue'
import RunArea from '../run/RunArea.vue'
import { createRunSession } from '../run/session'
import GradeResultView from '../grading/GradeResultView.vue'
import { conventionHints } from '@iot/shared'
import { downloadCsv } from '../teacher/csv'

interface Row {
  userId: number
  username: string
  name: string
  status: Submission['status'] | null
  autoScore: number | null
  manualScore: number | null
  review: Review | null
  submissionId: number | null
  aiStatus: AiReview['status'] | null
  aiManual: number | null
  submittedAt: number | null
  count: number
}

interface Detail {
  assignment: Assignment
  student: { id: number; username: string; name: string }
  submission: Submission | null
  files: SourceFile[] | null
  screenshots: Screenshot[]
  aiReview: AiReview | null
  review: Review | null
  submissionCount: number
}

/** 代码区"界面截图""运行"标签页的名字（不会和 .cs 文件名冲突） */
const SCREENS = '界面截图'
const RUN = '运行'

const props = defineProps<{ assignmentId: string }>()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

// ---------- 运行学生的程序 ----------
const session = createRunSession()
const editorRef = ref<InstanceType<typeof CodeEditor>>()
const runState = session.state
const running = computed(() => runState.status === 'compiling' || runState.status === 'running')
const STATUS_TEXT = { idle: '未运行', compiling: '编译中…', running: '运行中', stopped: '已停止' } as const

function runProgram() {
  if (!detail.value?.files || running.value) return
  void session.run(detail.value.files.map((f) => ({ ...f })))
}

/** 点编译错误：切到对应文件并跳到出错的行 */
async function showDiagnostic(file: string, line: number, column: number) {
  activeFile.value = file
  await nextTick()
  editorRef.value?.reveal(file, line, column)
}

onBeforeUnmount(() => session.close())

const assignment = ref<Assignment | null>(null)
const rows = ref<Row[]>([])
const selectedId = ref<number>()
const detail = ref<Detail | null>(null)
const activeFile = ref<string>()
const scores = ref<(number | null)[]>([])
const comment = ref('')
const saving = ref(false)

const autoTotal = computed(() => assignment.value?.scoring.auto.reduce((a, b) => a + b, 0) ?? 0)
const manualTotal = computed(() => assignment.value?.scoring.manual.reduce((a, m) => a + m.points, 0) ?? 0)
const codeFiles = computed(() => detail.value?.files?.filter((f) => f.path.endsWith('.cs')) ?? [])
const hints = computed(() => (detail.value?.files ? conventionHints(detail.value.files) : []))
/** 正在打的老师评分之和（未保存） */
const draftManual = computed(() => scores.value.reduce<number>((a, s) => a + (s ?? 0), 0))
const index = computed(() => rows.value.findIndex((r) => r.userId === selectedId.value))
const dirty = computed(() => {
  const saved = detail.value?.review
  return JSON.stringify(scores.value) !== JSON.stringify(saved?.scores ?? scores.value.map(() => null)) || comment.value !== (saved?.comment ?? '')
})

async function loadRows() {
  rows.value = await api<Row[]>('GET', `/api/teacher/assignments/${props.assignmentId}/submissions`)
}

onMounted(async () => {
  try {
    assignment.value = (await api<{ assignment: Assignment }>('GET', `/api/assignments/${props.assignmentId}`)).assignment
    await loadRows()
  } catch (e) {
    message.error((e as Error).message)
    return
  }
  const wanted = Number(route.query.student)
  // 默认先看第一个已提交的学生
  await select(rows.value.find((r) => r.userId === wanted)?.userId ?? rows.value.find((r) => r.status)?.userId ?? rows.value[0]?.userId)
})

async function select(userId: number | undefined) {
  if (userId === undefined) return
  // 换学生：停掉上一个学生的程序，清空运行区
  if (running.value) await session.stop()
  runState.forms = []
  runState.messageBoxes = []
  runState.diagnostics = []
  runState.errors = []
  runState.console = ''
  const wasRunTab = activeFile.value === RUN
  selectedId.value = userId
  void router.replace({ query: { student: userId } })
  detail.value = await api<Detail>('GET', `/api/teacher/assignments/${props.assignmentId}/students/${userId}`).catch((e: Error) => {
    message.error(e.message)
    return null
  })
  const manual = assignment.value?.scoring.manual ?? []
  scores.value = manual.map((_, i) => detail.value?.review?.scores[i] ?? null)
  comment.value = detail.value?.review?.comment ?? ''
  // 正在看"运行"时换学生，留在"运行"；否则默认先看界面截图，没有截图时看第一个窗体的代码
  activeFile.value = wasRunTab
    ? RUN
    : detail.value?.screenshots.length
      ? SCREENS
      : (codeFiles.value.find((f) => !f.path.endsWith('.Designer.cs') && f.path !== 'Program.cs')?.path ?? codeFiles.value[0]?.path)
  pollAi()
}

// ---------- AI 建议 ----------
let aiTimer: ReturnType<typeof setTimeout> | undefined

/** AI 评阅还在排队或进行中时，每 3 秒刷新一次这个学生 */
function pollAi() {
  clearTimeout(aiTimer)
  if (detail.value?.aiReview?.status !== 'pending') return
  const userId = detail.value.student.id
  aiTimer = setTimeout(async () => {
    const latest = await api<Detail>('GET', `/api/teacher/assignments/${props.assignmentId}/students/${userId}`).catch(() => null)
    if (latest && selectedId.value === userId && detail.value) {
      detail.value.aiReview = latest.aiReview
      if (latest.aiReview?.status !== 'pending') await loadRows()
    }
    pollAi()
  }, 3000)
}
onBeforeUnmount(() => clearTimeout(aiTimer))

/** 把 AI 的建议分和评语填进老师评分（还要点保存才生效） */
function adoptAi() {
  const ai = detail.value?.aiReview
  if (ai?.status !== 'done') return
  scores.value = ai.scores.map((s) => s.score)
  comment.value = ai.comment
}

async function rerunAi() {
  const id = detail.value?.submission?.id
  if (!id || !detail.value) return
  try {
    await api('POST', `/api/teacher/submissions/${id}/ai-review`)
    detail.value.aiReview = { status: 'pending', scores: [], comment: '' }
    pollAi()
  } catch (e) {
    message.error((e as Error).message)
  }
}

/** 全部采纳：老师还没评阅、已有 AI 建议的学生，一次采纳 */
function adoptAll() {
  const count = rows.value.filter((r) => !r.review && r.aiStatus === 'done').length
  if (count === 0) {
    message.info('没有待采纳的 AI 建议（已评阅的学生不会被覆盖）')
    return
  }
  dialog.info({
    title: '全部采纳 AI 建议',
    content: `将为 ${count} 个还没评阅的学生采纳 AI 的建议分和评语，学生随即能看到。已经评阅过的学生不受影响。确定吗？`,
    positiveText: '采纳',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { adopted } = await api<{ adopted: number }>('POST', `/api/teacher/assignments/${props.assignmentId}/adopt-ai`)
      message.success(`已采纳 ${adopted} 个学生的 AI 建议`)
      await loadRows()
      await select(selectedId.value)
    },
  })
}

async function save(next = false) {
  if (!detail.value || saving.value) return
  saving.value = true
  try {
    const review = await api<Review>('PUT', `/api/teacher/assignments/${props.assignmentId}/students/${detail.value.student.id}/review`, {
      scores: scores.value,
      comment: comment.value,
    })
    detail.value.review = review
    await loadRows()
    message.success('已保存')
    if (next) await go(1)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

/** 上一个 / 下一个已提交的学生 */
async function go(step: 1 | -1) {
  for (let i = index.value + step; i >= 0 && i < rows.value.length; i += step) {
    if (rows.value[i].status) return select(rows.value[i].userId)
  }
  message.info(step > 0 ? '后面没有已提交的学生了' : '前面没有已提交的学生了')
}

function openRunPage() {
  if (detail.value?.submission) window.open(router.resolve(`/teacher/submissions/${detail.value.submission.id}/run`).href, '_blank')
}

// 切换学生时，如果打了分还没保存，提醒一下
watch(selectedId, (_, old) => {
  if (old !== undefined && dirty.value) message.warning('上一个学生的评分还没保存')
})

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function statusTag(row: Row): { type: 'default' | 'warning' | 'error' | 'success' | 'info'; text: string } {
  if (!row.status) return { type: 'default', text: '未提交' }
  if (row.status === 'pending') return { type: 'warning', text: '评分中' }
  if (row.status === 'error') return { type: 'error', text: '评分出错' }
  // 老师评阅的是之前的版本，学生之后又交了新的
  if (row.review && row.submittedAt && row.submittedAt > row.review.updatedAt) return { type: 'warning', text: '评阅后又提交' }
  if (row.review) return { type: 'success', text: '已评阅' }
  if (row.aiStatus === 'done') return { type: 'info', text: 'AI 已评' }
  return { type: 'default', text: '待评阅' }
}

/** 列表里的分数：已评阅显示总分；只有 AI 建议时显示含 AI 建议的总分 */
function rowScore(row: Row) {
  if (row.status !== 'done') return null
  return (row.autoScore ?? 0) + (row.manualScore ?? row.aiManual ?? 0)
}

/** 导出这个作业的成绩：每个学生的自动评分、老师评分各项、总分和评语 */
function exportCsv() {
  const a = assignment.value
  if (!a) return
  downloadCsv(`${a.title}-成绩.csv`, [
    ['学号', '姓名', `自动评分（${autoTotal.value}）`, ...a.scoring.manual.map((m) => `${m.title}（${m.points}）`), `总分（${autoTotal.value + manualTotal.value}）`, '提交次数', '评语'],
    ...rows.value.map((r) => [
      `\t${r.username}`,
      r.name,
      r.status ? (r.autoScore ?? '') : '未提交',
      ...a.scoring.manual.map((_, i) => r.review?.scores[i] ?? ''),
      r.status ? (r.autoScore ?? 0) + (r.manualScore ?? 0) : '',
      r.count,
      r.review?.comment ?? '',
    ]),
  ])
}

async function signOut() {
  await logout()
  await router.push('/login')
}
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <RouterLink to="/teacher" class="nav-link">← 班级管理</RouterLink>
      <strong>{{ assignment?.title }}</strong>
      <span class="muted">{{ assignment?.className }}</span>
      <span class="muted">已提交 {{ rows.filter((r) => r.status).length }} / {{ rows.length }} 人</span>
      <NButton size="small" @click="adoptAll">全部采纳 AI 建议</NButton>
      <NButton size="small" @click="exportCsv">导出成绩</NButton>
      <span class="spacer" />
      <span class="user">{{ currentUser?.name }}</span>
      <NButton quaternary size="small" @click="signOut">退出</NButton>
    </header>

    <main class="content">
      <aside class="students">
        <button v-for="r in rows" :key="r.userId" class="student" :class="{ active: r.userId === selectedId }" @click="select(r.userId)">
          <span class="who">
            <span>{{ r.name }}</span>
            <span class="username">{{ r.username }}</span>
          </span>
          <span class="right">
            <span v-if="rowScore(r) !== null" class="score" :class="{ suggested: !r.review }">{{ rowScore(r) }}</span>
            <NTag size="tiny" :type="statusTag(r).type">{{ statusTag(r).text }}</NTag>
          </span>
        </button>
      </aside>

      <section v-if="detail && assignment" class="review">
        <div class="review-head">
          <h2>{{ detail.student.name }}</h2>
          <span class="muted">{{ detail.student.username }}</span>
          <span v-if="detail.submission" class="muted">提交 {{ detail.submissionCount }} 次 · 最后提交 {{ formatTime(detail.submission.createdAt) }}</span>
          <span class="spacer" />
          <NButton size="small" @click="go(-1)">上一个</NButton>
          <NButton size="small" @click="go(1)">下一个</NButton>
          <NButton size="small" :disabled="!detail.submission" title="在新标签页里打开完整的实验页，地方更大" @click="openRunPage">在新标签页运行</NButton>
        </div>

        <NEmpty v-if="!detail.submission" description="还没有提交" class="empty" />
        <div v-else class="review-body">
          <div class="code">
            <NTabs :value="activeFile" type="card" size="small" @update:value="(v: string) => (activeFile = v)">
              <NTab v-if="detail.screenshots.length" :name="SCREENS">{{ SCREENS }}</NTab>
              <NTab :name="RUN">▶ {{ RUN }}</NTab>
              <NTab v-for="f in codeFiles" :key="f.path" :name="f.path">{{ f.path }}</NTab>
            </NTabs>
            <div v-if="activeFile === SCREENS" class="screens">
              <figure v-for="s in detail.screenshots" :key="s.form">
                <img :src="`data:image/png;base64,${s.png}`" :alt="s.form" />
                <figcaption>{{ s.form }}</figcaption>
              </figure>
            </div>
            <div v-show="activeFile === RUN" class="run-pane">
              <div class="run-bar">
                <NButton size="small" type="primary" :disabled="running" @click="runProgram">▶ 运行</NButton>
                <NButton size="small" :disabled="!running" @click="session.stop">■ 停止</NButton>
                <NTag size="small" :type="runState.status === 'running' ? 'success' : runState.status === 'compiling' ? 'warning' : 'default'">
                  {{ STATUS_TEXT[runState.status] }}
                </NTag>
                <span class="muted">运行的是学生提交的代码，可以操作窗体和实训台</span>
              </div>
              <RunArea class="run-area-host" :session="session" @diagnostic="showDiagnostic" />
            </div>
            <CodeEditor
              v-show="activeFile !== SCREENS && activeFile !== RUN"
              ref="editorRef"
              class="editor"
              :files="codeFiles"
              :active-file="activeFile"
              :diagnostics="runState.diagnostics"
              read-only
            />
          </div>

          <div class="side">
            <section class="card">
              <h3>自动评分</h3>
              <GradeResultView :assignment="assignment" :submission="detail.submission" :show-manual="false" />
            </section>

            <section v-if="hints.length" class="card">
              <h3>规范提示</h3>
              <ul class="hints">
                <li v-for="(h, i) in hints" :key="i" :class="h.level">{{ h.text }}</li>
              </ul>
            </section>

            <section v-if="detail.aiReview && assignment.scoring.manual.length" class="card ai">
              <h3>AI 建议</h3>
              <div v-if="detail.aiReview.status === 'pending'" class="ai-pending"><NSpin size="small" /> AI 评阅中…</div>
              <template v-else-if="detail.aiReview.status === 'done'">
                <div v-for="(m, i) in assignment.scoring.manual" :key="i" class="ai-item">
                  <span class="score-title">{{ m.title }}</span>
                  <b>{{ detail.aiReview.scores[i]?.score }}</b><span class="muted"> / {{ m.points }}</span>
                  <div class="ai-reason">{{ detail.aiReview.scores[i]?.reason }}</div>
                </div>
                <div v-if="detail.aiReview.comment" class="ai-comment">评语：{{ detail.aiReview.comment }}</div>
              </template>
              <div v-else-if="detail.aiReview.status === 'error'" class="ai-error">AI 评阅出错：{{ detail.aiReview.error }}</div>
              <div v-else class="muted">学生又提交了新的版本，这一份没有 AI 评阅。</div>
              <div class="save-row">
                <span class="spacer" />
                <NButton size="small" quaternary :disabled="detail.aiReview.status === 'pending'" @click="rerunAi">重新评阅</NButton>
                <NButton size="small" type="primary" secondary :disabled="detail.aiReview.status !== 'done'" @click="adoptAi">采纳 AI 建议</NButton>
              </div>
            </section>

            <section class="card">
              <h3>老师评分</h3>
              <div v-if="detail.review && detail.submission.createdAt > detail.review.updatedAt" class="stale">
                学生在你评阅之后又提交了新版本，下面是之前的评分，请看过新版本后重新保存。
              </div>
              <div v-for="(m, i) in assignment.scoring.manual" :key="i" class="score-row">
                <span class="score-title">{{ m.title }}</span>
                <NInputNumber v-model:value="scores[i]" :min="0" :max="m.points" size="small" placeholder="未打分" class="score-input" />
                <span class="muted">/ {{ m.points }}</span>
              </div>
              <NInput v-model:value="comment" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" placeholder="评语（学生能看到）" />
              <div class="save-row">
                <span class="muted">
                  总分 {{ (detail.submission.autoScore ?? 0) + draftManual }} / {{ autoTotal + manualTotal }}
                </span>
                <span class="spacer" />
                <NButton size="small" :loading="saving" @click="save()">保存</NButton>
                <NButton size="small" type="primary" :loading="saving" @click="save(true)">保存并看下一个</NButton>
              </div>
            </section>
          </div>
        </div>
      </section>
      <section v-else class="review">
        <NEmpty description="班里还没有学生" class="empty" />
      </section>
    </main>
  </div>
</template>

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

.nav-link {
  color: #2563eb;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.muted {
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.spacer {
  flex: 1;
}

.user {
  font-size: 13px;
}

.content {
  flex: 1;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 0;
}

.students {
  display: flex;
  flex-direction: column;
  padding: 6px;
  border-right: 1px solid #e5e7eb;
  overflow: auto;
}

.student {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: none;
  border: none;
  border-radius: 4px;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.student:hover {
  background: #f3f4f6;
}

.student.active {
  background: #e0ecff;
}

.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.username {
  color: #9ca3af;
  font-size: 12px;
}

.right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.score {
  font-weight: 600;
}

/* 还没评阅、只是含 AI 建议的分数 */
.score.suggested {
  color: #6b7280;
  font-weight: normal;
}

.run-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #e5e7eb;
  border-top: none;
}

.run-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
}

.run-area-host {
  flex: 1;
  min-height: 0;
}

.screens {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 16px;
  padding: 12px;
  overflow: auto;
  background: #2d6aa3;
}

.screens figure {
  margin: 0;
  color: #fff;
  font-size: 12px;
}

.screens img {
  display: block;
  max-width: 100%;
}

.ai {
  border-color: #c7d2fe;
  background: #f8faff;
}

.ai-pending {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.ai-item {
  font-size: 13px;
}

.ai-item .score-title {
  margin-right: 8px;
}

.ai-reason {
  color: #4b5563;
}

.ai-comment {
  padding: 6px 8px;
  background: #fff;
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
}

.stale {
  padding: 6px 8px;
  background: #fffbeb;
  color: #b45309;
  border-radius: 4px;
  font-size: 13px;
}

.ai-error {
  color: #dc2626;
  font-size: 13px;
}

.review {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 10px 16px;
}

.review-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.review-head h2 {
  margin: 0;
  font-size: 18px;
}

.review-body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 12px;
  min-height: 0;
}

.code {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor {
  flex: 1;
  min-height: 0;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.card h3 {
  margin: 0;
  font-size: 14px;
}

.hints {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}

.hints .warn {
  color: #b45309;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-title {
  flex: 1;
  font-size: 13px;
}

.score-input {
  width: 110px;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty {
  margin-top: 80px;
}
</style>

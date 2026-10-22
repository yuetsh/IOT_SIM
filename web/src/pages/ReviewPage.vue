<script setup lang="ts">
// 评阅一个作业：左边是全班学生（提交状态、自动评分、老师评分），右边是选中学生的代码、自动评分结果、
// 规范提示和老师评分。"运行他的程序"在新标签页的实验页里打开学生的代码。
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NEmpty, NInput, NInputNumber, NTab, NTabs, NTag, useMessage } from 'naive-ui'
import type { Assignment, Review, SourceFile, Submission } from '@iot/shared'
import { api } from '../api'
import { currentUser, logout } from '../auth'
import CodeEditor from '../editor/CodeEditor.vue'
import GradeResultView from '../grading/GradeResultView.vue'
import { conventionHints } from '../teacher/conventions'
import { downloadCsv } from '../teacher/csv'

interface Row {
  userId: number
  username: string
  name: string
  status: Submission['status'] | null
  autoScore: number | null
  manualScore: number | null
  review: Review | null
  submittedAt: number | null
  count: number
}

interface Detail {
  assignment: Assignment
  student: { id: number; username: string; name: string }
  submission: Submission | null
  files: SourceFile[] | null
  review: Review | null
  submissionCount: number
}

const props = defineProps<{ assignmentId: string }>()
const route = useRoute()
const router = useRouter()
const message = useMessage()

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
  selectedId.value = userId
  void router.replace({ query: { student: userId } })
  detail.value = await api<Detail>('GET', `/api/teacher/assignments/${props.assignmentId}/students/${userId}`).catch((e: Error) => {
    message.error(e.message)
    return null
  })
  const manual = assignment.value?.scoring.manual ?? []
  scores.value = manual.map((_, i) => detail.value?.review?.scores[i] ?? null)
  comment.value = detail.value?.review?.comment ?? ''
  // 默认显示第一个窗体的代码
  activeFile.value = codeFiles.value.find((f) => !f.path.endsWith('.Designer.cs') && f.path !== 'Program.cs')?.path ?? codeFiles.value[0]?.path
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

function runProgram() {
  if (detail.value?.submission) window.open(router.resolve(`/teacher/submissions/${detail.value.submission.id}/run`).href, '_blank')
}

// 切换学生时，如果打了分还没保存，提醒一下
watch(selectedId, (_, old) => {
  if (old !== undefined && dirty.value) message.warning('上一个学生的评分还没保存')
})

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function statusTag(row: Row): { type: 'default' | 'warning' | 'error' | 'success'; text: string } {
  if (!row.status) return { type: 'default', text: '未提交' }
  if (row.status === 'pending') return { type: 'warning', text: '评分中' }
  if (row.status === 'error') return { type: 'error', text: '评分出错' }
  return { type: row.review ? 'success' : 'default', text: row.review ? '已评阅' : '待评阅' }
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
            <span v-if="r.status === 'done'" class="score">{{ (r.autoScore ?? 0) + (r.manualScore ?? 0) }}</span>
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
          <NButton size="small" type="primary" :disabled="!detail.submission" @click="runProgram">运行他的程序</NButton>
        </div>

        <NEmpty v-if="!detail.submission" description="还没有提交" class="empty" />
        <div v-else class="review-body">
          <div class="code">
            <NTabs :value="activeFile" type="card" size="small" @update:value="(v: string) => (activeFile = v)">
              <NTab v-for="f in codeFiles" :key="f.path" :name="f.path">{{ f.path }}</NTab>
            </NTabs>
            <CodeEditor class="editor" :files="codeFiles" :active-file="activeFile" :diagnostics="[]" read-only />
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

            <section class="card">
              <h3>老师评分</h3>
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

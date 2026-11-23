<script setup lang="ts">
// 学习情况：学生看自己的（/learning，"我的学习"），老师看任何一个学生的（/teacher/students/:id，学生档案），内容一样。
// 作业得分和用时、自由练习过的实验、每天做了多久、常犯的编译错误和运行出错（配上中文说明和改法）。
// 用时、运行、常犯的错误来自学习过程记录，2026-11-22 才开始记。
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js'
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { NDataTable, NEmpty, NSpin, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import type { StudentLearning } from '@iot/shared'
import { api } from '../api'
import TopNav from '../TopNav.vue'
import { exceptionFix, explainCompileError } from '../learning/explain'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

type AssignmentRow = StudentLearning['assignments'][number]
type PracticeRow = StudentLearning['practice'][number]

/** 老师看学生档案时是学生的 id；学生看自己的时没有 */
const props = defineProps<{ studentId?: string }>()
const message = useMessage()
const data = ref<StudentLearning | null>(null)
const loading = ref(true)
const teacherView = computed(() => props.studentId !== undefined)

onMounted(async () => {
  try {
    data.value = await api<StudentLearning>('GET', teacherView.value ? `/api/teacher/students/${props.studentId}/learning` : '/api/learning')
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
  await nextTick()
  drawChart()
})

const formatTime = (ms: number | null) =>
  ms === null ? '' : new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const duration = (minutes: number) => (minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`)

const submittedCount = computed(() => data.value?.assignments.filter((a) => a.status !== null).length ?? 0)
const compileRate = computed(() => {
  const s = data.value?.summary
  return s?.runs ? `${Math.round(((s.runs - s.failedCompiles) / s.runs) * 100)}%` : '—'
})

// ---------- 每天做了多久 ----------
/** 最多显示多少天、至少显示多少天 */
const MAX_DAYS = 120
const MIN_DAYS = 14
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 从第一次做到今天，每天一根柱子（没做的天是 0） */
const dailyMinutes = computed(() => {
  const days = data.value?.days ?? []
  const byDay = new Map(days.map((d) => [d.day, d.minutes]))
  const today = new Date()
  const first = days[0] ? new Date(`${days[0].day}T00:00:00`) : today
  const span = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round((today.getTime() - first.getTime()) / 86_400_000) + 1))
  return Array.from({ length: span }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (span - 1 - i))
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, minutes: byDay.get(dayKey(d)) ?? 0 }
  })
})

const canvas = ref<HTMLCanvasElement>()
let chart: Chart | undefined

function drawChart() {
  chart?.destroy()
  if (!canvas.value) return
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: dailyMinutes.value.map((d) => d.label),
      datasets: [{ data: dailyMinutes.value.map((d) => d.minutes), backgroundColor: '#60a5fa', borderRadius: 2 }],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} 分钟` } } },
      scales: { x: { ticks: { autoSkip: true, maxRotation: 0 } }, y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: '分钟' } } },
    },
  })
}
onBeforeUnmount(() => chart?.destroy())

// ---------- 作业、自由练习 ----------
function scoreCell(a: AssignmentRow) {
  if (a.status === null) {
    const late = a.deadline !== null && Date.now() > a.deadline
    return h(NTag, { size: 'small', type: late ? 'error' : 'default' }, () => (late ? '未提交，已截止' : '未提交'))
  }
  if (a.status === 'pending') return h(NTag, { size: 'small', type: 'warning' }, () => '评分中')
  if (a.status === 'error') return h(NTag, { size: 'small', type: 'error' }, () => '评分出错')
  const waiting = a.hasManual && !a.reviewed ? h('span', { class: 'muted' }, '（老师还没评）') : null
  return h('span', [`${a.total} / ${a.fullMarks}`, waiting])
}

/** 学生点作业打开去做；老师点作业去评阅这个学生 */
const assignmentLink = (a: AssignmentRow) =>
  teacherView.value ? { path: `/teacher/assignments/${a.id}`, query: { student: data.value!.student.id } } : `/assignments/${a.id}`

const statColumns = <T extends { minutes: number; runs: number; failedCompiles: number; selfchecks: number }>(): DataTableColumns<T> => [
  { title: '用时', key: 'minutes', width: 110, render: (r) => (r.minutes ? duration(r.minutes) : '') },
  { title: '运行', key: 'runs', width: 70 },
  { title: '编译没通过', key: 'failedCompiles', width: 100 },
  { title: '自己检查', key: 'selfchecks', width: 90 },
]

const assignmentColumns = computed<DataTableColumns<AssignmentRow>>(() => [
  { title: '作业', key: 'title', render: (a) => h(RouterLink, { to: assignmentLink(a), class: 'link' }, () => a.title) },
  { title: '得分', key: 'total', width: 170, render: scoreCell },
  ...statColumns<AssignmentRow>(),
  { title: '提交', key: 'submissions', width: 70 },
  { title: '最后提交', key: 'lastSubmittedAt', width: 120, render: (a) => formatTime(a.lastSubmittedAt) },
])

const practiceColumns = computed<DataTableColumns<PracticeRow>>(() => [
  {
    title: '实验',
    key: 'title',
    // 老师打开的是自己的实验页，看不到学生的练习代码，所以不做链接
    render: (p) => (teacherView.value ? p.title : h(RouterLink, { to: { path: '/', query: { sample: p.sampleId } }, class: 'link' }, () => p.title)),
  },
  ...statColumns<PracticeRow>(),
  { title: '最后做', key: 'lastActiveAt', width: 120, render: (p) => formatTime(p.lastActiveAt) },
])
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <template v-if="teacherView">
        <strong>学生档案</strong>
        <span v-if="data"
          >{{ data.student.name }}<span v-if="data.student.className" class="muted">（{{ data.student.className }}）</span></span
        >
      </template>
      <template v-else>
        <strong>物联网编程仿真平台</strong>
        <span class="title">我的学习</span>
      </template>
      <span class="spacer" />
      <TopNav />
    </header>

    <main class="content">
      <NSpin v-if="loading" class="loading" />
      <template v-else-if="data">
        <section class="stats">
          <div class="stat">
            <span class="label">作业</span>
            <b>{{ submittedCount }}</b>
            <span class="muted">/ {{ data.assignments.length }} 已提交</span>
          </div>
          <div class="stat">
            <span class="label">一共做了</span>
            <b>{{ duration(data.summary.minutes) }}</b>
            <span class="muted">{{ data.summary.days }} 天</span>
          </div>
          <div class="stat">
            <span class="label">运行</span>
            <b>{{ data.summary.runs }}</b>
            <span class="muted">次，编译通过 {{ compileRate }}</span>
          </div>
          <div class="stat">
            <span class="label">自己检查</span>
            <b>{{ data.summary.selfchecks }}</b>
            <span class="muted">次</span>
          </div>
        </section>
        <p class="muted small">用时、运行次数和常犯的错误从 2026 年 11 月 22 日开始记录。用时是改代码、运行或操作程序的分钟数，开着页面不动不算。</p>

        <section class="card">
          <h3>每天做了多久</h3>
          <div class="chart"><canvas ref="canvas" /></div>
        </section>

        <section class="card">
          <h3>作业</h3>
          <NDataTable
            v-if="data.assignments.length"
            :columns="assignmentColumns"
            :data="data.assignments"
            :row-key="(a: AssignmentRow) => a.id"
            size="small"
            :bordered="false"
            :scroll-x="800"
          />
          <NEmpty v-else size="small" description="老师还没有布置作业" />
        </section>

        <section class="card">
          <h3>自由练习</h3>
          <NDataTable
            v-if="data.practice.length"
            :columns="practiceColumns"
            :data="data.practice"
            :row-key="(p: PracticeRow) => p.sampleId"
            size="small"
            :bordered="false"
            :scroll-x="700"
          />
          <NEmpty v-else size="small" description="还没有自由练习过" />
        </section>

        <div class="grid">
          <section class="card">
            <h3>{{ teacherView ? '常犯的编译错误' : '我常犯的编译错误' }}</h3>
            <p class="muted small">按出现的次数排。改好之前每运行一次算一次。</p>
            <NEmpty v-if="!data.compileErrors.length" size="small" description="还没有编译错误的记录" />
            <ol v-else class="errors">
              <li v-for="e in data.compileErrors" :key="e.code">
                <div class="error-head">
                  <code>{{ e.code }}</code>
                  <span>{{ e.count }} 次</span>
                  <span class="muted">{{ e.works }} 个作业或实验里出现过，最近一次 {{ formatTime(e.lastAt) }}</span>
                </div>
                <!-- 报错带了平台的针对性提示时，通用说明就重复了 -->
                <div v-if="!e.messages.some((m) => m.hint) && explainCompileError(e.code)" class="explain">{{ explainCompileError(e.code) }}</div>
                <div v-for="m in e.messages" :key="m.message" class="message">
                  {{ m.message }} <span class="muted">× {{ m.count }}</span>
                  <div v-if="m.hint" class="hint">{{ m.hint }}</div>
                </div>
              </li>
            </ol>
          </section>

          <section class="card">
            <h3>{{ teacherView ? '运行出错' : '我的程序运行出错' }}</h3>
            <p class="muted small">程序运行时没处理的异常，一次运行里同样的只算一次。</p>
            <NEmpty v-if="!data.exceptions.length" size="small" description="还没有运行出错的记录" />
            <ol v-else class="errors">
              <li v-for="e in data.exceptions" :key="e.message">
                <div class="error-head">
                  <span class="message">{{ e.message }}</span>
                  <span class="nowrap">{{ e.count }} 次</span>
                </div>
                <div v-if="exceptionFix(e.message)" class="explain">怎么改：{{ exceptionFix(e.message) }}</div>
                <div class="muted">最近一次 {{ formatTime(e.lastAt) }}</div>
              </li>
            </ol>
          </section>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.title {
  color: #374151;
}

.spacer {
  flex: 1;
}

:deep(.link) {
  color: #2563eb;
  font-size: 14px;
  text-decoration: none;
}


.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
}

.loading {
  margin: 60px auto;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 8px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.stat .label {
  margin-right: 6px;
  color: #374151;
  font-size: 13px;
}

.stat b {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}

.card {
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  min-width: 0;
}

.card h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 12px;
}

.muted {
  color: #6b7280;
  font-size: 13px;
}

.small {
  margin: 0 0 8px;
  font-size: 12px;
}

.chart {
  position: relative;
  height: 180px;
}

.errors {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
}

.errors li {
  margin-bottom: 10px;
}

.error-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.error-head .message {
  flex: 1;
  min-width: 0;
}

.explain {
  margin: 2px 0;
  color: #1f2937;
}

.hint {
  margin: 2px 0;
  color: #b45309;
}

.message {
  color: #374151;
  overflow-wrap: anywhere;
}

.nowrap {
  white-space: nowrap;
}
</style>

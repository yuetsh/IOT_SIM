<script setup lang="ts">
// 作业分析（老师课后看）：全班得分分布、每个评分项的通过率、常见编译错误和运行出错、每个学生做了多久、运行和自测了几次。
// 用时、运行、自测、常见错误来自学习过程记录，2026-11-22 才开始记，之前布置的作业没有这些数据。
// 点学生那一行回到评阅看他的代码。
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js'
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NButton, NDataTable, NEmpty, NSpin, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import type { AssignmentAnalysis } from '@iot/shared'
import { api } from '../api'
import { downloadCsv, textCell } from './csv'

Chart.register(BarController, BarElement, CategoryScale, Legend, LinearScale, Tooltip)

type Student = AssignmentAnalysis['students'][number]

const props = defineProps<{ assignmentId: string }>()
const emit = defineEmits<{ student: [userId: number] }>()
const message = useMessage()

const data = ref<AssignmentAnalysis | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    data.value = await api<AssignmentAnalysis>('GET', `/api/teacher/assignments/${props.assignmentId}/analysis`)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
})

const submitted = computed(() => data.value?.students.filter((s) => s.total !== null) ?? [])
const totals = computed(() => submitted.value.map((s) => s.total!).sort((a, b) => a - b))
const average = computed(() => (totals.value.length ? totals.value.reduce((a, b) => a + b, 0) / totals.value.length : null))
const median = computed(() => {
  const t = totals.value
  if (!t.length) return null
  const mid = Math.floor(t.length / 2)
  return t.length % 2 ? t[mid] : (t[mid - 1] + t[mid]) / 2
})
const fullCount = computed(() => totals.value.filter((t) => t === data.value?.fullMarks).length)
/** 有老师评分项、提交了但老师还没评的人数（总分里老师评分按 0 算） */
const unreviewed = computed(() => (data.value?.assignment.scoring.manual.length ? submitted.value.filter((s) => !s.reviewed).length : 0))
const notStarted = computed(() => data.value?.students.filter((s) => s.total === null && s.firstOpenedAt === null && s.minutes === 0).length ?? 0)
const active = computed(() => data.value?.students.filter((s) => s.minutes > 0) ?? [])
const averageMinutes = computed(() => (active.value.length ? active.value.reduce((a, s) => a + s.minutes, 0) / active.value.length : null))

const round1 = (x: number) => Math.round(x * 10) / 10
const percent = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const formatTime = (ms: number | null) =>
  ms === null ? '' : new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const formatDate = (ms: number) => new Date(ms).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })

/** 过程记录是不是从布置作业之后很久才开始（这之前的用时、运行次数没有） */
const recordNote = computed(() => {
  const d = data.value
  if (!d) return ''
  if (d.recordedSince === null) return '这个作业还没有过程记录（用时、运行、自测、常见错误）。过程记录从 2026 年 11 月 22 日开始，之后学生打开、运行作业才有。'
  if (d.recordedSince - d.assignment.createdAt > 86_400_000)
    return `过程记录从 ${formatDate(d.recordedSince)} 开始，之前学生做的过程没有记下来，用时和次数会偏少。`
  return ''
})

// ---------- 得分分布 ----------
const BANDS = [
  { label: '不及格', sub: '60% 以下', min: 0 },
  { label: '及格', sub: '60%–69%', min: 0.6 },
  { label: '中等', sub: '70%–79%', min: 0.7 },
  { label: '良好', sub: '80%–89%', min: 0.8 },
  { label: '优秀', sub: '90% 以上', min: 0.9 },
]
/** 每档的人数，分老师已评（或没有老师评分项）和老师还没评（老师评分按 0 算）两部分 */
const bandCounts = computed(() => {
  const reviewed = BANDS.map(() => 0)
  const pending = BANDS.map(() => 0)
  const d = data.value
  const full = d?.fullMarks || 1
  for (const s of submitted.value) {
    let band = 0
    BANDS.forEach((b, i) => {
      if (s.total! / full >= b.min - 1e-9) band = i
    })
    if (d?.assignment.scoring.manual.length && !s.reviewed) pending[band]++
    else reviewed[band]++
  }
  return { reviewed, pending }
})

const canvas = ref<HTMLCanvasElement>()
let chart: Chart | undefined

function drawChart() {
  chart?.destroy()
  if (!canvas.value) return
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: BANDS.map((b) => [b.label, b.sub]),
      datasets: [
        { label: '已评完', data: bandCounts.value.reviewed, backgroundColor: ['#f87171', '#fbbf24', '#a3a3a3', '#60a5fa', '#34d399'] },
        { label: '等老师评分（老师评分按 0 算）', data: bandCounts.value.pending, backgroundColor: '#d1d5db' },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        // 都评完了就不用图例
        legend: { display: unreviewed.value > 0, labels: { filter: (item) => item.datasetIndex === 1, boxWidth: 12 } },
        tooltip: { callbacks: { title: (items) => BANDS[items[0].dataIndex].label, label: (item) => `${item.dataset.label}：${item.parsed.y} 人` } },
      },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: '人数' } } },
    },
  })
}

watch(data, async () => {
  await nextTick()
  drawChart()
})
onBeforeUnmount(() => chart?.destroy())

// ---------- 学生表 ----------
function scoreCell(s: Student) {
  if (s.status === null) return h(NTag, { size: 'tiny' }, () => '未提交')
  if (s.status === 'pending') return h(NTag, { size: 'tiny', type: 'warning' }, () => '评分中')
  if (s.status === 'error') return h(NTag, { size: 'tiny', type: 'error' }, () => '评分出错')
  const unreviewedTag = data.value?.assignment.scoring.manual.length && !s.reviewed ? h('span', { class: 'muted' }, ' 未评') : null
  return h('span', [String(s.total), unreviewedTag])
}

/** 没提交的排在最后 */
const byNullable = (key: (s: Student) => number | null) => (a: Student, b: Student) => (key(a) ?? -1) - (key(b) ?? -1)

const columns = computed<DataTableColumns<Student>>(() => [
  { title: '用户名', key: 'username', fixed: 'left', width: 120, sorter: 'default' },
  { title: `得分（${data.value?.fullMarks ?? ''}）`, key: 'total', width: 110, sorter: byNullable((s) => s.total), render: scoreCell },
  { title: '用时（分钟）', key: 'minutes', width: 110, sorter: (a, b) => a.minutes - b.minutes },
  { title: '运行', key: 'runs', width: 70, sorter: (a, b) => a.runs - b.runs },
  {
    title: '编译没通过',
    key: 'failedCompiles',
    width: 100,
    sorter: (a, b) => a.failedCompiles - b.failedCompiles,
    render: (s) => (s.runs ? `${s.failedCompiles}（${percent(s.failedCompiles, s.runs)}）` : ''),
  },
  { title: '运行出错', key: 'exceptions', width: 90, sorter: (a, b) => a.exceptions - b.exceptions },
  { title: '自己检查', key: 'selfchecks', width: 90, sorter: (a, b) => a.selfchecks - b.selfchecks },
  { title: '提交', key: 'submissions', width: 70, sorter: (a, b) => a.submissions - b.submissions },
  { title: '第一次打开', key: 'firstOpenedAt', width: 120, sorter: byNullable((s) => s.firstOpenedAt), render: (s) => formatTime(s.firstOpenedAt) },
  { title: '最后提交', key: 'lastSubmittedAt', width: 120, sorter: byNullable((s) => s.lastSubmittedAt), render: (s) => formatTime(s.lastSubmittedAt) },
])

const rowProps = (s: Student) => ({ style: 'cursor: pointer', title: '点击看他的提交', onClick: () => emit('student', s.userId) })

function exportCsv() {
  const d = data.value
  if (!d) return
  downloadCsv(`${d.assignment.title}-学习情况.csv`, [
    ['用户名', `得分（${d.fullMarks}）`, '老师已评', '用时（分钟）', '运行', '编译没通过', '运行出错', '自己检查', '提交', '第一次打开', '最后提交'],
    ...d.students.map((s) => [
      textCell(s.username),
      s.total ?? '未提交',
      s.total === null ? '' : s.reviewed ? '是' : '否',
      s.minutes,
      s.runs,
      s.failedCompiles,
      s.exceptions,
      s.selfchecks,
      s.submissions,
      formatTime(s.firstOpenedAt),
      formatTime(s.lastSubmittedAt),
    ]),
  ])
}
</script>

<template>
  <div class="analysis">
    <NSpin v-if="loading" class="loading" />
    <template v-else-if="data">
      <div v-if="recordNote" class="note">{{ recordNote }}</div>

      <section class="stats">
        <div class="stat">
          <span class="label">已提交</span>
          <b>{{ submitted.length }}</b>
          <span class="muted">/ {{ data.students.length }} 人</span>
        </div>
        <div class="stat">
          <span class="label">平均分</span>
          <b>{{ average === null ? '—' : round1(average) }}</b>
          <span class="muted">/ {{ data.fullMarks }}</span>
        </div>
        <div class="stat">
          <span class="label">中位数</span>
          <b>{{ median ?? '—' }}</b>
        </div>
        <div class="stat">
          <span class="label">满分</span>
          <b>{{ fullCount }}</b>
          <span class="muted">人</span>
        </div>
        <div class="stat">
          <span class="label">人均用时</span>
          <b>{{ averageMinutes === null ? '—' : Math.round(averageMinutes) }}</b>
          <span class="muted">分钟</span>
        </div>
        <div class="stat">
          <span class="label">还没打开过</span>
          <b>{{ notStarted }}</b>
          <span class="muted">人</span>
        </div>
      </section>

      <div class="grid">
        <section class="card">
          <h3>得分分布</h3>
          <p class="muted small">
            按满分 {{ data.fullMarks }} 的百分比分档，只算已提交的 {{ submitted.length }} 人<template v-if="unreviewed"
              >；灰色的 {{ unreviewed }} 人老师评分还没打，暂按 0 算，评完会往上走</template
            >。
          </p>
          <div class="chart"><canvas ref="canvas" /></div>
        </section>

        <section class="card">
          <h3>评分项</h3>
          <p class="muted small">通过率按每人最近一次提交算；"自己检查没过"是做的过程中自己检查时这项没通过过的人数，多说明这一步卡人。</p>
          <table class="checks">
            <thead>
              <tr>
                <th>评分项</th>
                <th>分值</th>
                <th>通过率</th>
                <th>自己检查没过</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in data.checks" :key="c.title">
                <td>{{ c.title }}</td>
                <td>{{ c.points }}</td>
                <td class="rate">
                  <span class="bar"><span :style="{ width: percent(c.passed, c.graded) === '—' ? '0' : percent(c.passed, c.graded) }" /></span>
                  {{ percent(c.passed, c.graded) }}
                  <span class="muted">（{{ c.passed }}/{{ c.graded }}）</span>
                </td>
                <td>{{ c.struggled }} 人</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="card">
          <h3>常见编译错误</h3>
          <p class="muted small">按出过这个错的人数排，学生改好之前每运行一次算一次。</p>
          <NEmpty v-if="!data.compileErrors.length" size="small" description="没有记录到编译错误" />
          <ol v-else class="errors">
            <li v-for="e in data.compileErrors" :key="e.code">
              <div class="error-head">
                <code>{{ e.code }}</code>
                <span>{{ e.students }} 人</span>
                <span class="muted">{{ e.count }} 次</span>
              </div>
              <div v-for="m in e.messages" :key="m.message" class="message">
                {{ m.message }} <span class="muted">× {{ m.count }}</span>
                <div v-if="m.hint" class="hint">{{ m.hint }}</div>
              </div>
            </li>
          </ol>
        </section>

        <section class="card">
          <h3>常见运行出错</h3>
          <p class="muted small">程序运行时没处理的异常，一次运行里同样的只算一次。</p>
          <NEmpty v-if="!data.exceptions.length" size="small" description="没有记录到运行出错" />
          <ol v-else class="errors">
            <li v-for="e in data.exceptions" :key="e.message">
              <div class="error-head">
                <span class="message">{{ e.message }}</span>
                <span>{{ e.students }} 人</span>
                <span class="muted">{{ e.count }} 次</span>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <section class="card">
        <div class="table-head">
          <h3>每个学生</h3>
          <span class="muted small">点一行看他的提交</span>
          <span class="spacer" />
          <NButton size="small" @click="exportCsv">导出</NButton>
        </div>
        <NDataTable :columns="columns" :data="data.students" :row-key="(s: Student) => s.userId" :row-props="rowProps" size="small" :scroll-x="1000" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.analysis {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 24px;
  overflow: auto;
}

.loading {
  margin: 60px auto;
}

.note {
  padding: 8px 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 13px;
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
  min-width: 130px;
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 12px;
}

.card {
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  min-width: 0;
}

.card h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.muted {
  color: #6b7280;
}

.small {
  margin: 0 0 8px;
  font-size: 12px;
}

.chart {
  position: relative;
  height: 220px;
}

.checks {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.checks th,
.checks td {
  padding: 5px 6px;
  border-bottom: 1px solid #f3f4f6;
  text-align: left;
}

.checks th {
  color: #6b7280;
  font-weight: normal;
}

.rate {
  white-space: nowrap;
}

.bar {
  display: inline-block;
  width: 80px;
  height: 8px;
  margin-right: 6px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
  vertical-align: middle;
}

.bar span {
  display: block;
  height: 100%;
  background: #34d399;
}

.errors {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
}

.errors li {
  margin-bottom: 8px;
}

.error-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.error-head .message {
  flex: 1;
  min-width: 0;
}

.hint {
  margin: 2px 0;
  color: #b45309;
}

.message {
  color: #374151;
  overflow-wrap: anywhere;
}

.table-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}

.table-head h3 {
  margin: 0;
}

.spacer {
  flex: 1;
}
</style>

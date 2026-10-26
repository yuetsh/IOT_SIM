<script setup lang="ts">
// 全班成绩表：每个学生在每个作业上的总分（自动评分 + 老师评分），点分数进入评阅页；可以导出给 Excel。
import { computed, h, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDataTable, NEmpty, useMessage, type DataTableColumns } from 'naive-ui'
import { api } from '../api'
import { downloadCsv } from './csv'

interface Cell {
  submitted: boolean
  auto: number | null
  manual: number | null
  /** 老师还没评阅时 AI 的建议分（老师评分项之和） */
  aiManual: number | null
  total: number | null
}

interface Gradebook {
  assignments: { id: number; title: string; total: number }[]
  students: { userId: number; username: string; name: string; scores: Record<number, Cell> }[]
}

type Row = Gradebook['students'][number]

const props = defineProps<{ classId: number; className: string }>()
const router = useRouter()
const message = useMessage()
const book = ref<Gradebook>({ assignments: [], students: [] })

watch(
  () => props.classId,
  async (id) => {
    book.value = await api<Gradebook>('GET', `/api/teacher/classes/${id}/gradebook`).catch((e: Error) => {
      message.error(e.message)
      return { assignments: [], students: [] }
    })
  },
  { immediate: true },
)

const sum = (row: Row) => book.value.assignments.reduce((a, x) => a + (row.scores[x.id]?.total ?? 0), 0)
const fullMarks = computed(() => book.value.assignments.reduce((a, x) => a + x.total, 0))

/** 单元格：已提交显示总分（老师还没评阅时：有 AI 建议显示含建议的总分并标"待确认"，否则标"待评"），未提交显示"未交" */
function cell(row: Row, assignmentId: number) {
  const c = row.scores[assignmentId]
  const open = () => router.push({ path: `/teacher/assignments/${assignmentId}`, query: { student: row.userId } })
  if (!c?.submitted) return h('span', { class: 'missing' }, '未交')
  const text = c.manual !== null ? String(c.total) : c.aiManual !== null ? `${(c.auto ?? 0) + c.aiManual}（AI 建议，待确认）` : `${c.total}（待评）`
  return h(NButton, { text: true, type: 'primary', onClick: open }, () => text)
}

const columns = computed<DataTableColumns<Row>>(() => [
  { title: '用户名', key: 'username', fixed: 'left', width: 130, sorter: 'default' },
  ...book.value.assignments.map((a) => ({
    title: `${a.title}（${a.total}）`,
    key: `a${a.id}`,
    minWidth: 120,
    render: (row: Row) => cell(row, a.id),
  })),
  { title: `合计（${fullMarks.value}）`, key: 'sum', width: 110, sorter: (a: Row, b: Row) => sum(a) - sum(b), render: (row: Row) => String(sum(row)) },
])

function exportCsv() {
  downloadCsv(`${props.className}-成绩表.csv`, [
    ['用户名', ...book.value.assignments.map((a) => `${a.title}（${a.total}）`), `合计（${fullMarks.value}）`],
    ...book.value.students.map((s) => [
      `\t${s.username}`,
      ...book.value.assignments.map((a) => (s.scores[a.id]?.submitted ? s.scores[a.id].total : '未交')),
      sum(s),
    ]),
  ])
}
</script>

<template>
  <div>
    <div class="head">
      <span class="tip">总分 = 最近一次提交的自动评分 + 老师评分；"AI 建议，待确认"是含 AI 建议分的总分，老师采纳后才算数；"待评"只含自动评分。</span>
      <NButton size="small" :disabled="book.students.length === 0" @click="exportCsv">导出成绩表（CSV）</NButton>
    </div>
    <NDataTable
      v-if="book.assignments.length"
      :columns="columns"
      :data="book.students"
      :row-key="(r: Row) => r.userId"
      size="small"
      :scroll-x="400 + book.assignments.length * 130"
    />
    <NEmpty v-else description="还没有布置作业" class="empty" />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.tip {
  flex: 1;
  color: #6b7280;
  font-size: 12px;
}

:deep(.missing) {
  color: #9ca3af;
}

.empty {
  margin-top: 40px;
}
</style>

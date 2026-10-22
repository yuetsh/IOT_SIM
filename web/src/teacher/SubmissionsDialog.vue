<script setup lang="ts">
// 一个作业的提交情况：全班每个学生最近一次提交的状态和自动评分得分。
import { computed, h, ref, watch } from 'vue'
import { NDataTable, NModal, NTag, type DataTableColumns } from 'naive-ui'
import type { Assignment } from '@iot/shared'
import { api } from '../api'

interface Row {
  userId: number
  username: string
  name: string
  status: 'pending' | 'done' | 'error' | null
  autoScore: number | null
  submittedAt: number | null
  count: number
}

const props = defineProps<{ show: boolean; assignment: Assignment | null }>()
const emit = defineEmits<{ 'update:show': [show: boolean] }>()

const rows = ref<Row[]>([])
const autoTotal = computed(() => props.assignment?.scoring.auto.reduce((a, b) => a + b, 0) ?? 0)
const submitted = computed(() => rows.value.filter((r) => r.status).length)

watch(
  () => props.show,
  async (show) => {
    if (show && props.assignment) rows.value = await api<Row[]>('GET', `/api/teacher/assignments/${props.assignment.id}/submissions`).catch(() => [])
  },
)

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const columns = computed<DataTableColumns<Row>>(() => [
  { title: '学号', key: 'username', sorter: 'default' },
  { title: '姓名', key: 'name' },
  {
    title: '状态',
    key: 'status',
    render: (r) =>
      r.status === null
        ? h(NTag, { size: 'small' }, () => '未提交')
        : r.status === 'pending'
          ? h(NTag, { size: 'small', type: 'warning' }, () => '评分中')
          : r.status === 'error'
            ? h(NTag, { size: 'small', type: 'error' }, () => '评分出错')
            : h(NTag, { size: 'small', type: 'success' }, () => '已评分'),
  },
  {
    title: `自动评分（满分 ${autoTotal.value}）`,
    key: 'autoScore',
    sorter: (a, b) => (a.autoScore ?? -1) - (b.autoScore ?? -1),
    render: (r) => (r.autoScore === null ? '—' : String(r.autoScore)),
  },
  { title: '提交次数', key: 'count' },
  { title: '最后提交', key: 'submittedAt', render: (r) => (r.submittedAt ? formatTime(r.submittedAt) : '—') },
])
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="`提交情况：${assignment?.title ?? ''}`"
    style="width: 760px; max-width: calc(100vw - 32px)"
    @update:show="emit('update:show', $event)"
  >
    <p class="summary">已提交 {{ submitted }} / {{ rows.length }} 人</p>
    <NDataTable :columns="columns" :data="rows" :row-key="(r: Row) => r.userId" size="small" :max-height="480" />
  </NModal>
</template>

<style scoped>
.summary {
  margin: 0 0 8px;
  color: #4b5563;
}
</style>

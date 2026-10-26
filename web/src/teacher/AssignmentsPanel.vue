<script setup lang="ts">
// 一个班的作业列表：布置、修改、删除作业；点"已提交"进入评阅页。
import { h, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDataTable, NEmpty, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import type { Assignment } from '@iot/shared'
import { api } from '../api'
import AssignmentDialog from './AssignmentDialog.vue'

type Row = Assignment & { studentCount: number; submittedCount: number }

const props = defineProps<{ classId: number }>()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const rows = ref<Row[]>([])
const editorOpen = ref(false)
const editing = ref<Assignment | null>(null)

async function load() {
  rows.value = await api<Row[]>('GET', `/api/teacher/classes/${props.classId}/assignments`).catch((e: Error) => {
    message.error(e.message)
    return []
  })
}
watch(() => props.classId, load, { immediate: true })

function create() {
  editing.value = null
  editorOpen.value = true
}

function edit(row: Row) {
  editing.value = row
  editorOpen.value = true
}

function remove(row: Row) {
  dialog.warning({
    title: '删除作业',
    content: `将删除"${row.title}"和全班的 ${row.submittedCount} 份提交，不能恢复。确定删除吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await api('DELETE', `/api/teacher/assignments/${row.id}`).catch((e: Error) => message.error(e.message))
      await load()
    },
  })
}

function review(row: Row) {
  void router.push(`/teacher/assignments/${row.id}`)
}

const formatTime = (ms: number) => new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const columns: DataTableColumns<Row> = [
  { title: '作业', key: 'title' },
  { title: '起点', key: 'startMode', width: 110, render: (r) => (r.startMode === 'ui' ? '界面已做好' : '空白工程') },
  { title: '截止时间', key: 'deadline', width: 130, render: (r) => (r.deadline ? formatTime(r.deadline) : '不限') },
  {
    title: '已提交',
    key: 'submitted',
    width: 150,
    render: (r) =>
      h(NButton, { text: true, type: 'primary', title: '查看提交、评阅', onClick: () => review(r) }, () => `${r.submittedCount} / ${r.studentCount} 人 · 评阅`),
  },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render: (r) =>
      h('div', { class: 'row-actions' }, [
        h(NButton, { size: 'tiny', onClick: () => edit(r) }, () => '修改'),
        h(NButton, { size: 'tiny', type: 'error', quaternary: true, onClick: () => remove(r) }, () => '删除'),
      ]),
  },
]
</script>

<template>
  <div class="panel">
    <div class="head">
      <NButton size="small" type="primary" @click="create">布置作业</NButton>
    </div>
    <NDataTable v-if="rows.length" :columns="columns" :data="rows" :row-key="(r: Row) => r.id" size="small" :bordered="false" />
    <NEmpty v-else description="还没有布置作业" class="empty" />
    <AssignmentDialog v-model:show="editorOpen" :class-id="classId" :editing="editing" @saved="load" />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.empty {
  margin-top: 40px;
}

:deep(.row-actions) {
  display: flex;
  gap: 6px;
}
</style>

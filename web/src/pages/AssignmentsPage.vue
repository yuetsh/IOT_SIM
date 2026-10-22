<script setup lang="ts">
// 学生的作业列表：自己班的作业、截止时间、提交和得分情况。
import { h, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { NButton, NDataTable, NEmpty, NTag, type DataTableColumns } from 'naive-ui'
import type { Assignment, Submission } from '@iot/shared'
import { api } from '../api'
import { currentUser, logout } from '../auth'

type Row = Assignment & { latest: Submission | null; manualScore: number | null }

const router = useRouter()
const rows = ref<Row[]>([])
const loaded = ref(false)

onMounted(async () => {
  rows.value = await api<Row[]>('GET', '/api/assignments').catch(() => [])
  loaded.value = true
})

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const total = (a: Assignment) => a.scoring.auto.reduce((x, y) => x + y, 0)

function status(row: Row) {
  const s = row.latest
  if (!s) return row.deadline && Date.now() > row.deadline ? h(NTag, { type: 'error', size: 'small' }, () => '未提交，已截止') : h(NTag, { size: 'small' }, () => '未提交')
  if (s.status === 'pending') return h(NTag, { type: 'warning', size: 'small' }, () => '评分中')
  if (s.status === 'error') return h(NTag, { type: 'error', size: 'small' }, () => '评分出错')
  if (row.manualScore !== null) {
    const all = total(row) + row.scoring.manual.reduce((a, m) => a + m.points, 0)
    return h(NTag, { type: 'success', size: 'small' }, () => `老师已评阅 · 总分 ${(s.autoScore ?? 0) + row.manualScore!} / ${all}`)
  }
  const full = s.autoScore === total(row)
  return h(NTag, { type: full ? 'success' : 'info', size: 'small' }, () => `已提交 · 自动评分 ${s.autoScore} / ${total(row)}`)
}

const columns: DataTableColumns<Row> = [
  { title: '作业', key: 'title', render: (r) => h(RouterLink, { to: `/assignments/${r.id}`, class: 'link' }, () => r.title) },
  { title: '起点', key: 'startMode', width: 120, render: (r) => (r.startMode === 'ui' ? '界面已做好' : '空白工程') },
  { title: '截止时间', key: 'deadline', width: 140, render: (r) => (r.deadline ? formatTime(r.deadline) : '不限') },
  { title: '状态', key: 'status', width: 220, render: status },
]

async function signOut() {
  await logout()
  await router.push('/login')
}
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <strong>物联网编程仿真平台</strong>
      <span class="title">我的作业</span>
      <RouterLink to="/" class="nav-link">自由练习</RouterLink>
      <span class="spacer" />
      <span class="user">
        {{ currentUser?.name }}<template v-if="currentUser?.className">（{{ currentUser.className }}）</template>
      </span>
      <NButton quaternary size="small" @click="signOut">退出</NButton>
    </header>
    <main class="content">
      <NDataTable v-if="rows.length" :columns="columns" :data="rows" :row-key="(r: Row) => r.id" :bordered="false" />
      <NEmpty v-else-if="loaded" description="老师还没有布置作业" class="empty" />
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

.nav-link,
:deep(.link) {
  color: #2563eb;
  font-size: 14px;
  text-decoration: none;
}

.user {
  font-size: 13px;
}

.content {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
}

.empty {
  margin-top: 80px;
}
</style>

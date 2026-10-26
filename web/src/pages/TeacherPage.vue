<script setup lang="ts">
// 老师的班级管理：建班、导入学生名单（CSV）、查看和重置密码、导出名单发给学生；布置作业（评阅在 ReviewPage）；全班成绩表。
import { computed, h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDataTable, NEmpty, NInput, NModal, NPopconfirm, NPopover, NTabPane, NTabs, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import { api } from '../api'
import { currentUser, logout } from '../auth'
import AssignmentsPanel from '../teacher/AssignmentsPanel.vue'
import GradebookPanel from '../teacher/GradebookPanel.vue'
import { downloadCsv } from '../teacher/csv'
import { decodeCsv, parseCsv, toRoster, type RosterRow } from '../teacher/roster'

interface ClassInfo {
  id: number
  name: string
  studentCount: number
}

interface Student {
  id: number
  username: string
  name: string
  password: string
}

interface ImportResult {
  created: number
  updated: number
  errors: { row: number; message: string }[]
}

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const classes = ref<ClassInfo[]>([])
const selectedId = ref<number>()
const selected = computed(() => classes.value.find((c) => c.id === selectedId.value))
const students = ref<Student[]>([])

/** 出错时弹出服务器给的说明 */
async function attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action()
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function loadClasses() {
  classes.value = (await attempt(() => api<ClassInfo[]>('GET', '/api/teacher/classes'))) ?? []
  if (!selected.value) selectedId.value = classes.value[0]?.id
}

async function loadStudents() {
  students.value = selectedId.value ? ((await attempt(() => api<Student[]>('GET', `/api/teacher/classes/${selectedId.value}/students`))) ?? []) : []
}

async function selectClass(id: number) {
  selectedId.value = id
  await loadStudents()
}

onMounted(async () => {
  await loadClasses()
  await loadStudents()
})

// ---------- 班级 ----------
const newClassName = ref('')
const newClassOpen = ref(false)

async function createClass() {
  const created = await attempt(() => api<{ id: number }>('POST', '/api/teacher/classes', { name: newClassName.value }))
  if (!created) return
  newClassName.value = ''
  newClassOpen.value = false
  await loadClasses()
  await selectClass(created.id)
}

const renameValue = ref('')
const renameOpen = ref(false)

async function renameClass() {
  if (!selected.value) return
  const ok = await attempt(() => api('PATCH', `/api/teacher/classes/${selected.value!.id}`, { name: renameValue.value }))
  if (!ok) return
  renameOpen.value = false
  await loadClasses()
}

async function deleteClass() {
  if (!selected.value) return
  const ok = await attempt(() => api('DELETE', `/api/teacher/classes/${selected.value!.id}`))
  if (!ok) return
  selectedId.value = undefined
  await loadClasses()
  await loadStudents()
}

// ---------- 学生 ----------
async function resetPassword(student: Student) {
  const result = await attempt(() => api<{ password: string }>('POST', `/api/teacher/students/${student.id}/reset-password`))
  if (!result) return
  message.success(`${student.name} 的新密码：${result.password}`)
  await loadStudents()
}

function deleteStudent(student: Student) {
  dialog.warning({
    title: '删除学生',
    content: `将删除 ${student.name}（${student.username}）和他保存的所有作品，不能恢复。确定删除吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await attempt(() => api('DELETE', `/api/teacher/students/${student.id}`))
      await loadClasses()
      await loadStudents()
    },
  })
}

const columns: DataTableColumns<Student> = [
  { title: '用户名', key: 'username', sorter: 'default' },
  { title: '密码', key: 'password', render: (s) => h('code', s.password) },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render: (s) =>
      h('div', { class: 'row-actions' }, [
        h(NButton, { size: 'tiny', onClick: () => resetPassword(s) }, () => '重置密码'),
        h(NButton, { size: 'tiny', type: 'error', quaternary: true, onClick: () => deleteStudent(s) }, () => '删除'),
      ]),
  },
]

// ---------- 导入、导出名单 ----------
const fileInput = ref<HTMLInputElement>()
const preview = ref<RosterRow[] | null>(null)
const previewValid = computed(() => preview.value?.filter((r) => !r.problem) ?? [])
const importing = ref(false)

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const rows = toRoster(parseCsv(decodeCsv(await file.arrayBuffer())))
  if (rows.length === 0) {
    message.warning('文件里没有读到学生')
    return
  }
  preview.value = rows
}

async function confirmImport() {
  if (!selected.value || previewValid.value.length === 0) return
  importing.value = true
  const rows = previewValid.value.map(({ username, name, password }) => ({ username, name, password }))
  const result = await attempt(() => api<ImportResult>('POST', `/api/teacher/classes/${selected.value!.id}/import`, { rows }))
  importing.value = false
  if (!result) return
  preview.value = null
  await loadClasses()
  await loadStudents()
  const summary = `新增 ${result.created} 人，更新 ${result.updated} 人`
  if (result.errors.length === 0) message.success(summary)
  else
    dialog.warning({
      title: '部分学生没有导入',
      content: () => h('div', [h('p', summary), ...result.errors.map((e) => h('div', `${rows[e.row - 1]?.username ?? ''}：${e.message}`))]),
      positiveText: '知道了',
    })
}

function exportRoster() {
  if (!selected.value) return
  downloadCsv(`${selected.value.name}-名单.csv`, [['用户名', '密码'], ...students.value.map((s) => [`\t${s.username}`, `\t${s.password}`])])
}

function downloadTemplate() {
  downloadCsv('学生名单模板.csv', [
    ['用户名', '密码'],
    ['张三', ''],
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
      <strong>物联网编程仿真平台</strong>
      <span class="title">班级管理</span>
      <RouterLink to="/" class="nav-link">返回实验</RouterLink>
      <span class="spacer" />
      <RouterLink to="/help#teacher" target="_blank" class="nav-link">使用说明</RouterLink>
      <span class="user">{{ currentUser?.name }}</span>
      <NButton quaternary size="small" @click="signOut">退出</NButton>
    </header>

    <main class="content">
      <aside class="classes">
        <div class="classes-head">
          <span>班级</span>
          <NPopover v-model:show="newClassOpen" trigger="click" placement="bottom-end">
            <template #trigger>
              <NButton size="small" quaternary>＋ 新建</NButton>
            </template>
            <form class="popover-form" @submit.prevent="createClass">
              <NInput v-model:value="newClassName" size="small" placeholder="班级名，如 物联网 2401" autofocus />
              <NButton size="small" type="primary" attr-type="submit" :disabled="!newClassName.trim()">创建</NButton>
            </form>
          </NPopover>
        </div>
        <button v-for="c in classes" :key="c.id" class="class-item" :class="{ active: c.id === selectedId }" @click="selectClass(c.id)">
          <span>{{ c.name }}</span>
          <span class="count">{{ c.studentCount }} 人</span>
        </button>
        <NEmpty v-if="classes.length === 0" description="还没有班级，先新建一个" size="small" class="empty" />
      </aside>

      <section v-if="selected" class="students">
        <div class="students-head">
          <h2>{{ selected.name }}</h2>
          <NPopover v-model:show="renameOpen" trigger="click" @update:show="(v: boolean) => v && (renameValue = selected!.name)">
            <template #trigger>
              <NButton size="small" quaternary>改名</NButton>
            </template>
            <form class="popover-form" @submit.prevent="renameClass">
              <NInput v-model:value="renameValue" size="small" autofocus />
              <NButton size="small" type="primary" attr-type="submit" :disabled="!renameValue.trim()">保存</NButton>
            </form>
          </NPopover>
          <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="deleteClass">
            <template #trigger>
              <NButton size="small" quaternary>删除班级</NButton>
            </template>
            只能删除没有学生的班级。确定删除"{{ selected.name }}"吗？
          </NPopconfirm>
        </div>
        <NTabs type="line" default-value="students">
          <NTabPane name="students" :tab="`学生（${students.length}）`">
            <div class="students-actions">
              <NButton size="small" type="primary" @click="fileInput?.click()">导入名单（CSV）</NButton>
              <NButton size="small" :disabled="students.length === 0" @click="exportRoster">导出名单（含密码）</NButton>
              <NButton size="small" quaternary @click="downloadTemplate">下载名单模板</NButton>
              <input ref="fileInput" type="file" accept=".csv,text/csv" hidden @change="onFileChosen" />
            </div>
            <p class="tip">
              名单是 Excel 另存的 CSV，两列："用户名、密码"。用户名就是学生姓名，前面带的班级代号（如 ks241张三 的 ks241）会自动去掉；
              全校重名时在后面加数字区分（张三2）。密码可以留空，平台会生成 6 位数字密码；导入后点"导出名单"发给学生。再次导入同一个班时，密码留空则不变。
            </p>
            <NDataTable :columns="columns" :data="students" :row-key="(s: Student) => s.id" size="small" :bordered="false" />
          </NTabPane>
          <NTabPane name="assignments" tab="作业">
            <AssignmentsPanel :class-id="selected.id" />
          </NTabPane>
          <NTabPane name="grades" tab="成绩" display-directive="if">
            <GradebookPanel :class-id="selected.id" :class-name="selected.name" />
          </NTabPane>
        </NTabs>
      </section>
      <section v-else class="students">
        <NEmpty description="选择或新建一个班级" />
      </section>
    </main>

    <NModal
      :show="preview !== null"
      preset="card"
      :title="`导入到 ${selected?.name ?? ''}`"
      style="width: 640px; max-width: calc(100vw - 32px)"
      @update:show="(v: boolean) => !v && (preview = null)"
    >
      <p>
        共 {{ preview?.length }} 人<template v-if="preview && previewValid.length < preview.length"
          >， <span class="problem">{{ preview.length - previewValid.length }} 行有问题，不会导入</span></template
        >。
      </p>
      <div class="preview">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>密码</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in preview" :key="i" :class="{ bad: r.problem }">
              <td>{{ r.username }}</td>
              <td>{{ r.password || '（自动生成）' }}</td>
              <td class="problem">{{ r.problem }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <div class="modal-actions">
          <NButton @click="preview = null">取消</NButton>
          <NButton type="primary" :loading="importing" :disabled="previewValid.length === 0" @click="confirmImport">
            导入 {{ previewValid.length }} 人
          </NButton>
        </div>
      </template>
    </NModal>
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

.title {
  color: #374151;
}

.spacer {
  flex: 1;
}

.nav-link {
  color: #2563eb;
  font-size: 13px;
  text-decoration: none;
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

.classes {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  overflow: auto;
}

.classes-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 6px;
  color: #6b7280;
  font-size: 13px;
}

.class-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 4px;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.class-item:hover {
  background: #f3f4f6;
}

.class-item.active {
  background: #e0ecff;
  color: #1d4ed8;
}

.count {
  color: #9ca3af;
  font-size: 12px;
}

.empty {
  margin-top: 24px;
}

.students {
  padding: 12px 20px;
  overflow: auto;
}

.students-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.students-head h2 {
  margin: 0 4px 0 0;
  font-size: 18px;
}

.students-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tip {
  color: #6b7280;
  font-size: 12px;
}

.popover-form {
  display: flex;
  gap: 6px;
  width: 260px;
}

:deep(.row-actions) {
  display: flex;
  gap: 6px;
}

.preview {
  max-height: 50vh;
  overflow: auto;
}

.preview table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.preview th,
.preview td {
  padding: 4px 8px;
  border-bottom: 1px solid #f0f0f0;
  text-align: left;
  white-space: nowrap;
}

.preview td.problem {
  white-space: normal;
}

.preview tr.bad td {
  background: #fef2f2;
}

.problem {
  color: #dc2626;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

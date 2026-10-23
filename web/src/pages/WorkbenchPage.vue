<script setup lang="ts">
// 实验页：编辑代码 → 运行 → 在网页里操作学生的窗体和虚拟实训台。
// 三种用法：自由练习（选择示例工程）；做作业（/assignments/:id，从作业起点开始，可以提交评分）；
// 老师运行学生提交的程序（/teacher/submissions/:id/run，改动只用于试运行，不保存）。
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NModal, NPopconfirm, NPopover, NSelect, NTab, NTabs, NTag, useMessage } from 'naive-ui'
import type { Assignment, Review, SourceFile, Submission } from '@iot/shared'
import FormDesigner from '../designer/FormDesigner.vue'
import { createDesignerHistory } from '../designer/history'
import { gallery, loadGallery, projectResources, resourcePrefix, resourcesFile, RESOURCES_FILE } from '../designer/resources'
import ResourcesDialog from '../designer/ResourcesDialog.vue'
import { classPathError, formNameTaken, isFormDesigner, newClassFile, newFormFiles, nextFormName, projectNamespace, startupForm } from '../designer/templates'
import CodeEditor from '../editor/CodeEditor.vue'
import { api } from '../api'
import { currentUser, logout } from '../auth'
import { deleteWork, loadWork, sampleWorkKey, saveWork } from '../editor/works'
import RunArea from '../run/RunArea.vue'
import { createRunSession } from '../run/session'
import GradeResultView from '../grading/GradeResultView.vue'
import { captureForms } from '../grading/screenshots'

const props = defineProps<{ assignmentId?: string; submissionId?: string }>()

const session = createRunSession()
const { state } = session

const samples = ref<{ label: string; value: string }[]>([])
const sampleId = ref<string>()
const files = ref<SourceFile[]>([])
/** 当前标签页：文件路径，或 "设计:X.Designer.cs" 表示窗体 X 的设计器 */
const activeTab = ref<string>()
const DESIGN = '设计:'

/** 每个 X.Designer.cs 对应一个设计器标签页，和它的代码文件 X.cs */
const forms = computed(() => {
  const startup = startupForm(files.value)
  return files.value
    .filter((f) => isFormDesigner(f.path))
    .map((f) => ({ tab: DESIGN + f.path, designer: f.path, code: f.path.replace(/\.Designer\.cs$/, '.cs') }))
    // 启动窗体排在最前
    .sort((a, b) => Number(b.code === `${startup}.cs`) - Number(a.code === `${startup}.cs`))
})
/**
 * 标签页按窗体分组：每个窗体依次是 [设计]、代码；其他文件（Program.cs 等）放最后。
 * Designer.cs 由设计器生成，平时不显示（和 VS 里藏在窗体文件下面一样），
 * 在设计器里点"查看生成的代码"或点到其中的编译错误时才临时出现，切走后收起。
 * 项目资源生成的 Properties/Resources.Designer.cs 也一样，在"项目资源"里管理。
 */
const tabs = computed(() => {
  const grouped = new Set(forms.value.flatMap((f) => [f.code, f.designer]))
  return [
    ...forms.value.flatMap((f) => [
      { name: f.tab, label: `${f.code} [设计]` },
      { name: f.code, label: f.code },
      ...(activeTab.value === f.designer ? [{ name: f.designer, label: f.designer }] : []),
    ]),
    ...files.value
      .filter((f) => !grouped.has(f.path) && (f.path !== RESOURCES_FILE || activeTab.value === RESOURCES_FILE))
      .map((f) => ({ name: f.path, label: f.path })),
  ]
})
const activeForm = computed(() => forms.value.find((f) => f.tab === activeTab.value))
/** 代码编辑器显示的文件：设计器打开时保持上一次的代码文件 */
const activeFile = computed(() => (activeForm.value ? undefined : activeTab.value))
const fileText = (path: string) => files.value.find((f) => f.path === path)?.content ?? ''
const designerHistory = createDesignerHistory({ read: fileText, write: (path, content) => updateFile(path, content) })

// 开发模式下暴露页面状态，供浏览器自动化测试读取
if (import.meta.env.DEV) Object.assign(window, { __iot: { files, fileText, designerHistory, activeTab, updateFile } })
/** 当前代码是否和示例原始代码不同（服务器上有这个人的作品） */
const modified = ref(false)
const editorRef = ref<InstanceType<typeof CodeEditor>>()
const route = useRoute()
const router = useRouter()
const message = useMessage()
/** 当前工程的作品保存在服务器上的哪个 key */
const workKey = ref<string>()

const STATUS_TEXT = { idle: '未运行', compiling: '编译中…', running: '运行中', stopped: '已停止' } as const
const statusType = computed(() => ({ idle: 'default', compiling: 'warning', running: 'success', stopped: 'default' })[state.status] as 'default' | 'warning' | 'success')
const running = computed(() => state.status === 'compiling' || state.status === 'running')

/**
 * F5 运行、Shift+F5 停止，与 Visual Studio 一致。在整个页面上生效，
 * 并阻止浏览器默认的"F5 刷新页面"（否则学生按习惯按下 F5，正在运行的程序和窗体都会丢失）。
 */
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'F5') return
  event.preventDefault()
  event.stopPropagation()
  if (event.shiftKey) session.stop()
  else run()
}

onMounted(() => window.addEventListener('keydown', onKeyDown, { capture: true }))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, { capture: true })
  session.close()
})

onMounted(async () => {
  // 一打开页面就连接服务器，实训台在运行程序之前就能显示和调节
  void session.connect()
  if (props.assignmentId) {
    await loadAssignment()
    return
  }
  if (props.submissionId) {
    await loadSubmission()
    return
  }
  const list = await api<{ id: string; title: string }[]>('GET', '/api/samples')
  samples.value = list.map((s) => ({ label: s.title, value: s.id }))
  // 网址里带 ?sample=示例编号 时直接打开该示例（便于老师把链接发给学生）
  const initial = list.find((s) => s.id === route.query.sample) ?? list[0]
  if (initial) await loadSample(initial.id)
})

/** 打开一个工程：服务器上有保存的作品就用作品，没有就用原始代码；discardWork 表示丢弃作品恢复原始代码 */
async function openProject(key: string, original: () => Promise<SourceFile[]>, discardWork: boolean) {
  await flushSave()
  workKey.value = key
  designerHistory.clear()
  if (discardWork) await deleteWork(key).catch(() => {})
  const work = discardWork ? null : await loadWork(key).catch(() => null)
  modified.value = work !== null
  saveState.value = work ? 'saved' : 'idle'
  files.value = work ?? (await original())
  // 和 VS 一样，默认打开主窗体的设计器
  activeTab.value = forms.value[0]?.tab ?? files.value.find((f) => f.path !== 'Program.cs')?.path ?? files.value[0]?.path
}

async function loadSample(id: string, discardWork = false) {
  sampleId.value = id
  void router.replace({ query: { sample: id } })
  await openProject(sampleWorkKey(id), () => api<SourceFile[]>('GET', `/api/samples/${encodeURIComponent(id)}`), discardWork)
}

// ---------- 作业 ----------
const assignment = ref<Assignment | null>(null)
const submission = ref<Submission | null>(null)
const review = ref<Review | null>(null)
const resultOpen = ref(false)
const submitting = ref(false)
const pastDeadline = computed(() => !!assignment.value?.deadline && Date.now() > assignment.value.deadline)
const autoTotal = computed(() => assignment.value?.scoring.auto.reduce((a, b) => a + b, 0) ?? 0)
const manualTotal = computed(() => assignment.value?.scoring.manual.reduce((a, m) => a + m.points, 0) ?? 0)
/** 工具栏上的得分：老师评阅后显示总分，之前只显示自动评分 */
const scoreText = computed(() => {
  const s = submission.value
  if (!s) return ''
  if (s.status === 'pending') return '评分中…'
  if (s.status === 'error') return '评分出错'
  if (!review.value) return `自动评分 ${s.autoScore} / ${autoTotal.value}`
  const manual = review.value.scores.reduce<number>((a, x) => a + (x ?? 0), 0)
  return `总分 ${(s.autoScore ?? 0) + manual} / ${autoTotal.value + manualTotal.value}`
})
let pollTimer: ReturnType<typeof setTimeout> | undefined

async function loadAssignment(discardWork = false) {
  const detail = await api<{ assignment: Assignment; template: SourceFile[]; latest: Submission | null; review: Review | null }>(
    'GET',
    `/api/assignments/${props.assignmentId}`,
  ).catch((e: Error) => {
    message.error(e.message)
    return null
  })
  if (!detail) return
  assignment.value = detail.assignment
  submission.value = detail.latest
  review.value = detail.review
  if (detail.latest?.status === 'pending') pollSubmission()
  await openProject(`assignment:${props.assignmentId}`, async () => detail.template.map((f) => ({ ...f })), discardWork)
}

// ---------- 老师运行学生提交的程序 ----------
const viewing = ref<{ studentName: string; username: string; assignmentTitle: string } | null>(null)

async function loadSubmission() {
  try {
    const result = await api<{ files: SourceFile[]; studentName: string; username: string; assignmentTitle: string }>(
      'GET',
      `/api/teacher/submissions/${props.submissionId}`,
    )
    viewing.value = result
    files.value = result.files
    activeTab.value = forms.value[0]?.tab ?? files.value[0]?.path
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function submit() {
  if (!assignment.value || submitting.value) return
  submitting.value = true
  try {
    await flushSave()
    // 每个窗体截一张图，老师评阅和 AI 评"窗体界面"时用；截图失败也照常提交
    const screenshots = await captureForms(files.value).catch(() => [])
    submission.value = await api<Submission>('POST', `/api/assignments/${assignment.value.id}/submit`, { files: files.value, screenshots })
    resultOpen.value = true
    pollSubmission()
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    submitting.value = false
  }
}

/** 评分中时每 2 秒查一次结果 */
function pollSubmission() {
  clearTimeout(pollTimer)
  pollTimer = setTimeout(async () => {
    const latest = await api<Submission | null>('GET', `/api/assignments/${props.assignmentId}/submission`).catch(() => submission.value)
    submission.value = latest
    if (latest?.status === 'pending') pollSubmission()
  }, 2000)
}
onBeforeUnmount(() => clearTimeout(pollTimer))

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// ---------- 自动保存到服务器 ----------
/** idle：还没改过；pending：有改动等待保存；saving：正在保存；saved：已保存；error：保存失败（下次改动时重试） */
const saveState = ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
const SAVE_TEXT = { idle: '', pending: '未保存', saving: '保存中…', saved: '已保存', error: '保存失败，请检查网络' } as const
let saveTimer: ReturnType<typeof setTimeout> | undefined

function scheduleSave() {
  saveState.value = 'pending'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flushSave(), 1000)
}

/** 立即保存还没保存的改动（切换示例、离开页面之前） */
async function flushSave(keepalive = false) {
  clearTimeout(saveTimer)
  if (saveState.value !== 'pending' || !workKey.value) return
  saveState.value = 'saving'
  const snapshot = files.value.map((f) => ({ ...f }))
  try {
    await saveWork(workKey.value, snapshot, keepalive)
    // 保存期间又有改动时保持 pending，等下一次保存
    if (saveState.value === 'saving') saveState.value = 'saved'
  } catch {
    saveState.value = 'error'
  }
}

const onPageHide = () => void flushSave(true)
onMounted(() => window.addEventListener('pagehide', onPageHide))
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', onPageHide)
  void flushSave()
})

async function signOut() {
  await flushSave()
  await logout()
  await router.push('/login')
}

function updateFile(path: string, content: string) {
  const file = files.value.find((f) => f.path === path)
  if (!file || file.content === content) return
  file.content = content
  filesChanged()
}

function filesChanged() {
  modified.value = true
  // 老师试运行学生的提交时没有保存位置，不保存
  if (workKey.value) scheduleSave()
}

// ---------- 项目资源 ----------
void loadGallery()
const resourcesOpen = ref(false)
const resourceNames = computed(() => projectResources(files.value))
/** 设计器里图片属性的选项：项目资源里的图片（声音不能当图片用） */
const designerResources = computed(() => ({
  names: resourceNames.value.filter((name) => gallery.value.find((g) => g.name === name)?.kind !== 'audio'),
  prefix: resourcePrefix(projectNamespace(files.value)),
}))

/** 保存勾选的项目资源：重新生成 Properties/Resources.Designer.cs（一个都没有时删掉） */
function saveResources(names: string[]) {
  const file = resourcesFile(projectNamespace(files.value), names)
  const rest = files.value.filter((f) => f.path !== RESOURCES_FILE)
  files.value = file ? [...rest, file] : rest
  filesChanged()
}

// ---------- 新建、删除类 ----------
const newClassOpen = ref(false)
const newClassName = ref('')
const newClassError = computed(() => classPathError(files.value, newClassName.value))

function openNewClass(show: boolean) {
  newClassOpen.value = show
  if (show) newClassName.value = ''
}

/** 新建类：和 VS 的"添加 → 类"一样，可以带文件夹（SQLHelpers/SQLHelper） */
function createClass() {
  if (newClassError.value) return
  const created = newClassFile(projectNamespace(files.value), newClassName.value)
  files.value.push(created)
  filesChanged()
  newClassOpen.value = false
  activeTab.value = created.path
}

/** 当前标签页的普通类文件能否删除：窗体文件、Program.cs、平台生成的资源类不在这里删 */
const deletableClass = computed(() => {
  const path = activeTab.value
  if (!path || activeForm.value || path === 'Program.cs' || path.startsWith('Properties/') || !path.endsWith('.cs')) return undefined
  return forms.value.some((f) => f.code === path || f.designer === path) ? undefined : path
})

function deleteClass() {
  const path = deletableClass.value
  if (!path) return
  files.value = files.value.filter((f) => f.path !== path)
  filesChanged()
  activeTab.value = forms.value[0]?.tab ?? files.value[0]?.path
}

// ---------- 新建、删除窗体 ----------
const newFormOpen = ref(false)
const newFormName = ref('')
const newFormError = computed(() => {
  const name = newFormName.value.trim()
  if (!name) return '请输入窗体名'
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) return '只能用字母、汉字、数字、下划线，且不能以数字开头'
  if (formNameTaken(files.value, name)) return `已经有名为“${name}”的窗体或类`
  return null
})

function openNewForm(show: boolean) {
  newFormOpen.value = show
  if (show) newFormName.value = nextFormName(files.value)
}

/** 新建窗体：生成 X.cs 和 X.Designer.cs，打开它的设计器 */
function createForm() {
  if (newFormError.value) return
  const created = newFormFiles(projectNamespace(files.value), newFormName.value.trim())
  files.value.push(...created)
  filesChanged()
  newFormOpen.value = false
  activeTab.value = DESIGN + created[1].path
}

/** 当前设计器里的窗体能否删除：启动窗体（Program.cs 里 Application.Run 的那个）不能删 */
const deletableForm = computed(() => {
  const form = activeForm.value
  if (!form) return undefined
  const className = /partial\s+class\s+([\p{L}\p{N}_]+)/u.exec(fileText(form.designer))?.[1]
  return className && className !== startupForm(files.value) ? form : undefined
})

function deleteForm() {
  const form = deletableForm.value
  if (!form) return
  files.value = files.value.filter((f) => f.path !== form.designer && f.path !== form.code)
  designerHistory.clear(form.designer)
  filesChanged()
  activeTab.value = forms.value[0]?.tab ?? files.value[0]?.path
}

/** 设计器改动了 Designer.cs（以及插入事件处理方法时的代码文件） */
function onDesignerUpdate(designerText: string, codeText?: string) {
  const form = activeForm.value
  if (!form) return
  // 没有实际改动（如双击已绑定的事件，只是跳到代码）不记入历史
  const codeChanged = codeText !== undefined && codeText !== fileText(form.code)
  if (designerText === fileText(form.designer) && !codeChanged) return
  designerHistory.record(form.designer, {
    designerBefore: fileText(form.designer),
    designerAfter: designerText,
    ...(codeText !== undefined ? { codeBefore: fileText(form.code), codeAfter: codeText } : {}),
  })
  updateFile(form.designer, designerText)
  if (codeText !== undefined) updateFile(form.code, codeText)
}

/** 设计器里双击控件或事件：切到代码文件并跳到事件处理方法 */
async function openCode(line: number) {
  const form = activeForm.value
  if (!form) return
  activeTab.value = form.code
  await nextTick()
  editorRef.value?.reveal(form.code, line, 13)
}

async function showDiagnostic(file: string, line: number, column: number) {
  activeTab.value = file
  await nextTick()
  editorRef.value?.reveal(file, line, column)
}

function restoreOriginal() {
  if (props.assignmentId) void loadAssignment(true)
  else if (sampleId.value) void loadSample(sampleId.value, true)
}

function run() {
  if (running.value) return
  session.run(files.value.map((f) => ({ ...f })))
}
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <template v-if="viewing">
        <strong class="assignment-title">{{ viewing.studentName }}（{{ viewing.username }}）的提交：{{ viewing.assignmentTitle }}</strong>
        <span class="deadline">可以运行和试改，改动不会保存</span>
      </template>
      <template v-else-if="assignmentId">
        <RouterLink to="/assignments" class="nav-link">← 我的作业</RouterLink>
        <strong class="assignment-title">{{ assignment?.title }}</strong>
        <span v-if="assignment?.deadline" class="deadline" :class="{ past: pastDeadline }">
          {{ pastDeadline ? '已截止' : '截止' }} {{ formatTime(assignment.deadline) }}
        </span>
      </template>
      <template v-else>
        <strong>物联网编程仿真平台</strong>
        <NSelect
          class="sample-select"
          :value="sampleId"
          :options="samples"
          placeholder="选择示例工程"
          @update:value="loadSample"
        />
      </template>
      <NButton type="primary" :disabled="running" title="F5" @click="run">▶ 运行</NButton>
      <NButton :disabled="!running" title="Shift+F5" @click="session.stop">■ 停止</NButton>
      <template v-if="assignment">
        <NButton
          type="warning"
          :loading="submitting"
          :disabled="submission?.status === 'pending' || (pastDeadline && currentUser?.role === 'student')"
          title="提交后自动评分，截止前可以改了再交"
          @click="submit"
        >
          提交
        </NButton>
        <NButton v-if="submission" size="small" quaternary @click="resultOpen = true">
          {{ scoreText }}
        </NButton>
      </template>
      <NPopconfirm v-if="modified && !viewing" positive-text="恢复" negative-text="取消" @positive-click="restoreOriginal">
        <template #trigger>
          <NButton quaternary size="small">{{ assignmentId ? '恢复到作业起点' : '恢复原始代码' }}</NButton>
        </template>
        {{ assignmentId ? '你在这个作业上写的代码将全部丢弃（已提交的不受影响），确定恢复吗？' : '你对这个示例的修改将全部丢弃，确定恢复吗？' }}
      </NPopconfirm>
      <span v-if="!viewing" class="save-state" :class="saveState">{{ SAVE_TEXT[saveState] }}</span>
      <NTag :type="statusType">{{ STATUS_TEXT[state.status] }}</NTag>
      <span v-if="!assignmentId && !viewing" class="metrics">
        编译 {{ state.metrics.compileMs }} ms · 启动 {{ state.metrics.startMs }} ms · 最近一次操作往返
        {{ state.metrics.lastRoundTripMs }} ms
      </span>
      <span v-else class="spacer" />
      <RouterLink v-if="!assignmentId && currentUser?.role === 'student'" to="/assignments" class="nav-link">我的作业</RouterLink>
      <RouterLink v-if="!viewing" to="/database" target="_blank" class="nav-link" title="在新标签页打开数据库（代替 SSMS）">数据库</RouterLink>
      <span class="user">
        {{ currentUser?.name }}<template v-if="currentUser?.className">（{{ currentUser.className }}）</template>
      </span>
      <RouterLink v-if="currentUser?.role === 'teacher'" to="/teacher" class="nav-link">班级管理</RouterLink>
      <NButton quaternary size="small" @click="signOut">退出</NButton>
    </header>

    <NModal
      v-if="assignment && submission"
      v-model:show="resultOpen"
      preset="card"
      :title="`评分结果：${assignment.title}`"
      style="width: 560px; max-width: calc(100vw - 32px)"
    >
      <GradeResultView :assignment="assignment" :submission="submission" :review="review" />
    </NModal>

    <main class="workspace" :class="{ designing: activeForm }">
      <section class="editor">
        <div class="tab-row">
          <NTabs v-model:value="activeTab" type="card" size="small" class="file-tabs">
            <NTab v-for="tab in tabs" :key="tab.name" :name="tab.name">{{ tab.label }}</NTab>
          </NTabs>
          <NPopover trigger="click" placement="bottom-end" :show="newFormOpen" @update:show="openNewForm">
            <template #trigger>
              <NButton size="small" quaternary>＋ 新建窗体</NButton>
            </template>
            <div class="new-form">
              <div>窗体名（也是类名和文件名）</div>
              <NInput v-model:value="newFormName" size="small" @keydown.enter="createForm" />
              <div v-if="newFormError" class="new-form-error">{{ newFormError }}</div>
              <NButton size="small" type="primary" :disabled="!!newFormError" @click="createForm">创建</NButton>
            </div>
          </NPopover>
          <NPopover trigger="click" placement="bottom-end" :show="newClassOpen" @update:show="openNewClass">
            <template #trigger>
              <NButton size="small" quaternary>＋ 新建类</NButton>
            </template>
            <div class="new-form">
              <div>类名（也是文件名；放进文件夹时写成 SQLHelpers/SQLHelper）</div>
              <NInput v-model:value="newClassName" size="small" placeholder="例如：AppSet" @keydown.enter="createClass" />
              <div v-if="newClassError && newClassName.trim()" class="new-form-error">{{ newClassError }}</div>
              <NButton size="small" type="primary" :disabled="!!newClassError" @click="createClass">创建</NButton>
            </div>
          </NPopover>
          <NPopconfirm v-if="deletableClass" positive-text="删除" negative-text="取消" @positive-click="deleteClass">
            <template #trigger>
              <NButton size="small" quaternary>删除类</NButton>
            </template>
            将删除 {{ deletableClass }}，代码里用到它的地方需要自己修改。确定删除吗？
          </NPopconfirm>
          <NButton size="small" quaternary title="相当于 VS 的“项目属性 → 资源”：添加图片和声音，代码里用 Properties.Resources.名字" @click="resourcesOpen = true">
            项目资源{{ resourceNames.length ? `（${resourceNames.length}）` : '' }}
          </NButton>
          <NPopconfirm v-if="deletableForm" positive-text="删除" negative-text="取消" @positive-click="deleteForm">
            <template #trigger>
              <NButton size="small" quaternary>删除窗体</NButton>
            </template>
            将删除 {{ deletableForm.code }} 和 {{ deletableForm.designer }}，代码里用到这个窗体的地方需要自己修改。确定删除吗？
          </NPopconfirm>
        </div>
        <FormDesigner
          v-if="activeForm"
          class="code"
          :designer-text="fileText(activeForm.designer)"
          :code-text="fileText(activeForm.code)"
          :can-undo="designerHistory.canUndo(activeForm.designer)"
          :can-redo="designerHistory.canRedo(activeForm.designer)"
          @update="onDesignerUpdate"
          @undo="designerHistory.undo(activeForm.designer, activeForm.code)"
          @redo="designerHistory.redo(activeForm.designer, activeForm.code)"
          @open-code="openCode"
          @open-designer-file="activeTab = activeForm.designer"
          :resources="designerResources"
          @add-resource="resourcesOpen = true"
        />
        <ResourcesDialog v-model:show="resourcesOpen" :selected="resourceNames" @save="saveResources" />
        <CodeEditor
          v-show="!activeForm"
          ref="editorRef"
          class="code"
          :files="files"
          :active-file="activeFile"
          :diagnostics="state.diagnostics"
          @change="updateFile"
        />
      </section>

      <RunArea :session="session" @diagnostic="showDiagnostic" />
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

.sample-select {
  width: 240px;
}

.metrics {
  margin-left: auto;
  color: #6b7280;
  font-size: 12px;
}

.spacer {
  margin-left: auto;
}

.assignment-title {
  white-space: nowrap;
}

.deadline {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

.deadline.past {
  color: #dc2626;
}

.save-state {
  color: #6b7280;
  font-size: 12px;
}

.save-state.error {
  color: #dc2626;
}

.user {
  font-size: 13px;
  white-space: nowrap;
}

.nav-link {
  color: #2563eb;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(360px, 2fr) 3fr;
  min-height: 0;
}

/* 设计器需要工具箱、窗体和属性窗口，左栏放宽 */
.workspace.designing {
  grid-template-columns: minmax(0, 3fr) minmax(360px, 2fr);
}

.editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.code {
  flex: 1;
  min-height: 0;
}

.tab-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.file-tabs {
  flex: 1;
  min-width: 0;
}

.new-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 220px;
  font-size: 12px;
}

.new-form-error {
  color: #dc2626;
}
</style>

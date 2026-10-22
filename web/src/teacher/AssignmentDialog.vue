<script setup lang="ts">
// 布置作业 / 修改作业。布置时选实验、起点和截止时间，给每个评分项设分值；
// 起点工程由浏览器用设计器引擎从参考答案生成（界面已做好：去掉事件和代码；空白工程：只有空的 Form1）。
// 修改时只能改名称、截止时间和分值。
import { computed, ref, watch } from 'vue'
import { NButton, NDatePicker, NInput, NInputNumber, NModal, NRadio, NRadioGroup, NSelect, useMessage } from 'naive-ui'
import type { Assignment, Scoring, SourceFile, StartMode } from '@iot/shared'
import { api } from '../api'
import { assignmentTemplate } from '../designer/templates'

const props = defineProps<{ show: boolean; classId: number; editing: Assignment | null }>()
const emit = defineEmits<{ 'update:show': [show: boolean]; saved: [] }>()
const message = useMessage()

const DEFAULT_MANUAL = [
  { title: '窗体界面（布局合理、美观）', points: 10 },
  { title: '注释书写规范', points: 10 },
  { title: '变量与控件命名规范', points: 10 },
]

const samples = ref<{ label: string; value: string }[]>([])
const sampleId = ref<string | null>(null)
const title = ref('')
const startMode = ref<StartMode>('ui')
const deadline = ref<number | null>(null)
const checkTitles = ref<string[]>([])
const auto = ref<number[]>([])
const manual = ref<Scoring['manual']>([])
const saving = ref(false)

const total = computed(() => [...auto.value, ...manual.value.map((m) => m.points)].reduce((a, b) => a + (b || 0), 0))

watch(
  () => props.show,
  async (show) => {
    if (!show) return
    const e = props.editing
    if (e) {
      sampleId.value = e.sampleId
      title.value = e.title
      startMode.value = e.startMode
      deadline.value = e.deadline
      checkTitles.value = e.checkTitles
      auto.value = [...e.scoring.auto]
      manual.value = e.scoring.manual.map((m) => ({ ...m }))
      return
    }
    sampleId.value = null
    title.value = ''
    startMode.value = 'ui'
    deadline.value = null
    checkTitles.value = []
    auto.value = []
    manual.value = DEFAULT_MANUAL.map((m) => ({ ...m }))
    if (samples.value.length === 0) {
      const list = await api<{ id: string; title: string }[]>('GET', '/api/samples')
      samples.value = list.map((s) => ({ label: s.title, value: s.id }))
    }
  },
)

async function chooseSample(id: string) {
  sampleId.value = id
  title.value = samples.value.find((s) => s.value === id)?.label ?? ''
  try {
    checkTitles.value = await api<string[]>('GET', `/api/teacher/samples/${encodeURIComponent(id)}/checks`)
    auto.value = checkTitles.value.map(() => 10)
  } catch (e) {
    checkTitles.value = []
    auto.value = []
    message.error((e as Error).message)
  }
}

async function save() {
  if (!sampleId.value || saving.value) return
  saving.value = true
  const scoring: Scoring = { auto: auto.value.map((p) => p || 0), manual: manual.value.map((m) => ({ title: m.title.trim(), points: m.points || 0 })) }
  try {
    if (props.editing) {
      await api('PATCH', `/api/teacher/assignments/${props.editing.id}`, { title: title.value, deadline: deadline.value, scoring })
    } else {
      const files = await api<SourceFile[]>('GET', `/api/samples/${encodeURIComponent(sampleId.value)}`)
      await api('POST', '/api/teacher/assignments', {
        classId: props.classId,
        sampleId: sampleId.value,
        title: title.value,
        startMode: startMode.value,
        template: assignmentTemplate(files, startMode.value),
        scoring,
        deadline: deadline.value,
      })
    }
    emit('saved')
    emit('update:show', false)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="editing ? '修改作业' : '布置作业'"
    style="width: 620px; max-width: calc(100vw - 32px)"
    @update:show="emit('update:show', $event)"
  >
    <div class="form">
      <label>实验</label>
      <NSelect :value="sampleId" :options="samples" :disabled="!!editing" placeholder="选择实验" @update:value="chooseSample" />

      <label>作业名称</label>
      <NInput v-model:value="title" placeholder="学生看到的作业名称" />

      <label>学生的起点</label>
      <NRadioGroup v-model:value="startMode" :disabled="!!editing">
        <NRadio value="ui">界面已做好（只写事件和代码）</NRadio>
        <NRadio value="blank">空白工程（从搭界面做起）</NRadio>
      </NRadioGroup>

      <label>截止时间</label>
      <NDatePicker v-model:value="deadline" type="datetime" clearable placeholder="不限" format="yyyy-MM-dd HH:mm" />

      <template v-if="checkTitles.length">
        <label>自动评分</label>
        <div class="points">
          <div v-for="(t, i) in checkTitles" :key="i" class="point-row">
            <span class="point-title">{{ t }}</span>
            <NInputNumber v-model:value="auto[i]" :min="0" size="small" class="point-input" />
            <span>分</span>
          </div>
        </div>
      </template>

      <label>老师评分</label>
      <div class="points">
        <div v-for="(m, i) in manual" :key="i" class="point-row">
          <NInput v-model:value="m.title" size="small" class="point-title" />
          <NInputNumber v-model:value="m.points" :min="0" size="small" class="point-input" />
          <span>分</span>
          <NButton size="tiny" quaternary @click="manual.splice(i, 1)">删除</NButton>
        </div>
        <NButton size="small" dashed @click="manual.push({ title: '', points: 10 })">＋ 添加老师评分项</NButton>
      </div>
    </div>
    <template #footer>
      <div class="footer">
        <span class="total">总分 {{ total }} 分</span>
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="saving" :disabled="!sampleId || !title.trim()" @click="save">
          {{ editing ? '保存' : '布置' }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.form {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.form label {
  color: #4b5563;
  font-size: 13px;
  align-self: start;
  padding-top: 6px;
}

.points {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.point-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.point-title {
  flex: 1;
  font-size: 13px;
}

.point-input {
  width: 90px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.total {
  margin-right: auto;
  color: #4b5563;
}
</style>

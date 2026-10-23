<script setup lang="ts">
// 日期时间选择器：文字由运行器按 Format 生成（如 2024年1月16日），点下拉按钮弹出浏览器的日期 / 时间选择框，
// 选好后把完整的日期时间发给运行器（只选日期时保留原来的时间，和 WinForms 一样）。
import { computed, ref, type CSSProperties } from 'vue'
import type { ControlNode, UserAction } from '@iot/shared'

const props = defineProps<{
  node: ControlNode
  style: CSSProperties
  enabled: boolean
  act: (action: UserAction) => void
}>()

const p = computed(() => props.node.props)
const value = computed(() => String(p.value.Value ?? '2000-01-01T00:00:00'))
const hasDate = computed(() => p.value.HasDate !== false)
const hasTime = computed(() => p.value.HasTime === true)
const inputType = computed(() => (hasDate.value && hasTime.value ? 'datetime-local' : hasTime.value ? 'time' : 'date'))
const nativeValue = computed(() => {
  const [date, time] = value.value.split('T')
  return inputType.value === 'date' ? date : inputType.value === 'time' ? time : value.value
})
const picker = ref<HTMLInputElement>()

function open() {
  if (!props.enabled) return
  props.act({ action: 'dropDown' })
  picker.value?.showPicker?.()
}

function pick(event: Event) {
  const picked = (event.target as HTMLInputElement).value
  if (!picked) return
  const [date, time] = value.value.split('T')
  const withSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t)
  const next =
    inputType.value === 'date' ? `${picked}T${time}` : inputType.value === 'time' ? `${date}T${withSeconds(picked)}` : withSeconds(picked)
  props.act({ action: 'pick', value: next })
}

/** ShowUpDown 的上下箭头：日期格式按天、时间格式按分钟调整 */
function step(delta: number) {
  if (!props.enabled) return
  const d = new Date(value.value)
  if (hasTime.value && !hasDate.value) d.setMinutes(d.getMinutes() + delta)
  else d.setDate(d.getDate() + delta)
  const pad = (n: number) => String(n).padStart(2, '0')
  props.act({
    action: 'pick',
    value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  })
}
</script>

<template>
  <div class="wf-control wf-dtp" :class="{ 'wf-disabled': !enabled }" :style="style">
    <span class="wf-dtp-text">{{ p.Text }}</span>
    <span v-if="p.ShowUpDown" class="wf-dtp-spin">
      <span @mousedown.prevent="step(1)">▴</span>
      <span @mousedown.prevent="step(-1)">▾</span>
    </span>
    <span v-else class="wf-dtp-button" title="选择日期" @mousedown.prevent="open">▾</span>
    <input ref="picker" class="wf-dtp-native" :type="inputType" step="1" :value="nativeValue" tabindex="-1" @change="pick" />
  </div>
</template>

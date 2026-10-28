<script setup lang="ts">
// 日期时间选择器：文字由运行器按 Format 生成（如 2024年1月16日），点下拉按钮弹出浏览器的日期 / 时间选择框，
// 选好后把完整的日期时间发给运行器（只选日期时保留原来的时间，和 WinForms 一样）。
// 下拉按钮上透明地盖着浏览器的日期框（日历图标撑满按钮），点按钮其实点的是日期框自己的图标，由浏览器弹出选择框。
// 不用 showPicker()：它 Chrome 99 才正式有，机房 Chrome 94 的原型上虽然有这个方法，调用却没有反应。
import { computed, type CSSProperties } from 'vue'
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
/** 点的是盖在按钮上的日期框：告诉运行器"展开了"（触发 DropDown），弹出由浏览器负责 */
function nativeDown() {
  if (props.enabled) props.act({ action: 'dropDown' })
}

function pick(event: Event) {
  const picked = (event.target as HTMLInputElement).value
  if (!picked) return
  const [date, time] = value.value.split('T')
  const withSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t)
  const next = inputType.value === 'date' ? `${picked}T${time}` : inputType.value === 'time' ? `${date}T${withSeconds(picked)}` : withSeconds(picked)
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
    <span v-else class="wf-dtp-button">▾</span>
    <input
      class="wf-dtp-native"
      :class="{ 'wf-dtp-overlay': !p.ShowUpDown }"
      title="选择日期"
      :type="inputType"
      step="1"
      :value="nativeValue"
      :disabled="!enabled"
      tabindex="-1"
      @mousedown="nativeDown"
      @change="pick"
    />
  </div>
</template>

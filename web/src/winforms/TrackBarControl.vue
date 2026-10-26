<script setup lang="ts">
// 滑动条（仿 Windows 10 的 TrackBar）：拖动滑块、点轨道（按 LargeChange 靠近）、方向键（按 SmallChange）改变值，
// 新值发给运行器，由运行器决定最终的 Value（并触发 ValueChanged、Scroll）。竖向时最小值在下面，和 WinForms 一样。
import { computed, ref, type CSSProperties } from 'vue'
import type { ControlNode, UserAction } from '@iot/shared'

const props = defineProps<{
  node: ControlNode
  style: CSSProperties
  enabled: boolean
  act: (action: UserAction) => void
}>()

/** 轨道两端留出的距离（滑块半宽 + 边距），和 WinForms 差不多 */
const PAD = 13

const p = computed(() => props.node.props)
const min = computed(() => Number(p.value.Minimum ?? 0))
const max = computed(() => Number(p.value.Maximum ?? 10))
const value = computed(() => Number(p.value.Value ?? 0))
const vertical = computed(() => p.value.Orientation === 'Vertical')
const tickStyle = computed(() => String(p.value.TickStyle ?? 'BottomRight'))
const size = computed(() => p.value.Size as { width: number; height: number } | undefined)
/** 轨道方向上的长度 */
const length = computed(() => (vertical.value ? (size.value?.height ?? 104) : (size.value?.width ?? 104)))

/** 值 → 沿轨道的位置（像素）；竖向时最小值在下面 */
function position(v: number) {
  const ratio = max.value === min.value ? 0 : (v - min.value) / (max.value - min.value)
  const along = PAD + ratio * (length.value - 2 * PAD)
  return vertical.value ? length.value - along : along
}

const ticks = computed(() => {
  const frequency = Math.max(1, Number(p.value.TickFrequency ?? 1))
  const list: number[] = []
  for (let v = min.value; v <= max.value && list.length < 200; v += frequency) list.push(v)
  if (list.at(-1) !== max.value) list.push(max.value)
  return list
})

const root = ref<HTMLDivElement>()
let dragging = false

function valueAt(event: PointerEvent) {
  const rect = root.value!.getBoundingClientRect()
  const along = vertical.value ? rect.bottom - event.clientY : event.clientX - rect.left
  const ratio = Math.min(1, Math.max(0, (along - PAD) / (length.value - 2 * PAD)))
  return Math.round(min.value + ratio * (max.value - min.value))
}

function send(next: number) {
  const clamped = Math.min(max.value, Math.max(min.value, next))
  if (clamped !== value.value) props.act({ action: 'scroll', value: String(clamped) })
}

function down(event: PointerEvent) {
  if (!props.enabled) return
  root.value?.focus()
  const target = event.target as HTMLElement
  if (target.classList.contains('wf-trackbar-thumb')) {
    dragging = true
    root.value!.setPointerCapture(event.pointerId)
    return
  }
  // 点轨道：向点击的位置移动一个 LargeChange
  const large = Number(p.value.LargeChange ?? 5)
  send(value.value + (valueAt(event) > value.value ? large : -large))
}

function move(event: PointerEvent) {
  if (dragging) send(valueAt(event))
}

function up() {
  dragging = false
}

function key(event: KeyboardEvent) {
  if (!props.enabled) return
  const small = Number(p.value.SmallChange ?? 1)
  const large = Number(p.value.LargeChange ?? 5)
  const delta: Record<string, number> = { ArrowRight: small, ArrowUp: small, ArrowLeft: -small, ArrowDown: -small, PageUp: large, PageDown: -large }
  if (event.key in delta) send(value.value + delta[event.key])
  else if (event.key === 'Home') send(min.value)
  else if (event.key === 'End') send(max.value)
  else return
  event.preventDefault()
}

const thumbStyle = computed((): CSSProperties => (vertical.value ? { top: `${position(value.value) - 5}px` } : { left: `${position(value.value) - 5}px` }))
/** 刻度：滑块下方（BottomRight）或上方（TopLeft），两端的刻度长一点 */
const tickStyleOf = (v: number, side: 'a' | 'b'): CSSProperties => {
  const extent = v === min.value || v === max.value ? '5px' : '3px'
  const offset = side === 'a' ? '0px' : '28px'
  return vertical.value ? { top: `${position(v)}px`, left: offset, width: extent } : { left: `${position(v)}px`, top: offset, height: extent }
}
</script>

<template>
  <div
    ref="root"
    class="wf-control wf-trackbar"
    :class="{ 'wf-trackbar-vertical': vertical, 'wf-disabled': !enabled }"
    :style="style"
    tabindex="0"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @keydown="key"
  >
    <div class="wf-trackbar-track" :style="vertical ? { top: `${PAD}px`, bottom: `${PAD}px` } : { left: `${PAD}px`, right: `${PAD}px` }" />
    <template v-if="tickStyle === 'TopLeft' || tickStyle === 'Both'">
      <span v-for="v in ticks" :key="`a${v}`" class="wf-trackbar-tick" :style="tickStyleOf(v, 'a')" />
    </template>
    <template v-if="tickStyle === 'BottomRight' || tickStyle === 'Both'">
      <span v-for="v in ticks" :key="`b${v}`" class="wf-trackbar-tick" :style="tickStyleOf(v, 'b')" />
    </template>
    <span class="wf-trackbar-thumb" :style="thumbStyle" />
  </div>
</template>

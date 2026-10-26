<script lang="ts">
let topZ = 1
const nextZ = () => ++topZ

/** 第一个窗体离桌面左上角的距离，之后每个窗体错开的距离 */
export const WINDOW_MARGIN = 24
export const WINDOW_STEP = 32
</script>

<script setup lang="ts">
// 一个 WinForms 窗体：标题栏 + 客户区。窗体可以拖动标题栏移动。
import { computed, inject, provide, ref } from 'vue'
import type { ControlNode, UserAction } from '@iot/shared'
import ControlView from './ControlView.vue'
import { AMBIENT_BACK_COLOR, DEFAULT_BACK_COLOR, displayText, fontCss, type FontValue, type SizeValue } from './format'
import { backgroundCss, RUN_IMAGES } from './images'

const props = defineProps<{
  form: ControlNode
  modal: boolean
  offset: number
  /** 桌面的缩放比例（窗体太大时整体缩小），拖动时把鼠标移动的距离换算回去 */
  scale: number
  act: (id: string, action: UserAction) => void
}>()

const p = computed(() => props.form.props)
const runImages = inject(RUN_IMAGES, new Map<string, string>())
provide(
  AMBIENT_BACK_COLOR,
  computed(() => (p.value.BackColor as string | null) ?? DEFAULT_BACK_COLOR),
)
const borderless = computed(() => p.value.FormBorderStyle === 'None')
// WinForms 中先加入 Controls 的控件在最上层，所以倒序渲染
const childrenTopLast = computed(() => [...props.form.children].reverse())
const clientSize = computed(() => (p.value.ClientSize as SizeValue | undefined) ?? { width: 300, height: 300 })

const position = ref({ x: WINDOW_MARGIN + props.offset * WINDOW_STEP, y: WINDOW_MARGIN + props.offset * WINDOW_STEP })

// 点哪个窗口，哪个窗口到最前面（所有窗体共用一个递增的层级）
const zIndex = ref(nextZ())
function activate() {
  zIndex.value = nextZ()
}
let dragStart: { x: number; y: number; px: number; py: number } | undefined

function startDrag(event: PointerEvent) {
  dragStart = { x: event.clientX, y: event.clientY, px: position.value.x, py: position.value.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragStart) return
  position.value = { x: dragStart.px + (event.clientX - dragStart.x) / props.scale, y: dragStart.py + (event.clientY - dragStart.y) / props.scale }
}

function close() {
  props.act(props.form.id, { action: 'close' })
}
</script>

<template>
  <div
    v-show="p.Visible !== false"
    class="wf-window"
    :class="{ 'wf-window-modal': modal }"
    :style="{ left: `${position.x}px`, top: `${position.y}px`, zIndex: modal ? undefined : zIndex }"
    @pointerdown.capture="activate"
  >
    <div v-if="!borderless" class="wf-titlebar" @pointerdown="startDrag" @pointermove="drag" @pointerup="dragStart = undefined">
      <span class="wf-title">{{ displayText(p.Text) }}</span>
      <span v-if="p.MinimizeBox !== false" class="wf-titlebar-button">─</span>
      <span v-if="p.MaximizeBox !== false" class="wf-titlebar-button">☐</span>
      <span class="wf-titlebar-button wf-titlebar-close" @pointerdown.stop @click="close">✕</span>
    </div>
    <div
      class="wf-client"
      :style="{
        width: `${clientSize.width}px`,
        height: `${clientSize.height}px`,
        color: (p.ForeColor as string | null) ?? undefined,
        backgroundColor: (p.BackColor as string | null) ?? undefined,
        ...fontCss(p.Font as FontValue | null),
        ...backgroundCss(p.BackgroundImage, p.BackgroundImageLayout, runImages),
      }"
    >
      <ControlView v-for="child in childrenTopLast" :key="child.id" :node="child" :act="act" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 一个 WinForms 窗体：标题栏 + 客户区。窗体可以拖动标题栏移动。
import { computed, ref } from 'vue'
import type { ControlNode, UserAction } from '@iot/shared'
import ControlView from './ControlView.vue'
import { displayText, fontCss, type FontValue, type SizeValue } from './format'

const props = defineProps<{
  form: ControlNode
  modal: boolean
  offset: number
  act: (id: string, action: UserAction) => void
}>()

const p = computed(() => props.form.props)
const borderless = computed(() => p.value.FormBorderStyle === 'None')
// WinForms 中先加入 Controls 的控件在最上层，所以倒序渲染
const childrenTopLast = computed(() => [...props.form.children].reverse())
const clientSize = computed(() => (p.value.ClientSize as SizeValue | undefined) ?? { width: 300, height: 300 })

const position = ref({ x: 24 + props.offset * 32, y: 24 + props.offset * 32 })
let dragStart: { x: number; y: number; px: number; py: number } | undefined

function startDrag(event: PointerEvent) {
  dragStart = { x: event.clientX, y: event.clientY, px: position.value.x, py: position.value.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragStart) return
  position.value = { x: dragStart.px + event.clientX - dragStart.x, y: dragStart.py + event.clientY - dragStart.y }
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
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
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
      }"
    >
      <ControlView v-for="child in childrenTopLast" :key="child.id" :node="child" :act="act" />
    </div>
  </div>
</template>

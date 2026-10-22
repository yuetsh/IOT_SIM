<script setup lang="ts">
// MessageBox.Show 弹出的对话框。按钮结果回传给运行器，学生代码里的 Show() 才会返回。
import { computed } from 'vue'
import type { PendingMessageBox } from '../run/session'

const props = defineProps<{ box: PendingMessageBox }>()
const emit = defineEmits<{ reply: [result: string] }>()

const BUTTONS: Record<string, [string, string][]> = {
  OK: [['OK', '确定']],
  OKCancel: [['OK', '确定'], ['Cancel', '取消']],
  YesNo: [['Yes', '是(Y)'], ['No', '否(N)']],
  YesNoCancel: [['Yes', '是(Y)'], ['No', '否(N)'], ['Cancel', '取消']],
  RetryCancel: [['Retry', '重试(R)'], ['Cancel', '取消']],
  AbortRetryIgnore: [['Abort', '中止(A)'], ['Retry', '重试(R)'], ['Ignore', '忽略(I)']],
}
const ICONS: Record<string, string> = { Error: '⛔', Hand: '⛔', Stop: '⛔', Warning: '⚠️', Exclamation: '⚠️', Information: 'ℹ️', Asterisk: 'ℹ️', Question: '❓' }

const buttons = computed(() => BUTTONS[props.box.buttons] ?? BUTTONS.OK)
const icon = computed(() => ICONS[props.box.icon])
</script>

<template>
  <div class="wf-modal-backdrop">
    <div class="wf-window wf-messagebox">
      <div class="wf-titlebar">
        <span class="wf-title">{{ box.caption }}</span>
        <span class="wf-titlebar-button wf-titlebar-close" @click="emit('reply', 'Cancel')">✕</span>
      </div>
      <div class="wf-messagebox-body">
        <span v-if="icon" class="wf-messagebox-icon">{{ icon }}</span>
        <span class="wf-messagebox-text">{{ box.text }}</span>
      </div>
      <div class="wf-messagebox-buttons">
        <button v-for="[result, label] in buttons" :key="result" class="wf-button" @click="emit('reply', result)">
          {{ label }}
        </button>
      </div>
    </div>
  </div>
</template>

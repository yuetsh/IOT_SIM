<script setup lang="ts">
// 按控件类型渲染一个 WinForms 控件及其子控件。
// 用户操作只通过 act() 上报，由运行器按真实 WinForms 的顺序触发事件。
import { computed, ref } from 'vue'
import type { ControlNode, UserAction } from '@iot/shared'
import { boxCss, displayText } from './format'
import LedControl from './LedControl.vue'

const props = defineProps<{
  node: ControlNode
  act: (id: string, action: UserAction) => void
}>()

const p = computed(() => props.node.props)
// WinForms 中先加入 Controls 的控件在最上层，所以倒序渲染（后渲染的 DOM 元素在上面）
const childrenTopLast = computed(() => [...props.node.children].reverse())
const enabled = computed(() => p.value.Enabled !== false)
const style = computed(() => boxCss(p.value, props.node.type === 'Label' && p.value.AutoSize === true))

function act(action: UserAction) {
  if (enabled.value) props.act(props.node.id, action)
}

// TextBox
const passwordChar = computed(() => {
  if (p.value.UseSystemPasswordChar) return '●'
  const ch = p.value.PasswordChar as string | undefined
  return ch && ch !== '\0' ? ch : ''
})

// ComboBox
const dropDownOpen = ref(false)
const items = computed(() => (p.value.Items as string[] | undefined) ?? [])
const editable = computed(() => p.value.DropDownStyle !== 'DropDownList')

function openDropDown() {
  if (!enabled.value) return
  if (dropDownOpen.value) {
    dropDownOpen.value = false
    return
  }
  // 先触发 Click（教材在 Click 里填充串口列表），列表随后按最新的 Items 显示
  act({ action: 'dropDown' })
  dropDownOpen.value = true
}

function selectItem(index: number) {
  dropDownOpen.value = false
  act({ action: 'select', index })
}
</script>

<template>
  <!-- Button -->
  <button
    v-if="node.type === 'Button'"
    class="wf-control wf-button"
    :style="style"
    :disabled="!enabled"
    @click="act({ action: 'click' })"
  >
    {{ displayText(p.Text) }}
  </button>

  <!-- Label -->
  <div
    v-else-if="node.type === 'Label'"
    class="wf-control wf-label"
    :class="{ 'wf-autosize': p.AutoSize === true, 'wf-disabled': !enabled }"
    :style="style"
    @click="act({ action: 'click' })"
  >
    {{ displayText(p.Text) }}
  </div>

  <!-- TextBox -->
  <div v-else-if="node.type === 'TextBox'" class="wf-control wf-textbox" :style="style">
    <textarea
      v-if="p.Multiline"
      :value="String(p.Text ?? '')"
      :readonly="p.ReadOnly === true"
      :disabled="!enabled"
      @input="act({ action: 'text', value: ($event.target as HTMLTextAreaElement).value })"
    />
    <input
      v-else
      :type="passwordChar ? 'password' : 'text'"
      :value="String(p.Text ?? '')"
      :readonly="p.ReadOnly === true"
      :disabled="!enabled"
      @input="act({ action: 'text', value: ($event.target as HTMLInputElement).value })"
    />
  </div>

  <!-- ComboBox -->
  <div v-else-if="node.type === 'ComboBox'" class="wf-control wf-combobox" :style="style">
    <input
      :value="String(p.Text ?? '')"
      :readonly="!editable"
      :disabled="!enabled"
      @mousedown="!editable && openDropDown()"
      @input="act({ action: 'text', value: ($event.target as HTMLInputElement).value })"
    />
    <span class="wf-combobox-arrow" @mousedown.prevent="openDropDown">▾</span>
    <ul v-if="dropDownOpen" class="wf-combobox-list">
      <li v-for="(item, index) in items" :key="index" @mousedown.prevent="selectItem(index)">{{ item }}</li>
      <li v-if="items.length === 0" class="wf-combobox-empty">&nbsp;</li>
    </ul>
  </div>

  <!-- CheckBox / RadioButton：自绘勾选框，状态完全由运行器决定（点击只上报，不在浏览器里自行切换） -->
  <div
    v-else-if="node.type === 'CheckBox' || node.type === 'RadioButton'"
    class="wf-control wf-check"
    :class="{ 'wf-disabled': !enabled, 'wf-autosize': p.AutoSize === true }"
    :style="style"
    @click="act({ action: 'click' })"
  >
    <span :class="node.type === 'CheckBox' ? 'wf-checkbox-box' : 'wf-radio-dot'" :data-checked="p.Checked === true" />
    <span class="wf-check-text">{{ displayText(p.Text) }}</span>
  </div>

  <!-- 教材控件库：灯泡、报警灯（图片沿用教材控件库） -->
  <div v-else-if="node.type === 'WinFormsDeviceControlLibrary.Lamp'" class="wf-control wf-device-image" :style="style">
    <img :src="p.IsOn ? '/devices/LampOn.png' : '/devices/LampOff.png'" alt="" draggable="false" />
  </div>
  <div v-else-if="node.type === 'WinFormsDeviceControlLibrary.Alarm'" class="wf-control wf-device-image" :style="style">
    <img :src="p.IsOn ? '/devices/AlarmOn.jpg' : '/devices/AlarmOff.jpg'" alt="" draggable="false" />
  </div>

  <!-- GroupBox -->
  <div v-else-if="node.type === 'GroupBox'" class="wf-control wf-groupbox" :style="style">
    <div class="wf-groupbox-frame" />
    <span v-if="p.Text" class="wf-groupbox-caption">{{ displayText(p.Text) }}</span>
    <ControlView v-for="child in childrenTopLast" :key="child.id" :node="child" :act="props.act" />
  </div>

  <!-- 教材控件库：LED 显示屏 -->
  <LedControl
    v-else-if="node.type === 'WinFormsDeviceControlLibrary.LED'"
    :node="node"
    :style="style"
  />

  <!-- 其他容器（Panel、UserControl 等）：按普通容器渲染 -->
  <div v-else class="wf-control wf-panel" :style="style" :title="node.type">
    <ControlView v-for="child in childrenTopLast" :key="child.id" :node="child" :act="props.act" />
  </div>
</template>

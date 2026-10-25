<script setup lang="ts">
// 按控件类型渲染一个 WinForms 控件及其子控件。
// 用户操作只通过 act() 上报，由运行器按真实 WinForms 的顺序触发事件。
import { computed, inject, provide, ref, type CSSProperties } from 'vue'
import type { ControlNode, UserAction } from '@iot/shared'
import { AMBIENT_BACK_COLOR, AMBIENT_BACK_TYPES, boxCss, DEFAULT_BACK_COLOR, displayText } from './format'
import { backgroundCss, imageSources, RUN_IMAGES, srcset, type ImageValue } from './images'
import ChartControl from './ChartControl.vue'
import DataGridViewControl from './DataGridViewControl.vue'
import DateTimePickerControl from './DateTimePickerControl.vue'
import LedControl from './LedControl.vue'
import TrackBarControl from './TrackBarControl.vue'

const props = defineProps<{
  node: ControlNode
  act: (id: string, action: UserAction) => void
}>()

const p = computed(() => props.node.props)
// WinForms 中先加入 Controls 的控件在最上层，所以倒序渲染（后渲染的 DOM 元素在上面）
const childrenTopLast = computed(() => [...props.node.children].reverse())
const enabled = computed(() => p.value.Enabled !== false)
const runImages = inject(RUN_IMAGES, new Map<string, string>())
const ambient = inject(AMBIENT_BACK_COLOR, ref(DEFAULT_BACK_COLOR))
/** 这个控件实际的背景色，子控件没设置背景色时沿用 */
const backColor = computed(() => (p.value.BackColor as string | null) ?? ambient.value)
provide(AMBIENT_BACK_COLOR, backColor)
const style = computed(() => ({
  ...boxCss(p.value, props.node.type === 'Label' && p.value.AutoSize === true),
  ...(AMBIENT_BACK_TYPES.has(props.node.type) ? { backgroundColor: backColor.value } : {}),
  ...backgroundCss(p.value.BackgroundImage, p.value.BackgroundImageLayout, runImages),
}))

function act(action: UserAction) {
  if (enabled.value) props.act(props.node.id, action)
}

/** 鼠标按下、松开（教材项目 8 的方向键图片：按下转动摄像机、换成按下的图片） */
function mouse(kind: 'mouseDown' | 'mouseUp', event: PointerEvent) {
  if (event.target !== event.currentTarget && !(event.target as HTMLElement).matches('img')) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  act({ action: kind, button: event.button === 2 ? 'right' : 'left', x: Math.round(event.clientX - rect.left), y: Math.round(event.clientY - rect.top) })
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

// PictureBox：按 SizeMode 摆放图片
const image = computed(() => p.value.Image as ImageValue | null | undefined)
const imageSrc = computed(() => imageSources(image.value, runImages))
// 设计器预览里不知道素材的尺寸，原样大小显示时让浏览器按图片本身的大小
const naturalSize = computed(() => (image.value?.width ? { width: `${image.value.width}px`, height: `${image.value.height}px` } : {}))
const imageStyle = computed((): CSSProperties => {
  const natural = naturalSize.value
  switch (p.value.SizeMode) {
    case 'StretchImage':
      return { width: '100%', height: '100%', objectFit: 'fill' }
    case 'Zoom':
      return { width: '100%', height: '100%', objectFit: 'contain' }
    case 'CenterImage':
      return { ...natural, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
    default:
      return natural
  }
})

// ListBox
const itemHeight = computed(() => `${(p.value.ItemHeight as number | undefined) ?? 12}px`)
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

  <!-- ListBox：点空白处只触发 Click，点某一项先选中再触发 Click -->
  <div
    v-else-if="node.type === 'ListBox'"
    class="wf-control wf-listbox"
    :class="[`wf-listbox-border-${p.BorderStyle ?? 'Fixed3D'}`, { 'wf-disabled': !enabled }]"
    :style="style"
    @click.self="act({ action: 'click' })"
  >
    <div
      v-for="(item, index) in items"
      :key="index"
      class="wf-listbox-item"
      :class="{ 'wf-listbox-selected': index === p.SelectedIndex }"
      :style="{ height: itemHeight, lineHeight: itemHeight }"
      @click="act({ action: 'select', index })"
      @dblclick="act({ action: 'doubleClick' })"
    >
      {{ item }}
    </div>
  </div>

  <!-- PictureBox -->
  <div
    v-else-if="node.type === 'PictureBox'"
    class="wf-control wf-picturebox"
    :class="`wf-picturebox-border-${p.BorderStyle ?? 'None'}`"
    :style="style"
    @click="act({ action: 'click' })"
    @pointerdown="mouse('mouseDown', $event)"
    @pointerup="mouse('mouseUp', $event)"
  >
    <img v-if="imageSrc" :src="imageSrc.src" :srcset="srcset(imageSrc)" :style="imageStyle" alt="" draggable="false" />
    <ControlView v-for="child in childrenTopLast" :key="child.id" :node="child" :act="props.act" />
  </div>

  <DataGridViewControl v-else-if="node.type === 'DataGridView'" :node="node" :style="style" :enabled="enabled" :act="act" />

  <DateTimePickerControl v-else-if="node.type === 'DateTimePicker'" :node="node" :style="style" :enabled="enabled" :act="act" />

  <ChartControl v-else-if="node.type === 'Chart'" :node="node" :style="style" />

  <TrackBarControl v-else-if="node.type === 'TrackBar'" :node="node" :style="style" :enabled="enabled" :act="act" />

  <!-- Windows Media Player（教材里通常设为不可见，只用来播放声音） -->
  <div v-else-if="node.type === 'AxWindowsMediaPlayer'" class="wf-control wf-wmp" :style="style">
    <div class="wf-wmp-screen">Windows Media Player</div>
    <div class="wf-wmp-bar"><span>▶</span><span>■</span><span class="wf-wmp-progress" /></div>
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

  <!-- 教材控件库：灯泡、报警灯（自绘图片，尺寸与教材控件一致） -->
  <div v-else-if="node.type === 'WinFormsDeviceControlLibrary.Lamp'" class="wf-control wf-device-image" :style="style">
    <img :src="p.IsOn ? '/devices/lamp-on.svg' : '/devices/lamp-off.svg'" alt="" draggable="false" />
  </div>
  <div v-else-if="node.type === 'WinFormsDeviceControlLibrary.Alarm'" class="wf-control wf-device-image" :style="style">
    <img :src="p.IsOn ? '/devices/alarm-on.svg' : '/devices/alarm-off.svg'" alt="" draggable="false" />
  </div>

  <!-- GroupBox -->
  <div v-else-if="node.type === 'GroupBox'" class="wf-control wf-groupbox" :style="style">
    <!-- 标题处的边框断开、透出底下的背景（教材项目 8 的分组框放在背景图上，白色标题） -->
    <fieldset class="wf-groupbox-frame">
      <legend v-if="p.Text" class="wf-groupbox-caption">{{ displayText(p.Text) }}</legend>
    </fieldset>
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

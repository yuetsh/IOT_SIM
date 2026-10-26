<script setup lang="ts">
// 属性窗口和事件窗口（仿 VS）：显示选中控件的常用属性；改动立即写回 Designer.cs。
import { computed, ref, watch } from 'vue'
import { type ControlDef, FORM_DEF, type PropDef, controlDef } from './catalog'
import { type ChartModel, readChart } from './chart'
import ChartDialog from './ChartDialog.vue'
import type { DesignerDocument } from './document'
import { checkName, getEventHandler, getItems, getPropText, typeOf } from './edit'
import { resourceNameOf } from './resources'
import { NAMED_COLORS, hexToRgb, parseValue, rgb, type Value } from './values'

const props = defineProps<{
  doc: DesignerDocument
  /** '' 表示窗体本身 */
  selected: string
  /** 项目资源（图片属性从这里选）和引用资源的前缀 global::命名空间.Properties.Resources. */
  resources?: { names: string[]; prefix: string }
  /** 窗体改名时检查新名字和工程里其他窗体、类有没有重名（没有问题返回 null） */
  checkFormName?: (name: string) => string | null
}>()

const emit = defineEmits<{
  setProp: [target: string, path: string, value: Value | null]
  setItems: [target: string, items: string[]]
  rename: [from: string, to: string]
  /** 窗体本身改名：类名和文件名一起改 */
  renameForm: [to: string]
  /** 双击事件或点"生成"：绑定（必要时生成）事件处理方法并跳到代码 */
  openEvent: [target: string, event: string, handler?: string]
  clearEvent: [target: string, event: string]
  /** 图片属性里选了"添加资源…"：打开项目资源对话框 */
  addResource: []
  /** 图表的"系列和图例"对话框点了确定 */
  setChart: [target: string, model: ChartModel]
}>()

const chartOpen = ref(false)
const chartModel = computed(() => readChart(props.doc, props.selected))

const tab = ref<'props' | 'events'>('props')
const def = computed<ControlDef>(() => (props.selected === '' ? FORM_DEF : controlDef(typeOf(props.doc, props.selected) ?? '')))
const typeName = computed(() => def.value.type.split('.').at(-1)!)
const title = computed(() => `${props.selected || props.doc.formName}（${def.value.label}）`)

function current(prop: PropDef): Value | undefined {
  const text = getPropText(props.doc, props.selected, prop.name)
  return text === undefined ? prop.default : parseValue(text)
}

/** 设成默认值时删除这条属性语句（VS 不写默认值） */
function set(prop: PropDef, value: Value) {
  const isDefault = prop.default && JSON.stringify(prop.default) === JSON.stringify(value)
  emit('setProp', props.selected, prop.name, isDefault ? null : value)
}

/** 图片属性：项目资源里的名字，没有设置时为空 */
function imageOf(prop: PropDef) {
  const text = getPropText(props.doc, props.selected, prop.name)
  return text === undefined ? '' : resourceNameOf(text) ?? text
}

function setImage(prop: PropDef, choice: string, select: HTMLSelectElement) {
  if (choice === '+') {
    select.value = imageOf(prop)
    emit('addResource')
    return
  }
  if (choice === '') reset(prop)
  else emit('setProp', props.selected, prop.name, { kind: 'raw', text: `${props.resources?.prefix ?? ''}${choice}` })
}

function reset(prop: PropDef) {
  emit('setProp', props.selected, prop.name, null)
}

// ---------- 名称 ----------
const nameDraft = ref('')
const nameError = ref<string | null>(null)
// 切换选中的控件或切换到另一个窗体时刷新
watch([() => props.selected, () => props.doc.formName], () => {
  nameDraft.value = props.selected || props.doc.formName
  nameError.value = null
}, { immediate: true })

function commitName() {
  const name = nameDraft.value.trim()
  if (!props.selected) {
    if (name === props.doc.className) return
    nameError.value = checkName(props.doc, name, props.doc.formName) ?? props.checkFormName?.(name) ?? null
    if (!nameError.value) emit('renameForm', name)
    return
  }
  if (name === props.selected) return
  nameError.value = checkName(props.doc, name, props.selected)
  if (!nameError.value) emit('rename', props.selected, name)
}

// ---------- 各类型的读写 ----------
function str(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'string' || v?.kind === 'char' ? v.value : ''
}
function num(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'int' || v?.kind === 'float' ? v.value : 0
}
function boolOf(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'bool' ? v.value : false
}
function point(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'point' ? v : { x: 0, y: 0 }
}
function size(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'size' ? v : { width: 0, height: 0 }
}
function enumOf(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'enum' ? v.member : ''
}
function color(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'color' ? v : undefined
}
function font(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'font' ? v : undefined
}
function raw(prop: PropDef) {
  const v = current(prop)
  return v?.kind === 'raw' ? v.text : undefined
}

function setColor(prop: PropDef, choice: string) {
  if (choice === '') return reset(prop)
  if (choice.startsWith('#')) {
    const [r, g, b] = hexToRgb(choice)
    return set(prop, rgb(r, g, b))
  }
  const css = NAMED_COLORS[choice]
  const [r, g, b] = css === 'transparent' ? [255, 255, 255] : hexToRgb(css)
  set(prop, { kind: 'color', css, name: choice, r, g, b, a: css === 'transparent' ? 0 : 255 })
}

const FONT_FAMILIES = ['宋体', '黑体', '楷体', '微软雅黑', 'Arial', 'Times New Roman']

function setFont(prop: PropDef, change: Partial<{ family: string; size: number; bold: boolean; italic: boolean }>) {
  const base = font(prop) ?? { kind: 'font' as const, family: '宋体', size: 9, bold: false, italic: false, underline: false, strikeout: false }
  set(prop, { ...base, ...change })
}

const itemsText = computed(() => getItems(props.doc, props.selected).map((item) => {
  const v = parseValue(item)
  return v.kind === 'string' ? v.value : item
}).join('\n'))

function setItemsFromText(text: string) {
  emit('setItems', props.selected, text.split('\n').map((s) => s.trimEnd()).filter((s) => s !== ''))
}

const handlerOf = (event: string) => getEventHandler(props.doc, props.selected, event) ?? ''

function renameHandler(event: string, value: string) {
  const name = value.trim()
  if (!name) emit('clearEvent', props.selected, event)
  else if (name !== handlerOf(event)) emit('openEvent', props.selected, event, name)
}
</script>

<template>
  <div class="grid">
    <div class="grid-title" :title="`类型：${typeName}`">{{ title }}</div>
    <div class="tabs">
      <button :class="{ active: tab === 'props' }" @click="tab = 'props'">属性</button>
      <button :class="{ active: tab === 'events' }" title="事件" @click="tab = 'events'">⚡ 事件</button>
    </div>

    <div v-if="tab === 'props'" class="rows">
      <div class="row">
        <label title="Name：控件的名称，代码里用这个名字访问它">名称</label>
        <div class="editor">
          <input v-model="nameDraft" @change="commitName" @keydown.enter="commitName" />
          <div v-if="nameError" class="error">{{ nameError }}</div>
          <div v-else-if="selected !== ''" class="note">改名后，代码里用到旧名字的地方要自己修改</div>
          <div v-else class="note">改名后，类名、文件名和 Program.cs 里的 new 跟着改；Form1_Load 这样的方法名不变</div>
        </div>
      </div>

      <div v-for="prop in def.props" :key="prop.name" class="row">
        <label :title="`${prop.name}：${prop.description}`">{{ prop.label }}</label>
        <div class="editor">
          <code v-if="prop.type !== 'image' && prop.type !== 'chart' && raw(prop) !== undefined" class="raw" :title="raw(prop)">{{ raw(prop) }}</code>

          <input v-else-if="prop.type === 'string'" :value="str(prop)" @change="set(prop, { kind: 'string', value: ($event.target as HTMLInputElement).value })" />

          <textarea v-else-if="prop.type === 'multiline'" rows="2" :value="str(prop)"
            @change="set(prop, { kind: 'string', value: ($event.target as HTMLTextAreaElement).value })" />

          <input v-else-if="prop.type === 'char'" maxlength="1" class="short" :value="str(prop)"
            @change="($event.target as HTMLInputElement).value ? set(prop, { kind: 'char', value: ($event.target as HTMLInputElement).value }) : reset(prop)" />

          <select v-else-if="prop.type === 'bool'" :value="String(boolOf(prop))"
            @change="set(prop, { kind: 'bool', value: ($event.target as HTMLSelectElement).value === 'true' })">
            <option value="true">是</option>
            <option value="false">否</option>
          </select>

          <input v-else-if="prop.type === 'int'" type="number" :value="num(prop)"
            @change="set(prop, { kind: 'int', value: Number(($event.target as HTMLInputElement).value) })" />

          <span v-else-if="prop.type === 'point'" class="pair">
            X <input type="number" :value="point(prop).x" @change="set(prop, { kind: 'point', x: Number(($event.target as HTMLInputElement).value), y: point(prop).y })" />
            Y <input type="number" :value="point(prop).y" @change="set(prop, { kind: 'point', x: point(prop).x, y: Number(($event.target as HTMLInputElement).value) })" />
          </span>

          <span v-else-if="prop.type === 'size'" class="pair">
            宽 <input type="number" min="1" :value="size(prop).width" @change="set(prop, { kind: 'size', width: Number(($event.target as HTMLInputElement).value), height: size(prop).height })" />
            高 <input type="number" min="1" :value="size(prop).height" @change="set(prop, { kind: 'size', width: size(prop).width, height: Number(($event.target as HTMLInputElement).value) })" />
          </span>

          <select v-else-if="prop.type === 'enum'" :value="enumOf(prop)"
            @change="set(prop, { kind: 'enum', type: prop.enumType!, member: ($event.target as HTMLSelectElement).value })">
            <option v-for="option in prop.options" :key="option" :value="option">{{ prop.optionLabels?.[option] ?? option }}</option>
          </select>

          <span v-else-if="prop.type === 'color'" class="color">
            <i class="swatch" :style="{ background: color(prop)?.css ?? 'transparent' }" />
            <select :value="color(prop)?.name ?? (color(prop) ? 'custom' : '')" @change="setColor(prop, ($event.target as HTMLSelectElement).value)">
              <option value="">（默认）</option>
              <option v-for="(_, name) in NAMED_COLORS" :key="name" :value="name">{{ name }}</option>
              <option v-if="color(prop) && !color(prop)!.name" value="custom" disabled>{{ color(prop)!.css }}</option>
            </select>
            <input type="color" title="自定义颜色" :value="color(prop)?.css.startsWith('#') ? color(prop)!.css : '#000000'"
              @change="setColor(prop, ($event.target as HTMLInputElement).value)" />
          </span>

          <span v-else-if="prop.type === 'font'" class="font">
            <select :value="font(prop)?.family ?? ''" @change="($event.target as HTMLSelectElement).value ? setFont(prop, { family: ($event.target as HTMLSelectElement).value }) : reset(prop)">
              <option value="">（默认：宋体 9）</option>
              <option v-for="family in FONT_FAMILIES" :key="family" :value="family">{{ family }}</option>
            </select>
            <template v-if="font(prop)">
              <input type="number" min="5" max="72" step="0.5" class="short" :value="font(prop)!.size"
                @change="setFont(prop, { size: Number(($event.target as HTMLInputElement).value) })" />
              <label class="check"><input type="checkbox" :checked="font(prop)!.bold" @change="setFont(prop, { bold: ($event.target as HTMLInputElement).checked })" />粗</label>
              <label class="check"><input type="checkbox" :checked="font(prop)!.italic" @change="setFont(prop, { italic: ($event.target as HTMLInputElement).checked })" />斜</label>
            </template>
          </span>

          <span v-else-if="prop.type === 'chart'" class="chart-summary">
            <span :title="`系列：${chartModel.series.map((s) => s.name).join('、') || '无'}；图例：${chartModel.legends.join('、') || '无'}`">{{ chartModel.series.length }} 个系列</span>
            <button @click="chartOpen = true">编辑…</button>
          </span>

          <textarea v-else-if="prop.type === 'items'" rows="4" :value="itemsText" placeholder="每行一项"
            @change="setItemsFromText(($event.target as HTMLTextAreaElement).value)" />

          <select v-else-if="prop.type === 'image'" :value="imageOf(prop)"
            @change="setImage(prop, ($event.target as HTMLSelectElement).value, $event.target as HTMLSelectElement)">
            <option value="">（无）</option>
            <option v-for="name in resources?.names ?? []" :key="name" :value="name">Resources.{{ name }}</option>
            <option v-if="imageOf(prop) && !resources?.names.includes(imageOf(prop))" :value="imageOf(prop)">{{ imageOf(prop) }}（不在项目资源里）</option>
            <option value="+">添加资源…</option>
          </select>

        </div>
      </div>
    </div>

    <div v-else class="rows">
      <div class="note events-note">双击事件名生成事件处理方法，并跳到代码</div>
      <div v-for="event in def.events" :key="event.name" class="row">
        <label class="event-name" :title="`${event.name}：双击生成事件处理方法`" @dblclick="emit('openEvent', selected, event.name)">{{ event.label }}</label>
        <div class="editor">
          <span class="pair">
            <input :value="handlerOf(event.name)" placeholder="（未绑定）" @change="renameHandler(event.name, ($event.target as HTMLInputElement).value)" />
            <button class="go" title="生成或跳到事件处理方法" @click="emit('openEvent', selected, event.name)">→</button>
          </span>
        </div>
      </div>
    </div>
    <ChartDialog v-model:show="chartOpen" :model="chartModel" @save="emit('setChart', selected, $event)" />
  </div>
</template>

<style scoped>
.grid {
  display: flex;
  flex-direction: column;
  min-height: 0;
  font-size: 12px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
}

.grid-title {
  padding: 6px 8px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.tabs button {
  flex: 1;
  padding: 4px;
  border: none;
  background: #f7f7f8;
  cursor: pointer;
}

.tabs button.active {
  background: #fff;
  font-weight: 600;
  box-shadow: inset 0 -2px #2563eb;
}

.rows {
  flex: 1;
  overflow: auto;
}

.row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid #f1f1f3;
}

.row > label {
  padding-top: 3px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-name {
  cursor: pointer;
}

.event-name:hover {
  color: #2563eb;
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.editor input:not([type="checkbox"]):not([type="color"]),
.editor select,
.editor textarea {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  padding: 2px 4px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
}

.pair,
.color,
.font {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pair input {
  min-width: 0;
}

.short {
  width: 56px !important;
  flex: none;
}

.swatch {
  flex: none;
  width: 14px;
  height: 14px;
  border: 1px solid #9ca3af;
  background-image: linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);
}

.color input[type="color"] {
  flex: none;
  width: 24px;
  height: 22px;
  padding: 0;
  border: none;
}

.check {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.chart-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.raw {
  font-size: 11px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint,
.note {
  color: #9ca3af;
  font-size: 11px;
}

.events-note {
  padding: 6px 8px;
}

.error {
  color: #dc2626;
  font-size: 11px;
}

.go {
  flex: none;
  padding: 1px 6px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  background: #f9fafb;
  cursor: pointer;
}
</style>

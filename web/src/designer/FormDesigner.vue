<script setup lang="ts">
// 窗体设计器（仿 VS）：左边工具箱，中间窗体，下方组件栏，右边属性 / 事件窗口。
// 窗体用运行时同一套 ControlView 渲染；上面盖一层透明的操作层，负责选中、拖动、改大小、放置新控件。
// 每次改动都重新生成 Designer.cs，通过 update 事件交给页面保存。
import { computed, ref, shallowRef, watch } from 'vue'
import ControlView from '../winforms/ControlView.vue'
import { displayText, fontCss, type FontValue } from '../winforms/format'
import { CONTROLS, type ControlDef, FORM_DEF, controlDef, isContainerType } from './catalog'
import { type ChartModel, writeChart } from './chart'
import { ensureHandler } from './code'
import { type DesignerDocument, DesignerParseError, generateDesigner, parseDesigner } from './document'
import {
  addControl,
  childrenOf,
  getEventHandler,
  getPropText,
  listControls,
  moveControl,
  removeControl,
  renameControl,
  setEvent,
  setItems,
  setProp,
  typeOf,
} from './edit'
import { dockLayout } from './layout'
import PropertyGrid from './PropertyGrid.vue'
import { componentsOf, previewTree } from './preview'
import { parseValue, type Value } from './values'

const props = defineProps<{
  designerText: string
  codeText: string
  canUndo: boolean
  canRedo: boolean
  /** 项目资源（图片属性的选项） */
  resources?: { names: string[]; prefix: string }
}>()

const emit = defineEmits<{
  /** Designer.cs 改了；codeText 不为空时窗体代码文件也改了（插入了事件处理方法） */
  update: [designerText: string, codeText?: string]
  /** 跳到窗体代码文件的某一行 */
  openCode: [line: number]
  /** 查看设计器生成的 Designer.cs */
  openDesignerFile: []
  undo: []
  redo: []
  /** 属性窗口里要添加项目资源 */
  addResource: []
}>()

/** Ctrl+Z 撤销，Ctrl+Y / Ctrl+Shift+Z 重做；在属性窗口的输入框里打字时不拦截（输入框有自己的撤销） */
function onShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select')) return
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    emit('undo')
  } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
    event.preventDefault()
    emit('redo')
  }
}

// ---------- 文档 ----------
const parsed = computed<{ doc?: DesignerDocument; error?: string }>(() => {
  try {
    return { doc: parseDesigner(props.designerText) }
  } catch (error) {
    return { error: error instanceof DesignerParseError ? error.message : String(error) }
  }
})

/** 拖动过程中的临时文档（松手时才写回文件） */
const dragDoc = shallowRef<DesignerDocument>()
const doc = computed(() => dragDoc.value ?? parsed.value.doc)
const tree = computed(() => (doc.value ? previewTree(doc.value) : undefined))
const components = computed(() => (doc.value ? componentsOf(doc.value) : []))

/** 选中的控件；'' 表示窗体 */
const selected = ref('')
watch(parsed, () => {
  if (selected.value && doc.value && !listControls(doc.value).some((c) => c.name === selected.value)) selected.value = ''
})

/** 每次修改后像 VS 一样把停靠的控件排好（没有停靠控件时文档不变） */
function commit(next: DesignerDocument, codeText?: string) {
  dragDoc.value = undefined
  emit('update', generateDesigner(dockLayout(next)), codeText)
}

// ---------- 几何 ----------
interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function valueOf(d: DesignerDocument, target: string, path: string): Value | undefined {
  const text = getPropText(d, target, path)
  return text === undefined ? undefined : parseValue(text)
}

function localRect(d: DesignerDocument, name: string): Rect {
  const location = valueOf(d, name, 'Location')
  const size = valueOf(d, name, 'Size')
  return {
    x: location?.kind === 'point' ? location.x : 0,
    y: location?.kind === 'point' ? location.y : 0,
    width: size?.kind === 'size' ? size.width : 75,
    height: size?.kind === 'size' ? size.height : 23,
  }
}

/** 控件在窗体客户区里的绝对位置（Location 相对于所在容器） */
function absRect(d: DesignerDocument, name: string): Rect {
  const rect = localRect(d, name)
  const parent = listControls(d).find((c) => c.name === name)?.parent
  if (parent) {
    const p = absRect(d, parent)
    rect.x += p.x
    rect.y += p.y
  }
  return rect
}

const clientSize = computed(() => {
  const v = doc.value && valueOf(doc.value, '', 'ClientSize')
  return v?.kind === 'size' ? v : { width: 300, height: 300 }
})

const contains = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height

/** 找到点下的最上层控件（先查子控件；同一层里 Controls 中靠前的在上面） */
function hitTest(d: DesignerDocument, x: number, y: number, container = '', skip?: Set<string>): string | null {
  for (const child of childrenOf(d, container)) {
    if (skip?.has(child) || !contains(absRect(d, child), x, y)) continue
    if (isContainerType(typeOf(d, child) ?? '')) return hitTest(d, x, y, child, skip) ?? child
    return child
  }
  return null
}

/** 点所在的最深一层容器（窗体为 ''），拖放控件时用来决定放进哪个容器 */
function containerAt(d: DesignerDocument, x: number, y: number, skip?: Set<string>): string {
  const hit = hitTest(d, x, y, '', skip)
  if (hit === null) return ''
  if (isContainerType(typeOf(d, hit) ?? '')) return hit
  return listControls(d).find((c) => c.name === hit)?.parent ?? ''
}

function descendants(d: DesignerDocument, name: string): Set<string> {
  const set = new Set([name])
  for (const child of childrenOf(d, name)) for (const n of descendants(d, child)) set.add(n)
  return set
}

const selectedRect = computed(() => (doc.value && selected.value ? absRect(doc.value, selected.value) : undefined))
const selectedAutoSize = computed(() => doc.value && selected.value && getPropText(doc.value, selected.value, 'AutoSize') === 'true')

// ---------- 指针操作：选中、移动、改大小 ----------
const surface = ref<HTMLElement>()
type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

let drag:
  | { mode: 'move'; name: string; startX: number; startY: number; origin: Rect; moved: boolean }
  | { mode: 'resize'; name: string; handle: Handle; startX: number; startY: number; origin: Rect }
  | { mode: 'form'; startX: number; startY: number; origin: { width: number; height: number } }
  | undefined

function pointer(event: PointerEvent | DragEvent) {
  const box = surface.value!.getBoundingClientRect()
  return { x: event.clientX - box.left, y: event.clientY - box.top }
}

function onPointerDown(event: PointerEvent) {
  if (!doc.value || event.button !== 0) return
  surface.value!.focus()
  const { x, y } = pointer(event)
  const hit = hitTest(doc.value, x, y)
  selected.value = hit ?? ''
  if (hit) {
    drag = { mode: 'move', name: hit, startX: x, startY: y, origin: absRect(doc.value, hit), moved: false }
    surface.value!.setPointerCapture(event.pointerId)
  }
}

function startResize(event: PointerEvent, handle: Handle) {
  if (!doc.value || !selected.value) return
  const { x, y } = pointer(event)
  drag = { mode: 'resize', name: selected.value, handle, startX: x, startY: y, origin: localRect(doc.value, selected.value) }
  surface.value!.setPointerCapture(event.pointerId)
}

function startFormResize(event: PointerEvent) {
  if (!doc.value) return
  selected.value = ''
  const { x, y } = pointer(event)
  drag = { mode: 'form', startX: x, startY: y, origin: { ...clientSize.value } }
  surface.value!.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  const base = parsed.value.doc
  if (!drag || !base) return
  const { x, y } = pointer(event)
  const dx = Math.round(x - drag.startX)
  const dy = Math.round(y - drag.startY)
  if (drag.mode === 'move') {
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return
    drag.moved = true
    const local = localRect(base, drag.name)
    dragDoc.value = setProp(base, drag.name, 'Location', { kind: 'point', x: local.x + dx, y: local.y + dy })
  } else if (drag.mode === 'resize') {
    const r = { ...drag.origin }
    const h = drag.handle
    if (h.includes('e')) r.width = Math.max(4, drag.origin.width + dx)
    if (h.includes('s')) r.height = Math.max(4, drag.origin.height + dy)
    if (h.includes('w')) {
      r.width = Math.max(4, drag.origin.width - dx)
      r.x = drag.origin.x + drag.origin.width - r.width
    }
    if (h.includes('n')) {
      r.height = Math.max(4, drag.origin.height - dy)
      r.y = drag.origin.y + drag.origin.height - r.height
    }
    let next = setProp(base, drag.name, 'Location', { kind: 'point', x: r.x, y: r.y })
    next = setProp(next, drag.name, 'Size', { kind: 'size', width: r.width, height: r.height })
    dragDoc.value = next
  } else {
    dragDoc.value = setProp(base, '', 'ClientSize', {
      kind: 'size',
      width: Math.max(80, drag.origin.width + dx),
      height: Math.max(40, drag.origin.height + dy),
    })
  }
}

function onPointerUp(event: PointerEvent) {
  const base = parsed.value.doc
  const current = drag
  drag = undefined
  if (!current || !base || !dragDoc.value) {
    dragDoc.value = undefined
    return
  }
  if (current.mode === 'move') {
    // 松手的位置在另一个容器里：把控件移进去（坐标换算成相对新容器）
    const { x, y } = pointer(event)
    const target = containerAt(dragDoc.value, x, y, descendants(base, current.name))
    const abs = absRect(dragDoc.value, current.name)
    const origin = target ? absRect(dragDoc.value, target) : { x: 0, y: 0 }
    commit(moveControl(base, current.name, target, { x: abs.x - origin.x, y: abs.y - origin.y }))
  } else {
    commit(dragDoc.value)
  }
}

// ---------- 键盘 ----------
function onKeyDown(event: KeyboardEvent) {
  const d = parsed.value.doc
  if (!d || !selected.value) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    const name = selected.value
    selected.value = ''
    commit(removeControl(d, name))
    return
  }
  const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
  if (step && listControls(d).find((c) => c.name === selected.value)?.parent !== null) {
    event.preventDefault()
    const r = localRect(d, selected.value)
    commit(setProp(d, selected.value, 'Location', { kind: 'point', x: r.x + step[0], y: r.y + step[1] }))
  }
  if (event.key === 'Escape') {
    selected.value = listControls(d).find((c) => c.name === selected.value)?.parent ?? ''
  }
}

// ---------- 工具箱 ----------
const TOOLBOX_GROUPS = ['常用控件', '容器', '数据', '组件', '物联网设备'] as const
const ICONS: Record<string, string> = {
  按钮: '▭', 标签: 'A', 文本框: '▤', 下拉框: '☰', 复选框: '☑', 单选按钮: '◉', 分组框: '⬚', 面板: '▢',
  定时器: '⏱', 'LED 显示屏': '▬', 灯泡: '💡', 报警灯: '🚨',
}
const DRAG_TYPE = 'application/x-winforms-control'

function onToolDragStart(event: DragEvent, def: ControlDef) {
  event.dataTransfer!.setData(DRAG_TYPE, def.type)
  event.dataTransfer!.effectAllowed = 'copy'
}

function onDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes(DRAG_TYPE)) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDrop(event: DragEvent) {
  const d = parsed.value.doc
  const type = event.dataTransfer?.getData(DRAG_TYPE)
  if (!d || !type) return
  event.preventDefault()
  const { x, y } = pointer(event)
  place(d, controlDef(type), x, y)
}

/** 双击工具箱：放在选中的容器（或窗体）左上角 */
function onToolDoubleClick(def: ControlDef) {
  const d = parsed.value.doc
  if (!d) return
  // 直接放进选中的容器，不按坐标判断（左上角可能正好压在另一个分组框上）
  const container = !def.component && selected.value && isContainerType(typeOf(d, selected.value) ?? '') ? selected.value : ''
  const result = addControl(d, def, container, { x: 12, y: container ? 20 : 12 })
  selected.value = result.name
  commit(result.doc)
}

function place(d: DesignerDocument, def: ControlDef, x: number, y: number) {
  const container = def.component ? '' : containerAt(d, x, y)
  const origin = container ? absRect(d, container) : { x: 0, y: 0 }
  const result = addControl(d, def, container, { x: x - origin.x, y: y - origin.y })
  selected.value = result.name
  commit(result.doc)
}

// ---------- 属性窗口的回调 ----------
function onSetProp(target: string, path: string, value: Value | null) {
  const d = parsed.value.doc
  if (!d) return
  let next = setProp(d, target, path, value)
  // AutoSize 的控件：文字或字体变化时按文字重新计算大小（VS 也会这样更新 Size）
  const def = target ? controlDef(typeOf(d, target) ?? '') : undefined
  if (def?.autoSize && (path === 'Text' || path === 'AutoSize') && getPropText(next, target, 'AutoSize') === 'true') {
    const text = valueOf(next, target, 'Text')
    const size = def.autoSize(text?.kind === 'string' ? text.value : '')
    next = setProp(next, target, 'Size', { kind: 'size', ...size })
  }
  commit(next)
}

function onSetItems(target: string, items: string[]) {
  const d = parsed.value.doc
  if (d) commit(setItems(d, target, items))
}

function onSetChart(target: string, model: ChartModel) {
  const d = parsed.value.doc
  if (d) commit(writeChart(d, target, model))
}

function onRename(from: string, to: string) {
  const d = parsed.value.doc
  if (!d) return
  selected.value = to
  commit(renameControl(d, from, to))
}

/** 绑定事件并在代码里生成处理方法（已存在则直接跳过去），然后跳到代码 */
function openEvent(target: string, eventName: string, handler?: string) {
  const d = parsed.value.doc
  if (!d) return
  const def = target ? controlDef(typeOf(d, target) ?? '') : FORM_DEF
  const event = def.events.find((e) => e.name === eventName)
  if (!event) return
  const name = handler ?? getEventHandler(d, target, eventName) ?? `${target || d.formName}_${eventName}`
  const next = setEvent(d, target, eventName, event.delegate, name)
  try {
    const result = ensureHandler(props.codeText, d.className, name, event.args)
    commit(next, result.code === props.codeText ? undefined : result.code)
    emit('openCode', result.line)
  } catch (error) {
    commit(next)
    alert(String(error))
  }
}

function clearEvent(target: string, eventName: string) {
  const d = parsed.value.doc
  if (d) commit(setEvent(d, target, eventName, '', null))
}

/** 双击控件：生成默认事件（按钮的 Click、窗体的 Load……） */
function onDoubleClick(event: MouseEvent) {
  const d = parsed.value.doc
  if (!d) return
  const box = surface.value!.getBoundingClientRect()
  const hit = hitTest(d, event.clientX - box.left, event.clientY - box.top) ?? ''
  const def = hit ? controlDef(typeOf(d, hit) ?? '') : FORM_DEF
  openEvent(hit, def.defaultEvent)
}

function onComponentDoubleClick(name: string) {
  const d = parsed.value.doc
  if (d) openEvent(name, controlDef(typeOf(d, name) ?? '').defaultEvent)
}

const formTitle = computed(() => String(tree.value?.props.Text ?? ''))
const formStyle = computed(() => ({
  width: `${clientSize.value.width}px`,
  height: `${clientSize.value.height}px`,
  color: (tree.value?.props.ForeColor as string | undefined) ?? undefined,
  backgroundColor: (tree.value?.props.BackColor as string | undefined) ?? undefined,
  ...fontCss(tree.value?.props.Font as FontValue | undefined),
}))
const childrenTopLast = computed(() => [...(tree.value?.children ?? [])].reverse())
const noop = () => {}
</script>

<template>
  <div v-if="parsed.error" class="cannot-open">
    <p><b>设计器无法打开这个窗体。</b></p>
    <p>{{ parsed.error }}</p>
    <p>Designer.cs 的内容不是窗体设计器能识别的格式，可能是手动修改造成的。可以在代码里改回来，或者用"恢复原始代码"。</p>
  </div>

  <div v-else-if="doc && tree" class="designer" @keydown="onShortcut">
    <aside class="toolbox">
      <div class="panel-title">工具箱</div>
      <template v-for="group in TOOLBOX_GROUPS" :key="group">
        <div class="group">{{ group }}</div>
        <div
          v-for="def in CONTROLS.filter((d) => d.group === group)"
          :key="def.type"
          class="tool"
          draggable="true"
          :title="`${def.type.split('.').at(-1)}：拖到窗体上，或双击添加`"
          @dragstart="onToolDragStart($event, def)"
          @dblclick="onToolDoubleClick(def)"
        >
          <span class="tool-icon">{{ ICONS[def.label] ?? '▫' }}</span>{{ def.label }}
        </div>
      </template>
    </aside>

    <section class="canvas">
      <div class="actions">
        <button :disabled="!canUndo" title="撤销（Ctrl+Z）" @click="emit('undo')">↶ 撤销</button>
        <button :disabled="!canRedo" title="重做（Ctrl+Y）" @click="emit('redo')">↷ 重做</button>
        <span class="tips">拖动工具箱里的控件到窗体上；双击控件生成事件处理方法；Delete 删除</span>
        <button class="view-code" title="设计器根据窗体上的控件自动生成的代码（Designer.cs）" @click="emit('openDesignerFile')">
          查看生成的代码
        </button>
      </div>
      <div class="window" :class="{ selected: selected === '' }">
        <div class="titlebar" @pointerdown="selected = ''">
          <span class="title">{{ displayText(formTitle) }}</span>
          <span class="buttons">─ ☐ ✕</span>
        </div>
        <div class="client wf-client-host" :style="formStyle">
          <ControlView v-for="child in childrenTopLast" :key="child.id" :node="child" :act="noop" />
          <!-- 操作层：盖在窗体客户区上，接管所有鼠标操作 -->
          <div
            ref="surface"
            class="surface"
            tabindex="0"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @dblclick="onDoubleClick"
            @keydown="onKeyDown"
            @dragover="onDragOver"
            @drop="onDrop"
          >
            <div
              v-if="selectedRect"
              class="selection"
              :style="{ left: `${selectedRect.x}px`, top: `${selectedRect.y}px`, width: `${selectedRect.width}px`, height: `${selectedRect.height}px` }"
            >
              <template v-if="!selectedAutoSize">
                <i v-for="h in HANDLES" :key="h" :class="['handle', h]" @pointerdown.stop="startResize($event, h)" />
              </template>
            </div>
          </div>
          <i class="form-resize" title="拖动改变窗体大小" @pointerdown.stop="startFormResize" />
        </div>
      </div>

      <div class="tray">
        <span class="tray-label">组件栏</span>
        <span v-if="components.length === 0" class="tray-empty">把 Timer 等不显示在窗体上的组件拖到窗体上，会出现在这里</span>
        <button
          v-for="c in components"
          :key="c.name"
          class="component"
          :class="{ active: selected === c.name }"
          @click="selected = c.name"
          @dblclick="onComponentDoubleClick(c.name)"
          @keydown.delete="commit(removeControl(parsed.doc!, c.name)); selected = ''"
        >
          ⏱ {{ c.name }}
        </button>
      </div>
    </section>

    <PropertyGrid
      class="properties"
      :doc="doc"
      :selected="selected"
      :resources="resources"
      @set-prop="onSetProp"
      @set-items="onSetItems"
      @rename="onRename"
      @open-event="openEvent"
      @clear-event="clearEvent"
      @add-resource="emit('addResource')"
      @set-chart="onSetChart"
    />
  </div>
</template>

<style scoped>
.designer {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 260px;
  height: 100%;
  min-height: 0;
  border: 1px solid #e5e7eb;
}

.cannot-open {
  padding: 24px;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  height: 100%;
  box-sizing: border-box;
}

.toolbox {
  overflow-y: auto;
  border-right: 1px solid #e5e7eb;
  background: #fafafa;
  font-size: 12px;
}

.panel-title {
  padding: 6px 8px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

.group {
  padding: 6px 8px 2px;
  color: #6b7280;
  font-size: 11px;
}

.tool {
  padding: 4px 8px 4px 14px;
  cursor: grab;
  user-select: none;
}

.tool-icon {
  display: inline-block;
  width: 18px;
  color: #6b7280;
}

.tool:hover {
  background: #e8f0fe;
}

.canvas {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: auto;
  background: #e9edf2;
  padding: 16px;
  gap: 12px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.actions button {
  flex: none;
  white-space: nowrap;
  padding: 2px 10px;
  border: 1px solid #c5ccd5;
  border-radius: 3px;
  background: #fff;
  font: inherit;
  cursor: pointer;
}

.actions button:disabled {
  color: #b0b6bf;
  cursor: default;
}

.view-code {
  margin-left: auto;
}

.tips {
  min-width: 0;
  margin-left: 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #7a838e;
}

.window {
  align-self: flex-start;
  border: 1px solid #9aa3ad;
  background: #f0f0f0;
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.15);
}

.window.selected {
  outline: 1px dashed #2563eb;
  outline-offset: 2px;
}

.titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 30px;
  padding: 0 8px;
  background: #fff;
  font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
  font-size: 12px;
  user-select: none;
}

.buttons {
  color: #6b7280;
  letter-spacing: 12px;
}

.client {
  position: relative;
  overflow: hidden;
  font-family: "SimSun", "Songti SC", "Noto Serif CJK SC", "Noto Serif SC", serif;
  font-size: 12px;
}

.surface {
  position: absolute;
  inset: 0;
  outline: none;
  cursor: default;
}

.selection {
  position: absolute;
  box-sizing: border-box;
  border: 1px dashed #2563eb;
  pointer-events: none;
}

.handle {
  position: absolute;
  width: 7px;
  height: 7px;
  background: #fff;
  border: 1px solid #2563eb;
  pointer-events: auto;
}

.handle.nw { left: -4px; top: -4px; cursor: nwse-resize; }
.handle.n { left: calc(50% - 4px); top: -4px; cursor: ns-resize; }
.handle.ne { right: -4px; top: -4px; cursor: nesw-resize; }
.handle.e { right: -4px; top: calc(50% - 4px); cursor: ew-resize; }
.handle.se { right: -4px; bottom: -4px; cursor: nwse-resize; }
.handle.s { left: calc(50% - 4px); bottom: -4px; cursor: ns-resize; }
.handle.sw { left: -4px; bottom: -4px; cursor: nesw-resize; }
.handle.w { left: -4px; top: calc(50% - 4px); cursor: ew-resize; }

.form-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #9aa3ad 50%);
}

.tray {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #fff;
  border: 1px solid #d5dbe2;
  font-size: 12px;
}

.tray-label {
  color: #6b7280;
}

.tray-empty {
  color: #9ca3af;
}

.component {
  padding: 2px 8px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  background: #f9fafb;
  cursor: pointer;
  font: inherit;
}

.component.active {
  border-color: #2563eb;
  background: #e8f0fe;
}

.properties {
  min-height: 0;
}
</style>

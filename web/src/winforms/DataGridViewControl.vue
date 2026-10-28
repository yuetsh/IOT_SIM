<script setup lang="ts">
// 数据表格：显示运行器发来的列和行；单元格的值、当前单元格、选中的行都以运行器为准。
// 编辑：双击、按 F2 或直接打字开始，回车或离开时提交（运行器按列的类型转换后写回），Esc 取消。
import { computed, nextTick, ref, type CSSProperties } from 'vue'
import type { ControlNode, UserAction } from '@iot/shared'

interface Column {
  name: string
  header: string
  width: number
  visible: boolean
  readOnly: boolean
  check: boolean
  fill: boolean
}

interface Rows {
  items: { cells: (string | boolean)[]; isNew: boolean }[]
  total: number
  height: number
}

const props = defineProps<{
  node: ControlNode
  style: CSSProperties
  enabled: boolean
  act: (action: UserAction) => void
}>()

const p = computed(() => props.node.props)
const columns = computed(() => ((p.value.Columns as Column[] | undefined) ?? []).map((c, index) => ({ ...c, index })).filter((c) => c.visible))
const rows = computed(() => (p.value.Rows as Rows | undefined) ?? { items: [], total: 0, height: 23 })
const current = computed(() => (p.value.CurrentCell as [number, number] | null | undefined) ?? null)
const selectedRows = computed(() => new Set((p.value.SelectedRows as number[] | undefined) ?? []))
const rowHeaders = computed(() => p.value.RowHeadersVisible !== false)
const columnHeaders = computed(() => p.value.ColumnHeadersVisible !== false)
const hasFill = computed(() => columns.value.some((c) => c.fill))

const editing = ref<{ row: number; column: number; value: string } | null>(null)
const editor = ref<HTMLInputElement[]>([])

function isCurrent(row: number, column: number) {
  return current.value?.[0] === row && current.value?.[1] === column
}

function click(row: number, column: number) {
  if (!props.enabled) return
  commit()
  props.act({ action: 'cellClick', row, column })
  const col = columns.value.find((c) => c.index === column)
  const cell = rows.value.items[row]?.cells[column]
  // 复选框列：点一下就切换
  if (col?.check && !col.readOnly && p.value.ReadOnly !== true) props.act({ action: 'cellEdit', row, column, value: cell === true ? 'False' : 'True' })
}

function doubleClick(row: number, column: number) {
  props.act({ action: 'cellDoubleClick', row, column })
  startEdit(row, column)
}

function startEdit(row: number, column: number, initial?: string) {
  const col = columns.value.find((c) => c.index === column)
  if (!props.enabled || !col || col.readOnly || col.check || p.value.ReadOnly === true) return
  const cell = rows.value.items[row]?.cells[column]
  editing.value = { row, column, value: initial ?? String(cell ?? '') }
  void nextTick(() => {
    const input = editor.value[0]
    input?.focus()
    if (initial === undefined) input?.select()
  })
}

function commit() {
  const edit = editing.value
  if (!edit) return
  editing.value = null
  const original = String(rows.value.items[edit.row]?.cells[edit.column] ?? '')
  if (edit.value !== original || rows.value.items[edit.row]?.isNew) {
    if (edit.value !== '' || !rows.value.items[edit.row]?.isNew) props.act({ action: 'cellEdit', row: edit.row, column: edit.column, value: edit.value })
  }
}

function cancel() {
  editing.value = null
}

/** 表格获得焦点时：方向键移动当前单元格，F2 / 回车编辑，直接打字开始编辑 */
function keydown(event: KeyboardEvent) {
  if (editing.value || !current.value) return
  const [row, column] = current.value
  const visible = columns.value.map((c) => c.index)
  const at = visible.indexOf(column)
  const move = (r: number, c: number) => {
    if (r >= 0 && r < rows.value.items.length && c >= 0) props.act({ action: 'cellClick', row: r, column: c })
  }
  switch (event.key) {
    case 'ArrowDown':
      move(row + 1, column)
      break
    case 'ArrowUp':
      move(row - 1, column)
      break
    case 'ArrowLeft':
      if (at > 0) move(row, visible[at - 1])
      break
    case 'ArrowRight':
      if (at < visible.length - 1) move(row, visible[at + 1])
      break
    case 'F2':
    case 'Enter':
      startEdit(row, column)
      break
    default:
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        startEdit(row, column, event.key)
        event.preventDefault()
        return
      }
      return
  }
  event.preventDefault()
}

function columnStyle(column: Column): CSSProperties {
  return column.fill ? {} : { width: `${column.width}px`, minWidth: `${column.width}px`, maxWidth: `${column.width}px` }
}
</script>

<template>
  <div
    class="wf-control wf-dgv"
    :class="{ 'wf-disabled': !enabled }"
    :style="{ ...style, backgroundColor: (p.BackgroundColor as string | null) ?? '#ababab' }"
    tabindex="0"
    @keydown="keydown"
  >
    <table v-if="columns.length" class="wf-dgv-table" :class="{ 'wf-dgv-fill': hasFill }">
      <thead v-if="columnHeaders">
        <tr>
          <th v-if="rowHeaders" class="wf-dgv-corner" />
          <th v-for="column in columns" :key="column.index" :style="columnStyle(column)">{{ column.header }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in rows.items" :key="r" :class="{ 'wf-dgv-selected': selectedRows.has(r) }" :style="{ height: `${rows.height}px` }">
          <th v-if="rowHeaders" class="wf-dgv-rowheader" @click="click(r, -1)">
            {{ current?.[0] === r ? '▶' : row.isNew ? '*' : '' }}
          </th>
          <td
            v-for="column in columns"
            :key="column.index"
            :class="{ 'wf-dgv-current': isCurrent(r, column.index) }"
            :style="columnStyle(column)"
            @click="click(r, column.index)"
            @dblclick="doubleClick(r, column.index)"
          >
            <input
              v-if="editing && editing.row === r && editing.column === column.index"
              ref="editor"
              v-model="editing.value"
              class="wf-dgv-editor"
              autocomplete="off"
              @keydown.enter.stop.prevent="commit"
              @keydown.esc.stop.prevent="cancel"
              @keydown.stop
              @blur="commit"
            />
            <span v-else-if="column.check" class="wf-checkbox-box wf-dgv-check" :data-checked="row.cells[column.index] === true" />
            <template v-else>{{ row.cells[column.index] }}</template>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="rows.total > rows.items.length" class="wf-dgv-more">（共 {{ rows.total }} 行，只显示前 {{ rows.items.length }} 行）</div>
  </div>
</template>

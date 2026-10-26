<script setup lang="ts">
// 编辑前 200 行（仿 SSMS）：改单元格立即写回数据库（UPDATE），最下面的 * 行输入新数据、离开这一行或按回车时插入（INSERT），
// 右键行号删除（DELETE）。输入 NULL 表示空值。自增列和二进制列不能改。出错时显示数据库的报错并恢复原值。
import { NButton, NDropdown, useDialog, useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, ref } from 'vue'
import { deleteRow, execute, insertRow, parseInput, quoteName, updateCell, type ExplorerTable } from './sql'

const props = defineProps<{ database: string; table: ExplorerTable }>()
const emit = defineEmits<{ changed: [] }>()
const message = useMessage()
const dialog = useDialog()

type Cell = string | number | null
const rows = ref<Cell[][]>([])
const loading = ref(false)
const current = ref<{ row: number; column: number } | null>(null)
const editing = ref<{ row: number; column: number; value: string } | null>(null)
const editor = ref<HTMLInputElement[]>([])
/** 新行里已经填的值（列序号 → 值） */
const newRow = ref(new Map<number, string | null>())
const menu = ref<{ x: number; y: number; row: number } | null>(null)

const columns = computed(() => props.table.columns)
const newRowIndex = computed(() => rows.value.length)
const readOnly = (column: number) => columns.value[column].identity || /^(binary|varbinary|image)/i.test(columns.value[column].type)

async function load() {
  loading.value = true
  try {
    const sql = `SELECT TOP (200) ${columns.value.map((c) => quoteName(c.name)).join(', ')} FROM ${quoteName(props.table.name)}`
    const reply = await execute(props.database, sql)
    rows.value = (reply.type === 'result' ? reply.results[0]?.rows : []) as Cell[][]
  } catch (error) {
    message.error((error as Error).message)
  } finally {
    loading.value = false
  }
}

/** 执行一条修改语句，然后重新读取（出错时提示，表格恢复成数据库里的样子） */
async function apply(sql: string) {
  try {
    await execute(props.database, sql)
    emit('changed')
  } catch (error) {
    dialog.error({ title: 'Microsoft SQL Server Management Studio', content: `未更新任何行。\n${(error as Error).message}`, positiveText: '确定' })
  }
  await load()
}

async function select(row: number, column: number) {
  await commitEdit()
  if (current.value?.row === newRowIndex.value && row !== newRowIndex.value) await commitNewRow()
  current.value = { row, column }
}

function startEdit(row: number, column: number, initial?: string) {
  if (readOnly(column)) return
  const value = row === newRowIndex.value ? newRow.value.get(column) : rows.value[row]?.[column]
  editing.value = { row, column, value: initial ?? (value === null || value === undefined ? (row === newRowIndex.value ? '' : 'NULL') : String(value)) }
  void nextTick(() => {
    editor.value[0]?.focus()
    if (initial === undefined) editor.value[0]?.select()
  })
}

async function commitEdit() {
  const edit = editing.value
  if (!edit) return
  editing.value = null
  if (edit.row === newRowIndex.value) {
    if (edit.value !== '') newRow.value.set(edit.column, parseInput(edit.value))
    return
  }
  const original = rows.value[edit.row]
  const value = parseInput(edit.value)
  if (String(original[edit.column] ?? 'NULL') === edit.value) return
  await apply(updateCell(props.table, edit.column, value, original))
}

async function commitNewRow() {
  if (newRow.value.size === 0) return
  const values = newRow.value
  newRow.value = new Map()
  await apply(insertRow(props.table, values))
}

function keydown(event: KeyboardEvent) {
  if (editing.value || !current.value) return
  const { row, column } = current.value
  const move = (r: number, c: number) => {
    if (r >= 0 && r <= newRowIndex.value && c >= 0 && c < columns.value.length) void select(r, c)
  }
  if (event.key === 'ArrowDown') move(row + 1, column)
  else if (event.key === 'ArrowUp') move(row - 1, column)
  else if (event.key === 'ArrowLeft') move(row, column - 1)
  else if (event.key === 'ArrowRight' || event.key === 'Tab') move(row, column + 1)
  else if (event.key === 'F2') startEdit(row, column)
  else if (event.key === 'Enter') {
    if (row === newRowIndex.value) void commitNewRow()
    else startEdit(row, column)
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) startEdit(row, column, event.key)
  else return
  event.preventDefault()
}

async function editorKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Escape') editing.value = null
  else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    const row = editing.value?.row
    await commitEdit()
    if (row === newRowIndex.value && event.key === 'Enter') await commitNewRow()
  }
}

function rowMenu(event: MouseEvent, row: number) {
  event.preventDefault()
  if (row >= rows.value.length) return
  menu.value = null
  void nextTick(() => (menu.value = { x: event.clientX, y: event.clientY, row }))
}

function confirmDelete() {
  const row = menu.value!.row
  menu.value = null
  dialog.warning({
    title: 'Microsoft SQL Server Management Studio',
    content: '将永久删除 1 行。\n确实要删除这些行吗？',
    positiveText: '是',
    negativeText: '否',
    onPositiveClick: () => apply(deleteRow(props.table, rows.value[row])),
  })
}

const display = (value: Cell | undefined) => (value === null || value === undefined ? 'NULL' : String(value))

onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <div class="edit">
    <div class="bar">
      <span>{{ database }} - dbo.{{ table.name }}</span>
      <NButton size="small" :loading="loading" @click="load">刷新</NButton>
      <span class="hint">双击或直接打字修改；输入 NULL 表示空值；在 * 行输入新数据，按回车保存；右键行号删除</span>
    </div>
    <div class="grid-wrap" tabindex="0" @keydown="keydown">
      <table class="grid">
        <thead>
          <tr>
            <th class="head" />
            <th v-for="(column, c) in columns" :key="c" :title="column.type">{{ column.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows.length + 1" :key="r - 1">
            <th class="head" @click="select(r - 1, 0)" @contextmenu="rowMenu($event, r - 1)">
              {{ r - 1 === newRowIndex ? '*' : current?.row === r - 1 ? '▶' : '' }}
            </th>
            <td
              v-for="(column, c) in columns"
              :key="c"
              :class="{
                current: current?.row === r - 1 && current?.column === c,
                null: r - 1 < rows.length ? rows[r - 1][c] === null : !newRow.has(c) || newRow.get(c) === null,
                readonly: readOnly(c),
              }"
              @click="select(r - 1, c)"
              @dblclick="startEdit(r - 1, c)"
            >
              <input
                v-if="editing && editing.row === r - 1 && editing.column === c"
                ref="editor"
                v-model="editing.value"
                class="editor"
                @keydown="editorKeydown"
                @blur="commitEdit"
              />
              <template v-else-if="r - 1 < rows.length">{{ display(rows[r - 1][c]) }}</template>
              <template v-else>{{ newRow.has(c) ? display(newRow.get(c)) : 'NULL' }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <NDropdown
      v-if="menu"
      show
      trigger="manual"
      placement="bottom-start"
      :x="menu.x"
      :y="menu.y"
      :options="[{ label: '删除', key: 'delete' }]"
      size="small"
      @select="confirmDelete"
      @clickoutside="menu = null"
    />
  </div>
</template>

<style scoped>
.edit {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}

.hint {
  color: #6b7280;
  font-size: 12px;
}

.grid-wrap {
  flex: 1;
  overflow: auto;
  outline: none;
  padding: 8px;
}

.grid {
  border-collapse: collapse;
  font-size: 12px;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif;
  background: #fff;
}

.grid th,
.grid td {
  border: 1px solid #d4d4d4;
  padding: 2px 6px;
  min-width: 80px;
  max-width: 280px;
  height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  font-weight: normal;
  cursor: default;
}

.grid thead th,
.grid .head {
  background: #f3f3f3;
}

.grid .head {
  min-width: 24px;
  width: 24px;
  text-align: center;
}

.grid td.null {
  color: #6b7280;
  font-style: italic;
}

.grid td.readonly {
  background: #f9fafb;
}

.grid td.current {
  outline: 2px solid #0078d7;
  outline-offset: -2px;
}

.editor {
  width: 100%;
  border: none;
  outline: none;
  font: inherit;
  padding: 0;
  background: #fff;
}
</style>

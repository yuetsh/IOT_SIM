<script setup lang="ts">
// 表设计器（仿 SSMS）：每行一列（列名、数据类型、允许 Null 值），右键行号设置主键，下方"列属性"里设置标识（自增）。
// 新表保存时输入表名（CREATE TABLE）；已有的表只能添加新列（ALTER TABLE ADD），已有的列只读。
// "查看 SQL 脚本"显示保存时要执行的 T-SQL，方便对照书上的 SQL 语句。
import { NButton, NCheckbox, NDropdown, NInput, NModal, useMessage } from 'naive-ui'
import { computed, nextTick, ref } from 'vue'
import { addColumns, COMMON_TYPES, createTable, execute, type DesignColumn, type ExplorerTable } from './sql'

const props = defineProps<{ database: string; table?: ExplorerTable }>()
const emit = defineEmits<{ saved: [table: string] }>()
const message = useMessage()

interface Row extends DesignColumn {
  existing: boolean
}

const blank = (): Row => ({ name: '', type: 'nchar(10)', nullable: true, identity: false, primaryKey: false, existing: false })
const rows = ref<Row[]>([...(props.table?.columns.map((c) => ({ ...c, existing: true })) ?? []), blank()])
const selected = ref(0)
const menu = ref<{ x: number; y: number; row: number } | null>(null)
const naming = ref<string | null>(null)
const script = ref<string | null>(null)
const saving = ref(false)

/** 填了列名的新列（最后一行空行用来添加） */
const newColumns = computed(() => rows.value.filter((r) => !r.existing && r.name.trim() !== ''))
const current = computed(() => rows.value[selected.value])

function edited(index: number) {
  // 在最后一行填了列名：下面再补一行空行
  if (index === rows.value.length - 1 && rows.value[index].name.trim() !== '') rows.value.push(blank())
}

function rowMenu(event: MouseEvent, row: number) {
  event.preventDefault()
  selected.value = row
  menu.value = null
  void nextTick(() => (menu.value = { x: event.clientX, y: event.clientY, row }))
}

const menuOptions = computed(() => {
  const row = menu.value ? rows.value[menu.value.row] : null
  if (!row || row.existing || !row.name.trim()) return [{ label: '（已有的列不能修改）', key: 'none', disabled: true }]
  return [
    { label: row.primaryKey ? '删除主键' : '设置主键', key: 'key' },
    { label: '删除列', key: 'delete' },
  ]
})

function chooseMenu(key: string) {
  const index = menu.value!.row
  menu.value = null
  const row = rows.value[index]
  if (key === 'key') {
    row.primaryKey = !row.primaryKey
    if (row.primaryKey) row.nullable = false
  } else if (key === 'delete') {
    rows.value.splice(index, 1)
    selected.value = Math.min(selected.value, rows.value.length - 1)
  }
}

function setIdentity(value: boolean) {
  const row = current.value
  if (value && !/^(int|bigint|smallint|tinyint)$/i.test(row.type.trim())) {
    message.warning('只有 int、bigint、smallint、tinyint 类型的列可以设为标识列（自增）')
    return
  }
  row.identity = value
  if (value) row.nullable = false
}

/** 保存前检查：列名不能重复，新表至少要有一列 */
function problem(): string | null {
  const names = rows.value.filter((r) => r.name.trim()).map((r) => r.name.trim().toLowerCase())
  if (names.length === 0) return '表里至少要有一列'
  const duplicate = names.find((n, i) => names.indexOf(n) !== i)
  if (duplicate) return `列名 "${duplicate}" 重复了`
  if (rows.value.filter((r) => r.identity).length > 1) return '一张表只能有一个标识列'
  if (props.table && newColumns.value.length === 0) return '没有要保存的新列（已有的列不能修改）'
  return null
}

const sqlFor = (name: string) =>
  props.table
    ? addColumns(props.table.name, newColumns.value)
    : createTable(
        name,
        rows.value.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim(), type: r.type.trim() })),
      )

function save() {
  const error = problem()
  if (error) {
    message.warning(error)
    return
  }
  if (props.table) void run(props.table.name)
  else naming.value = 'Table_1'
}

async function run(name: string) {
  saving.value = true
  try {
    await execute(props.database, sqlFor(name))
    message.success(props.table ? '已添加新列' : `已创建表 ${name}`)
    naming.value = null
    emit('saved', name)
  } catch (error) {
    message.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

function showScript() {
  const error = problem()
  script.value = error ? `-- ${error}` : sqlFor(props.table?.name ?? 'Table_1')
}
</script>

<template>
  <div class="design">
    <div class="bar">
      <span>{{ database }} - {{ table ? `dbo.${table.name}` : '新表' }}</span>
      <NButton size="small" type="primary" :loading="saving" @click="save">保存</NButton>
      <NButton size="small" @click="showScript">查看 SQL 脚本</NButton>
      <span class="hint">右键行号设置主键；选中一列后在下方设置标识（自增）{{ table ? '；已有的列不能修改，可以添加新列' : '' }}</span>
    </div>
    <div class="grid-wrap">
      <table class="grid">
        <thead>
          <tr>
            <th class="head" />
            <th>列名</th>
            <th>数据类型</th>
            <th>允许 Null 值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i" :class="{ selected: selected === i, existing: row.existing }" @click="selected = i">
            <th class="head" @contextmenu="rowMenu($event, i)">{{ row.primaryKey ? '🔑' : selected === i ? '▶' : '' }}</th>
            <td><input v-model="row.name" :readonly="row.existing" @input="edited(i)" /></td>
            <td>
              <input v-model="row.type" :readonly="row.existing" list="sim-sql-types" />
            </td>
            <td class="center">
              <input v-model="row.nullable" type="checkbox" :disabled="row.existing || row.primaryKey || row.identity" />
            </td>
          </tr>
        </tbody>
      </table>
      <datalist id="sim-sql-types">
        <option v-for="type in COMMON_TYPES" :key="type" :value="type" />
      </datalist>
    </div>
    <div class="properties">
      <div class="properties-title">列属性{{ current?.name ? `：${current.name}` : '' }}</div>
      <div v-if="current && current.name.trim()" class="property">
        <NCheckbox :checked="current.identity" :disabled="current.existing" @update:checked="setIdentity">
          标识规范（是标识）：插入数据时自动编号，从 1 开始，每次加 1
        </NCheckbox>
      </div>
      <div v-if="current && current.name.trim()" class="property">主键：{{ current.primaryKey ? '是' : '否' }}（右键行号设置）</div>
    </div>

    <NModal :show="naming !== null" preset="card" title="选择名称" style="width: 360px" @update:show="naming = null">
      <div style="margin-bottom: 8px">输入表名称：</div>
      <NInput v-if="naming !== null" v-model:value="naming" autofocus @keydown.enter="naming?.trim() && run(naming.trim())" />
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <NButton type="primary" :disabled="!naming?.trim()" :loading="saving" @click="run(naming!.trim())">确定</NButton>
          <NButton @click="naming = null">取消</NButton>
        </div>
      </template>
    </NModal>

    <NModal :show="script !== null" preset="card" title="SQL 脚本" style="width: 560px; max-width: calc(100vw - 32px)" @update:show="script = null">
      <pre class="script">{{ script }}</pre>
    </NModal>

    <NDropdown
      v-if="menu"
      show
      trigger="manual"
      placement="bottom-start"
      :x="menu.x"
      :y="menu.y"
      :options="menuOptions"
      size="small"
      @select="chooseMenu"
      @clickoutside="menu = null"
    />
  </div>
</template>

<style scoped>
.design {
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
  padding: 8px;
}

.grid {
  border-collapse: collapse;
  font-size: 13px;
  background: #fff;
}

.grid th,
.grid td {
  border: 1px solid #d4d4d4;
  padding: 0;
  font-weight: normal;
  text-align: left;
}

.grid thead th {
  background: #f3f3f3;
  padding: 3px 8px;
}

.grid .head {
  width: 26px;
  text-align: center;
  background: #f3f3f3;
  cursor: default;
}

.grid input:not([type]),
.grid input[list] {
  width: 180px;
  border: none;
  padding: 3px 6px;
  font: inherit;
  outline: none;
  background: transparent;
}

.grid tr.selected td {
  background: #e5f1fb;
}

.grid tr.existing input {
  color: #6b7280;
}

.center {
  text-align: center !important;
  width: 90px;
}

.properties {
  border-top: 1px solid #e5e7eb;
  padding: 8px;
  font-size: 13px;
  min-height: 90px;
}

.properties-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.property {
  margin: 4px 0;
}

.script {
  margin: 0;
  font-size: 13px;
  white-space: pre-wrap;
}
</style>

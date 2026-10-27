<script setup lang="ts">
// 对象资源管理器：只有“库 → 表”两层。点表名打开编辑数据，其他操作在 ⋯ 里（右键也是同一个菜单，照书上右键操作也行）。
import { NDropdown, type DropdownOption } from 'naive-ui'
import { nextTick, reactive, ref } from 'vue'
import type { ExplorerDatabase, ExplorerTable } from './sql'

export type ExplorerAction =
  | { kind: 'newDatabase' }
  | { kind: 'refresh' }
  | { kind: 'newQuery'; database: string }
  | { kind: 'newTable'; database: string }
  | { kind: 'dropDatabase'; database: string }
  | { kind: 'editRows'; database: string; table: ExplorerTable }
  | { kind: 'selectRows'; database: string; table: ExplorerTable }
  | { kind: 'design'; database: string; table: ExplorerTable }
  | { kind: 'dropTable'; database: string; table: ExplorerTable }

defineProps<{ databases: ExplorerDatabase[] }>()
const emit = defineEmits<{ action: [action: ExplorerAction] }>()

/** 收起的库（默认都展开，学生的库不多） */
const collapsed = reactive(new Set<string>())
const toggle = (name: string) => (collapsed.has(name) ? collapsed.delete(name) : collapsed.add(name))

// ---------- 菜单（⋯ 按钮和右键共用） ----------
const menu = ref<{ x: number; y: number; options: DropdownOption[]; actions: Map<string, ExplorerAction> } | null>(null)

function openMenu(event: MouseEvent, items: [string, ExplorerAction | null][]) {
  event.preventDefault()
  event.stopPropagation()
  // 右键：菜单出在鼠标处；点 ⋯（也可能是键盘按的，没有鼠标坐标）：出在按钮下面
  const anchor = event.type === 'contextmenu' ? null : (event.currentTarget as HTMLElement).getBoundingClientRect()
  menu.value = null
  void nextTick(() => {
    menu.value = {
      x: anchor ? anchor.left : event.clientX,
      y: anchor ? anchor.bottom : event.clientY,
      options: items.map(([label, action], i) => (action ? { label, key: String(i) } : { type: 'divider', key: `d${i}` })),
      actions: new Map(items.flatMap(([, action], i) => (action ? [[String(i), action] as const] : []))),
    }
  })
}

function choose(key: string) {
  const action = menu.value?.actions.get(key)
  menu.value = null
  if (action) emit('action', action)
}

function databaseMenu(event: MouseEvent, database: string) {
  openMenu(event, [
    ['新建表', { kind: 'newTable', database }],
    ['新建查询', { kind: 'newQuery', database }],
    ['-', null],
    ['删除数据库', { kind: 'dropDatabase', database }],
  ])
}

function tableMenu(event: MouseEvent, database: string, table: ExplorerTable) {
  openMenu(event, [
    ['编辑数据（前 200 行）', { kind: 'editRows', database, table }],
    ['查询数据（前 1000 行）', { kind: 'selectRows', database, table }],
    ['设计表结构', { kind: 'design', database, table }],
    ['-', null],
    ['删除表', { kind: 'dropTable', database, table }],
  ])
}

/** 鼠标停在表名上显示的列：每列一行“列名  类型  主键 / 可空” */
function columnsTip(table: ExplorerTable) {
  const lines = table.columns.map((c) => [c.name, c.type, c.primaryKey ? '主键' : '', c.nullable ? '可空' : ''].filter(Boolean).join('  '))
  return `点一下编辑数据\n\n${lines.join('\n')}`
}
</script>

<template>
  <div class="explorer">
    <div class="head">
      <span class="title">数据库</span>
      <button class="head-btn" title="刷新" @click="emit('action', { kind: 'refresh' })">↻</button>
      <button class="head-btn add" @click="emit('action', { kind: 'newDatabase' })">+ 新建库</button>
    </div>

    <div class="tree">
      <p v-if="databases.length === 0" class="empty">还没有数据库。点上面的“+ 新建库”，或者在页面顶部“恢复实验初始数据”。</p>

      <div v-for="db in databases" :key="db.name" class="db">
        <div class="row db-row" @click="toggle(db.name)" @contextmenu="databaseMenu($event, db.name)">
          <span class="arrow">{{ collapsed.has(db.name) ? '▸' : '▾' }}</span>
          <svg class="icon db-icon" viewBox="0 0 16 16" aria-hidden="true">
            <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />
            <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
          </svg>
          <span class="name">{{ db.name }}</span>
          <span class="count">{{ db.tables.length }} 张表</span>
          <button class="more" title="更多操作" @click="databaseMenu($event, db.name)">⋯</button>
        </div>

        <div v-if="!collapsed.has(db.name)" class="tables">
          <div
            v-for="table in db.tables"
            :key="table.name"
            class="row table-row"
            :title="columnsTip(table)"
            @click="emit('action', { kind: 'editRows', database: db.name, table })"
            @contextmenu="tableMenu($event, db.name, table)"
          >
            <svg class="icon table-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M2 6.5h12M6.5 6.5V13" />
            </svg>
            <span class="name">{{ table.name }}</span>
            <button class="more" title="更多操作" @click="tableMenu($event, db.name, table)">⋯</button>
          </div>
          <div class="row new-table" @click="emit('action', { kind: 'newTable', database: db.name })">+ 新建表</div>
        </div>
      </div>
    </div>

    <NDropdown
      v-if="menu"
      show
      trigger="manual"
      placement="bottom-start"
      :x="menu.x"
      :y="menu.y"
      :options="menu.options"
      size="small"
      @select="choose"
      @clickoutside="menu = null"
    />
  </div>
</template>

<style scoped>
.explorer {
  display: flex;
  flex-direction: column;
  min-height: 0;
  font-size: 13px;
  background: #fff;
}

.head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.title {
  flex: 1;
  font-weight: 600;
}

.head-btn {
  padding: 2px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #4b5563;
  font: inherit;
  cursor: pointer;
}

.head-btn:hover {
  background: #f3f4f6;
}

.head-btn.add {
  color: #2563eb;
}

.tree {
  flex: 1;
  overflow: auto;
  padding: 6px;
}

.db + .db {
  margin-top: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 4px 0 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.row:hover {
  background: #eff6ff;
}

.arrow {
  width: 12px;
  color: #6b7280;
}

.name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.db-row .name {
  font-weight: 600;
}

.icon {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.db-icon {
  stroke: #2563eb;
}

.db-icon ellipse {
  fill: #dbeafe;
}

.table-icon {
  stroke: #6b7280;
}

.table-icon rect {
  fill: #f9fafb;
}

/* 表挂在库下面：往里缩进，左边一条竖线对齐库图标 */
.tables {
  margin-left: 33px;
  padding-left: 6px;
  border-left: 1px solid #e5e7eb;
}

.count {
  font-size: 12px;
  color: #9ca3af;
}

.new-table {
  color: #2563eb;
  padding-left: 30px;
}

/* ⋯ 平时浅一点，鼠标移到这一行再变深 */
.more {
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #c0c4cc;
  font: inherit;
  line-height: 22px;
  cursor: pointer;
}

.row:hover .more {
  color: #4b5563;
}

.more:hover {
  background: #dbeafe;
}

.empty {
  margin: 8px 6px;
  color: #9ca3af;
  line-height: 1.6;
}
</style>

<script setup lang="ts">
// 对象资源管理器（仿 SSMS）：数据库 → 库 → 表 → 列。右键菜单里的操作交给页面处理。
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

/** 展开的节点：root、db:库名、tables:库名、table:库名/表名、columns:库名/表名 */
const expanded = reactive(new Set<string>(['root']))
const toggle = (key: string) => (expanded.has(key) ? expanded.delete(key) : expanded.add(key))

// ---------- 右键菜单 ----------
const menu = ref<{ x: number; y: number; options: DropdownOption[]; actions: Map<string, ExplorerAction> } | null>(null)

function openMenu(event: MouseEvent, items: [string, ExplorerAction][]) {
  event.preventDefault()
  menu.value = null
  void nextTick(() => {
    menu.value = {
      x: event.clientX,
      y: event.clientY,
      options: items.map(([label], i) => (label === '-' ? { type: 'divider', key: `d${i}` } : { label, key: String(i) })),
      actions: new Map(items.map(([, action], i) => [String(i), action])),
    }
  })
}

function choose(key: string) {
  const action = menu.value?.actions.get(key)
  menu.value = null
  if (action) emit('action', action)
}

const REFRESH: ExplorerAction = { kind: 'refresh' }

function rootMenu(event: MouseEvent) {
  openMenu(event, [
    ['新建数据库…', { kind: 'newDatabase' }],
    ['-', REFRESH],
    ['刷新', REFRESH],
  ])
}

function databaseMenu(event: MouseEvent, database: string) {
  openMenu(event, [
    ['新建查询', { kind: 'newQuery', database }],
    ['新建表…', { kind: 'newTable', database }],
    ['-', REFRESH],
    ['删除', { kind: 'dropDatabase', database }],
    ['刷新', REFRESH],
  ])
}

function tablesMenu(event: MouseEvent, database: string) {
  openMenu(event, [
    ['新建表…', { kind: 'newTable', database }],
    ['-', REFRESH],
    ['刷新', REFRESH],
  ])
}

function tableMenu(event: MouseEvent, database: string, table: ExplorerTable) {
  openMenu(event, [
    ['新建表…', { kind: 'newTable', database }],
    ['设计', { kind: 'design', database, table }],
    ['选择前 1000 行', { kind: 'selectRows', database, table }],
    ['编辑前 200 行', { kind: 'editRows', database, table }],
    ['-', REFRESH],
    ['删除', { kind: 'dropTable', database, table }],
    ['刷新', REFRESH],
  ])
}

function columnText(column: ExplorerTable['columns'][number]) {
  const flags = [column.primaryKey ? 'PK' : '', column.type, column.nullable ? 'null' : 'not null'].filter(Boolean)
  return `${column.name} (${flags.join(', ')})`
}
</script>

<template>
  <div class="explorer">
    <div class="title">对象资源管理器</div>
    <ul class="tree">
      <li>
        <div class="node" @click="toggle('root')" @contextmenu="rootMenu">
          <span class="arrow">{{ expanded.has('root') ? '▾' : '▸' }}</span
          >📁 数据库
        </div>
        <ul v-if="expanded.has('root')">
          <li v-if="databases.length === 0" class="empty">（还没有数据库：右键"数据库"新建，或在上方恢复实验初始数据）</li>
          <li v-for="db in databases" :key="db.name">
            <div class="node" @click="toggle(`db:${db.name}`)" @contextmenu="databaseMenu($event, db.name)">
              <span class="arrow">{{ expanded.has(`db:${db.name}`) ? '▾' : '▸' }}</span
              >🛢 {{ db.name }}
            </div>
            <ul v-if="expanded.has(`db:${db.name}`)">
              <li>
                <div class="node" @click="toggle(`tables:${db.name}`)" @contextmenu="tablesMenu($event, db.name)">
                  <span class="arrow">{{ expanded.has(`tables:${db.name}`) ? '▾' : '▸' }}</span
                  >📁 表
                </div>
                <ul v-if="expanded.has(`tables:${db.name}`)">
                  <li v-if="db.tables.length === 0" class="empty">（没有表）</li>
                  <li v-for="table in db.tables" :key="table.name">
                    <div
                      class="node"
                      title="右键：编辑前 200 行、设计、删除"
                      @click="toggle(`table:${db.name}/${table.name}`)"
                      @contextmenu="tableMenu($event, db.name, table)"
                    >
                      <span class="arrow">{{ expanded.has(`table:${db.name}/${table.name}`) ? '▾' : '▸' }}</span
                      >▦ dbo.{{ table.name }}
                    </div>
                    <ul v-if="expanded.has(`table:${db.name}/${table.name}`)">
                      <li>
                        <div class="node" @click="toggle(`columns:${db.name}/${table.name}`)">
                          <span class="arrow">{{ expanded.has(`columns:${db.name}/${table.name}`) ? '▾' : '▸' }}</span
                          >📁 列
                        </div>
                        <ul v-if="expanded.has(`columns:${db.name}/${table.name}`)">
                          <li v-for="column in table.columns" :key="column.name" class="node leaf">
                            {{ column.primaryKey ? '🔑' : '▫' }} {{ columnText(column) }}
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>
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

.title {
  padding: 6px 8px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

.tree,
.tree ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree {
  flex: 1;
  overflow: auto;
  padding: 4px 0;
}

.tree ul {
  padding-left: 16px;
}

.node {
  padding: 2px 6px;
  white-space: nowrap;
  cursor: default;
  user-select: none;
}

.node:hover {
  background: #e5f1fb;
}

.leaf {
  padding-left: 20px;
  color: #374151;
}

.arrow {
  display: inline-block;
  width: 14px;
  color: #6b7280;
}

.empty {
  padding: 2px 6px 2px 22px;
  color: #9ca3af;
  white-space: normal;
}
</style>

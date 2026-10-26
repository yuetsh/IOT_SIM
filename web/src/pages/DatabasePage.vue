<script setup lang="ts">
// 数据库页面（代替教材里的 SSMS）：左边对象资源管理器，右边查询窗口、编辑前 200 行、表设计器的标签页。
// 每个学生一套自己的数据库，长期保存；可以按实验恢复初始数据。
import { NButton, NInput, NModal, NSelect, NTabPane, NTabs, useDialog, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import { currentUser } from '../auth'
import DesignTab from '../database/DesignTab.vue'
import EditTab from '../database/EditTab.vue'
import ObjectExplorer, { type ExplorerAction } from '../database/ObjectExplorer.vue'
import QueryTab from '../database/QueryTab.vue'
import { execute, loadExplorer, quoteName, type ExplorerDatabase, type ExplorerTable } from '../database/sql'
import { renderSampleTag, sampleOptions } from '../samples'

type Tab =
  | { key: string; kind: 'query'; title: string; database: string; sql?: string; run?: boolean }
  | { key: string; kind: 'edit'; title: string; database: string; table: ExplorerTable }
  | { key: string; kind: 'design'; title: string; database: string; table?: ExplorerTable }

/** 新开的标签页（编号由 open 分配）：对联合类型的每一种分别去掉 key */
type WithoutKey<T> = T extends unknown ? Omit<T, 'key'> : never
type NewTab = WithoutKey<Tab>

const message = useMessage()
const dialog = useDialog()
const databases = ref<ExplorerDatabase[]>([])
const tabs = ref<Tab[]>([])
const active = ref<string>()
let nextKey = 1
let queryCount = 0

const databaseNames = computed(() => databases.value.map((d) => d.name))

async function refresh() {
  try {
    databases.value = (await loadExplorer()).databases
  } catch (error) {
    message.error((error as Error).message)
  }
}

function open(tab: NewTab) {
  const key = String(nextKey++)
  tabs.value.push({ ...tab, key } as Tab)
  active.value = key
}

function newQuery(database = databaseNames.value[0] ?? 'master', sql = '', run = false, title?: string) {
  open({ kind: 'query', title: title ?? `SQLQuery${++queryCount}.sql`, database, sql, run })
}

function close(key: string) {
  const index = tabs.value.findIndex((t) => t.key === key)
  tabs.value.splice(index, 1)
  if (active.value === key) active.value = tabs.value[Math.max(0, index - 1)]?.key
}

// ---------- 对象资源管理器的操作 ----------

const creatingDatabase = ref<string | null>(null)

async function onAction(action: ExplorerAction) {
  switch (action.kind) {
    case 'refresh':
      await refresh()
      break
    case 'newDatabase':
      creatingDatabase.value = ''
      break
    case 'newQuery':
      newQuery(action.database)
      break
    case 'newTable':
      open({ kind: 'design', title: `${action.database} - 新表`, database: action.database })
      break
    case 'design':
      open({ kind: 'design', title: `${action.database} - dbo.${action.table.name}`, database: action.database, table: action.table })
      break
    case 'editRows':
      open({ kind: 'edit', title: `${action.database} - dbo.${action.table.name}`, database: action.database, table: action.table })
      break
    case 'selectRows': {
      // 和 SSMS 生成的语句格式一样
      const columns = action.table.columns.map((c) => quoteName(c.name)).join('\n      ,')
      newQuery(action.database, `SELECT TOP 1000 ${columns}\n  FROM [dbo].${quoteName(action.table.name)}`, true)
      break
    }
    case 'dropDatabase':
      confirmDrop(`删除数据库"${action.database}"？库里的所有表和数据都会被删除，不能恢复。`, 'master', `DROP DATABASE ${quoteName(action.database)}`, () => {
        tabs.value = tabs.value.filter((t) => t.database !== action.database)
      })
      break
    case 'dropTable':
      confirmDrop(`删除表"dbo.${action.table.name}"？表里的数据会一起删除，不能恢复。`, action.database, `DROP TABLE ${quoteName(action.table.name)}`, () => {
        tabs.value = tabs.value.filter((t) => !(t.database === action.database && 'table' in t && t.table?.name === action.table.name))
      })
      break
  }
}

function confirmDrop(content: string, database: string, sql: string, after: () => void) {
  dialog.warning({
    title: '删除对象',
    content,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await execute(database, sql)
        after()
        await refresh()
      } catch (error) {
        message.error((error as Error).message)
      }
    },
  })
}

async function createDatabase() {
  const name = creatingDatabase.value?.trim()
  if (!name) return
  try {
    await execute('master', `CREATE DATABASE ${quoteName(name)}`)
    creatingDatabase.value = null
    await refresh()
  } catch (error) {
    message.error((error as Error).message)
  }
}

/** 表设计器保存后：刷新树，标签页换成已保存的表 */
async function designSaved(tab: Tab, table: string) {
  await refresh()
  const saved = databases.value.find((d) => d.name === tab.database)?.tables.find((t) => t.name === table)
  if (saved && tab.kind === 'design') {
    tab.table = saved
    tab.title = `${tab.database} - dbo.${saved.name}`
    tab.key = `${tab.key}*`
    active.value = tab.key
  }
}

// ---------- 恢复实验初始数据 ----------

const experiments = ref<{ id: string; title: string }[]>([])
const restoring = ref<string | null>(null)
const restoreBusy = ref(false)

async function openRestore() {
  experiments.value = await api('GET', '/api/db/experiments')
  restoring.value = experiments.value[0]?.id ?? null
}

async function restore() {
  if (!restoring.value) return
  restoreBusy.value = true
  try {
    const { databases: restored } = await api<{ databases: string[] }>('POST', '/api/db/restore', { sampleId: restoring.value })
    message.success(`已恢复：${restored.join('、') || '（这个实验没有数据库）'}`)
    restoring.value = null
    tabs.value = tabs.value.filter((t) => !restored.includes(t.database))
    await refresh()
  } catch (error) {
    message.error((error as Error).message)
  } finally {
    restoreBusy.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <RouterLink to="/" class="nav-link">← 返回实验</RouterLink>
      <strong>数据库</strong>
      <NButton size="small" type="primary" @click="newQuery()">新建查询</NButton>
      <NButton size="small" @click="creatingDatabase = ''">新建数据库</NButton>
      <NButton size="small" @click="openRestore">恢复实验初始数据</NButton>
      <span class="spacer" />
      <span class="user">{{ currentUser?.name }}的数据库（只有自己能看到）</span>
    </header>
    <div class="workspace">
      <ObjectExplorer class="explorer" :databases="databases" @action="onAction" />
      <main class="documents">
        <NTabs v-if="tabs.length" v-model:value="active" type="card" size="small" closable class="tabs" @close="close">
          <NTabPane v-for="tab in tabs" :key="tab.key" :name="tab.key" :tab="tab.title" display-directive="show">
            <QueryTab
              v-if="tab.kind === 'query'"
              v-model:database="tab.database"
              :databases="databaseNames"
              :initial-sql="tab.sql"
              :run-on-open="tab.run"
              @changed="refresh"
            />
            <EditTab v-else-if="tab.kind === 'edit'" :database="tab.database" :table="tab.table" />
            <DesignTab v-else :key="tab.key" :database="tab.database" :table="tab.table" @saved="designSaved(tab, $event)" />
          </NTabPane>
        </NTabs>
        <div v-else class="empty">
          <p>右键左边的"数据库"新建数据库；右键表可以编辑数据、设计表结构。</p>
          <p>也可以点"新建查询"，用 SQL 语句建库、建表、增删改查。</p>
          <p>运行要用数据库的实验（教材项目 6 的任务 2、3，项目 8）时，平台会自动建好需要的库；把实验库恢复成初始数据，点"恢复实验初始数据"。</p>
        </div>
      </main>
    </div>

    <NModal :show="creatingDatabase !== null" preset="card" title="新建数据库" style="width: 380px" @update:show="creatingDatabase = null">
      <div style="margin-bottom: 8px">数据库名称：</div>
      <NInput v-if="creatingDatabase !== null" v-model:value="creatingDatabase" autofocus placeholder="例如：环境数据表" @keydown.enter="createDatabase" />
      <template #footer>
        <div class="dialog-buttons">
          <NButton type="primary" :disabled="!creatingDatabase?.trim()" @click="createDatabase">确定</NButton>
          <NButton @click="creatingDatabase = null">取消</NButton>
        </div>
      </template>
    </NModal>

    <NModal :show="restoring !== null" preset="card" title="恢复实验初始数据" style="width: 460px" @update:show="restoring = null">
      <NSelect v-model:value="restoring" :options="sampleOptions(experiments)" :render-tag="renderSampleTag" />
      <p class="warning">会用实验的初始数据替换实验用到的数据库（如"环境数据表"），你在这些库里做的改动会丢失；其他数据库不受影响。</p>
      <template #footer>
        <div class="dialog-buttons">
          <NButton type="warning" :loading="restoreBusy" :disabled="!restoring" @click="restore">恢复</NButton>
          <NButton @click="restoring = null">取消</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}

.spacer {
  flex: 1;
}

.user {
  font-size: 13px;
  color: #4b5563;
}

.nav-link {
  color: #2563eb;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.workspace {
  flex: 1;
  display: flex;
  min-height: 0;
}

.explorer {
  width: 280px;
  flex: none;
  border-right: 1px solid #e5e7eb;
}

.documents {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tabs :deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
}

.tabs :deep(.n-tab-pane) {
  height: 100%;
  padding: 0;
  background: #fff;
}

.empty {
  margin: auto;
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  line-height: 1.8;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.warning {
  color: #b45309;
  font-size: 13px;
}

@media (max-width: 700px) {
  .workspace {
    flex-direction: column;
  }

  .explorer {
    width: auto;
    max-height: 40vh;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }
}
</style>

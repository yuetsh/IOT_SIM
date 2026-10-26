// 数据库页面（代替 SSMS）的数据和 T-SQL 生成：编辑表数据、表设计器的操作都生成 T-SQL 交给服务器执行，
// 和学生在查询窗口里写的语句走同一套转写和报错。
import { api } from '../api'

export interface ExplorerColumn {
  name: string
  type: string
  nullable: boolean
  identity: boolean
  primaryKey: boolean
}

export interface ExplorerTable {
  name: string
  columns: ExplorerColumn[]
}

export interface ExplorerDatabase {
  name: string
  tables: ExplorerTable[]
}

export interface ResultSet {
  columns: { name: string; type: string | null }[]
  rows: (string | number | null)[][]
  total: number
}

export type QueryReply =
  { type: 'result'; database: string; results: ResultSet[]; affected: number; ms: number } | { type: 'error'; number: number; message: string; line: number }

export const loadExplorer = () => api<{ databases: ExplorerDatabase[] }>('GET', '/api/db')
export const runQuery = (database: string, sql: string) => api<QueryReply>('POST', '/api/db/query', { database, sql })

/** 执行并在出错时抛出（编辑表数据、设计器用）；消息和 SQL Server 一样 */
export async function execute(database: string, sql: string) {
  const reply = await runQuery(database, sql)
  if (reply.type === 'error') throw new Error(reply.message)
  return reply
}

export const quoteName = (name: string) => `[${name.replace(/]/g, ']]')}]`

/** 值写成 T-SQL 字面量；null 是 NULL（和 SSMS 一样，在单元格里输入 NULL 表示空值） */
export const literal = (value: string | number | null) =>
  value === null ? 'NULL' : typeof value === 'number' ? String(value) : `N'${value.replace(/'/g, "''")}'`

/** 编辑表格里输入的文字转成要保存的值 */
export const parseInput = (text: string): string | null => (text === 'NULL' ? null : text)

const isBinary = (column: ExplorerColumn) => /^(binary|varbinary|image)/i.test(column.type)

/**
 * 定位一行的条件：有主键时按主键；没有主键时按所有列的原值（配合 TOP (1)，有完全相同的行时只改一行，和 SSMS 一样）。
 * 二进制列无法按显示的值比较，不放进条件。
 */
export function rowCondition(table: ExplorerTable, original: (string | number | null)[]) {
  const keys = table.columns.map((column, i) => ({ column, value: original[i] })).filter(({ column }) => column.primaryKey)
  const parts = (keys.length > 0 ? keys : table.columns.map((column, i) => ({ column, value: original[i] })).filter(({ column }) => !isBinary(column))).map(
    ({ column, value }) => (value === null ? `${quoteName(column.name)} IS NULL` : `${quoteName(column.name)} = ${literal(value)}`),
  )
  return parts.join(' AND ')
}

export function updateCell(table: ExplorerTable, columnIndex: number, value: string | null, original: (string | number | null)[]) {
  return `UPDATE TOP (1) ${quoteName(table.name)} SET ${quoteName(table.columns[columnIndex].name)} = ${literal(value)} WHERE ${rowCondition(table, original)}`
}

export function deleteRow(table: ExplorerTable, original: (string | number | null)[]) {
  return `DELETE TOP (1) FROM ${quoteName(table.name)} WHERE ${rowCondition(table, original)}`
}

/** 新增一行：只写用户填过的列（自增列和没填的列由数据库决定） */
export function insertRow(table: ExplorerTable, values: Map<number, string | null>) {
  const entries = [...values].filter(([i]) => !table.columns[i].identity).sort(([a], [b]) => a - b)
  if (entries.length === 0) return `INSERT INTO ${quoteName(table.name)} DEFAULT VALUES`
  return `INSERT INTO ${quoteName(table.name)} (${entries.map(([i]) => quoteName(table.columns[i].name)).join(', ')}) VALUES (${entries.map(([, v]) => literal(v)).join(', ')})`
}

/** 表设计器里的一列 */
export interface DesignColumn {
  name: string
  type: string
  nullable: boolean
  identity: boolean
  primaryKey: boolean
}

/** 设计器"数据类型"下拉里的常用类型（和 SSMS 一样也可以直接输入，如 varchar(20)） */
export const COMMON_TYPES = [
  'int',
  'bigint',
  'smallint',
  'tinyint',
  'bit',
  'float',
  'real',
  'decimal(18, 0)',
  'money',
  'char(10)',
  'varchar(50)',
  'varchar(MAX)',
  'nchar(10)',
  'nvarchar(50)',
  'nvarchar(MAX)',
  'text',
  'ntext',
  'date',
  'datetime',
  'smalldatetime',
  'time(7)',
  'uniqueidentifier',
  'varbinary(MAX)',
  'image',
]

export function columnDefinition(column: DesignColumn) {
  const identity = column.identity ? ' IDENTITY(1,1)' : ''
  const nullable = column.nullable && !column.primaryKey && !column.identity ? ' NULL' : ' NOT NULL'
  return `${quoteName(column.name)} ${column.type.replace(/^time\(7\)$/i, 'time')}${identity}${nullable}`
}

export function createTable(name: string, columns: DesignColumn[]) {
  const keys = columns.filter((c) => c.primaryKey)
  const lines = columns.map((c) => `    ${columnDefinition(c)}`)
  if (keys.length > 0) lines.push(`    PRIMARY KEY (${keys.map((c) => quoteName(c.name)).join(', ')})`)
  return `CREATE TABLE ${quoteName(name)}\n(\n${lines.join(',\n')}\n)`
}

export function addColumns(table: string, columns: DesignColumn[]) {
  return columns.map((c) => `ALTER TABLE ${quoteName(table)} ADD ${columnDefinition(c)}`).join('\n')
}

/** 消息栏的文字，和 SSMS 一致：每个结果集、增删改各一行"(n 行受影响)"；出错时"消息 208，级别 16，状态 1，第 1 行" */
export function messages(reply: QueryReply): { text: string; error: boolean }[] {
  if (reply.type === 'error') {
    return [{ text: `消息 ${reply.number}，级别 16，状态 1，第 ${reply.line} 行\n${reply.message}`, error: true }]
  }
  const lines = reply.results.map((r) => ({ text: `(${r.total} 行受影响)`, error: false }))
  if (reply.affected >= 0) lines.push({ text: `(${reply.affected} 行受影响)`, error: false })
  if (lines.length === 0) lines.push({ text: '命令已成功完成。', error: false })
  return lines
}

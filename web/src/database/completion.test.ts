import { describe, expect, test } from 'bun:test'
import { sqlSuggestions, type SqlSchema } from './completion'
import type { ExplorerTable } from './sql'

const column = (name: string, type = 'varchar(50)', primaryKey = false) => ({ name, type, nullable: !primaryKey, identity: primaryKey, primaryKey })

const environment: ExplorerTable = { name: 'CampusEnvironment', columns: [column('ID', 'int', true), column('light'), column('addtime', 'datetime')] }
const users: ExplorerTable = { name: '用户表', columns: [column('ID', 'int', true), column('姓名')] }
const spaced: ExplorerTable = { name: 'my table', columns: [column('Order')] }
const schema: SqlSchema = { databases: ['master', '环境数据库'], tables: [environment, users, spaced] }

/** | 是光标位置 */
function suggest(sql: string, trigger?: string) {
  const offset = sql.indexOf('|')
  return sqlSuggestions(sql.replace('|', ''), offset, schema, trigger)
}
const labels = (sql: string, trigger?: string) => suggest(sql, trigger).map((s) => s.label)
const sorted = (sql: string, trigger?: string) =>
  suggest(sql, trigger)
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map((s) => s.label)

describe('查询窗口的自动补全', () => {
  test('一般位置：关键字、函数、数据类型、表、列都有', () => {
    const items = suggest('SEL|')
    expect(items.find((s) => s.label === 'SELECT')?.detail).toBe('查询')
    expect(items.find((s) => s.label === 'GETDATE()')).toMatchObject({ kind: 'function', insert: 'GETDATE($0)', snippet: true })
    expect(items.find((s) => s.label === 'COUNT(*)')?.insert).toBe('COUNT(*)')
    expect(items.find((s) => s.label === 'nvarchar(50)')?.kind).toBe('type')
    expect(items.find((s) => s.label === 'CampusEnvironment')?.kind).toBe('table')
    expect(items.find((s) => s.label === 'light')?.detail).toBe('列 · varchar(50)（CampusEnvironment）')
  })

  test('同名的列只列一次，说明里写出所有表', () => {
    const ids = suggest('|').filter((s) => s.label === 'ID')
    expect(ids).toHaveLength(1)
    expect(ids[0].detail).toBe('列 · int · 主键 · 自增 · 不允许空（CampusEnvironment、用户表）')
  })

  test('FROM / JOIN / UPDATE / INTO 后面表名排在最前', () => {
    expect(sorted('SELECT * FROM |').slice(0, 3)).toEqual(['CampusEnvironment', 'my table', '用户表'])
    expect(sorted('UPDATE |')[0]).toBe('CampusEnvironment')
    expect(sorted('INSERT INTO C|')[0]).toBe('CampusEnvironment')
    expect(sorted('SELECT * FROM 用户表, |')[0]).toBe('CampusEnvironment')
  })

  test('写了表名后只列用到的表的列，还没写时列所有表的列', () => {
    expect(labels('SELECT | FROM 用户表')).toContain('姓名')
    expect(labels('SELECT | FROM 用户表')).not.toContain('light')
    expect(labels('SELECT | FROM 用户表 u JOIN CampusEnvironment e ON u.ID = e.ID')).toContain('light')
    expect(labels('SELECT |')).toContain('light')
    expect(labels('SELECT |')).toContain('姓名')
  })

  test('空格触发：只在要写表名的地方弹出', () => {
    expect(labels('SELECT * FROM |', ' ')).toContain('CampusEnvironment')
    expect(labels('SELECT * FROM 用户表 |', ' ')).toEqual([])
    expect(labels('SELECT |', ' ')).toEqual([])
  })

  test('表名. 列出这张表的列（按表里的顺序）', () => {
    expect(labels('SELECT CampusEnvironment.| FROM CampusEnvironment', '.')).toEqual(['ID', 'light', 'addtime'])
    expect(labels('SELECT campusenvironment.|', '.')).toEqual(['ID', 'light', 'addtime'])
  })

  test('别名. 列出别名对应的表的列，支持 AS、JOIN、逗号分隔', () => {
    expect(labels('SELECT e.| FROM CampusEnvironment e', '.')).toEqual(['ID', 'light', 'addtime'])
    expect(labels('SELECT u.| FROM CampusEnvironment AS e INNER JOIN 用户表 AS u ON e.ID = u.ID', '.')).toEqual(['ID', '姓名'])
    expect(labels('SELECT u.| FROM CampusEnvironment e, dbo.用户表 u', '.')).toEqual(['ID', '姓名'])
    expect(labels('SELECT t.| FROM [my table] t', '.')).toEqual(['Order'])
  })

  test('几条语句用同一个别名时，取离光标最近的', () => {
    const sql = 'SELECT * FROM CampusEnvironment t\nSELECT t.| FROM 用户表 t'
    expect(labels(sql, '.')).toEqual(['ID', '姓名'])
  })

  test('表名后面的关键字不当别名', () => {
    expect(labels('SELECT CampusEnvironment.| FROM CampusEnvironment WHERE ID = 1', '.')).toEqual(['ID', 'light', 'addtime'])
  })

  test('不认识的前缀不弹出；dbo. 列出表', () => {
    expect(labels('SELECT x.| FROM CampusEnvironment', '.')).toEqual([])
    expect(labels('SELECT 3.|', '.')).toEqual([])
    expect(labels('SELECT * FROM dbo.|', '.')).toEqual(['CampusEnvironment', '用户表', 'my table'])
  })

  test('名字需要时加方括号；已经输入了 [ 时不加', () => {
    expect(suggest('SELECT * FROM |').find((s) => s.label === 'my table')?.insert).toBe('[my table]')
    expect(suggest('SELECT t.| FROM [my table] t', '.')[0].insert).toBe('[Order]')
    expect(suggest('SELECT * FROM [m|').find((s) => s.label === 'my table')?.insert).toBe('my table')
    expect(suggest('SELECT * FROM [m|').every((s) => s.kind === 'table' || s.kind === 'column')).toBe(true)
    expect(suggest('SELECT t.[|] FROM [my table] t')[0].insert).toBe('Order')
    expect(suggest('SELECT * FROM |').find((s) => s.label === '用户表')?.insert).toBe('用户表')
  })

  test('USE 后面列数据库', () => {
    expect(labels('USE |', ' ')).toEqual(['master', '环境数据库'])
  })

  test('字符串和注释里不补全', () => {
    expect(labels("SELECT * FROM 用户表 WHERE 姓名 = '张|")).toEqual([])
    expect(labels("SELECT * FROM 用户表 WHERE 姓名 = 'a.|", '.')).toEqual([])
    expect(labels('-- 查询 FROM |', ' ')).toEqual([])
    expect(labels('/* e.| */', '.')).toEqual([])
    expect(labels("SELECT 'it''s' AS a, |")).toContain('SELECT')
    expect(labels('-- 注释\nSEL|')).toContain('SELECT')
  })
})

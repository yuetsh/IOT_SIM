// 查询窗口的自动补全（仿 SSMS 的 IntelliSense）：T-SQL 关键字、函数、数据类型，当前数据库的表名和列名；
// 输入"表名."或"别名."时只列这张表的列。只做简单的词法分析（找 FROM / JOIN / UPDATE / INTO 后面的表和别名），够学生用就行。
// 这里不依赖 Monaco，方便单独测试；注册到编辑器见 sql-language.ts。
// 关键字、函数、数据类型只列服务器能执行的（见 runtime/Sim.Data/Engine/Translator.cs）。
import type { ExplorerTable } from './sql'

export type SuggestionKind = 'keyword' | 'function' | 'type' | 'table' | 'column' | 'database'

export interface SqlSuggestion {
  label: string
  kind: SuggestionKind
  /** 插入的文字；snippet 为 true 时是 Monaco 的代码片段格式（$0 是插入后光标的位置） */
  insert: string
  snippet?: boolean
  /** 显示在右边的中文说明 */
  detail: string
  sort: string
}

export interface SqlSchema {
  databases: string[]
  tables: ExplorerTable[]
}

const KEYWORDS: [string, string][] = [
  ['SELECT', '查询'],
  ['FROM', '从哪张表'],
  ['WHERE', '筛选条件'],
  ['INSERT INTO', '插入数据'],
  ['VALUES', '插入的值'],
  ['UPDATE', '修改数据'],
  ['SET', '要修改的列和新值'],
  ['DELETE FROM', '删除数据'],
  ['CREATE DATABASE', '新建数据库'],
  ['CREATE TABLE', '新建表'],
  ['ALTER TABLE', '修改表结构'],
  ['ADD', '添加列'],
  ['DROP TABLE', '删除表'],
  ['DROP DATABASE', '删除数据库'],
  ['TRUNCATE TABLE', '清空表里的数据'],
  ['USE', '切换数据库'],
  ['ORDER BY', '排序'],
  ['GROUP BY', '分组'],
  ['HAVING', '分组后的筛选条件'],
  ['ASC', '升序（从小到大）'],
  ['DESC', '降序（从大到小）'],
  ['TOP', '只取前几行'],
  ['DISTINCT', '去掉重复的行'],
  ['AS', '起别名'],
  ['AND', '并且'],
  ['OR', '或者'],
  ['NOT', '不'],
  ['NULL', '空值'],
  ['IS NULL', '是空值'],
  ['IS NOT NULL', '不是空值'],
  ['IN', '在列表里'],
  ['LIKE', '模糊匹配（% 任意多个字符，_ 一个字符）'],
  ['BETWEEN', '在两个值之间（BETWEEN 小 AND 大）'],
  ['JOIN', '连接另一张表'],
  ['INNER JOIN', '内连接'],
  ['LEFT JOIN', '左连接'],
  ['RIGHT JOIN', '右连接'],
  ['CROSS JOIN', '交叉连接'],
  ['ON', '连接条件'],
  ['UNION', '合并两个查询的结果（去重）'],
  ['UNION ALL', '合并两个查询的结果'],
  ['CASE', '条件取值（CASE WHEN ... THEN ... END）'],
  ['WHEN', '条件'],
  ['THEN', '条件成立时的值'],
  ['ELSE', '都不成立时的值'],
  ['END', '结束 CASE'],
  ['PRIMARY KEY', '主键'],
  ['IDENTITY(1,1)', '自增列（标识列）'],
  ['NOT NULL', '不允许空值'],
  ['DEFAULT', '默认值'],
]

const FUNCTIONS: [string, string, string][] = [
  ['COUNT', '*', '统计行数'],
  ['SUM', '列', '求和'],
  ['AVG', '列', '平均值'],
  ['MAX', '列', '最大值'],
  ['MIN', '列', '最小值'],
  ['GETDATE', '', '当前日期和时间'],
  ['YEAR', '日期', '取年份'],
  ['MONTH', '日期', '取月份'],
  ['DAY', '日期', '取日'],
  ['DATEPART', '部分, 日期', '取日期的一部分，部分如 year、month、day、hour'],
  ['DATENAME', '部分, 日期', '取日期的一部分'],
  ['DATEADD', '部分, 数量, 日期', '日期加上一段时间'],
  ['DATEDIFF', '部分, 开始, 结束', '两个日期相差多少'],
  ['CAST', '值 AS 类型', '转换类型'],
  ['CONVERT', '类型, 值', '转换类型'],
  ['LEN', '字符串', '字符串长度'],
  ['LEFT', '字符串, 个数', '取左边几个字符'],
  ['RIGHT', '字符串, 个数', '取右边几个字符'],
  ['SUBSTRING', '字符串, 开始, 长度', '取一部分字符'],
  ['CHARINDEX', '要找的, 字符串', '查找位置（从 1 开始，找不到是 0）'],
  ['REPLACE', '字符串, 旧, 新', '替换'],
  ['UPPER', '字符串', '转大写'],
  ['LOWER', '字符串', '转小写'],
  ['LTRIM', '字符串', '去掉左边的空格'],
  ['RTRIM', '字符串', '去掉右边的空格'],
  ['ABS', '数', '绝对值'],
  ['ROUND', '数, 小数位数', '四舍五入'],
  ['FLOOR', '数', '向下取整'],
  ['CEILING', '数', '向上取整'],
  ['POWER', '数, 次方', '乘方'],
  ['SQRT', '数', '平方根'],
  ['ISNULL', '值, 替代值', '是空值时用替代值'],
  ['COALESCE', '值1, 值2, ...', '第一个不是空值的'],
  ['NEWID', '', '新的 GUID'],
  ['RAND', '', '0 到 1 之间的随机数'],
  ['SCOPE_IDENTITY', '', '刚插入的自增值'],
]

const TYPES: [string, string][] = [
  ['int', '整数'],
  ['bigint', '大整数'],
  ['smallint', '小整数'],
  ['tinyint', '0 到 255 的整数'],
  ['bit', '0 或 1'],
  ['decimal(18, 2)', '小数（总位数, 小数位数）'],
  ['float', '浮点数'],
  ['real', '单精度浮点数'],
  ['money', '金额'],
  ['char(10)', '定长字符串'],
  ['varchar(50)', '字符串'],
  ['varchar(MAX)', '长字符串'],
  ['nchar(10)', '定长字符串（Unicode）'],
  ['nvarchar(50)', '字符串（Unicode，存中文用）'],
  ['nvarchar(MAX)', '长字符串（Unicode）'],
  ['text', '长文本'],
  ['ntext', '长文本（Unicode）'],
  ['date', '日期'],
  ['datetime', '日期和时间'],
  ['datetime2', '日期和时间（精度更高）'],
  ['time', '时间'],
  ['varbinary(MAX)', '二进制数据（图片等）'],
  ['image', '二进制数据（图片等）'],
  ['uniqueidentifier', 'GUID'],
]

/** 后面跟表名的关键字 */
const TABLE_CONTEXT = new Set(['FROM', 'JOIN', 'UPDATE', 'INTO', 'TABLE'])

/** 跟在表名后面时不是别名的词 */
const NOT_ALIAS = new Set(
  'WHERE ON JOIN INNER LEFT RIGHT FULL CROSS OUTER ORDER GROUP HAVING UNION EXCEPT SET VALUES SELECT DEFAULT WITH AS FROM INTO UPDATE DELETE INSERT CREATE DROP ALTER USE TRUNCATE ADD'.split(' '),
)

/** 不加方括号就不能当名字用的词（关键字里的单词） */
const RESERVED = new Set(KEYWORDS.flatMap(([k]) => k.split(/[\s(]/)).concat(['TABLE', 'DATABASE', 'KEY', 'INTO', 'BY']))

const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_@$#]*$/u

interface Token {
  text: string
  /** 名字（去掉方括号）；关键字比较用大写 */
  name: string
  start: number
  end: number
  word: boolean
}

/**
 * 分词，跳过字符串和注释。光标在字符串或注释里时 inLiteral 为 true（这时不补全）。
 * 只扫描 [0, end)，未闭合的方括号名字算作一个词。
 */
function tokenize(text: string, end: number) {
  const tokens: Token[] = []
  let i = 0
  let inLiteral = false
  while (i < end) {
    const c = text[i]
    if (/\s/.test(c)) {
      i++
    } else if (c === "'" || (c === '-' && text[i + 1] === '-') || (c === '/' && text[i + 1] === '*')) {
      const close = c === "'" ? text.indexOf("'", i + 1) : c === '-' ? text.indexOf('\n', i) : text.indexOf('*/', i + 2)
      if (close === -1 || close >= end) {
        inLiteral = true
        break
      }
      // '' 是字符串里的单引号：下一轮从它开始又是一个字符串，相当于接着跳过
      i = close + (c === '/' ? 2 : 1)
    } else if (c === '[') {
      const close = text.indexOf(']', i)
      const stop = close === -1 || close >= end ? end : close + 1
      tokens.push({ text: text.slice(i, stop), name: text.slice(i + 1, close === -1 || close >= end ? end : close), start: i, end: stop, word: true })
      i = stop
    } else if (/[\p{L}\p{N}_@$#]/u.test(c)) {
      const start = i
      while (i < end && /[\p{L}\p{N}_@$#]/u.test(text[i])) i++
      const word = text.slice(start, i)
      tokens.push({ text: word, name: word, start, end: i, word: true })
    } else {
      tokens.push({ text: c, name: c, start: i, end: i + 1, word: false })
      i++
    }
  }
  return { tokens, inLiteral }
}

const upper = (token: Token | undefined) => (token?.word && !token.text.startsWith('[') ? token.text.toUpperCase() : '')
const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0

interface TableRef {
  table: ExplorerTable
  alias: string | null
  offset: number
}

/** 找出语句里用到的表和别名：FROM / JOIN / UPDATE / INTO / TABLE 后面的表名（可带 dbo.），后面可以跟 [AS] 别名，FROM 后面可以用逗号列多张表 */
function tableRefs(tokens: Token[], tables: ExplorerTable[]) {
  const refs: TableRef[] = []
  for (let i = 0; i < tokens.length; i++) {
    const keyword = upper(tokens[i])
    if (!TABLE_CONTEXT.has(keyword)) continue
    let j = i + 1
    for (;;) {
      if (upper(tokens[j]) === 'DBO' && tokens[j + 1]?.text === '.') j += 2
      const name = tokens[j]
      const table = name?.word ? tables.find((t) => same(t.name, name.name)) : undefined
      if (!table) break
      j++
      if (upper(tokens[j]) === 'AS') j++
      let alias: string | null = null
      if (tokens[j]?.word && !NOT_ALIAS.has(upper(tokens[j]))) alias = tokens[j++].name
      refs.push({ table, alias, offset: name.start })
      if (keyword !== 'FROM' || tokens[j]?.text !== ',') break
      j++
    }
  }
  return refs
}

/** 名字需要时加方括号；光标前已经有 [ 时不加 */
function nameText(name: string, bracketOpen: boolean) {
  if (bracketOpen) return name
  return IDENTIFIER.test(name) && !RESERVED.has(name.toUpperCase()) ? name : `[${name.replace(/]/g, ']]')}]`
}

function columnDetail(column: ExplorerTable['columns'][number]) {
  return ['列', column.type, column.primaryKey ? '主键' : '', column.identity ? '自增' : '', column.nullable ? '' : '不允许空'].filter(Boolean).join(' · ')
}

const pad = (n: number) => String(n).padStart(4, '0')

/**
 * 光标处（offset）的补全项。trigger 是触发补全的字符：输入"."时列表或表；输入空格时只在 FROM / JOIN 等后面列表名，其他地方不弹出。
 */
export function sqlSuggestions(text: string, offset: number, schema: SqlSchema, trigger?: string): SqlSuggestion[] {
  // 光标所在的词（正在输入的部分）不算在分析里
  let wordStart = offset
  while (wordStart > 0 && /[\p{L}\p{N}_@$#]/u.test(text[wordStart - 1])) wordStart--
  const before = tokenize(text, wordStart)
  if (before.inLiteral) return []
  const all = tokenize(text, text.length).tokens
  const bracketOpen = text[wordStart - 1] === '['
  // 正在输入的词前面是 "[" 时，往前再看一个
  const previous = before.tokens.filter((t) => !(bracketOpen && t.end === wordStart))
  const last = previous.at(-1)
  const refs = tableRefs(all, schema.tables)

  // 表名. 或 别名.
  if (last?.text === '.' && last.end === (bracketOpen ? wordStart - 1 : wordStart)) {
    const qualifier = previous.at(-2)
    if (!qualifier?.word) return []
    if (upper(qualifier) === 'DBO') return tableSuggestions(schema.tables, bracketOpen, '0')
    const matches = refs.filter((r) => (r.alias ? same(r.alias, qualifier.name) : false) || same(r.table.name, qualifier.name))
    const nearest = matches.sort((a, b) => Math.abs(a.offset - offset) - Math.abs(b.offset - offset))[0]
    const table = nearest?.table ?? schema.tables.find((t) => same(t.name, qualifier.name))
    if (!table) return []
    return table.columns.map((column, i) => ({
      label: column.name,
      kind: 'column',
      insert: nameText(column.name, bracketOpen),
      detail: columnDetail(column),
      sort: pad(i),
    }))
  }
  if (trigger === '.') return []

  const context = upper(last)
  if (context === 'USE' || (context === 'DATABASE' && upper(previous.at(-2)) === 'DROP')) {
    return schema.databases.map((name) => ({ label: name, kind: 'database', insert: nameText(name, bracketOpen), detail: '数据库', sort: name }))
  }
  const tableContext = TABLE_CONTEXT.has(context) || (last?.text === ',' && lastKeyword(previous) === 'FROM')
  if (trigger === ' ' && !tableContext) return []
  if (bracketOpen) {
    // [ 后面只会是名字
    return [...tableSuggestions(schema.tables, true, '0'), ...columnSuggestions(schema.tables, refs, true)]
  }

  const keywords: SqlSuggestion[] = KEYWORDS.map(([label, detail]) => ({ label, kind: 'keyword', insert: label, detail, sort: `3${label}` }))
  const functions: SqlSuggestion[] = FUNCTIONS.map(([name, args, detail]) => ({
    label: `${name}(${args})`,
    kind: 'function',
    insert: args === '*' ? `${name}(*)` : `${name}($0)`,
    snippet: args !== '*',
    detail,
    sort: `3${name}`,
  }))
  const types: SqlSuggestion[] = TYPES.map(([label, detail]) => ({ label, kind: 'type', insert: label, detail: `数据类型：${detail}`, sort: `4${label}` }))
  return [
    ...tableSuggestions(schema.tables, false, tableContext ? '0' : '2'),
    ...(tableContext ? [] : columnSuggestions(schema.tables, refs, false)),
    ...keywords,
    ...functions,
    ...types,
  ]
}

/** 往前找最近的一个子句关键字（判断逗号是不是在 FROM 的表列表里） */
function lastKeyword(tokens: Token[]) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const word = upper(tokens[i])
    if (['SELECT', 'FROM', 'WHERE', 'SET', 'VALUES', 'ORDER', 'GROUP', 'ON', 'JOIN', 'HAVING'].includes(word)) return word
  }
  return ''
}

function tableSuggestions(tables: ExplorerTable[], bracketOpen: boolean, rank: string): SqlSuggestion[] {
  return tables.map((table) => ({ label: table.name, kind: 'table', insert: nameText(table.name, bracketOpen), detail: '表', sort: rank + table.name }))
}

/** 查询窗口里用到的表（FROM / JOIN 等后面写了的）的列；还没写表名时列所有表的列。同名的列只列一次 */
function columnSuggestions(tables: ExplorerTable[], refs: TableRef[], bracketOpen: boolean): SqlSuggestion[] {
  const used = new Set(refs.map((r) => r.table))
  const columns = new Map<string, { column: ExplorerTable['columns'][number]; tables: string[]; sort: string }>()
  for (const table of used.size > 0 ? tables.filter((t) => used.has(t)) : tables) {
    for (const column of table.columns) {
      const key = column.name.toUpperCase()
      const existing = columns.get(key)
      if (existing) existing.tables.push(table.name)
      else columns.set(key, { column, tables: [table.name], sort: `1${pad(columns.size)}` })
    }
  }
  return [...columns.values()].map(({ column, tables, sort }) => ({
    label: column.name,
    kind: 'column',
    insert: nameText(column.name, bracketOpen),
    detail: `${columnDetail(column)}（${tables.join('、')}）`,
    sort,
  }))
}

import { describe, expect, test } from 'bun:test'
import { addColumns, createTable, deleteRow, insertRow, literal, messages, parseInput, rowCondition, updateCell, type ExplorerTable } from './sql'

const campus: ExplorerTable = {
  name: 'CampusEnvironment',
  columns: [
    { name: 'ID', type: 'int', nullable: false, identity: true, primaryKey: true },
    { name: 'light', type: 'varchar(50)', nullable: true, identity: false, primaryKey: false },
    { name: 'addtime', type: 'datetime', nullable: true, identity: false, primaryKey: false },
  ],
}

const noKey: ExplorerTable = {
  name: 'EnvironmentWork',
  columns: [
    { name: 'light', type: 'varchar(MAX)', nullable: true, identity: false, primaryKey: false },
    { name: 'temperature', type: 'varchar(MAX)', nullable: true, identity: false, primaryKey: false },
    { name: 'photo', type: 'varbinary(MAX)', nullable: true, identity: false, primaryKey: false },
  ],
}

describe('编辑表数据生成的 T-SQL', () => {
  test('字面量：字符串用 N 前缀并转义单引号，NULL 原样', () => {
    expect(literal("it's")).toBe("N'it''s'")
    expect(literal(null)).toBe('NULL')
    expect(literal(25)).toBe('25')
    expect(parseInput('NULL')).toBeNull()
    expect(parseInput('null')).toBe('null')
  })

  test('有主键时按主键定位', () => {
    expect(updateCell(campus, 1, '600', [3, '500', '2024-01-16 09:00:00.000'])).toBe('UPDATE TOP (1) [CampusEnvironment] SET [light] = N\'600\' WHERE [ID] = 3')
    expect(deleteRow(campus, [3, '500', null])).toBe('DELETE TOP (1) FROM [CampusEnvironment] WHERE [ID] = 3')
  })

  test('没有主键时按所有列的原值定位（二进制列除外），空值用 IS NULL', () => {
    expect(rowCondition(noKey, ['520', null, '0xFF'])).toBe("[light] = N'520' AND [temperature] IS NULL")
  })

  test('新增行跳过自增列；什么都没填时用 DEFAULT VALUES', () => {
    expect(insertRow(campus, new Map([[2, '2024-01-20 08:00:00'], [0, '9'], [1, null]]))).toBe(
      "INSERT INTO [CampusEnvironment] ([light], [addtime]) VALUES (NULL, N'2024-01-20 08:00:00')",
    )
    expect(insertRow(campus, new Map())).toBe('INSERT INTO [CampusEnvironment] DEFAULT VALUES')
  })
})

describe('表设计器生成的 T-SQL', () => {
  test('建表：主键和标识列不允许 Null', () => {
    expect(
      createTable('EnvironmentWorkNew', [
        { name: 'id', type: 'int', nullable: true, identity: true, primaryKey: true },
        { name: 'EnvironmentDay', type: 'date', nullable: true, identity: false, primaryKey: false },
        { name: 'EnvironmentWork', type: 'varchar(200)', nullable: true, identity: false, primaryKey: false },
      ]),
    ).toBe('CREATE TABLE [EnvironmentWorkNew]\n(\n    [id] int IDENTITY(1,1) NOT NULL,\n    [EnvironmentDay] date NULL,\n    [EnvironmentWork] varchar(200) NULL,\n    PRIMARY KEY ([id])\n)')
  })

  test('给已有的表加列', () => {
    expect(addColumns('T', [{ name: 'memo', type: 'nvarchar(50)', nullable: true, identity: false, primaryKey: false }])).toBe('ALTER TABLE [T] ADD [memo] nvarchar(50) NULL')
  })
})

test('消息栏和 SSMS 一致', () => {
  expect(messages({ type: 'error', number: 208, message: "对象名 'X' 无效。", line: 2 })).toEqual([{ text: "消息 208，级别 16，状态 1，第 2 行\n对象名 'X' 无效。", error: true }])
  expect(messages({ type: 'result', database: 'db', results: [{ columns: [], rows: [], total: 3 }], affected: 1, ms: 1 }).map((m) => m.text)).toEqual(['(3 行受影响)', '(1 行受影响)'])
  expect(messages({ type: 'result', database: 'db', results: [], affected: -1, ms: 1 }).map((m) => m.text)).toEqual(['命令已成功完成。'])
})

/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { decodeCsv, parseCsv, stripClassCode, toRoster } from './roster'

describe('decodeCsv', () => {
  test('UTF-8（带 BOM，Excel 的"CSV UTF-8"）', () => {
    const bytes = new TextEncoder().encode('﻿学号,姓名\n2024001,张三\n')
    expect(decodeCsv(bytes.buffer)).toBe('学号,姓名\n2024001,张三\n')
  })

  test('GBK（中文 Windows 上 Excel 的"CSV（逗号分隔）"）', () => {
    // "学号,姓名" 的 GBK 编码
    const gbk = new Uint8Array([0xd1, 0xa7, 0xba, 0xc5, 0x2c, 0xd0, 0xd5, 0xc3, 0xfb])
    expect(decodeCsv(gbk.buffer)).toBe('学号,姓名')
  })
})

describe('parseCsv', () => {
  test('引号里的逗号、换行和两个双引号；CRLF 换行；忽略空行', () => {
    expect(parseCsv('a,"b,c","d ""e""\nf"\r\n\r\n1,2,3\r\n,,\r\n')).toEqual([
      ['a', 'b,c', 'd "e"\nf'],
      ['1', '2', '3'],
    ])
  })
})

describe('toRoster', () => {
  test('有表头时按表头找列，列的顺序可以不同', () => {
    expect(toRoster(parseCsv('姓名,学号,密码\n张三,2024001,abc\n李四,2024002,\n'))).toEqual([
      { username: '2024001', name: '张三', password: 'abc' },
      { username: '2024002', name: '李四', password: '' },
    ])
  })

  test('表头只有用户名和密码时，姓名用用户名；去掉姓名前的班级代号', () => {
    expect(toRoster(parseCsv('用户名,密码\nks241张三,525517\n'))).toEqual([{ username: '张三', name: '张三', password: '525517' }])
  })

  test('没有表头时按"用户名、密码"的顺序', () => {
    expect(toRoster(parseCsv('ks241张三,525517\nks241李四\n'))).toEqual([
      { username: '张三', name: '张三', password: '525517' },
      { username: '李四', name: '李四', password: '' },
    ])
  })

  test('只去掉"字母 + 数字 + 汉字"开头的代号', () => {
    expect(['ks241张三', 'KS2401王超', '2024001', 'zhang3', 'abc张三', '张三'].map(stripClassCode)).toEqual([
      '张三',
      '王超',
      '2024001',
      'zhang3',
      'abc张三',
      '张三',
    ])
  })

  test('去掉代号后重名的标出问题', () => {
    const rows = toRoster(parseCsv('用户名,密码\nks241王超,1\nks242王超,2\n'))
    expect(rows.map((r) => r.problem)).toEqual([undefined, expect.stringContaining('同名')])
  })

  test('科学计数法的学号、空账号、空姓名标出问题', () => {
    const rows = toRoster(parseCsv('学号,姓名\n2.02401E+11,张三\n,李四\n2024003,\n'))
    expect(rows.map((r) => r.problem)).toEqual([expect.stringContaining('科学计数法'), '用户名为空', '姓名为空'])
  })
})

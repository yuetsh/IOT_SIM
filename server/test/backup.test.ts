// 手动备份：平台数据库和学生数据库都导出完整（正在使用、数据还在 -wal 文件里时也一样）。
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdir, readdir, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { backupTo } from '../src/backup'
import { config } from '../src/config'
import { openDatabase } from '../src/db'

const saved = config.dataDir
const target = `${config.runsDir}/test-backup-copy`

beforeAll(async () => {
  config.dataDir = `${config.runsDir}/test-backup-data`
  await rm(config.dataDir, { recursive: true, force: true })
  await rm(target, { recursive: true, force: true })
})

afterAll(async () => {
  await rm(config.dataDir, { recursive: true, force: true })
  await rm(target, { recursive: true, force: true })
  config.dataDir = saved
})

test('导出平台数据库和每个学生的数据库，不覆盖已有的备份', async () => {
  // 平台和学生程序都开着库（WAL 模式，刚写入的数据还在 -wal 文件里）
  const db = openDatabase()
  db.query(`INSERT INTO users (username, name, password, role, created_at) VALUES ('s1', '学生', '123456', 'student', 0)`).run()
  await mkdir(join(config.dataDir, 'databases', '7'), { recursive: true })
  const student = new Database(join(config.dataDir, 'databases', '7', 'WisdomCampus.db'), { create: true })
  student.run('PRAGMA journal_mode = WAL')
  student.run('CREATE TABLE EnvironmentData (id INTEGER PRIMARY KEY, temperature REAL) STRICT')
  student.run('INSERT INTO EnvironmentData (temperature) VALUES (25.5), (26)')

  await backupTo(target)
  await expect(backupTo(target)).rejects.toThrow('已经有备份')
  student.close()
  db.close()

  const mainCopy = new Database(join(target, 'iot-sim.db'), { readonly: true })
  expect(mainCopy.query(`SELECT name FROM users WHERE username = 's1'`).get()).toEqual({ name: '学生' })
  mainCopy.close()
  const studentCopy = new Database(join(target, 'databases', '7', 'WisdomCampus.db'), { readonly: true })
  expect(studentCopy.query('SELECT temperature FROM EnvironmentData ORDER BY id').all()).toEqual([{ temperature: 25.5 }, { temperature: 26 }])
  studentCopy.close()
})

test('学生的库目录里有不是 SQLite 的 .db、链接文件：跳过，不让整个备份失败，也不跟着链接', async () => {
  const copy = `${target}-bad`
  await rm(copy, { recursive: true, force: true })
  const dir = join(config.dataDir, 'databases', '8')
  await mkdir(dir, { recursive: true })
  await Bun.write(join(dir, 'junk.db'), '这不是数据库')
  const good = new Database(join(dir, 'good.db'), { create: true })
  good.run('CREATE TABLE t (v INTEGER)')
  good.run('INSERT INTO t VALUES (1)')
  good.close()
  await symlink(join(config.dataDir, 'iot-sim.db'), join(dir, 'link.db'))

  await backupTo(copy)
  const files = await readdir(join(copy, 'databases', '8'))
  expect(files.sort()).toEqual(['good.db'])
  await rm(copy, { recursive: true, force: true })
})

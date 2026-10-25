// 手动备份：平台数据库和学生数据库都导出完整（正在使用、数据还在 -wal 文件里时也一样）。
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdir, rm } from 'node:fs/promises'
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

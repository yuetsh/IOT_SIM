// 学习过程记录：代码快照只存改动、能还原；同一分钟只记一次在做
import { expect, test } from 'bun:test'
import { openDatabase } from '../src/db'
import { createLearningLog, SNAPSHOT_INTERVAL_MS, validWorkKey, workSnapshots } from '../src/learning-log'

function setup() {
  const db = openDatabase(':memory:')
  db.run("INSERT INTO users (id, username, name, password, role, created_at) VALUES (1, 's1', 's1', 'p', 'student', 0)")
  return { db, log: createLearningLog(db) }
}

const KEY = 'sample:p2-t1-LED显示屏'

test('作品 key 只认实验和作业', () => {
  expect(validWorkKey(KEY)).toBe(true)
  expect(validWorkKey('assignment:12')).toBe(true)
  expect(validWorkKey('assignment:x')).toBe(false)
  expect(validWorkKey('other:1')).toBe(false)
  expect(validWorkKey(undefined)).toBe(false)
})

test('代码快照：至少隔一分钟、没改不存、只存改动的文件，读出来是完整代码', () => {
  const { db, log } = setup()
  const t0 = 1_800_000_000_000
  const v1 = [
    { path: 'Form1.cs', content: 'a' },
    { path: 'Form1.Designer.cs', content: 'd'.repeat(5000) },
  ]
  log.snapshot(1, KEY, v1, t0)
  // 不到一分钟
  log.snapshot(1, KEY, [{ ...v1[0], content: 'b' }, v1[1]], t0 + 30_000)
  // 没改
  log.snapshot(1, KEY, v1, t0 + SNAPSHOT_INTERVAL_MS)
  const v2 = [{ path: 'Form1.cs', content: 'c' }, v1[1], { path: 'Helper.cs', content: 'h' }]
  log.snapshot(1, KEY, v2, t0 + 2 * SNAPSHOT_INTERVAL_MS)
  const v3 = [v2[0], v2[1]]
  log.snapshot(1, KEY, v3, t0 + 3 * SNAPSHOT_INTERVAL_MS)

  const sizes = db.query<{ n: number }, []>('SELECT length(changes) AS n FROM snapshots ORDER BY id').all()
  expect(sizes.length).toBe(3)
  // 第二份没有带上没改过的设计器代码
  expect(sizes[1]!.n).toBeLessThan(sizes[0]!.n)

  const sorted = (files: { path: string; content: string }[]) => [...files].sort((a, b) => a.path.localeCompare(b.path))
  expect(workSnapshots(db, 1, KEY)).toEqual([
    { at: t0, files: sorted(v1) },
    { at: t0 + 2 * SNAPSHOT_INTERVAL_MS, files: sorted(v2) },
    { at: t0 + 3 * SNAPSHOT_INTERVAL_MS, files: sorted(v3) },
  ])
})

test('服务器重启后的第一份快照存完整代码，还原时不受前面影响', () => {
  const { db, log } = setup()
  log.snapshot(1, KEY, [{ path: 'Old.cs', content: 'o' }], 0)
  const restarted = createLearningLog(db)
  restarted.snapshot(1, KEY, [{ path: 'Form1.cs', content: 'x' }], 10)
  expect(workSnapshots(db, 1, KEY).at(-1)!.files).toEqual([{ path: 'Form1.cs', content: 'x' }])
})

test('同一分钟里在做只记一行；编译只记错误、最多 10 条', () => {
  const { db, log } = setup()
  log.touch(1, KEY, 60_000)
  log.touch(1, KEY, 119_999)
  log.touch(1, KEY, 120_000)
  expect(db.query('SELECT minute FROM activity ORDER BY minute').all()).toEqual([{ minute: 1 }, { minute: 2 }])

  const diagnostic = (code: string, severity: 'error' | 'warning') => ({ file: 'Form1.cs', line: 3, column: 1, severity, code, message: code, hint: '提示' })
  log.compiled(1, KEY, false, [diagnostic('CS0168', 'warning'), ...Array.from({ length: 12 }, () => diagnostic('CS1002', 'error'))], 130_000)
  const data = JSON.parse(db.query<{ data: string }, []>("SELECT data FROM events WHERE type = 'compile'").get()!.data)
  expect(data.ok).toBe(false)
  expect(data.errorCount).toBe(12)
  expect(data.errors.length).toBe(10)
  expect(data.errors[0]).toEqual({ code: 'CS1002', message: 'CS1002', file: 'Form1.cs', line: 3, hint: '提示' })
})

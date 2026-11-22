// 学习过程记录：学生做实验、做作业的过程（打开、编译、运行出错、自测、做了多久、代码怎么一步步改的），
// 给老师课后分析、学生看自己的情况、导出教学材料用。只记学生，不记老师。
//
// - events：打开、恢复原始代码、编译（成败和报错）、运行出错、自测结果
// - activity：某一分钟里在做某个作品（改代码、运行、操作程序）就记一行，数行数就是做了多少分钟
// - snapshots：运行时存一份代码，同一份作品至少隔一分钟；只存和上一份比改了的文件
import type { Database } from 'bun:sqlite'
import type { CheckResult, Diagnostic, SourceFile } from '@iot/shared'

/** 作品 key：自由练习 sample:实验编号，作业 assignment:作业编号（和 works 表一样） */
export function validWorkKey(key: unknown): key is string {
  return typeof key === 'string' && /^(sample:[^/\\]{1,80}|assignment:\d{1,9})$/.test(key)
}

export type LearningEvent =
  | { type: 'open' }
  | { type: 'reset' }
  /** 编译；errors 只存前几条错误，hint 是平台补充的中文提示（书上常见错误的说明） */
  | { type: 'compile'; ok: boolean; errorCount: number; errors: Pick<Diagnostic, 'code' | 'message' | 'file' | 'line' | 'hint'>[] }
  | { type: 'exception'; message: string; file?: string; line?: number }
  | { type: 'selfcheck'; compiled: boolean; results: CheckResult[] }

/** 一次编译最多记几条错误 */
const MAX_ERRORS = 10
/** 同一份作品两次代码快照至少隔多久 */
export const SNAPSHOT_INTERVAL_MS = 60_000

export function createLearningLog(db: Database) {
  const insertEvent = db.query('INSERT INTO events (user_id, work_key, type, data, created_at) VALUES (?, ?, ?, ?, ?)')
  const insertActivity = db.query('INSERT OR IGNORE INTO activity (user_id, work_key, minute) VALUES (?, ?, ?)')
  const insertSnapshot = db.query('INSERT INTO snapshots (user_id, work_key, changes, created_at) VALUES (?, ?, ?, ?)')

  /** 每人每份作品最近记过的那一分钟，同一分钟里不再写库 */
  const lastMinute = new Map<string, number>()
  /** 每人每份作品最近一份快照的完整代码（算改了哪些文件用）；服务器重启后第一份快照存完整代码 */
  const lastSnapshot = new Map<string, { at: number; files: Map<string, string> }>()
  const MAX_CACHED = 1000

  function remember<T>(map: Map<string, T>, key: string, value: T) {
    map.delete(key)
    map.set(key, value)
    if (map.size > MAX_CACHED) map.delete(map.keys().next().value!)
  }

  function event(userId: number, workKey: string, e: LearningEvent, now = Date.now()) {
    const { type, ...data } = e
    insertEvent.run(userId, workKey, type, Object.keys(data).length ? JSON.stringify(data) : null, now)
    touch(userId, workKey, now)
  }

  function touch(userId: number, workKey: string, now = Date.now()) {
    const key = `${userId}|${workKey}`
    const minute = Math.floor(now / 60_000)
    if (lastMinute.get(key) === minute) return
    remember(lastMinute, key, minute)
    insertActivity.run(userId, workKey, minute)
  }

  function compiled(userId: number, workKey: string, ok: boolean, diagnostics: Diagnostic[], now = Date.now()) {
    const errors = diagnostics.filter((d) => d.severity === 'error')
    event(
      userId,
      workKey,
      {
        type: 'compile',
        ok,
        errorCount: errors.length,
        errors: errors.slice(0, MAX_ERRORS).map(({ code, message, file, line, hint }) => ({ code, message, file, line, hint })),
      },
      now,
    )
  }

  /** 运行前存一份代码快照（离上一份不到一分钟或没改动时不存） */
  function snapshot(userId: number, workKey: string, files: SourceFile[], now = Date.now()) {
    const key = `${userId}|${workKey}`
    const last = lastSnapshot.get(key)
    if (last && now - last.at < SNAPSHOT_INTERVAL_MS) return
    const current = new Map(files.map((f) => [f.path, f.content]))
    const changes: SnapshotChanges = last ? { files: {}, deleted: [] } : { full: true, files: {}, deleted: [] }
    for (const [path, content] of current) if (last?.files.get(path) !== content) changes.files[path] = content
    if (last) for (const path of last.files.keys()) if (!current.has(path)) changes.deleted.push(path)
    if (last && Object.keys(changes.files).length === 0 && changes.deleted.length === 0) return
    insertSnapshot.run(userId, workKey, Bun.gzipSync(JSON.stringify(changes)), now)
    remember(lastSnapshot, key, { at: now, files: current })
  }

  return { event, touch, compiled, snapshot }
}

export type LearningLog = ReturnType<typeof createLearningLog>

/** 一份快照相对上一份的改动；full 表示这一份是完整代码（不依赖前面的） */
interface SnapshotChanges {
  full?: boolean
  files: Record<string, string>
  deleted: string[]
}

/** 一份作品的全部代码快照，按时间顺序，每份都还原成完整代码 */
export function workSnapshots(db: Database, userId: number, workKey: string): { at: number; files: SourceFile[] }[] {
  const rows = db
    .query<{ changes: Uint8Array<ArrayBuffer>; created_at: number }, [number, string]>(
      'SELECT changes, created_at FROM snapshots WHERE user_id = ? AND work_key = ? ORDER BY id',
    )
    .all(userId, workKey)
  const files = new Map<string, string>()
  return rows.map((row) => {
    const changes = JSON.parse(new TextDecoder().decode(Bun.gunzipSync(row.changes))) as SnapshotChanges
    if (changes.full) files.clear()
    for (const path of changes.deleted) files.delete(path)
    for (const [path, content] of Object.entries(changes.files)) files.set(path, content)
    return { at: row.created_at, files: [...files].map(([path, content]) => ({ path, content })).sort((a, b) => a.path.localeCompare(b.path)) }
  })
}

/** 删除作业时一并删除它的过程记录 */
export function deleteWorkRecords(db: Database, workKey: string) {
  for (const table of ['events', 'activity', 'snapshots']) db.query(`DELETE FROM ${table} WHERE work_key = ?`).run(workKey)
}

// 学生作品：每个人在每个实验上的代码，浏览器改动后自动保存，换电脑登录也能接着做。
import type { Database } from 'bun:sqlite'
import type { SourceFile } from '@iot/shared'

/** 一份作品最大字节数（全部文件内容合计），防止误传大文件 */
export const MAX_WORK_BYTES = 1_000_000

export function getWork(db: Database, userId: number, key: string): { files: SourceFile[]; updatedAt: number } | null {
  const row = db
    .query<{ files: string; updated_at: number }, [number, string]>('SELECT files, updated_at FROM works WHERE user_id = ? AND key = ?')
    .get(userId, key)
  return row ? { files: JSON.parse(row.files) as SourceFile[], updatedAt: row.updated_at } : null
}

export function saveWork(db: Database, userId: number, key: string, files: SourceFile[]) {
  const updatedAt = Date.now()
  db.query(
    `INSERT INTO works (user_id, key, files, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET files = excluded.files, updated_at = excluded.updated_at`,
  ).run(userId, key, JSON.stringify(files), updatedAt)
  return updatedAt
}

/** 删除作品（学生点"恢复原始代码"） */
export function deleteWork(db: Database, userId: number, key: string) {
  db.query('DELETE FROM works WHERE user_id = ? AND key = ?').run(userId, key)
}

/** 检查浏览器传来的文件列表：路径和内容都是字符串，总大小不超限 */
export function validFiles(value: unknown): value is SourceFile[] {
  if (!Array.isArray(value) || value.length > 100) return false
  let bytes = 0
  for (const file of value) {
    if (typeof file?.path !== 'string' || typeof file?.content !== 'string') return false
    bytes += file.path.length + file.content.length
  }
  return bytes <= MAX_WORK_BYTES
}

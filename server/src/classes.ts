// 班级和学生名单（老师用）。学生账号由老师上传名单导入，密码由老师发放，学生不能自己改。
import type { Database } from 'bun:sqlite'
import { revokeTokens } from './auth'

export interface ClassInfo {
  id: number
  name: string
  studentCount: number
}

export interface Student {
  id: number
  username: string
  name: string
  password: string
}

export interface ImportRow {
  username: string
  name: string
  password?: string
}

export interface ImportResult {
  created: number
  updated: number
  /** 有问题的行（行号从 1 开始，对应上传的名单），这些行没有导入 */
  errors: { row: number; message: string }[]
}

/** 平台生成的初始密码：6 位数字，学生好输入；老师在名单里能看到 */
export function generatePassword() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
}

export function listClasses(db: Database): ClassInfo[] {
  return db
    .query<ClassInfo, []>(
      `SELECT c.id, c.name, COUNT(u.id) AS studentCount
       FROM classes c LEFT JOIN users u ON u.class_id = c.id
       GROUP BY c.id ORDER BY c.name`,
    )
    .all()
}

/** 新建班级；名字为空或重名时返回错误信息 */
export function createClass(db: Database, name: string): { id: number } | { error: string } {
  name = name.trim()
  if (!name) return { error: '班级名不能为空' }
  if (db.query('SELECT 1 FROM classes WHERE name = ?').get(name)) return { error: `已经有叫"${name}"的班级` }
  const result = db.query('INSERT INTO classes (name, created_at) VALUES (?, ?)').run(name, Date.now())
  return { id: Number(result.lastInsertRowid) }
}

export function renameClass(db: Database, id: number, name: string): { error?: string } {
  name = name.trim()
  if (!name) return { error: '班级名不能为空' }
  if (db.query('SELECT 1 FROM classes WHERE name = ? AND id <> ?').get(name, id)) return { error: `已经有叫"${name}"的班级` }
  db.query('UPDATE classes SET name = ? WHERE id = ?').run(name, id)
  return {}
}

/** 只能删除没有学生的班级，避免误删全班的作品 */
export function deleteClass(db: Database, id: number): { error?: string } {
  if (db.query('SELECT 1 FROM users WHERE class_id = ?').get(id)) return { error: '班级里还有学生，先删除学生再删除班级' }
  db.query('DELETE FROM classes WHERE id = ?').run(id)
  return {}
}

export function listStudents(db: Database, classId: number): Student[] {
  return db.query<Student, [number]>(`SELECT id, username, name, password FROM users WHERE class_id = ? AND role = 'student' ORDER BY username`).all(classId)
}

/**
 * 导入名单到一个班：账号不存在就新建，已存在就更新姓名、班级（以及填了的密码）。
 * 密码留空时：新学生生成 6 位数字密码，老学生保持原密码。
 */
export function importStudents(db: Database, classId: number, rows: ImportRow[]): ImportResult {
  const result: ImportResult = { created: 0, updated: 0, errors: [] }
  const seen = new Set<string>()
  const find = db.query<{ id: number; role: string }, [string]>('SELECT id, role FROM users WHERE username = ?')
  const insert = db.query(`INSERT INTO users (username, name, password, role, class_id, created_at) VALUES (?, ?, ?, 'student', ?, ?)`)
  const update = db.query('UPDATE users SET name = ?, class_id = ?, password = COALESCE(?, password) WHERE id = ?')

  db.transaction(() => {
    for (const [index, row] of rows.entries()) {
      const fail = (message: string) => result.errors.push({ row: index + 1, message })
      const username = row.username.trim()
      const name = row.name.trim()
      const password = row.password?.trim() || undefined
      if (!username) {
        fail('账号为空')
        continue
      }
      if (/\s/.test(username)) {
        fail(`账号"${username}"里有空格`)
        continue
      }
      if (!name) {
        fail(`账号"${username}"的姓名为空`)
        continue
      }
      if (seen.has(username)) {
        fail(`账号"${username}"在名单里重复`)
        continue
      }
      seen.add(username)

      const existing = find.get(username)
      if (existing?.role === 'teacher') {
        fail(`"${username}"是老师账号`)
        continue
      }
      if (existing) {
        update.run(name, classId, password ?? null, existing.id)
        if (password) revokeTokens(db, existing.id)
        result.updated++
      } else {
        insert.run(username, name, password ?? generatePassword(), classId, Date.now())
        result.created++
      }
    }
  })()
  return result
}

/** 重置为新的 6 位数字密码，学生已登录的浏览器需要重新登录 */
export function resetPassword(db: Database, studentId: number): string | null {
  const password = generatePassword()
  const changed = db.query(`UPDATE users SET password = ? WHERE id = ? AND role = 'student'`).run(password, studentId).changes
  if (!changed) return null
  revokeTokens(db, studentId)
  return password
}

/** 删除学生，连同他的作品 */
/** 删除学生，返回是否删掉了 */
export function deleteStudent(db: Database, studentId: number) {
  return db.query(`DELETE FROM users WHERE id = ? AND role = 'student'`).run(studentId).changes > 0
}

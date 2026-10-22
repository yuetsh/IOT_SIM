// 登录与会话：账号密码登录后发一个 HttpOnly cookie，数据库只存令牌的哈希。
// 老师账号只有一个，账号密码来自配置；学生账号由老师导入名单创建。
import type { Database } from 'bun:sqlite'
import { config } from './config'

export const SESSION_COOKIE = 'iot_session'
const SESSION_DAYS = 180
// 全班通常共用学校的一个出口 IP，上限不能太小，否则几个同学输错就把全班挡在外面
const MAX_FAILURES = 30
const FAILURE_WINDOW_MS = 10 * 60_000

export interface User {
  id: number
  username: string
  name: string
  role: 'student' | 'teacher'
  classId: number | null
  className: string | null
}

const hash = (token: string) => new Bun.CryptoHasher('sha256').update(token).digest('hex')

let warnedDefaultPassword = false

/** 服务器启动时按配置创建或更新老师账号 */
export function ensureTeacher(db: Database) {
  let password = config.teacherPassword
  if (!password) {
    password = 'admin'
    if (!warnedDefaultPassword) console.warn(`没有设置 TEACHER_PASSWORD，老师账号为 ${config.teacherUsername} / admin（只适合本机开发）`)
    warnedDefaultPassword = true
  }
  db.query(
    `INSERT INTO users (username, name, password, role, created_at) VALUES (?, '老师', ?, 'teacher', ?)
     ON CONFLICT (username) DO UPDATE SET password = excluded.password, role = 'teacher', class_id = NULL`,
  ).run(config.teacherUsername, password, Date.now())
}

/** 每个 IP 一段时间内的失败次数，防止暴力猜密码 */
const failures = new Map<string, { count: number; since: number }>()

export function tooManyFailures(ip: string) {
  const entry = failures.get(ip)
  if (!entry) return false
  if (Date.now() - entry.since > FAILURE_WINDOW_MS) {
    failures.delete(ip)
    return false
  }
  return entry.count >= MAX_FAILURES
}

/** 账号密码正确时创建会话，返回令牌（放进 cookie）；不正确返回 null */
export function login(db: Database, username: string, password: string, ip: string): string | null {
  const row = db.query<{ id: number; password: string }, [string]>('SELECT id, password FROM users WHERE username = ?').get(username.trim())
  if (!row || row.password !== password) {
    const entry = failures.get(ip) ?? { count: 0, since: Date.now() }
    entry.count++
    failures.set(ip, entry)
    return null
  }
  failures.delete(ip)
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')
  db.query('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)').run(hash(token), row.id, Date.now())
  return token
}

export function logout(db: Database, token: string) {
  db.query('DELETE FROM sessions WHERE token_hash = ?').run(hash(token))
}

/** 删除某个用户的所有会话（重置密码、删除学生时，让他已登录的浏览器失效） */
export function endSessions(db: Database, userId: number) {
  db.query('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

/** 从 Cookie 请求头取出令牌 */
export function sessionToken(cookieHeader: string | null | undefined) {
  return cookieHeader
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === SESSION_COOKIE)?.[1]
}

/** 令牌对应的用户；没登录或会话已过期返回 null */
export function sessionUser(db: Database, token: string | undefined): User | null {
  if (!token) return null
  const row = db
    .query<
      { id: number; username: string; name: string; role: User['role']; class_id: number | null; class_name: string | null; created_at: number },
      [string]
    >(
      `SELECT u.id, u.username, u.name, u.role, u.class_id, c.name AS class_name, s.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN classes c ON c.id = u.class_id
       WHERE s.token_hash = ?`,
    )
    .get(hash(token))
  if (!row) return null
  if (Date.now() - row.created_at > SESSION_DAYS * 86_400_000) {
    logout(db, token)
    return null
  }
  return { id: row.id, username: row.username, name: row.name, role: row.role, classId: row.class_id, className: row.class_name }
}

export const sessionMaxAge = SESSION_DAYS * 86_400

// 登录：访问令牌 + 刷新令牌。
// - 访问令牌：JWT（HS256），15 分钟有效，放在请求头 Authorization: Bearer 里；
//   WebSocket 不能带请求头，连接时放在网址参数 token 里。
// - 刷新令牌：随机字符串，30 天有效，用来换新的访问令牌；数据库只存哈希。每次刷新都换一个新的（旧的立即作废），
//   一直在用的学生不用重新登录。退出登录删除这个刷新令牌。
// - 重置密码、删除学生：用户的 token_version 加一（已签发的访问令牌立即失效），并删除他的所有刷新令牌。
// 签名密钥第一次用到时随机生成，存在数据库里，服务器重启后令牌仍然有效。
// 老师账号只有一个，账号密码来自配置；学生账号由老师导入名单创建。
import type { Database } from 'bun:sqlite'
import { sign, verify } from 'hono/jwt'
import { config } from './config'

const ACCESS_SECONDS = 15 * 60
const REFRESH_DAYS = 30
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

export interface Tokens {
  accessToken: string
  refreshToken: string
}

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

/** JWT 签名密钥：存在 settings 表里，第一次用到时生成 */
function secret(db: Database): string {
  db.query(`INSERT OR IGNORE INTO settings (key, value) VALUES ('jwt_secret', ?)`).run(randomString())
  return db.query<{ value: string }, []>(`SELECT value FROM settings WHERE key = 'jwt_secret'`).get()!.value
}

const randomString = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
const hash = (token: string) => new Bun.CryptoHasher('sha256').update(token).digest('hex')

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

async function issueTokens(db: Database, userId: number, tokenVersion: number): Promise<Tokens> {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = await sign({ sub: String(userId), ver: tokenVersion, iat: now, exp: now + ACCESS_SECONDS }, secret(db), 'HS256')
  const refreshToken = randomString()
  db.query('INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    hash(refreshToken),
    userId,
    Date.now() + REFRESH_DAYS * 86_400_000,
  )
  return { accessToken, refreshToken }
}

/** 账号密码正确时签发令牌；不正确返回 null */
export async function login(db: Database, username: string, password: string, ip: string): Promise<Tokens | null> {
  const row = db
    .query<{ id: number; password: string; token_version: number }, [string]>('SELECT id, password, token_version FROM users WHERE username = ?')
    .get(username.trim())
  if (!row || row.password !== password) {
    const entry = failures.get(ip) ?? { count: 0, since: Date.now() }
    entry.count++
    failures.set(ip, entry)
    return null
  }
  failures.delete(ip)
  return issueTokens(db, row.id, row.token_version)
}

/** 用刷新令牌换一对新令牌，旧的刷新令牌作废；无效或过期返回 null */
export async function refresh(db: Database, refreshToken: string): Promise<Tokens | null> {
  const row = db
    .query<{ user_id: number; expires_at: number; token_version: number }, [string]>(
      `SELECT r.user_id, r.expires_at, u.token_version FROM refresh_tokens r JOIN users u ON u.id = r.user_id WHERE r.token_hash = ?`,
    )
    .get(hash(refreshToken))
  db.query('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash(refreshToken))
  if (!row || row.expires_at < Date.now()) return null
  // 顺便清掉这个用户已过期的刷新令牌
  db.query('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < ?').run(row.user_id, Date.now())
  return issueTokens(db, row.user_id, row.token_version)
}

/** 退出登录：作废这个刷新令牌（访问令牌 15 分钟后自然过期） */
export function logout(db: Database, refreshToken: string) {
  db.query('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash(refreshToken))
}

/** 让某个用户在所有设备上的登录立即失效（重置密码、删除学生时） */
export function revokeTokens(db: Database, userId: number) {
  db.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(userId)
  db.query('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId)
}

/** 从 Authorization 请求头取出访问令牌 */
export function bearerToken(header: string | null | undefined) {
  return /^Bearer\s+(\S+)$/i.exec(header ?? '')?.[1]
}

/** 访问令牌对应的用户；令牌无效、过期或已被撤回时返回 null */
export async function tokenUser(db: Database, accessToken: string | null | undefined): Promise<User | null> {
  if (!accessToken) return null
  let payload: { sub?: unknown; ver?: unknown }
  try {
    payload = (await verify(accessToken, secret(db), 'HS256')) as unknown as { sub?: unknown; ver?: unknown }
  } catch {
    return null
  }
  const row = db
    .query<
      { id: number; username: string; name: string; role: User['role']; class_id: number | null; class_name: string | null; token_version: number },
      [number]
    >(
      `SELECT u.id, u.username, u.name, u.role, u.class_id, c.name AS class_name, u.token_version
       FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ?`,
    )
    .get(Number(payload.sub))
  if (!row || row.token_version !== payload.ver) return null
  return { id: row.id, username: row.username, name: row.name, role: row.role, classId: row.class_id, className: row.class_name }
}

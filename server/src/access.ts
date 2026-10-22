// 访问口令：账号系统（第 2 阶段）做好之前，用一个统一口令挡住外人。
// 输对口令后发一个 cookie，值是口令的哈希；老师换口令后，旧 cookie 全部失效。
import type { Context } from 'hono'
import { setCookie } from 'hono/cookie'
import { config } from './config'

const COOKIE = 'iot_access'
// 全班通常共用学校的一个出口 IP，上限不能太小，否则几个同学输错就把全班挡在外面
const MAX_FAILURES = 30
const FAILURE_WINDOW_MS = 10 * 60_000

const token = config.accessPassword
  ? new Bun.CryptoHasher('sha256').update(`iot-sim-access:${config.accessPassword}`).digest('hex')
  : ''

export const accessRequired = token !== ''

/** 请求是否带着有效的口令 cookie（没设口令时总是放行） */
export function hasAccess(cookieHeader: string | null) {
  if (!accessRequired) return true
  const value = cookieHeader
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === COOKIE)?.[1]
  return value === token
}

/** 每个 IP 一段时间内的失败次数，防止暴力猜口令 */
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

/** 检查口令；对了就设置 cookie */
export function login(c: Context, password: string, ip: string) {
  if (password !== config.accessPassword) {
    const entry = failures.get(ip) ?? { count: 0, since: Date.now() }
    entry.count++
    failures.set(ip, entry)
    return false
  }
  failures.delete(ip)
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: 180 * 24 * 3600,
  })
  return true
}

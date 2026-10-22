// 登录令牌：访问令牌（15 分钟）和刷新令牌（30 天）都放在 localStorage，多个标签页共用。
// 访问令牌快过期时先用刷新令牌换一对新的；同时有多个请求要刷新时只刷新一次。
// 刷新令牌每用一次就作废：另一个标签页刚刷新过时，这边的旧令牌会失败，这时改用它存下的新令牌。

const ACCESS_KEY = 'iot-sim:access-token'
const REFRESH_KEY = 'iot-sim:refresh-token'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setTokens(tokens: Tokens) {
  try {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  } catch {
    // 浏览器禁用了本地存储：只能本次页面内有效
    memory = tokens
  }
}

export function clearTokens() {
  memory = null
  try {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  } catch {
    // 忽略
  }
}

/** 本地存储不可用时退回内存 */
let memory: Tokens | null = null

const accessToken = () => read(ACCESS_KEY) ?? memory?.accessToken ?? null
export const refreshToken = () => read(REFRESH_KEY) ?? memory?.refreshToken ?? null

/** 访问令牌是否会在一分钟内过期（读 JWT 里的 exp，不校验签名） */
function expiresSoon(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return !payload.exp || payload.exp * 1000 < Date.now() + 60_000
  } catch {
    return true
  }
}

let refreshing: Promise<boolean> | null = null

/** 用刷新令牌换新令牌；返回是否成功。登录已过期（服务器拒绝）时清掉令牌 */
export function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const tried = refreshToken()
    if (!tried) return false
    let response: Response
    try {
      response = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tried }),
      })
    } catch {
      return false // 网络问题：保留令牌，下次再试
    }
    if (response.ok) {
      setTokens((await response.json()) as Tokens)
      return true
    }
    // 另一个标签页已经用这个刷新令牌换过了新的
    const latest = refreshToken()
    if (latest && latest !== tried) return true
    clearTokens()
    return false
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

/** 可用的访问令牌：快过期时先刷新；没登录或登录已过期返回 null */
export async function validAccessToken(): Promise<string | null> {
  const token = accessToken()
  if (token && !expiresSoon(token)) return token
  if (!(await refreshTokens())) return null
  return accessToken()
}

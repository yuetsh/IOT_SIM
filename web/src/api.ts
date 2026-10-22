// 调用服务器接口。出错时抛出 ApiError，message 是服务器给的中文说明；
// 请求带上访问令牌（快过期时先刷新）；登录过期（刷新也失败）时回到登录页。
import { refreshTokens, validAccessToken } from './tokens'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** 登录过期时的处理，由 router.ts 设置（避免这里依赖路由） */
export const apiHooks = { onUnauthorized: () => {} }

export async function api<T>(method: string, path: string, json?: unknown, init?: RequestInit): Promise<T> {
  const response = await send(method, path, json, init)
  const data = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (response.status === 401 && path !== '/api/login') apiHooks.onUnauthorized()
  if (!response.ok) throw new ApiError(data.message ?? `请求失败（${response.status}）`, response.status)
  return data
}

/** 发请求并带上访问令牌；令牌被拒绝（401）时刷新一次再重发 */
async function send(method: string, path: string, json: unknown, init: RequestInit | undefined, retried = false): Promise<Response> {
  const headers: Record<string, string> = {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  if (path !== '/api/login') {
    const token = await validAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  let response: Response
  try {
    response = await fetch(path, { method, headers, body: json === undefined ? undefined : JSON.stringify(json), ...init })
  } catch {
    throw new ApiError('连不上服务器，请检查网络', 0)
  }
  if (response.status === 401 && path !== '/api/login' && !retried && (await refreshTokens())) {
    return send(method, path, json, init, true)
  }
  return response
}

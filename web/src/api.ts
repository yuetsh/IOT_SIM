// 调用服务器接口。出错时抛出 ApiError，message 是服务器给的中文说明；
// 登录过期（401）时回到登录页。
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
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: json === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
      ...init,
    })
  } catch {
    throw new ApiError('连不上服务器，请检查网络', 0)
  }
  const data = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (response.status === 401 && path !== '/api/login') apiHooks.onUnauthorized()
  if (!response.ok) throw new ApiError(data.message ?? `请求失败（${response.status}）`, response.status)
  return data
}

// 当前登录的用户。页面启动时用保存的令牌问一次服务器，之后登录、退出时更新。
import { ref } from 'vue'
import { api } from './api'
import { clearTokens, refreshToken, setTokens, type Tokens } from './tokens'

export interface User {
  id: number
  username: string
  name: string
  role: 'student' | 'teacher'
  classId: number | null
  className: string | null
}

export const currentUser = ref<User | null>(null)

/** 页面启动时调用：保存的令牌还有效（或能刷新）就取到用户 */
export async function loadCurrentUser() {
  if (!refreshToken()) return
  currentUser.value = await api<{ user: User }>('GET', '/api/me')
    .then((r) => r.user)
    .catch(() => null)
}

export async function login(username: string, password: string) {
  const result = await api<Tokens & { user: User }>('POST', '/api/login', { username, password })
  setTokens(result)
  currentUser.value = result.user
  return result.user
}

export async function logout() {
  const token = refreshToken()
  clearTokens()
  currentUser.value = null
  if (token) await api('POST', '/api/logout', { refreshToken: token }).catch(() => {})
}

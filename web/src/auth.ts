// 当前登录的用户。页面启动时先问一次服务器，之后登录、退出时更新。
import { ref } from 'vue'
import { api } from './api'

export interface User {
  id: number
  username: string
  name: string
  role: 'student' | 'teacher'
  classId: number | null
  className: string | null
}

export const currentUser = ref<User | null>(null)

/** 页面启动时调用：已登录（cookie 有效）就取到用户 */
export async function loadCurrentUser() {
  currentUser.value = await api<{ user: User }>('GET', '/api/me')
    .then((r) => r.user)
    .catch(() => null)
}

export async function login(username: string, password: string) {
  currentUser.value = (await api<{ user: User }>('POST', '/api/login', { username, password })).user
}

export async function logout() {
  await api('POST', '/api/logout').catch(() => {})
  currentUser.value = null
}

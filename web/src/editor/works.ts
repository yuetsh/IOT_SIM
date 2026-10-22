// 学生的作品保存在服务器上（按账号），换电脑登录也能接着做。
// key 标识是哪个实验，如 "sample:p2-t1-LED显示屏"。
import type { SourceFile } from '@iot/shared'
import { api } from '../api'

export const sampleWorkKey = (sampleId: string) => `sample:${sampleId}`

const url = (key: string) => `/api/works/${encodeURIComponent(key)}`

export async function loadWork(key: string): Promise<SourceFile[] | null> {
  return (await api<{ files: SourceFile[] } | null>('GET', url(key)))?.files ?? null
}

/** keepalive：页面关闭时也把请求发出去 */
export async function saveWork(key: string, files: SourceFile[], keepalive = false) {
  await api('PUT', url(key), { files }, { keepalive })
}

export async function deleteWork(key: string) {
  await api('DELETE', url(key))
}

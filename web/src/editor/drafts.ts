// 学生改过的代码保存在浏览器本地（localStorage），刷新页面不丢失。
// 这只是方便功能：隐私窗口、清除网站数据等情况下可能读写失败，失败时当作没有草稿。
// 作业的正式保存以后放到服务器上。
import type { SourceFile } from '@iot/shared'

const PREFIX = 'iot-sim:draft:'

export function loadDraft(sampleId: string): SourceFile[] | null {
  try {
    const raw = localStorage.getItem(PREFIX + sampleId)
    return raw ? (JSON.parse(raw) as SourceFile[]) : null
  } catch {
    return null
  }
}

export function saveDraft(sampleId: string, files: SourceFile[]) {
  try {
    localStorage.setItem(PREFIX + sampleId, JSON.stringify(files))
  } catch {
    // 存储不可用或已满：忽略
  }
}

export function clearDraft(sampleId: string) {
  try {
    localStorage.removeItem(PREFIX + sampleId)
  } catch {
    // 忽略
  }
}

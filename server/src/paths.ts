import { normalize, resolve } from 'node:path'

/** 拼接路径并拒绝跳出工程目录的文件名 */
export function safeJoin(base: string, path: string) {
  const target = resolve(base, normalize(path))
  if (!target.startsWith(`${base}/`)) throw new Error(`非法文件路径：${path}`)
  return target
}

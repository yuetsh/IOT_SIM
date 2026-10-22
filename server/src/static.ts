// 提供打包好的网页文件（web/dist）。带哈希的 assets 长期缓存，index.html 每次都检查更新。
import { normalize, resolve } from 'node:path'
import { config } from './config'

export async function serveStatic(pathname: string) {
  const root = config.staticDir
  let path = resolve(root, `.${normalize(decodeURIComponent(pathname))}`)
  if (!path.startsWith(`${root}/`) || !(await Bun.file(path).exists())) path = resolve(root, 'index.html')
  const file = Bun.file(path)
  if (!(await file.exists())) return new Response('网页还没有打包：bun run --filter web build', { status: 404 })
  const immutable = path.startsWith(`${root}/assets/`)
  return new Response(file, {
    headers: { 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' },
  })
}

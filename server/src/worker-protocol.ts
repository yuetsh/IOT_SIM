// 服务器（hub）和计算节点（worker）之间的消息。worker 主动连 hub 的 /worker（WebSocket，带令牌），
// 一条连接上同时跑很多件事，每件事用 id 区分。消息都是一行 JSON。
//
// hub → worker：
//   run    编译并运行一个学生程序（带上学生自己的数据库文件）
//   in     写一行到学生程序的标准输入
//   kill   结束学生程序
//   grade  评分（提交评分、自己检查）
//   lang   语言服务（补全、悬停、参数提示、边写边检查）
//   pong   回应 worker 的 ping
// worker → hub：
//   started  编译结果；编译通过时 program 表示程序是否已启动（false：worker 上同时运行的程序太多）
//   out/err  学生程序的标准输出、标准错误（一行）
//   exit     程序结束，带数据库文件的改动
//   graded / gradeFailed / lang
//   ping     心跳（hub 回 pong），也让中间的 nginx 不会因为没有数据断开连接
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { GradeResult, SourceFile } from '@iot/shared'
import type { CompileResult } from './compile-service'
import type { Check } from './grading/checks'

/** 数据库目录里的文件：文件名 → base64 内容（null 表示删掉了） */
export type DbFiles = Record<string, string | null>

export type HubMessage =
  | { t: 'run'; id: number; files: SourceFile[]; env: Record<string, string>; db: DbFiles | null }
  | { t: 'in'; id: number; line: string }
  | { t: 'kill'; id: number }
  | { t: 'grade'; id: number; files: SourceFile[]; checks: string; sampleId?: string }
  | { t: 'lang'; id: number; body: Record<string, unknown> }
  | { t: 'pong' }

export type WorkerMessage =
  | ({ t: 'started'; id: number; program: boolean } & CompileResult)
  | { t: 'startFailed'; id: number; message: string }
  | { t: 'out'; id: number; line: string }
  | { t: 'err'; id: number; line: string }
  | { t: 'exit'; id: number; code: number | null; signal: string | number | null; db: DbFiles | null }
  | { t: 'graded'; id: number; result: GradeResult }
  | { t: 'gradeFailed'; id: number; message: string }
  | { t: 'lang'; id: number; reply: Record<string, unknown> | null }
  | { t: 'ping' }

/** worker 发起连接时带的请求头：版本（部署的提交号）要和 hub 一样，不一样时 hub 拒绝，自己做 */
export const VERSION_HEADER = 'x-worker-version'

/** 学生数据库目录超过这么大就不发给 worker，在服务器上运行（正常的实验库只有几十 KB） */
export const MAX_REMOTE_DB_BYTES = 8 * 1024 * 1024

// ---------- 评分规则：里面有正则（matches 检查），JSON 里写成 { $regexp, flags } ----------

export function encodeChecks(checks: Check[]): string {
  return JSON.stringify(checks, (_, value) => (value instanceof RegExp ? { $regexp: value.source, flags: value.flags } : value))
}

export function decodeChecks(text: string): Check[] {
  return JSON.parse(text, (_, value) =>
    value && typeof value === 'object' && typeof value.$regexp === 'string' ? new RegExp(value.$regexp, value.flags) : value,
  )
}

// ---------- 数据库目录（每个库一个 SQLite 文件，可能还有 -wal、-shm） ----------

/** 读出目录里的全部文件；目录不存在时为空。总大小超过 limit 时返回 null */
export async function readDbDir(dir: string, limit = MAX_REMOTE_DB_BYTES): Promise<Record<string, string> | null> {
  const names = await readdir(dir).catch(() => [] as string[])
  const files: Record<string, string> = {}
  let bytes = 0
  for (const name of names) {
    const file = Bun.file(join(dir, name))
    bytes += file.size
    if (bytes > limit) return null
    files[name] = Buffer.from(await file.arrayBuffer()).toString('base64')
  }
  return files
}

/** 把文件写进目录（目录要已经存在） */
export async function writeDbFiles(dir: string, files: DbFiles) {
  for (const [name, content] of Object.entries(files)) {
    if (!validDbName(name)) continue
    const path = join(dir, name)
    if (content === null) await rm(path, { force: true })
    else await Bun.write(path, Buffer.from(content, 'base64'))
  }
}

/** 运行前后的目录比较：新增和改过的文件给出内容，删掉的给 null；没有变化时返回 null */
export function diffDbFiles(before: Record<string, string>, after: Record<string, string>): DbFiles | null {
  const changes: DbFiles = {}
  for (const [name, content] of Object.entries(after)) if (before[name] !== content) changes[name] = content
  for (const name of Object.keys(before)) if (!(name in after)) changes[name] = null
  return Object.keys(changes).length > 0 ? changes : null
}

/** 只接受目录里的普通文件名，不能带路径 */
function validDbName(name: string) {
  return /^[^/\\]+$/.test(name) && name !== '.' && name !== '..'
}

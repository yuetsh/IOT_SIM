// 服务器（hub）和计算节点（worker）之间的消息。worker 主动连 hub 的 /worker（WebSocket，带令牌），
// 一条连接上同时跑很多件事，每件事用 id 区分。消息都是一行 JSON。
//
// hub → worker：
//   run    编译并运行一个学生程序（用到数据库的程序不交给 worker，见 dispatch.ts）
//   in     写一行到学生程序的标准输入
//   kill   结束学生程序
//   grade  评分（提交评分、自己检查）
//   lang   语言服务（补全、悬停、参数提示、边写边检查）
//   pong   回应 worker 的 ping
// worker → hub：
//   started  编译结果；编译通过时 program 表示程序是否已启动（false：worker 上同时运行的程序太多）
//   out/err  学生程序的标准输出、标准错误（一行）
//   exit     程序结束
//   graded / gradeFailed / lang
//   ping     心跳（hub 回 pong），也让中间的 nginx 不会因为没有数据断开连接
import type { GradeResult, SourceFile } from '@iot/shared'
import type { CompileResult } from './compile-service'
import type { Check } from './grading/checks'

export type HubMessage =
  | { t: 'run'; id: number; files: SourceFile[]; env: Record<string, string>; maxMinutes: number }
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
  | { t: 'exit'; id: number; code: number | null; signal: string | number | null }
  | { t: 'graded'; id: number; result: GradeResult }
  | { t: 'gradeFailed'; id: number; message: string }
  | { t: 'lang'; id: number; reply: Record<string, unknown> | null }
  | { t: 'ping' }

/** worker 发起连接时带的请求头：版本（部署的提交号）要和 hub 一样，不一样时 hub 拒绝，自己做 */
export const VERSION_HEADER = 'x-worker-version'
/** worker 同时能跑多少个评分检查项（它的 SIM_GRADE_CONCURRENCY）；hub 的提交评分队列按它放行，见 grading/queue.ts */
export const GRADE_CONCURRENCY_HEADER = 'x-worker-grade-concurrency'

/**
 * 一条消息最大多少字节（hub 的 WebSocket maxPayloadLength）。worker 转发学生程序的输出时，
 * 编码后超过 MAX_LINE 字节的一行丢掉（控制字符转成 \u0001 会变成 6 倍长，所以按编码后的字节算），
 * 免得一条超大的消息让 hub 断开整条连接（所有学生的程序都会结束）
 */
export const MAX_PAYLOAD = 64 * 1024 * 1024
export const MAX_LINE = 4 * 1024 * 1024

// ---------- 评分规则：里面有正则（matches 检查），JSON 里写成 { $regexp, flags } ----------

export function encodeChecks(checks: Check[]): string {
  return JSON.stringify(checks, (_, value) => (value instanceof RegExp ? { $regexp: value.source, flags: value.flags } : value))
}

export function decodeChecks(text: string): Check[] {
  return JSON.parse(text, (_, value) =>
    value && typeof value === 'object' && typeof value.$regexp === 'string' ? new RegExp(value.$regexp, value.flags) : value,
  )
}

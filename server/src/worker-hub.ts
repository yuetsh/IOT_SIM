// 计算节点（worker）的服务器端：学校的机器主动连到 /worker，服务器把编译运行、评分、语言服务交给它，
// 自己只管账号、作业、数据库和实训台状态。服务器只有 2 核，学校的机器核多，学生程序放在那边跑。
//
// worker 随时可能不在（学校关机、断网、正在部署）：
//   - 没连上：全部在服务器上自己做，和没有 worker 时一样
//   - 运行中断了：程序结束，提示学生重新运行（下一次就在服务器上运行）
//   - 评分、启动中断了，或者 worker 那边出错（磁盘满等）：改在服务器上做，学生和老师感觉不到
// 同时只用一个 worker；新的连上来时替换旧的（比如 worker 重启后旧连接还没超时）。
import { timingSafeEqual } from 'node:crypto'
import type { Server, ServerWebSocket } from 'bun'
import type { GradeResult, SourceFile } from '@iot/shared'
import { config } from './config'
import type { LineListener, ProgramExit, ProgramHandle, RunOutcome, RunRequest } from './executor'
import { LineBuffer } from './executor'
import type { Check } from './grading/checks'
import { encodeChecks, GRADE_CONCURRENCY_HEADER, type HubMessage, VERSION_HEADER, type WorkerMessage } from './worker-protocol'

/** 交给 worker 的事情没法在那边完成，调用方改在服务器上做 */
export class WorkerUnavailable extends Error {}

/** 等 worker 回复的时限：超过就当它不在了，改在服务器上做 */
const START_TIMEOUT_MS = 60_000
const GRADE_TIMEOUT_MS = 10 * 60_000
const LANGUAGE_TIMEOUT_MS = 10_000
/** 发给 worker 的数据积压超过这么多时不再转发学生的操作（Bun 默认积压到 16 MB 就开始丢消息） */
const MAX_INPUT_BACKLOG = 4 * 1024 * 1024

export interface WorkerSocketData {
  kind: 'worker'
  /** 连接上来的 worker 的地址（日志用） */
  address: string
  /** worker 同时能跑多少个评分检查项；没报告时为 0 */
  gradeConcurrency: number
}

interface Pending {
  resolve: (message: WorkerMessage) => void
  reject: (error: Error) => void
  timer: Timer
}

class RemoteProgram implements ProgramHandle {
  readonly lines = new LineBuffer()
  readonly exited: Promise<ProgramExit>
  finish!: (exit: ProgramExit) => void
  private ended = false

  constructor(
    private readonly hub: WorkerHub,
    readonly id: number,
  ) {
    this.exited = new Promise((resolve) => {
      this.finish = (exit) => {
        if (this.ended) return
        this.ended = true
        resolve(exit)
      }
    })
  }

  listen(onStdout: LineListener, onStderr: LineListener) {
    this.lines.listen(onStdout, onStderr)
  }

  write(line: string) {
    // 链路堵了就丢掉学生的操作（像点了没反应），免得缓冲满了 Bun 丢掉别人的 kill、启动
    if (!this.ended && !this.hub.congested) this.hub.send({ t: 'in', id: this.id, line })
  }

  kill() {
    if (!this.ended) this.hub.send({ t: 'kill', id: this.id })
  }
}

class WorkerHub {
  private socket?: ServerWebSocket<WorkerSocketData>
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private readonly programs = new Map<number, RemoteProgram>()
  /** 交给 worker 做了多少件事（测试、日志用） */
  readonly stats = { runs: 0, grades: 0, language: 0 }

  /** worker 在不在 */
  get available() {
    return this.socket !== undefined
  }

  /** worker 同时能跑多少个评分检查项；不在或没报告时为 0 */
  get gradeConcurrency() {
    return this.socket?.data.gradeConcurrency ?? 0
  }

  /** 发给 worker 的数据积压太多（链路慢、有人一直发大消息）：学生的操作先不转发 */
  get congested() {
    return (this.socket?.getBufferedAmount() ?? 0) > MAX_INPUT_BACKLOG
  }

  /**
   * /worker 的升级请求：令牌对、版本一样才接受。没有配置令牌时不接受 worker（返回 404，和没有这个地址一样）
   */
  upgrade(req: Request, server: Server<unknown>): Response | undefined {
    if (!config.workerToken) return new Response('Not Found', { status: 404 })
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!sameSecret(token, config.workerToken)) return new Response('令牌不对', { status: 401 })
    const version = req.headers.get(VERSION_HEADER) ?? ''
    if (version !== config.appVersion) {
      console.warn(`计算节点版本 ${version || '（无）'} 和服务器 ${config.appVersion || '（无）'} 不一样，不用它`)
      return new Response(`版本不一样：服务器是 ${config.appVersion || '（无）'}`, { status: 409 })
    }
    const address = req.headers.get('x-real-ip') ?? server.requestIP(req)?.address ?? ''
    const gradeConcurrency = Math.max(0, Math.floor(Number(req.headers.get(GRADE_CONCURRENCY_HEADER)) || 0))
    const data: WorkerSocketData = { kind: 'worker', address, gradeConcurrency }
    if (server.upgrade(req, { data })) return undefined
    return new Response('WebSocket 升级失败', { status: 400 })
  }

  open(ws: ServerWebSocket<WorkerSocketData>) {
    if (this.socket) {
      console.warn('新的计算节点连上来了，替换旧的连接')
      const old = this.socket
      this.detach(old)
      old.close(1000, '被新的连接替换')
    }
    this.socket = ws
    console.log(`计算节点已连接（${ws.data.address}），编译运行、评分交给它`)
  }

  message(ws: ServerWebSocket<WorkerSocketData>, raw: string | Buffer) {
    if (ws !== this.socket) return
    let message: WorkerMessage
    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }
    switch (message.t) {
      case 'ping':
        this.send({ t: 'pong' })
        return
      case 'out':
      case 'err':
        this.programs.get(message.id)?.lines.push(message.t === 'err', message.line)
        return
      case 'exit': {
        const program = this.programs.get(message.id)
        this.programs.delete(message.id)
        program?.finish({ code: message.code, signal: message.signal })
        return
      }
      default:
        if (this.pending.has(message.id)) {
          this.settle(message.id, message)
        } else if (message.t === 'startFailed') {
          // 程序启动之后 worker 那边出错：当作程序结束，免得学生那边一直显示"运行中"
          const program = this.programs.get(message.id)
          this.programs.delete(message.id)
          program?.finish({ code: null, signal: null, lost: true })
        }
    }
  }

  close(ws: ServerWebSocket<WorkerSocketData>) {
    if (ws !== this.socket) return
    this.detach(ws)
    console.warn('计算节点断开了，编译运行、评分改在服务器上做')
  }

  /**
   * 发给 worker；不在时什么也不做（等它的事情会因为断开或超时失败）。
   * 发送缓冲满了 Bun 会直接丢掉这条消息（send 返回 0）：丢了 kill、输入就乱了，所以干脆断开，改在服务器上做
   */
  send(message: HubMessage) {
    const socket = this.socket
    if (!socket) return
    if (socket.send(JSON.stringify(message)) === 0) {
      console.warn('发给计算节点的消息发不出去（发送缓冲满了），断开它')
      this.detach(socket)
      socket.close(1011, '发送缓冲满了')
    }
  }

  /** 编译并启动（不带数据库，见 dispatch.ts）；worker 不在、出错、中途断开或超时抛出 WorkerUnavailable */
  async run(request: RunRequest): Promise<RunOutcome> {
    if (!this.socket) throw new WorkerUnavailable('计算节点不在')
    if (request.dbDir) throw new WorkerUnavailable('用到数据库的程序在服务器上运行')
    const id = this.nextId++
    // 先登记，编译一通过 worker 马上就会发来程序的输出
    const program = new RemoteProgram(this, id)
    this.programs.set(id, program)
    let reply: WorkerMessage
    try {
      reply = await this.request({ t: 'run', id, files: request.files, env: request.env, maxMinutes: config.maxRunMinutes }, START_TIMEOUT_MS)
    } catch (error) {
      this.programs.delete(id)
      // 超时的话 worker 可能过一会儿还是把程序启动了：让它启动后马上结束
      this.send({ t: 'kill', id })
      throw error
    }
    if (reply.t !== 'started') {
      this.programs.delete(id)
      throw new WorkerUnavailable(reply.t === 'startFailed' ? `计算节点出错：${reply.message}` : `计算节点回复不对：${reply.t}`)
    }
    this.stats.runs++
    const compiled = { ok: reply.ok, diagnostics: reply.diagnostics, ms: reply.ms }
    if (!reply.program) {
      this.programs.delete(id)
      return { compiled }
    }
    return { compiled, program }
  }

  /** 评分；worker 不在、出错、中途断开或超时抛出 WorkerUnavailable */
  async grade(files: SourceFile[], checks: Check[], sampleId?: string): Promise<GradeResult> {
    if (!this.socket) throw new WorkerUnavailable('计算节点不在')
    const reply = await this.request({ t: 'grade', id: this.nextId++, files, checks: encodeChecks(checks), sampleId }, GRADE_TIMEOUT_MS)
    if (reply.t !== 'graded') {
      throw new WorkerUnavailable(reply.t === 'gradeFailed' ? `计算节点评分出错：${reply.message}` : `计算节点回复不对：${reply.t}`)
    }
    this.stats.grades++
    return reply.result
  }

  /** 语言服务；worker 不在时抛出 WorkerUnavailable，超时返回 null（和本机的语言服务一样） */
  async language(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!this.socket) throw new WorkerUnavailable('计算节点不在')
    try {
      const reply = await this.request({ t: 'lang', id: this.nextId++, body }, LANGUAGE_TIMEOUT_MS)
      this.stats.language++
      return reply.t === 'lang' ? reply.reply : null
    } catch (error) {
      if (error instanceof Timeout) return null
      throw error
    }
  }

  private request(message: Extract<HubMessage, { id: number }>, timeoutMs: number): Promise<WorkerMessage> {
    if (!this.socket) return Promise.reject(new WorkerUnavailable('计算节点不在'))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.id)
        reject(new Timeout(`计算节点 ${Math.round(timeoutMs / 1000)} 秒没有回复`))
      }, timeoutMs)
      this.pending.set(message.id, { resolve, reject, timer })
      // 发不出去时 send 会断开连接，上面登记的等待随之失败
      this.send(message)
    })
  }

  private settle(id: number, message: WorkerMessage) {
    const waiter = this.pending.get(id)
    if (!waiter) return
    this.pending.delete(id)
    clearTimeout(waiter.timer)
    waiter.resolve(message)
  }

  /** 连接断了：等回复的都失败（调用方改在服务器上做），正在运行的程序都算结束 */
  private detach(ws: ServerWebSocket<WorkerSocketData>) {
    if (ws !== this.socket) return
    this.socket = undefined
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(new WorkerUnavailable('和计算节点的连接断了'))
    }
    this.pending.clear()
    for (const program of this.programs.values()) program.finish({ code: null, signal: null, lost: true })
    this.programs.clear()
  }
}

/** worker 超时没回复：也当它不在了 */
class Timeout extends WorkerUnavailable {}

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const workerHub = new WorkerHub()

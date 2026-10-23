import type { Subprocess } from 'bun'
import { config } from './config'
import { readLines } from './runner-process'

/** 查询窗口的一个结果集 */
export interface SqlResultSet {
  columns: { name: string; type: string | null }[]
  rows: unknown[][]
  /** 实际行数（只返回前 1000 行） */
  total: number
}

export type SqlReply =
  | { type: 'result'; database: string; results: SqlResultSet[]; affected: number; ms: number }
  | { type: 'done' }
  | { type: 'explorer'; databases: { name: string; tables: { name: string; columns: SqlColumnInfo[] }[] }[] }
  | { type: 'error'; number: number; message: string; line: number }

export interface SqlColumnInfo {
  name: string
  type: string
  nullable: boolean
  identity: boolean
  primaryKey: boolean
}

export type SqlRequest =
  | { type: 'exec'; dir: string; database: string; sql: string }
  | { type: 'script'; dir: string; sql: string }
  | { type: 'explorer'; dir: string }

/** SQL 报错（编号和信息与 SQL Server 一致） */
export class SqlError extends Error {
  constructor(
    readonly number: number,
    message: string,
    readonly line: number,
  ) {
    super(message)
  }
}

/**
 * 常驻 SQL 服务（C# 进程，T-SQL 转写成 SQLite 执行）：数据库页面的查询和对象资源管理器、评分前准备实验数据库。
 * 进程意外退出时挂起的请求全部失败，下一次请求自动重启。
 */
class SqlService {
  private proc?: Subprocess<'pipe', 'pipe', 'inherit'>
  private ready?: Promise<void>
  private nextId = 1
  private readonly pending = new Map<number, { resolve: (r: SqlReply) => void; reject: (e: Error) => void }>()

  /** 发出请求；SQL 报错时抛出 SqlError */
  async request(request: SqlRequest): Promise<Exclude<SqlReply, { type: 'error' }>> {
    await this.start()
    const id = this.nextId++
    const reply = await new Promise<SqlReply>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.proc!.stdin.write(`${JSON.stringify({ id, ...request })}\n`)
      this.proc!.stdin.flush()
    })
    if (reply.type === 'error') throw new SqlError(reply.number, reply.message, reply.line)
    return reply
  }

  stop() {
    const proc = this.proc
    this.proc = undefined
    this.ready = undefined
    for (const waiter of this.pending.values()) waiter.reject(new Error('SQL 服务已停止'))
    this.pending.clear()
    proc?.kill()
  }

  start() {
    if (this.ready) return this.ready
    const proc = Bun.spawn(['dotnet', config.runnerDll, 'sql-server'], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', TZ: config.timeZone },
    })
    this.proc = proc
    this.ready = new Promise<void>((resolveReady) => {
      void readLines(proc.stdout, (line) => {
        const message = JSON.parse(line) as ({ type: 'ready' } | SqlReply) & { id?: number }
        if (message.type === 'ready') {
          resolveReady()
          return
        }
        const waiter = this.pending.get(message.id!)
        if (!waiter) return
        this.pending.delete(message.id!)
        waiter.resolve(message)
      })
    })
    proc.exited.then((code) => {
      if (this.proc !== proc) return
      this.proc = undefined
      this.ready = undefined
      for (const waiter of this.pending.values()) waiter.reject(new Error(`SQL 服务意外退出（${code}）`))
      this.pending.clear()
    })
    return this.ready
  }
}

export const sqlService = new SqlService()

import type { Subprocess } from 'bun'
import { config } from './config'
import { readLines } from './runner-process'

/** 一个请求最多等多久；语言服务忙或卡住时，编辑器不弹补全也不影响写代码 */
const TIMEOUT_MS = 10_000

/**
 * 常驻语言服务：代码补全、悬停提示、参数提示、边写边检查。全服务器共用一个进程（和编译服务分开），
 * 请求按编号对应回复。进程意外退出时，挂起的请求失败，下一次请求自动重启。
 */
class LanguageService {
  private proc?: Subprocess<'pipe', 'pipe', 'inherit'>
  private ready?: Promise<void>
  private nextId = 1
  private readonly pending = new Map<number, (reply: Record<string, unknown> | null) => void>()

  /** 发一个请求（type、session、files、file、line、column 等原样转给语言服务）；超时或出错返回 null */
  async request(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    await this.start()
    const id = this.nextId++
    const reply = new Promise<Record<string, unknown> | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve(null)
      }, TIMEOUT_MS)
      this.pending.set(id, (r) => {
        clearTimeout(timer)
        resolve(r)
      })
    })
    this.proc!.stdin.write(`${JSON.stringify({ ...body, id })}\n`)
    this.proc!.stdin.flush()
    return reply
  }

  /** 结束进程；立即清空状态，下一次请求会启动新进程（不会发给正在退出的旧进程） */
  stop() {
    const proc = this.proc
    this.proc = undefined
    this.ready = undefined
    for (const resolve of this.pending.values()) resolve(null)
    this.pending.clear()
    proc?.kill()
  }

  /** 服务器启动时调用，提前完成加载和预热 */
  start() {
    if (this.ready) return this.ready
    const proc = Bun.spawn(['dotnet', config.runnerDll, 'language-server'], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' },
    })
    this.proc = proc
    this.ready = new Promise<void>((resolveReady) => {
      void readLines(proc.stdout, (line) => {
        const message = JSON.parse(line) as { type: string; id?: number }
        if (message.type === 'ready') {
          resolveReady()
          return
        }
        const resolve = this.pending.get(message.id!)
        if (!resolve) return
        this.pending.delete(message.id!)
        resolve(message.type === 'error' ? null : message)
      })
    })
    proc.exited.then(() => {
      if (this.proc !== proc) return
      this.proc = undefined
      this.ready = undefined
      for (const resolve of this.pending.values()) resolve(null)
      this.pending.clear()
    })
    return this.ready
  }
}

export const languageService = new LanguageService()

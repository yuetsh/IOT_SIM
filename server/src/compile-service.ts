import type { Subprocess } from 'bun'
import type { Diagnostic } from '@iot/shared'
import { config } from './config'
import { readLines } from './runner-process'

export interface CompileResult {
  ok: boolean
  diagnostics: Diagnostic[]
  ms: number
}

/** 导出的 exe 在工程目录里的文件名（Sim.Runner 的 CompileServer.ExportFile） */
export const EXPORT_FILE = 'export.exe'

type Reply = ({ type: 'compiled' } & CompileResult) | { type: 'compileFailed'; message: string }

/**
 * 常驻编译服务：全服务器共用一个 C# 编译进程（Roslyn 只加载一次），按请求编号对应回复。
 * 进程意外退出时，挂起的请求全部失败，下一次请求自动重启。
 */
class CompileService {
  private proc?: Subprocess<'pipe', 'pipe', 'inherit'>
  private ready?: Promise<void>
  private nextId = 1
  private readonly pending = new Map<number, { resolve: (r: CompileResult) => void; reject: (e: Error) => void }>()

  /** 编译工程目录；成功时程序集写到同一目录 */
  compile(dir: string): Promise<CompileResult> {
    return this.request({ dir })
  }

  /**
   * 导出 EXE：照教材工程编译成 .NET Framework 程序，嵌入教材的设备类库（config.textbookLibsDir），
   * 成功时写到工程目录的 EXPORT_FILE。name 是 exe 的名字（不带 .exe）
   */
  exportExe(dir: string, name: string): Promise<CompileResult> {
    return this.request({ dir, export: { libs: config.textbookLibsDir, name } })
  }

  private async request(payload: object): Promise<CompileResult> {
    await this.start()
    const id = this.nextId++
    const result = new Promise<CompileResult>((resolve, reject) => this.pending.set(id, { resolve, reject }))
    this.proc!.stdin.write(`${JSON.stringify({ id, ...payload })}\n`)
    this.proc!.stdin.flush()
    return result
  }

  /** 结束进程；立即清空状态，下一次请求会启动新进程（不会发给正在退出的旧进程） */
  stop() {
    const proc = this.proc
    this.proc = undefined
    this.ready = undefined
    for (const waiter of this.pending.values()) waiter.reject(new Error('编译服务已停止'))
    this.pending.clear()
    proc?.kill()
  }

  /** 服务器启动时调用，提前完成编译器的加载和预热 */
  start() {
    if (this.ready) return this.ready
    const proc = Bun.spawn(['dotnet', config.runnerDll, 'compile-server'], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' },
    })
    this.proc = proc
    this.ready = new Promise<void>((resolveReady) => {
      void readLines(proc.stdout, (line) => {
        const message = JSON.parse(line) as ({ type: 'ready' } | Reply) & { id?: number }
        if (message.type === 'ready') {
          resolveReady()
          return
        }
        const waiter = this.pending.get(message.id!)
        if (!waiter) return
        this.pending.delete(message.id!)
        if (message.type === 'compiled') waiter.resolve(message)
        else waiter.reject(new Error(message.message))
      })
    })
    proc.exited.then((code) => {
      if (this.proc !== proc) return
      this.proc = undefined
      this.ready = undefined
      for (const waiter of this.pending.values()) waiter.reject(new Error(`编译服务意外退出（${code}）`))
      this.pending.clear()
    })
    return this.ready
  }
}

export const compileService = new CompileService()

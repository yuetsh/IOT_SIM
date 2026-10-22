import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join, normalize, resolve } from 'node:path'
import type { Subprocess } from 'bun'
import type { RunnerInput, RunnerMessage, ServerMessage, SourceFile } from '@iot/shared'
import { compileService } from './compile-service'
import { ROOT, RUNNER_DLL, readLines } from './runner-process'

const RUNS_DIR = join(ROOT, '.runs')

/** 服务器启动时清掉上次异常退出遗留的运行目录 */
export async function cleanupStaleRuns() {
  await rm(RUNS_DIR, { recursive: true, force: true })
}

/** 一次运行：写出学生工程 → 编译服务编译 → 启动运行进程，在运行进程和浏览器之间转发消息 */
export class RunSession {
  private proc?: Subprocess<'pipe', 'pipe', 'pipe'>
  private dir?: string
  /** 每次启动、停止都递增，用来丢弃已经过时的编译结果 */
  private generation = 0
  /** 同一会话的多次"运行"排队依次执行，避免两次启动交错 */
  private queue = Promise.resolve()

  constructor(private readonly send: (message: ServerMessage) => void) {}

  start(files: SourceFile[]) {
    const next = this.queue.then(() => this.startNow(files))
    this.queue = next.catch(() => {})
    return next
  }

  private async startNow(files: SourceFile[]) {
    await this.dispose()
    const generation = ++this.generation
    await mkdir(RUNS_DIR, { recursive: true })
    const dir = await mkdtemp(join(RUNS_DIR, 'run-'))
    for (const file of files) {
      const target = safeJoin(dir, file.path)
      await mkdir(dirname(target), { recursive: true })
      await Bun.write(target, file.content)
    }

    this.send({ type: 'status', state: 'compiling' })
    const compiled = await compileService.compile(dir)
    // 编译期间又点了一次"运行"或"停止"：这次结果作废
    if (generation !== this.generation) {
      await rm(dir, { recursive: true, force: true })
      return
    }
    this.dir = dir
    this.send({ type: 'compiled', ...compiled })
    if (!compiled.ok) {
      this.send({ type: 'status', state: 'stopped' })
      await this.cleanup()
      return
    }

    const proc = Bun.spawn(['dotnet', RUNNER_DLL, 'run', dir], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' },
    })
    this.proc = proc

    void readLines(proc.stdout, (line) => {
      let message: RunnerMessage
      try {
        message = JSON.parse(line)
      } catch {
        this.send({ type: 'console', text: `${line}\n` })
        return
      }
      if (message.type === 'started') this.send({ type: 'status', state: 'running' })
      this.send(message)
    })
    void readLines(proc.stderr, (line) => this.send({ type: 'serverError', message: line }))

    proc.exited.then(async (code) => {
      if (this.proc !== proc) return
      this.proc = undefined
      this.send({ type: 'exited', code })
      this.send({ type: 'status', state: 'stopped' })
      await this.cleanup()
    })
  }

  input(message: RunnerInput) {
    if (!this.proc) return
    this.proc.stdin.write(`${JSON.stringify(message)}\n`)
    this.proc.stdin.flush()
  }

  async dispose() {
    this.generation++
    await this.killProc()
    await this.cleanup()
  }

  /** 浏览器点"停止"：直接结束进程（不依赖学生程序还能响应） */
  async stop() {
    this.generation++
    await this.killProc()
    this.send({ type: 'status', state: 'stopped' })
    await this.cleanup()
  }

  private async killProc() {
    const proc = this.proc
    this.proc = undefined
    if (!proc) return
    proc.kill()
    await proc.exited
  }

  private async cleanup() {
    if (!this.dir) return
    const dir = this.dir
    this.dir = undefined
    await rm(dir, { recursive: true, force: true })
  }
}

/** 拼接路径并拒绝跳出工程目录的文件名 */
function safeJoin(base: string, path: string) {
  const target = resolve(base, normalize(path))
  if (!target.startsWith(`${base}/`)) throw new Error(`非法文件路径：${path}`)
  return target
}

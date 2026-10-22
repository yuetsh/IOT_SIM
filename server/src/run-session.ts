import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join, normalize, resolve } from 'node:path'
import type { Subprocess } from 'bun'
import type { ClientMessage, RunnerInput, RunnerMessage, ServerMessage, SourceFile } from '@iot/shared'
import { Board } from './board'
import { compileService } from './compile-service'
import { config } from './config'
import { readLines } from './runner-process'
import { cpuLimitMessage, runCommand, sandboxError } from './sandbox'

const RUNS_DIR = config.runsDir

/** 全站正在运行的学生程序数 */
let liveRuns = 0

/** 服务器启动时清掉上次异常退出遗留的运行目录 */
export async function cleanupStaleRuns() {
  await rm(RUNS_DIR, { recursive: true, force: true })
}

/**
 * 一个浏览器会话：拥有一台虚拟实训台，负责每次运行（写出学生工程 → 编译服务编译 → 启动运行进程），
 * 在运行进程和浏览器之间转发消息，并让实训台状态在两边保持一致。
 */
export class RunSession {
  readonly board = new Board()
  private proc?: Subprocess<'pipe', 'pipe', 'pipe'>
  private dir?: string
  /** 每次启动、停止都递增，用来丢弃已经过时的编译结果 */
  private generation = 0
  /** 同一会话的多次"运行"排队依次执行，避免两次启动交错 */
  private queue = Promise.resolve()

  constructor(private readonly send: (message: ServerMessage) => void) {
    this.sendBoard()
  }

  start(files: SourceFile[]) {
    const next = this.queue.then(() => this.startNow(files))
    this.queue = next.catch(() => {})
    return next
  }

  private async startNow(files: SourceFile[]) {
    if (sandboxError) throw new Error(sandboxError)
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
    if (liveRuns >= config.maxRuns) {
      this.send({ type: 'serverError', message: '服务器繁忙：同时运行的程序太多，请稍后再试' })
      this.send({ type: 'status', state: 'stopped' })
      await this.cleanup()
      return
    }

    // 启动时就带上传感器读数，学生程序第一次 SetData() 前不必等消息
    const { cmd, env } = runCommand(dir, { SIM_BOARD: JSON.stringify(this.board.runnerInputs()) })
    const proc = Bun.spawn(cmd, { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env })
    this.proc = proc
    liveRuns++
    // 运行太久自动结束，防止忘了关的程序一直占着服务器
    const timeout = setTimeout(() => {
      if (this.proc !== proc) return
      this.send({ type: 'console', text: `\n程序已运行 ${config.maxRunMinutes} 分钟，自动结束。\n` })
      proc.kill()
    }, config.maxRunMinutes * 60_000)

    void readLines(proc.stdout, (line) => {
      let message: RunnerMessage
      try {
        message = JSON.parse(line)
      } catch {
        this.send({ type: 'console', text: `${line}\n` })
        return
      }
      if (message.type === 'started') this.send({ type: 'status', state: 'running' })
      if (message.type === 'device') {
        if (this.board.applyDevice(message)) this.sendBoard()
        return
      }
      this.send(message)
    })
    void readLines(proc.stderr, (line) => this.send({ type: 'serverError', message: line }))

    proc.exited.then(async (code) => {
      liveRuns--
      clearTimeout(timeout)
      if (this.proc !== proc) return
      this.proc = undefined
      this.board.programExited()
      this.sendBoard()
      const cpuMessage = cpuLimitMessage(code, proc.signalCode)
      if (cpuMessage) this.send({ type: 'console', text: cpuMessage })
      this.send({ type: 'exited', code })
      this.send({ type: 'status', state: 'stopped' })
      await this.cleanup()
    })
  }

  /** 浏览器调节实训台环境：更新状态，推给浏览器和正在运行的学生程序 */
  boardInput(message: Extract<ClientMessage, { type: 'boardInput' }>) {
    if (!this.board.applyInput(message)) return
    this.sendBoard()
    this.input(this.board.runnerInputs())
  }

  boardReset() {
    this.board.reset()
    this.sendBoard()
    this.input(this.board.runnerInputs())
  }

  private sendBoard() {
    this.send({ type: 'board', state: structuredClone(this.board.state) })
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
    this.board.programExited()
    this.sendBoard()
  }

  private async cleanup() {
    if (!this.dir) return
    const dir = this.dir
    this.dir = undefined
    await rm(dir, { recursive: true, force: true })
  }
}

/** 拼接路径并拒绝跳出工程目录的文件名 */
export function safeJoin(base: string, path: string) {
  const target = resolve(base, normalize(path))
  if (!target.startsWith(`${base}/`)) throw new Error(`非法文件路径：${path}`)
  return target
}

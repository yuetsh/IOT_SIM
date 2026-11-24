import { rm } from 'node:fs/promises'
import type { ClientMessage, RunnerInput, RunnerMessage, ServerMessage, SourceFile, Wiring } from '@iot/shared'
import { Board } from './board'
import { config } from './config'
import { startProgram } from './dispatch'
import type { ProgramHandle } from './executor'
import { cpuLimitMessage, sandboxError } from './sandbox'

export { safeJoin } from './paths'

/** 服务器启动时清掉上次异常退出遗留的运行目录 */
export async function cleanupStaleRuns() {
  await rm(config.runsDir, { recursive: true, force: true })
}

/**
 * 一个浏览器会话：拥有一台虚拟实训台，负责每次运行（编译 → 启动学生程序，在本机或计算节点上，见 dispatch.ts），
 * 在学生程序和浏览器之间转发消息，并让实训台状态在两边保持一致。
 */
export class RunSession {
  readonly board = new Board()
  private program?: ProgramHandle
  /** 每次启动、停止都递增，用来丢弃已经过时的编译结果 */
  private generation = 0
  /** 同一会话的多次"运行"排队依次执行，避免两次启动交错 */
  private queue = Promise.resolve()

  /** dbDir：这个用户的数据库目录（运行时挂进沙箱，程序可以读写） */
  constructor(
    private readonly send: (message: ServerMessage) => void,
    private readonly dbDir?: () => Promise<string>,
  ) {
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

    this.send({ type: 'status', state: 'compiling' })
    // 启动时就带上传感器读数，学生程序第一次 SetData() 前不必等消息
    const { compiled, program } = await startProgram({
      files,
      env: { SIM_BOARD: JSON.stringify(this.board.runnerInputs()) },
      dbDir: await this.dbDir?.(),
    })
    // 编译期间又点了一次"运行"或"停止"：这次结果作废
    if (generation !== this.generation) {
      // 等它真的结束再让下一次运行开始，免得两个程序同时用学生的数据库
      if (program) {
        program.kill()
        await program.exited
      }
      return
    }
    this.send({ type: 'compiled', ...compiled })
    if (!compiled.ok) {
      this.send({ type: 'status', state: 'stopped' })
      return
    }
    if (!program) {
      this.send({ type: 'serverError', message: '服务器繁忙：同时运行的程序太多，请稍后再试' })
      this.send({ type: 'status', state: 'stopped' })
      return
    }

    this.program = program
    // 运行太久自动结束，防止忘了关的程序一直占着服务器
    const timeout = setTimeout(() => {
      if (this.program !== program) return
      this.send({ type: 'console', text: `\n程序已运行 ${config.maxRunMinutes} 分钟，自动结束。\n` })
      program.kill()
    }, config.maxRunMinutes * 60_000)

    program.listen(
      (line) => {
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
      },
      (line) => this.send({ type: 'serverError', message: line }),
    )

    void program.exited.then(({ code, signal, lost }) => {
      clearTimeout(timeout)
      if (this.program !== program) return
      this.program = undefined
      this.board.programExited()
      this.sendBoard()
      if (lost) this.send({ type: 'console', text: '\n和运行程序的机器断开了连接，程序已结束，请重新运行。\n' })
      const cpuMessage = cpuLimitMessage(code, signal)
      if (cpuMessage) this.send({ type: 'console', text: cpuMessage })
      this.send({ type: 'exited', code: code ?? -1 })
      this.send({ type: 'status', state: 'stopped' })
    })
  }

  /** 浏览器调节实训台环境：更新状态，推给浏览器和正在运行的学生程序 */
  boardInput(message: Extract<ClientMessage, { type: 'boardInput' }>) {
    if (!this.board.applyInput(message)) return
    this.sendBoard()
    this.input(this.board.runnerInputs())
  }

  /** 换成实验的接线（打开实验、运行时） */
  setWiring(wiring: Wiring) {
    if (!this.board.setWiring(wiring)) return
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
    this.program?.write(JSON.stringify(message))
  }

  async dispose() {
    this.generation++
    await this.killProgram()
  }

  /** 浏览器点"停止"：直接结束进程（不依赖学生程序还能响应） */
  async stop() {
    this.generation++
    await this.killProgram()
    this.send({ type: 'status', state: 'stopped' })
  }

  /** 结束学生程序，等它的收尾做完（远程运行时数据库改动写回之后，下一次运行才能开始） */
  private async killProgram() {
    const program = this.program
    this.program = undefined
    if (!program) return
    program.kill()
    await program.exited
    this.board.programExited()
    this.sendBoard()
  }
}

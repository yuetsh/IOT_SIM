// 编译并启动一个学生程序。程序可能在本机（runLocally），也可能在学校的计算节点上（worker-hub.ts），
// 两种都给出同样的 ProgramHandle，运行会话（run-session.ts）不用管程序在哪里。
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Subprocess } from 'bun'
import type { SourceFile } from '@iot/shared'
import { type CompileResult, compileService } from './compile-service'
import { config } from './config'
import { readLines } from './runner-process'
import { safeJoin } from './paths'
import { runCommand, sandboxError } from './sandbox'

export type LineListener = (line: string) => void | Promise<void>

export interface ProgramExit {
  code: number | null
  signal: string | number | null
  /** 和计算节点的连接断了，程序随之结束 */
  lost?: boolean
}

/** 一个正在运行的学生程序 */
export interface ProgramHandle {
  /**
   * 开始接收输出。之前收到的行先存着，调用时一并交出。
   * 回调返回 Promise 时（本机运行），等它完成再读下一行，用来给太快的输出降速
   */
  listen(onStdout: LineListener, onStderr: LineListener): void
  /** 写一行到标准输入 */
  write(line: string): void
  kill(): void
  /** 程序结束，而且收尾已经做完（临时目录删掉、远程时数据库文件写回） */
  readonly exited: Promise<ProgramExit>
}

export interface RunRequest {
  files: SourceFile[]
  /** 额外的环境变量（SIM_BOARD：启动时的传感器读数） */
  env: Record<string, string>
  /** 学生的数据库目录，程序可以读写；没有时程序连不上数据库 */
  dbDir?: string
}

/** 编译结果；编译通过并启动了才有 program。编译通过却没有 program：同时运行的程序太多 */
export interface RunOutcome {
  compiled: CompileResult
  program?: ProgramHandle
}

/** 本机正在运行的学生程序数 */
let liveRuns = 0

/** 在本机写出工程、编译、在沙箱里启动 */
export async function runLocally(request: RunRequest): Promise<RunOutcome> {
  if (sandboxError) throw new Error(sandboxError)
  await mkdir(config.runsDir, { recursive: true })
  const dir = await mkdtemp(join(config.runsDir, 'run-'))
  let compiled: CompileResult
  try {
    await writeFiles(dir, request.files)
    compiled = await compileService.compile(dir)
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
  if (!compiled.ok || liveRuns >= config.maxRuns) {
    await rm(dir, { recursive: true, force: true })
    return { compiled }
  }
  const { cmd, env } = runCommand(dir, request.env, request.dbDir)
  const proc = Bun.spawn(cmd, { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env })
  liveRuns++
  return {
    compiled,
    program: new LocalProgram(proc, async () => {
      liveRuns--
      await rm(dir, { recursive: true, force: true })
    }),
  }
}

/** 把源文件写进工程目录（拒绝跳出目录的文件名） */
export async function writeFiles(dir: string, files: SourceFile[]) {
  for (const file of files) {
    const target = safeJoin(dir, file.path)
    await mkdir(dirname(target), { recursive: true })
    await Bun.write(target, file.content)
  }
}

/** 收到的行先存着，等 listen 之后再交出去 */
export class LineBuffer {
  private stdout?: LineListener
  private stderr?: LineListener
  private pending: [boolean, string][] = []

  listen(onStdout: LineListener, onStderr: LineListener) {
    this.stdout = onStdout
    this.stderr = onStderr
    for (const [isErr, line] of this.pending) void (isErr ? onStderr : onStdout)(line)
    this.pending = []
  }

  push(isErr: boolean, line: string): void | Promise<void> {
    const target = isErr ? this.stderr : this.stdout
    if (target) return target(line)
    this.pending.push([isErr, line])
  }
}

class LocalProgram implements ProgramHandle {
  private readonly lines = new LineBuffer()
  readonly exited: Promise<ProgramExit>

  constructor(
    private readonly proc: Subprocess<'pipe', 'pipe', 'pipe'>,
    cleanup: () => Promise<void>,
  ) {
    const reading = Promise.all([readLines(proc.stdout, (line) => this.lines.push(false, line)), readLines(proc.stderr, (line) => this.lines.push(true, line))])
    this.exited = proc.exited.then(async (code) => {
      // 输出读完再算结束，最后几行（比如异常信息）不会排在"已结束"后面；管道迟迟不关时最多等 2 秒
      await Promise.race([reading.catch(() => {}), Bun.sleep(2000)])
      await cleanup()
      return { code, signal: proc.signalCode }
    })
  }

  listen(onStdout: LineListener, onStderr: LineListener) {
    this.lines.listen(onStdout, onStderr)
  }

  write(line: string) {
    if (this.proc.exitCode !== null || this.proc.signalCode !== null) return
    this.proc.stdin.write(`${line}\n`)
    this.proc.stdin.flush()
  }

  kill() {
    this.proc.kill()
  }
}

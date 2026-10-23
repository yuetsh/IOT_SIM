// 学生程序的沙箱：每次运行用 bubblewrap 放进独立的命名空间。
// 断网；只能看到系统只读文件、运行时程序和自己的工程目录；/tmp 是独立的内存盘；
// 看不到服务器上的其他进程（包括别的学生程序）；服务器进程的环境变量也不会传进去。
import { lstatSync, readlinkSync, realpathSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { config } from './config'

const RUNNER_DIR = '/sim/runner'
const APP_DIR = '/sim/app'
const DB_DIR = '/sim/db'

/** 学生程序的全部环境变量（不继承服务器的） */
function runnerEnv(extra: Record<string, string>) {
  return {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: '/tmp',
    TZ: config.timeZone,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1',
    // 学生写出死循环分配内存时，在这里报 OutOfMemoryException，而不是拖垮服务器
    DOTNET_GCHeapHardLimit: (config.heapLimitMb * 1024 * 1024).toString(16),
    ...extra,
  }
}

/** /lib、/bin 等在新系统上是指向 /usr 的链接，照原样建链接；老系统上是真目录，只读挂载 */
function rootLinks(): string[] {
  const args: string[] = []
  for (const path of ['/bin', '/sbin', '/lib', '/lib32', '/lib64']) {
    let stat
    try {
      stat = lstatSync(path)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) args.push('--symlink', readlinkSync(path), path)
    else if (stat.isDirectory()) args.push('--ro-bind', path, path)
  }
  return args
}

/** dotnet 不在 /usr 下时（比如装在 /opt），把它所在目录也挂进去 */
function dotnetMounts(): string[] {
  const dotnet = Bun.which('dotnet')
  if (!dotnet) return []
  const home = dirname(realpathSync(dotnet))
  return home.startsWith('/usr/') ? [] : ['--ro-bind', home, home]
}

/** 沙箱不可用的原因；可用（或没启用沙箱）时为 undefined。服务器启动时检查一次 */
export let sandboxError: string | undefined

export async function checkSandbox() {
  if (config.sandbox === 'none') return
  await mkdir(config.runsDir, { recursive: true })
  const proc = Bun.spawn([...bwrapArgs(config.runsDir), 'true'], { stdout: 'ignore', stderr: 'pipe', env: runnerEnv({}) })
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (code === 0) return
  sandboxError =
    `沙箱（bubblewrap）无法启动：${stderr.trim().replace(/[.。]$/, '')}。` +
    '学生程序不会在没有隔离的情况下运行。检查 compose.yaml 里的 security_opt；' +
    'Ubuntu 23.10 及以上的宿主机还要执行 sudo sysctl kernel.apparmor_restrict_unprivileged_userns=0（见 deploy/README.md）'
}

/**
 * 启动一次学生程序运行的命令行和环境变量。
 * dbDir：这次运行使用的数据库目录（学生自己的，或评分时的临时目录），学生程序可以读写；不给时程序连不上数据库。
 */
export function runCommand(projectDir: string, extraEnv: Record<string, string>, dbDir?: string) {
  if (config.sandbox === 'none') {
    const env = runnerEnv({ ...extraEnv, ...(dbDir ? { SIM_DB_DIR: dbDir } : {}) })
    return { cmd: ['dotnet', config.runnerDll, 'run', projectDir], env }
  }
  const env = runnerEnv({ ...extraEnv, ...(dbDir ? { SIM_DB_DIR: DB_DIR } : {}) })
  const cmd = [
    // 学生程序写出死循环时，降低它的优先级，网页服务和编译服务仍然流畅
    'nice', '-n', '10',
    // CPU 时间用完直接 SIGKILL 结束（软硬上限相同）。软上限更小时内核先发 SIGXCPU，它默认生成 core dump：
    // 学生每写一次死循环就留下一个转储，本机桌面还会弹出"程序崩溃"
    'prlimit', `--cpu=${config.cpuLimitSeconds}:${config.cpuLimitSeconds}`, '--core=0',
    ...bwrapArgs(projectDir),
    ...(dbDir ? ['--bind', dbDir, DB_DIR] : []),
    'dotnet', `${RUNNER_DIR}/${config.runnerDll.split('/').pop()}`, 'run', APP_DIR,
  ]
  return { cmd, env }
}

const SIGKILL = 9

/**
 * 运行进程退出时，如果是因为 CPU 时间用完，给学生的说明。
 * CPU 上限到时内核发 SIGKILL，bwrap 把子进程"被信号结束"转成退出码 128 + 信号编号；
 * 平台自己结束程序（停止、超时、关闭页面）用的是 SIGTERM，不会误报。
 */
export function cpuLimitMessage(code: number | null, signal: string | number | null) {
  return signal === 'SIGKILL' || code === 128 + SIGKILL
    ? `\n程序占用 CPU 太多，已被结束（累计超过 ${config.cpuLimitSeconds} 秒）。检查是否有死循环：循环里要有退出条件，等待请用 Timer 或 Thread.Sleep。\n`
    : undefined
}

function bwrapArgs(projectDir: string) {
  return [
    'bwrap',
    '--unshare-all',
    '--die-with-parent',
    '--new-session',
    '--ro-bind', '/usr', '/usr',
    ...rootLinks(),
    '--ro-bind-try', '/etc/localtime', '/etc/localtime',
    ...dotnetMounts(),
    '--proc', '/proc',
    '--dev', '/dev',
    '--tmpfs', '/tmp',
    '--ro-bind', dirname(config.runnerDll), RUNNER_DIR,
    '--ro-bind', projectDir, APP_DIR,
    '--chdir', APP_DIR,
  ]
}

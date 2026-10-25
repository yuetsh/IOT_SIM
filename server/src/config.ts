// 服务器配置：都可以用环境变量覆盖，开发时不设置也能直接运行。
import { resolve } from 'node:path'

const env = process.env

/** 项目根目录。部署时服务端打包成单个文件，位置变了，用 APP_ROOT 指定 */
export const ROOT = env.APP_ROOT ?? resolve(import.meta.dir, '../..')

export const config = {
  port: Number(env.PORT ?? 3000),
  /** 运行时程序（编译服务和运行进程共用），部署时用 Release 版 */
  runnerDll: resolve(ROOT, env.RUNNER_DLL ?? 'runtime/Sim.Runner/bin/Debug/net10.0/Sim.Runner.dll'),
  /** 每次运行的临时工程目录放在这里 */
  runsDir: resolve(ROOT, env.RUNS_DIR ?? '.runs'),
  samplesDir: resolve(ROOT, env.SAMPLES_DIR ?? 'samples'),
  /** 打包好的网页（web/dist）；目录不存在时不提供网页，开发时由 Vite 提供 */
  staticDir: resolve(ROOT, env.STATIC_DIR ?? 'web/dist'),
  /** 学生程序的沙箱：bwrap（bubblewrap）或 none；默认装了 bwrap 就用 */
  sandbox: (env.SIM_SANDBOX ?? (Bun.which('bwrap') ? 'bwrap' : 'none')) as 'bwrap' | 'none',
  /** 学生程序托管堆上限（MB） */
  heapLimitMb: Number(env.SIM_HEAP_LIMIT_MB ?? 128),
  /**
   * 一次运行最多用多少秒 CPU。正常的界面程序大部分时间在等事件，一小时也用不了几秒；
   * 写出死循环的程序会一直占满一个核（服务器只有 2 核），到时间就被结束
   */
  cpuLimitSeconds: Number(env.SIM_CPU_LIMIT_SECONDS ?? 120),
  /** 全站同时运行的学生程序最多多少个（两个班约 100 人） */
  maxRuns: Number(env.SIM_MAX_RUNS ?? 150),
  /**
   * 全站同时跑多少个评分检查项（提交评分和自测共用）。检查大部分时间在等学生程序的定时器，并发太低时全班排队：
   * 2 核实测 45 人同时自测项目 8 任务 3，6 个时最后一人等 4 分钟（CPU 才 28%），16 个时 1.5 分钟（CPU 58%）；
   * 24 个时 CPU 接近 80%，定时器来不及触发，参考答案被误判不通过（test/classroom.ts）
   */
  gradeConcurrency: Number(env.SIM_GRADE_CONCURRENCY ?? 16),
  /** 一次运行最长多少分钟，到时自动结束 */
  maxRunMinutes: Number(env.SIM_MAX_RUN_MINUTES ?? 60),
  /** SQLite 数据库所在目录（账号、班级、学生作品）；部署时放在数据卷里 */
  dataDir: resolve(ROOT, env.DATA_DIR ?? 'data'),
  /** 老师账号（只有一个）。开发时不设置密码就用 admin / admin */
  teacherUsername: env.TEACHER_USERNAME ?? 'admin',
  teacherPassword: env.TEACHER_PASSWORD ?? '',
  timeZone: env.TZ ?? 'Asia/Shanghai',
  /** AI 评阅（DeepSeek，OpenAI 格式接口）；不设置密钥就不做 AI 评阅 */
  aiApiKey: env.DEEPSEEK_API_KEY ?? '',
  aiBaseUrl: env.AI_BASE_URL ?? 'https://api.deepseek.com',
  aiModel: env.AI_MODEL ?? 'deepseek-flash',
}

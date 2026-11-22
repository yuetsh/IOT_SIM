// 自动评分的结果：服务器给学生程序逐项检查后返回，学生提交后立即能看到。
import type { Diagnostic, SourceFile } from './protocol'

export interface CheckResult {
  /** 检查项名称，对应书上评价表的功能项，如"能实时显示入侵数据" */
  title: string
  passed: boolean
  /** 不通过的原因：期望看到什么、实际是什么 */
  message?: string
}

export interface GradeResult {
  /** 编译没通过时所有项都不通过 */
  compiled: boolean
  results: CheckResult[]
  /** 评分用时（毫秒） */
  ms: number
}

/** 自测（提交前自己跑一遍评分，不计分）：每人同时一次，结果保留到下一次自测 */
export interface SelfCheck {
  status: 'running' | 'done' | 'error'
  /** 检查的是哪个实验或作业（结果只对同一个显示） */
  target: string
  result: GradeResult | null
  startedAt: number
}

// ---------- 作业 ----------

/** 学生的起点：blank 空白工程（从界面做起），ui 界面已做好（只写代码） */
export type StartMode = 'blank' | 'ui'

/** 分值：自动评分项按规则顺序各自的分值；老师评分项（界面、注释、命名等）由老师打分 */
export interface Scoring {
  auto: number[]
  manual: { title: string; points: number }[]
}

export interface Assignment {
  id: number
  classId: number
  className: string
  sampleId: string
  title: string
  startMode: StartMode
  /** 截止时间（毫秒时间戳），null 表示不限 */
  deadline: number | null
  createdAt: number
  /** 自动评分项的名称，和 scoring.auto 一一对应 */
  checkTitles: string[]
  scoring: Scoring
  /**
   * 任务说明（Markdown，见 web/src/grading/markdown.ts）：布置时从实验的 task.md 复制，老师可以改写。
   * null 是加这个功能之前布置的作业，学生看到的是实验现在的说明
   */
  task: string | null
}

export interface Submission {
  id: number
  status: 'pending' | 'done' | 'error'
  result: GradeResult | null
  /** 自动评分得分（通过的项的分值之和） */
  autoScore: number | null
  createdAt: number
  /** 排队评分时前面还有几份 */
  queueAhead?: number
}

/** 老师评阅：老师评分项各自的得分（null 表示还没打分，和 scoring.manual 一一对应）和评语 */
export interface Review {
  scores: (number | null)[]
  comment: string
  updatedAt: number
}

/** 提交时浏览器截的窗体图（PNG 的 base64，不含 data: 前缀） */
export interface Screenshot {
  form: string
  png: string
}

/**
 * AI 评阅：老师评分项的建议分（和 scoring.manual 一一对应）、理由和给学生的评语。
 * 只是建议，老师采纳（或修改后保存）才成为老师评分。
 * status：pending 排队中；done 已评；error 出错；skipped 学生又交了新的，这份不评了
 */
export interface AiReview {
  status: 'pending' | 'done' | 'error' | 'skipped'
  scores: { score: number; reason: string }[]
  comment: string
  error?: string
  model?: string
  at?: number
}

/** 作业分析（老师课后看）：得分来自提交和评阅，过程数据来自学习过程记录 */
export interface AssignmentAnalysis {
  assignment: Assignment
  fullMarks: number
  autoTotal: number
  /** 这个作业最早的一条过程记录（过程记录 2026-11-22 才开始记，之前的作业没有）；没有时为 null */
  recordedSince: number | null
  students: {
    userId: number
    username: string
    name: string
    /** 最近一次提交的状态；没提交为 null */
    status: Submission['status'] | null
    auto: number | null
    manual: number | null
    reviewed: boolean
    /** 自动评分 + 老师评分（没评的按 0）；没提交为 null */
    total: number | null
    submissions: number
    lastSubmittedAt: number | null
    /** 做了多少分钟（改代码、运行、操作程序的分钟数） */
    minutes: number
    /** 运行（编译）次数，其中编译没通过的次数 */
    runs: number
    failedCompiles: number
    /** 运行出错的次数（一次运行里同样的异常只算一次） */
    exceptions: number
    selfchecks: number
    firstOpenedAt: number | null
    lastActiveAt: number | null
  }[]
  /** 自动评分项：最近一次提交里通过的人数 / 已评分的人数；struggled 是自测时这项没通过过的人数 */
  checks: { title: string; points: number; passed: number; graded: number; struggled: number }[]
  /** 常见编译错误：按错误代码分组，按出过这个错的人数排；messages 是最常见的几种具体报错，hint 是平台补充的中文提示（书上常见错误的说明） */
  compileErrors: { code: string; students: number; count: number; messages: { message: string; count: number; hint: string | null }[] }[]
  /** 常见运行出错：按异常信息分组 */
  exceptions: { message: string; students: number; count: number }[]
}

/** 一份作品（作业或自由练习的实验）上的过程数据 */
export interface WorkStats {
  /** 做了多少分钟（改代码、运行、操作程序的分钟数） */
  minutes: number
  runs: number
  failedCompiles: number
  exceptions: number
  selfchecks: number
  lastActiveAt: number | null
}

/** 一个学生的学习情况：学生在"我的学习"里看自己的，老师在学生档案里看（同一份数据） */
export interface StudentLearning {
  student: { id: number; username: string; name: string; className: string | null }
  /** days：有做题记录的天数 */
  summary: { minutes: number; days: number; runs: number; failedCompiles: number; exceptions: number; selfchecks: number }
  /** 自己班的作业（按布置时间） */
  assignments: (WorkStats & {
    id: number
    title: string
    sampleId: string
    deadline: number | null
    createdAt: number
    fullMarks: number
    /** 有老师评分项 */
    hasManual: boolean
    status: Submission['status'] | null
    reviewed: boolean
    /** 自动评分 + 老师评分（没评的按 0）；没提交为 null */
    total: number | null
    submissions: number
    lastSubmittedAt: number | null
  })[]
  /** 自由练习过的实验，最近做的在前 */
  practice: (WorkStats & { sampleId: string; title: string })[]
  /** 每天做了多少分钟（北京时间，yyyy-MM-dd） */
  days: { day: string; minutes: number }[]
  /** 常犯的编译错误：按错误代码分组、按次数排；works 是在几份作品里出过 */
  compileErrors: { code: string; count: number; works: number; lastAt: number; messages: { message: string; count: number; hint: string | null }[] }[]
  exceptions: { message: string; count: number; lastAt: number }[]
}

/** 学习过程记录里的一条事件（服务器的 learning-log.ts 记） */
export type LearningEvent =
  | { type: 'open' }
  | { type: 'reset' }
  /** 编译；errors 只存前几条错误，hint 是平台补充的中文提示（书上常见错误的说明） */
  | { type: 'compile'; ok: boolean; errorCount: number; errors: Pick<Diagnostic, 'code' | 'message' | 'file' | 'line' | 'hint'>[] }
  | { type: 'exception'; message: string; file?: string; line?: number }
  | { type: 'selfcheck'; compiled: boolean; results: CheckResult[] }

/** 一份快照相对上一份的改动；full 表示这一份是完整代码（不依赖前面的） */
export interface SnapshotChanges {
  full?: boolean
  files: Record<string, string>
  deleted: string[]
}

/** 老师回放一个学生做一个作业的过程 */
export interface WorkHistory {
  /** 布置时的起点工程（回放的第 0 步） */
  template: SourceFile[]
  /** 运行时存的代码快照，按时间顺序，只含改动（浏览器里按顺序还原） */
  snapshots: ({ at: number } & SnapshotChanges)[]
  events: { at: number; event: LearningEvent }[]
  submissions: { id: number; at: number; status: Submission['status']; autoScore: number | null }[]
}

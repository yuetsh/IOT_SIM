// 自动评分的结果：服务器给学生程序逐项检查后返回，学生提交后立即能看到。

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

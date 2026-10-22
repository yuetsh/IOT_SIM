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

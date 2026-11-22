// 作业分析（老师课后看）：全班得分、每个评分项的通过率、常见编译错误和运行出错、每个学生做了多久、运行和自测了几次。
// 得分来自提交和评阅，过程数据来自学习过程记录（learning-log.ts，2026-11-22 开始记，之前布置的作业没有）。
import type { Database } from 'bun:sqlite'
import type { AssignmentAnalysis, CheckResult, GradeResult } from '@iot/shared'
import { getAssignment } from './assignments'
import { getReview, manualScore } from './reviews'

/** 常见错误各列多少种 */
const TOP = 10
/** 一种编译错误下列出几种具体的报错信息 */
const TOP_MESSAGES = 3

export function assignmentAnalysis(db: Database, assignmentId: number): AssignmentAnalysis | null {
  const assignment = getAssignment(db, assignmentId)
  if (!assignment) return null
  const key = `assignment:${assignmentId}`
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

  const students = db
    .query<{ id: number; username: string; name: string }, [number]>(
      `SELECT id, username, name FROM users WHERE class_id = ? AND role = 'student' ORDER BY username`,
    )
    .all(assignment.classId)

  // 每个学生最近一次提交、提交次数
  const latest = new Map(
    db
      .query<{ user_id: number; status: string; auto_score: number | null; result: string | null; created_at: number; count: number }, [number]>(
        `SELECT s.user_id, s.status, s.auto_score, s.result, s.created_at, c.count
         FROM submissions s
         JOIN (SELECT user_id, MAX(id) AS id, COUNT(*) AS count FROM submissions WHERE assignment_id = ?1 GROUP BY user_id) c ON c.id = s.id`,
      )
      .all(assignmentId)
      .map((r) => [r.user_id, r]),
  )

  // 过程记录：每人每种事件的次数、编译失败次数、第一次打开的时间
  const counts = new Map<number, { open: number; compile: number; failed: number; exception: number; selfcheck: number; firstOpen: number | null }>()
  for (const r of db
    .query<{ user_id: number; type: string; n: number; failed: number; first: number }, [string]>(
      `SELECT user_id, type, COUNT(*) AS n, SUM(type = 'compile' AND json_extract(data, '$.ok') = 0) AS failed, MIN(created_at) AS first
       FROM events WHERE work_key = ? GROUP BY user_id, type`,
    )
    .all(key)) {
    const c = counts.get(r.user_id) ?? { open: 0, compile: 0, failed: 0, exception: 0, selfcheck: 0, firstOpen: null }
    if (r.type === 'open' || r.type === 'compile' || r.type === 'exception' || r.type === 'selfcheck') c[r.type] = r.n
    if (r.type === 'compile') c.failed = r.failed
    if (r.type === 'open') c.firstOpen = r.first
    counts.set(r.user_id, c)
  }
  const activity = new Map(
    db
      .query<{ user_id: number; minutes: number; last: number }, [string]>(
        'SELECT user_id, COUNT(*) AS minutes, MAX(minute) AS last FROM activity WHERE work_key = ? GROUP BY user_id',
      )
      .all(key)
      .map((r) => [r.user_id, r]),
  )

  // 评分项：最近一次提交（已评分）的通过人数；自测时没通过过的人数（哪项卡住的人多）
  const checks = assignment.checkTitles.map((title, i) => ({ title, points: assignment.scoring.auto[i] ?? 0, passed: 0, graded: 0, struggled: 0 }))
  for (const s of latest.values()) {
    if (s.status !== 'done' || !s.result) continue
    const result = JSON.parse(s.result) as GradeResult
    result.results.forEach((r, i) => {
      if (!checks[i]) return
      checks[i].graded++
      if (r.passed) checks[i].passed++
    })
  }
  const struggled = checks.map(() => new Set<number>())
  for (const r of db
    .query<{ user_id: number; data: string }, [string]>(`SELECT user_id, data FROM events WHERE work_key = ? AND type = 'selfcheck'`)
    .all(key)) {
    const results = (JSON.parse(r.data) as { results: CheckResult[] }).results
    results.forEach((x, i) => {
      if (!x.passed) struggled[i]?.add(r.user_id)
    })
  }
  checks.forEach((c, i) => (c.struggled = struggled[i]!.size))

  // 常见编译错误：按错误代码分组，按出过这个错的人数排
  interface CompileGroup {
    users: Set<number>
    count: number
    /** 具体报错 → 次数和平台的中文提示 */
    messages: Map<string, { count: number; hint: string | null }>
  }
  const compileGroups = new Map<string, CompileGroup>()
  for (const r of db
    .query<{ user_id: number; code: string; message: string; hint: string | null }, [string]>(
      `SELECT e.user_id, json_extract(j.value, '$.code') AS code, json_extract(j.value, '$.message') AS message, json_extract(j.value, '$.hint') AS hint
       FROM events e, json_each(e.data, '$.errors') j WHERE e.work_key = ? AND e.type = 'compile'`,
    )
    .all(key)) {
    const g: CompileGroup = compileGroups.get(r.code) ?? { users: new Set(), count: 0, messages: new Map() }
    g.users.add(r.user_id)
    g.count++
    const m = g.messages.get(r.message) ?? { count: 0, hint: null }
    m.count++
    m.hint ??= r.hint
    g.messages.set(r.message, m)
    compileGroups.set(r.code, g)
  }
  const compileErrors = [...compileGroups]
    .map(([code, g]) => ({
      code,
      students: g.users.size,
      count: g.count,
      messages: [...g.messages]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, TOP_MESSAGES)
        .map(([message, m]) => ({ message, ...m })),
    }))
    .sort((a, b) => b.students - a.students || b.count - a.count)
    .slice(0, TOP)

  // 运行出错：按异常信息分组
  const exceptions = db
    .query<{ message: string; students: number; count: number }, [string]>(
      `SELECT json_extract(data, '$.message') AS message, COUNT(DISTINCT user_id) AS students, COUNT(*) AS count
       FROM events WHERE work_key = ? AND type = 'exception' GROUP BY message ORDER BY students DESC, count DESC LIMIT ${TOP}`,
    )
    .all(key)

  const since = db.query<{ first: number | null }, [string]>('SELECT MIN(created_at) AS first FROM events WHERE work_key = ?').get(key)!.first

  return {
    assignment,
    fullMarks: sum(assignment.scoring.auto) + sum(assignment.scoring.manual.map((m) => m.points)),
    autoTotal: sum(assignment.scoring.auto),
    recordedSince: since,
    students: students.map((u) => {
      const s = latest.get(u.id)
      const review = getReview(db, assignmentId, u.id)
      const manual = manualScore(review)
      const c = counts.get(u.id)
      const a = activity.get(u.id)
      const auto = s?.status === 'done' ? s.auto_score : null
      return {
        userId: u.id,
        username: u.username,
        name: u.name,
        status: (s?.status ?? null) as AssignmentAnalysis['students'][number]['status'],
        auto,
        manual,
        reviewed: review !== null,
        total: s ? (auto ?? 0) + (manual ?? 0) : null,
        submissions: s?.count ?? 0,
        lastSubmittedAt: s?.created_at ?? null,
        minutes: a?.minutes ?? 0,
        runs: c?.compile ?? 0,
        failedCompiles: c?.failed ?? 0,
        exceptions: c?.exception ?? 0,
        selfchecks: c?.selfcheck ?? 0,
        firstOpenedAt: c?.firstOpen ?? null,
        lastActiveAt: a ? a.last * 60_000 : null,
      }
    }),
    checks,
    compileErrors,
    exceptions,
  }
}

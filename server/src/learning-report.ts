// 一个学生的学习情况：学生在"我的学习"里看自己的，老师在学生档案里看任何一个学生的（同一份数据）。
// 作业得分来自提交和评阅；用时、运行、自测、常犯的错误来自学习过程记录（learning-log.ts，2026-11-22 开始记）。
import type { Database } from 'bun:sqlite'
import type { Scoring, StudentLearning } from '@iot/shared'
import { latestSubmission } from './assignments'
import { getReview, manualScore } from './reviews'
import type { SampleInfo } from './samples'

/** 常犯的错误各列多少种 */
const TOP = 10
const TOP_MESSAGES = 3
/** 按北京时间分天（服务器容器可能是 UTC） */
const DAY_OFFSET_SECONDS = 8 * 3600

export function studentLearning(db: Database, userId: number, samples: SampleInfo[]): StudentLearning | null {
  const student = db
    .query<{ id: number; username: string; name: string; class_id: number | null; class_name: string | null }, [number]>(
      `SELECT u.id, u.username, u.name, u.class_id, c.name AS class_name FROM users u LEFT JOIN classes c ON c.id = u.class_id
       WHERE u.id = ? AND u.role = 'student'`,
    )
    .get(userId)
  if (!student) return null

  // 每份作品的用时、运行次数等
  interface WorkStats {
    minutes: number
    runs: number
    failedCompiles: number
    exceptions: number
    selfchecks: number
    lastActiveAt: number | null
  }
  const works = new Map<string, WorkStats>()
  const work = (key: string) => {
    let w = works.get(key)
    if (!w) works.set(key, (w = { minutes: 0, runs: 0, failedCompiles: 0, exceptions: 0, selfchecks: 0, lastActiveAt: null }))
    return w
  }
  for (const r of db
    .query<{ work_key: string; minutes: number; last: number }, [number]>(
      'SELECT work_key, COUNT(*) AS minutes, MAX(minute) AS last FROM activity WHERE user_id = ? GROUP BY work_key',
    )
    .all(userId)) {
    const w = work(r.work_key)
    w.minutes = r.minutes
    w.lastActiveAt = r.last * 60_000
  }
  for (const r of db
    .query<{ work_key: string; type: string; n: number; failed: number; last: number }, [number]>(
      `SELECT work_key, type, COUNT(*) AS n, SUM(type = 'compile' AND json_extract(data, '$.ok') = 0) AS failed, MAX(created_at) AS last
       FROM events WHERE user_id = ? GROUP BY work_key, type`,
    )
    .all(userId)) {
    const w = work(r.work_key)
    if (r.type === 'compile') {
      w.runs = r.n
      w.failedCompiles = r.failed
    } else if (r.type === 'exception') w.exceptions = r.n
    else if (r.type === 'selfcheck') w.selfchecks = r.n
    w.lastActiveAt = Math.max(w.lastActiveAt ?? 0, r.last)
  }
  const statsOf = (key: string): WorkStats => works.get(key) ?? { minutes: 0, runs: 0, failedCompiles: 0, exceptions: 0, selfchecks: 0, lastActiveAt: null }

  // 自己班的作业（按布置时间）
  const assignments = (
    student.class_id === null
      ? []
      : db
          .query<{ id: number; title: string; sample_id: string; scoring: string; deadline: number | null; created_at: number }, [number]>(
            'SELECT id, title, sample_id, scoring, deadline, created_at FROM assignments WHERE class_id = ? ORDER BY created_at',
          )
          .all(student.class_id)
  ).map((a) => {
    const scoring = JSON.parse(a.scoring) as Scoring
    const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0)
    const latest = latestSubmission(db, a.id, userId)
    const review = getReview(db, a.id, userId)
    const auto = latest?.status === 'done' ? latest.autoScore : null
    const manual = manualScore(review)
    const submissions = db
      .query<{ n: number }, [number, number]>('SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = ? AND user_id = ?')
      .get(a.id, userId)!.n
    return {
      id: a.id,
      title: a.title,
      sampleId: a.sample_id,
      deadline: a.deadline,
      createdAt: a.created_at,
      fullMarks: sum(scoring.auto) + sum(scoring.manual.map((m) => m.points)),
      hasManual: scoring.manual.length > 0,
      status: latest?.status ?? null,
      reviewed: review !== null,
      total: latest ? (auto ?? 0) + (manual ?? 0) : null,
      submissions,
      lastSubmittedAt: latest?.createdAt ?? null,
      ...statsOf(`assignment:${a.id}`),
    }
  })

  // 自由练习过的实验
  const titles = new Map(samples.map((s) => [s.id, s.title]))
  const practice = [...works]
    .filter(([key]) => key.startsWith('sample:'))
    .map(([key, w]) => ({ sampleId: key.slice('sample:'.length), title: titles.get(key.slice('sample:'.length)) ?? key.slice('sample:'.length), ...w }))
    .sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0))

  // 每天做了多少分钟（北京时间）
  const days = db
    .query<{ day: string; minutes: number }, [number, number]>(
      `SELECT date(minute * 60 + ?, 'unixepoch') AS day, COUNT(*) AS minutes FROM activity WHERE user_id = ? GROUP BY day ORDER BY day`,
    )
    .all(DAY_OFFSET_SECONDS, userId)

  // 常犯的编译错误：按错误代码分组，按出现次数排
  const groups = new Map<string, { count: number; works: Set<string>; lastAt: number; messages: Map<string, { count: number; hint: string | null }> }>()
  for (const r of db
    .query<{ work_key: string; created_at: number; code: string; message: string; hint: string | null }, [number]>(
      `SELECT e.work_key, e.created_at, json_extract(j.value, '$.code') AS code, json_extract(j.value, '$.message') AS message,
              json_extract(j.value, '$.hint') AS hint
       FROM events e, json_each(e.data, '$.errors') j WHERE e.user_id = ? AND e.type = 'compile'`,
    )
    .all(userId)) {
    let g = groups.get(r.code)
    if (!g) groups.set(r.code, (g = { count: 0, works: new Set(), lastAt: 0, messages: new Map() }))
    g.count++
    g.works.add(r.work_key)
    g.lastAt = Math.max(g.lastAt, r.created_at)
    const m = g.messages.get(r.message) ?? { count: 0, hint: null }
    m.count++
    m.hint ??= r.hint
    g.messages.set(r.message, m)
  }
  const compileErrors = [...groups]
    .map(([code, g]) => ({
      code,
      count: g.count,
      works: g.works.size,
      lastAt: g.lastAt,
      messages: [...g.messages]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, TOP_MESSAGES)
        .map(([message, m]) => ({ message, ...m })),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP)

  const exceptions = db
    .query<{ message: string; count: number; lastAt: number }, [number]>(
      `SELECT json_extract(data, '$.message') AS message, COUNT(*) AS count, MAX(created_at) AS lastAt
       FROM events WHERE user_id = ? AND type = 'exception' GROUP BY message ORDER BY count DESC LIMIT ${TOP}`,
    )
    .all(userId)

  const all = [...works.values()]
  const total = (f: (w: WorkStats) => number) => all.reduce((a, w) => a + f(w), 0)
  return {
    student: { id: student.id, username: student.username, name: student.name, className: student.class_name },
    summary: {
      minutes: total((w) => w.minutes),
      days: days.length,
      runs: total((w) => w.runs),
      failedCompiles: total((w) => w.failedCompiles),
      exceptions: total((w) => w.exceptions),
      selfchecks: total((w) => w.selfchecks),
    },
    assignments,
    practice,
    days,
    compileErrors,
    exceptions,
  }
}

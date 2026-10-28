// 老师评阅和成绩：给老师评分项打分、写评语；全班成绩表。
// 一个学生的总分 = 最近一次提交的自动评分 + 老师评分（没提交时没有总分）。
import type { Database } from 'bun:sqlite'
import type { Review, Scoring, Screenshot, SourceFile } from '@iot/shared'
import { getAiReview } from './ai-review'
import { getAssignment, latestSubmission } from './assignments'

/**
 * 把保存的得分对齐到作业现在的老师评分项：老师后来增删了评分项时，多的截掉、少的补"未打分"，
 * 超过满分的按满分算
 */
function normalize(scores: (number | null)[], scoring: Scoring): (number | null)[] {
  return scoring.manual.map((m, i) => {
    const s = scores[i]
    return typeof s === 'number' ? Math.min(Math.max(s, 0), m.points) : null
  })
}

export function getReview(db: Database, assignmentId: number, userId: number): Review | null {
  const assignment = getAssignment(db, assignmentId)
  const row = db
    .query<{ scores: string; comment: string; updated_at: number }, [number, number]>(
      'SELECT scores, comment, updated_at FROM reviews WHERE assignment_id = ? AND user_id = ?',
    )
    .get(assignmentId, userId)
  if (!row || !assignment) return null
  return { scores: normalize(JSON.parse(row.scores), assignment.scoring), comment: row.comment, updatedAt: row.updated_at }
}

/** 老师评分之和（未打分的项不算） */
export const manualScore = (review: Review | null) => review?.scores.reduce<number>((sum, s) => sum + (s ?? 0), 0) ?? null

export function saveReview(db: Database, assignmentId: number, userId: number, scores: unknown, comment: unknown): { error?: string } {
  const assignment = getAssignment(db, assignmentId)
  if (!assignment) return { error: '作业不存在' }
  const student = db.query('SELECT 1 FROM users WHERE id = ? AND class_id = ?').get(userId, assignment.classId)
  if (!student) return { error: '学生不在这个班' }
  const manual = assignment.scoring.manual
  if (!Array.isArray(scores) || scores.length !== manual.length) return { error: `老师评分项应有 ${manual.length} 项` }
  for (const [i, s] of scores.entries()) {
    if (s === null) continue
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > manual[i].points)
      return { error: `"${manual[i].title}"的得分要在 0 到 ${manual[i].points} 之间` }
  }
  db.query(
    `INSERT INTO reviews (assignment_id, user_id, scores, comment, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (assignment_id, user_id) DO UPDATE SET scores = excluded.scores, comment = excluded.comment, updated_at = excluded.updated_at`,
  ).run(assignmentId, userId, JSON.stringify(scores), String(comment ?? ''), Date.now())
  return {}
}

/** 老师评阅一个学生：最近一次提交（含代码）、评阅、提交次数 */
export function studentDetail(db: Database, assignmentId: number, userId: number) {
  const student = db.query<{ id: number; username: string; name: string }, [number]>('SELECT id, username, name FROM users WHERE id = ?').get(userId)
  if (!student) return null
  const latest = latestSubmission(db, assignmentId, userId)
  const row =
    latest && db.query<{ files: string; screenshots: string | null }, [number]>('SELECT files, screenshots FROM submissions WHERE id = ?').get(latest.id)
  const files = row ? (JSON.parse(row.files) as SourceFile[]) : null
  const screenshots = row?.screenshots ? (JSON.parse(row.screenshots) as Screenshot[]) : []
  const count = db
    .query<{ n: number }, [number, number]>('SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = ? AND user_id = ?')
    .get(assignmentId, userId)!.n
  return {
    student,
    submission: latest,
    files,
    screenshots,
    aiReview: latest ? getAiReview(db, latest.id) : null,
    review: getReview(db, assignmentId, userId),
    submissionCount: count,
  }
}

/** 一份提交的代码和它属于谁（老师在实验页里运行学生的程序时用） */
export function submissionFiles(db: Database, submissionId: number) {
  const row = db
    .query<{ files: string; assignment_id: number; sample_id: string; title: string; name: string; username: string }, [number]>(
      `SELECT s.files, s.assignment_id, a.sample_id, a.title, u.name, u.username
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .get(submissionId)
  if (!row) return null
  return {
    files: JSON.parse(row.files) as SourceFile[],
    assignmentId: row.assignment_id,
    /** 作业基于的实验：运行时按它给实训台接线、建实验数据库 */
    sampleId: row.sample_id,
    assignmentTitle: row.title,
    studentName: row.name,
    username: row.username,
  }
}

/** 全班成绩表：每个学生在每个作业上的自动评分、老师评分和总分 */
export function gradebook(db: Database, classId: number) {
  const assignments = db
    .query<{ id: number; title: string; scoring: string }, [number]>('SELECT id, title, scoring FROM assignments WHERE class_id = ? ORDER BY created_at')
    .all(classId)
    .map((a) => {
      const scoring = JSON.parse(a.scoring) as Scoring
      const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0)
      return { id: a.id, title: a.title, scoring, total: sum(scoring.auto) + sum(scoring.manual.map((m) => m.points)) }
    })
  const students = db
    .query<{ id: number; username: string; name: string }, [number]>(
      `SELECT id, username, name FROM users WHERE class_id = ? AND role = 'student' ORDER BY username`,
    )
    .all(classId)
  return {
    assignments: assignments.map(({ id, title, total }) => ({ id, title, total })),
    students: students.map((s) => ({
      userId: s.id,
      username: s.username,
      name: s.name,
      scores: Object.fromEntries(
        assignments.map((a) => {
          const latest = latestSubmission(db, a.id, s.id)
          const review = getReview(db, a.id, s.id)
          const auto = latest?.status === 'done' ? latest.autoScore : null
          const manual = manualScore(review)
          // 老师还没评阅时，带上 AI 的建议分（成绩表里标"待确认"）
          const ai = latest && !review ? getAiReview(db, latest.id) : null
          const aiManual = ai?.status === 'done' ? ai.scores.reduce((sum, s) => sum + s.score, 0) : null
          return [a.id, { submitted: latest !== null, auto, manual, aiManual, total: latest ? (auto ?? 0) + (manual ?? 0) : null }]
        }),
      ),
    })),
  }
}

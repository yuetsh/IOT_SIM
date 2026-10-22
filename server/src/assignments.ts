// 作业：老师把一个实验布置给一个班，学生提交后自动评分。
// 布置时保存起点工程和评分规则的快照，以后改示例不影响已布置的作业。
import type { Database } from 'bun:sqlite'
import type { Assignment, GradeResult, Scoring, Screenshot, SourceFile, StartMode, Submission } from '@iot/shared'
import { parseChecks } from './grading/checks'

interface AssignmentRow {
  id: number
  class_id: number
  class_name: string
  sample_id: string
  title: string
  start_mode: StartMode
  checks: string
  scoring: string
  deadline: number | null
  created_at: number
}

const SELECT_ASSIGNMENT = `
  SELECT a.id, a.class_id, c.name AS class_name, a.sample_id, a.title, a.start_mode, a.checks, a.scoring, a.deadline, a.created_at
  FROM assignments a JOIN classes c ON c.id = a.class_id`

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    sampleId: row.sample_id,
    title: row.title,
    startMode: row.start_mode,
    deadline: row.deadline,
    createdAt: row.created_at,
    checkTitles: parseChecks(row.checks).map((c) => c.title),
    scoring: JSON.parse(row.scoring) as Scoring,
  }
}

export function listAssignments(db: Database, classId: number): Assignment[] {
  return db.query<AssignmentRow, [number]>(`${SELECT_ASSIGNMENT} WHERE a.class_id = ? ORDER BY a.created_at DESC`).all(classId).map(toAssignment)
}

export function getAssignment(db: Database, id: number): Assignment | null {
  const row = db.query<AssignmentRow, [number]>(`${SELECT_ASSIGNMENT} WHERE a.id = ?`).get(id)
  return row ? toAssignment(row) : null
}

/** 评分规则的快照（评分时用） */
export function assignmentChecks(db: Database, id: number) {
  const row = db.query<{ checks: string }, [number]>('SELECT checks FROM assignments WHERE id = ?').get(id)
  return row ? parseChecks(row.checks) : null
}

export function assignmentTemplate(db: Database, id: number): SourceFile[] | null {
  const row = db.query<{ template: string }, [number]>('SELECT template FROM assignments WHERE id = ?').get(id)
  return row ? (JSON.parse(row.template) as SourceFile[]) : null
}

/** 检查分值：自动评分项个数要和规则一致，分值是不小于 0 的数，老师评分项要有名称 */
function scoringError(scoring: Scoring, checkCount: number): string | null {
  if (!Array.isArray(scoring?.auto) || scoring.auto.length !== checkCount) return `自动评分项应有 ${checkCount} 项`
  if (!Array.isArray(scoring.manual)) return '老师评分项格式不对'
  const valid = (p: unknown) => typeof p === 'number' && Number.isFinite(p) && p >= 0
  if (!scoring.auto.every(valid) || !scoring.manual.every((m) => valid(m?.points))) return '分值要填不小于 0 的数'
  if (scoring.manual.some((m) => typeof m.title !== 'string' || !m.title.trim())) return '老师评分项要填名称'
  return null
}

export interface NewAssignment {
  classId: number
  sampleId: string
  title: string
  startMode: StartMode
  template: SourceFile[]
  /** checks.yaml 的原文 */
  checks: string
  scoring: Scoring
  deadline: number | null
}

export function createAssignment(db: Database, a: NewAssignment): { id: number } | { error: string } {
  if (!a.title.trim()) return { error: '作业名称不能为空' }
  const error = scoringError(a.scoring, parseChecks(a.checks).length)
  if (error) return { error }
  const result = db
    .query(
      `INSERT INTO assignments (class_id, sample_id, title, start_mode, template, checks, scoring, deadline, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(a.classId, a.sampleId, a.title.trim(), a.startMode, JSON.stringify(a.template), a.checks, JSON.stringify(a.scoring), a.deadline, Date.now())
  return { id: Number(result.lastInsertRowid) }
}

/** 修改名称、截止时间、分值（起点工程和评分规则布置后不能改） */
export function updateAssignment(db: Database, id: number, changes: { title: string; deadline: number | null; scoring: Scoring }): { error?: string } {
  const checks = assignmentChecks(db, id)
  if (!checks) return { error: '作业不存在' }
  if (!changes.title.trim()) return { error: '作业名称不能为空' }
  const error = scoringError(changes.scoring, checks.length)
  if (error) return { error }
  db.query('UPDATE assignments SET title = ?, deadline = ?, scoring = ? WHERE id = ?').run(
    changes.title.trim(),
    changes.deadline,
    JSON.stringify(changes.scoring),
    id,
  )
  // 分值变了，已评分的提交重新算分
  for (const s of db.query<{ id: number; result: string }, [number]>(`SELECT id, result FROM submissions WHERE assignment_id = ? AND status = 'done'`).all(id)) {
    db.query('UPDATE submissions SET auto_score = ? WHERE id = ?').run(autoScore(JSON.parse(s.result), changes.scoring), s.id)
  }
  return {}
}

export function deleteAssignment(db: Database, id: number) {
  db.query('DELETE FROM assignments WHERE id = ?').run(id)
}

/** 通过的自动评分项的分值之和 */
export function autoScore(result: GradeResult, scoring: Scoring) {
  return result.results.reduce((sum, r, i) => sum + (r.passed ? (scoring.auto[i] ?? 0) : 0), 0)
}

// ---------- 提交 ----------

interface SubmissionRow {
  id: number
  status: Submission['status']
  result: string | null
  auto_score: number | null
  created_at: number
}

function toSubmission(db: Database, row: SubmissionRow): Submission {
  const submission: Submission = {
    id: row.id,
    status: row.status,
    result: row.result ? (JSON.parse(row.result) as GradeResult) : null,
    autoScore: row.auto_score,
    createdAt: row.created_at,
  }
  if (row.status === 'pending') {
    submission.queueAhead = db.query<{ n: number }, [number]>(`SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending' AND id < ?`).get(row.id)!.n
  }
  return submission
}

/** 某个学生在某个作业上最近一次提交 */
export function latestSubmission(db: Database, assignmentId: number, userId: number): Submission | null {
  const row = db
    .query<SubmissionRow, [number, number]>(
      'SELECT id, status, result, auto_score, created_at FROM submissions WHERE assignment_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
    )
    .get(assignmentId, userId)
  return row ? toSubmission(db, row) : null
}

/** 新建一份等待评分的提交；同一个人上一份还在评分时返回 null */
export function createSubmission(db: Database, assignmentId: number, userId: number, files: SourceFile[], screenshots: Screenshot[] = []): number | null {
  if (latestSubmission(db, assignmentId, userId)?.status === 'pending') return null
  const result = db
    .query(`INSERT INTO submissions (assignment_id, user_id, files, screenshots, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
    .run(assignmentId, userId, JSON.stringify(files), JSON.stringify(screenshots), Date.now())
  return Number(result.lastInsertRowid)
}

export function pendingSubmissionIds(db: Database): number[] {
  return db.query<{ id: number }, []>(`SELECT id FROM submissions WHERE status = 'pending' ORDER BY id`).all().map((r) => r.id)
}

export function submissionForGrading(db: Database, id: number) {
  const row = db.query<{ assignment_id: number; files: string }, [number]>('SELECT assignment_id, files FROM submissions WHERE id = ?').get(id)
  return row ? { assignmentId: row.assignment_id, files: JSON.parse(row.files) as SourceFile[] } : null
}

export function saveGrade(db: Database, id: number, result: GradeResult | null) {
  const row = db.query<{ scoring: string }, [number]>('SELECT a.scoring FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?').get(id)
  if (!row) return
  if (!result) {
    db.query(`UPDATE submissions SET status = 'error', graded_at = ? WHERE id = ?`).run(Date.now(), id)
    return
  }
  db.query(`UPDATE submissions SET status = 'done', result = ?, auto_score = ?, graded_at = ? WHERE id = ?`).run(
    JSON.stringify(result),
    autoScore(result, JSON.parse(row.scoring) as Scoring),
    Date.now(),
    id,
  )
}

/** 每个学生最近一次提交的状态（老师看提交情况） */
export function classSubmissions(db: Database, assignmentId: number) {
  return db
    .query<
      { user_id: number; username: string; name: string; submission_id: number | null; status: Submission['status'] | null; auto_score: number | null; created_at: number | null; count: number },
      [number]
    >(
      `SELECT u.id AS user_id, u.username, u.name, s.id AS submission_id, s.status, s.auto_score, s.created_at,
              (SELECT COUNT(*) FROM submissions x WHERE x.assignment_id = ?1 AND x.user_id = u.id) AS count
       FROM users u
       JOIN assignments a ON a.id = ?1 AND u.class_id = a.class_id AND u.role = 'student'
       LEFT JOIN submissions s ON s.id = (SELECT MAX(id) FROM submissions WHERE assignment_id = ?1 AND user_id = u.id)
       ORDER BY u.username`,
    )
    .all(assignmentId)
    .map((r) => ({
      userId: r.user_id,
      username: r.username,
      name: r.name,
      submissionId: r.submission_id,
      status: r.status,
      autoScore: r.auto_score,
      submittedAt: r.created_at,
      count: r.count,
    }))
}

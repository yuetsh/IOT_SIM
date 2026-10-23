// 评分队列：学生提交后立即返回，后台按提交顺序评分（同时最多评 MAX_ACTIVE 份），结果写回数据库。
// 服务器重启前没评完的提交，启动时继续评。评完调用 onGraded（接着做 AI 评阅）。
import type { Database } from 'bun:sqlite'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { assignmentChecks, pendingSubmissionIds, saveGrade, submissionForGrading } from '../assignments'
import { config } from '../config'
import { safeJoin } from '../run-session'
import { grade } from './grader'

const MAX_ACTIVE = 3

export function createGradingQueue(db: Database, onGraded: (submissionId: number) => void = () => {}) {
  const queue: number[] = []
  let active = 0
  let idleWaiters: (() => void)[] = []

  async function gradeOne(id: number) {
    const submission = submissionForGrading(db, id)
    const checks = submission && assignmentChecks(db, submission.assignmentId)
    if (!submission || !checks) return
    const dir = join(config.runsDir, `grade-${id}`)
    try {
      await rm(dir, { recursive: true, force: true })
      for (const file of submission.files) {
        const target = safeJoin(dir, file.path)
        await mkdir(dirname(target), { recursive: true })
        await Bun.write(target, file.content)
      }
      saveGrade(db, id, await grade(dir, checks, submission.sampleId))
      onGraded(id)
    } catch (error) {
      console.error(`评分出错（提交 ${id}）：`, error)
      saveGrade(db, id, null)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  function pump() {
    while (active < MAX_ACTIVE && queue.length > 0) {
      const id = queue.shift()!
      active++
      void gradeOne(id).finally(() => {
        active--
        pump()
      })
    }
    if (active === 0 && queue.length === 0) {
      for (const resolve of idleWaiters) resolve()
      idleWaiters = []
    }
  }

  for (const id of pendingSubmissionIds(db)) queue.push(id)
  pump()

  return {
    enqueue(id: number) {
      queue.push(id)
      pump()
    },
    /** 等队列全部评完（测试用） */
    idle(): Promise<void> {
      if (active === 0 && queue.length === 0) return Promise.resolve()
      return new Promise((resolve) => idleWaiters.push(resolve))
    },
  }
}

export type GradingQueue = ReturnType<typeof createGradingQueue>

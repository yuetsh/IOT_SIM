// 自测：学生提交前自己跑一遍评分，告诉他哪几项不通过、为什么；不计分、不留记录。
// 每人同时只能有一次，结果放在内存里，保留到下一次自测（服务器重启后就没有了）。
// 检查项和提交评分一样受全站并发上限（config.gradeConcurrency）约束，机器忙时排队。
import type { SelfCheck, SourceFile } from '@iot/shared'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config'
import type { Check } from './checks'
import { grade } from './grader'
import { writeProject } from './queue'

export function createSelfCheck() {
  const states = new Map<number, SelfCheck>()

  return {
    /** 开始自测；上一次还没完成时返回 false */
    start(userId: number, target: string, files: SourceFile[], checks: Check[], sampleId: string): boolean {
      if (states.get(userId)?.status === 'running') return false
      const state: SelfCheck = { status: 'running', target, result: null, startedAt: Date.now() }
      states.set(userId, state)
      const dir = join(config.runsDir, `selfcheck-${userId}`)
      void (async () => {
        try {
          await writeProject(dir, files)
          state.result = await grade(dir, checks, sampleId)
          state.status = 'done'
        } catch (error) {
          console.error(`自测出错（用户 ${userId}）：`, error)
          state.status = 'error'
        } finally {
          await rm(dir, { recursive: true, force: true })
        }
      })()
      return true
    },

    get(userId: number): SelfCheck | null {
      return states.get(userId) ?? null
    },
  }
}

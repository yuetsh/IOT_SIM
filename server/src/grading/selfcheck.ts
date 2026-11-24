// 自测：学生提交前自己跑一遍评分，告诉他哪几项不通过、为什么；不计分，结果交给 onDone 记进学习过程记录。
// 每人同时只能有一次，结果放在内存里，保留到下一次自测（服务器重启后就没有了）。
// 检查项和提交评分一样受全站并发上限（config.gradeConcurrency）约束，机器忙时排队。
import type { GradeResult, SelfCheck, SourceFile } from '@iot/shared'
import { gradeFiles } from '../dispatch'
import type { Check } from './checks'

export function createSelfCheck(onDone?: (userId: number, target: string, result: GradeResult) => void) {
  const states = new Map<number, SelfCheck>()

  return {
    /** 开始自测；上一次还没完成时返回 false。record：完成后交给 onDone（学生的自测才记） */
    start(userId: number, target: string, files: SourceFile[], checks: Check[], sampleId: string, record = false): boolean {
      if (states.get(userId)?.status === 'running') return false
      const state: SelfCheck = { status: 'running', target, result: null, startedAt: Date.now() }
      states.set(userId, state)
      void (async () => {
        try {
          // 计算节点在就交给它评（见 dispatch.ts）
          state.result = await gradeFiles(files, checks, sampleId)
          state.status = 'done'
          if (record) onDone?.(userId, target, state.result)
        } catch (error) {
          console.error(`自测出错（用户 ${userId}）：`, error)
          state.status = 'error'
        }
      })()
      return true
    },

    get(userId: number): SelfCheck | null {
      return states.get(userId) ?? null
    },
  }
}

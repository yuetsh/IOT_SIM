// 编译运行、评分、语言服务：计算节点（worker）在就交给它，不在或者中途断了就在本机做。
// 服务器和 worker 都通过这里调用本机的实现（worker 上没有连 hub，总是本机做）。
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { GradeResult, SourceFile } from '@iot/shared'
import { config } from './config'
import { type RunOutcome, type RunRequest, runLocally, writeFiles } from './executor'
import type { Check } from './grading/checks'
import { grade } from './grading/grader'
import { languageService } from './language-service'
import { workerHub, WorkerUnavailable } from './worker-hub'

/**
 * 编译并启动学生程序。用到数据库的程序在服务器上运行：学生的库只在服务器上，数据库页面随时可能在改它，
 * 拷到 worker 再拷回来会互相覆盖（还有 WAL 文件对不上、学生被删除后目录又被建出来等问题）。
 * 交给 worker 的运行不带数据库目录：没写 SqlConnection 等却连了数据库的程序只会连不上，不会碰到别人的数据
 */
export async function startProgram(request: RunRequest): Promise<RunOutcome> {
  if (workerHub.available && !usesDatabase(request.files)) {
    try {
      return await workerHub.run({ ...request, dbDir: undefined })
    } catch (error) {
      if (!(error instanceof WorkerUnavailable)) throw error
      console.warn(`运行改在服务器上：${error.message}`)
    }
  }
  return runLocally(request)
}

/** 代码里用到了数据库（教材的写法都是 System.Data.SqlClient 里的这几个类） */
export function usesDatabase(files: SourceFile[]) {
  return files.some((file) => /\bSql(Client|Connection|Command|DataAdapter|DataReader|CommandBuilder|Parameter|Transaction)\b/.test(file.content))
}

/**
 * 给作品评分（提交评分、自己检查）。评分用的是按实验的 database.sql 新建的库，不碰学生自己的库，
 * 用到数据库的作品也可以交给 worker
 */
export async function gradeFiles(files: SourceFile[], checks: Check[], sampleId?: string): Promise<GradeResult> {
  if (workerHub.available) {
    try {
      return await workerHub.grade(files, checks, sampleId)
    } catch (error) {
      if (!(error instanceof WorkerUnavailable)) throw error
      console.warn(`评分改在服务器上：${error.message}`)
    }
  }
  return gradeLocally(files, checks, sampleId)
}

/** 在本机写出工程再评分，评完删掉 */
export async function gradeLocally(files: SourceFile[], checks: Check[], sampleId?: string): Promise<GradeResult> {
  await mkdir(config.runsDir, { recursive: true })
  const dir = await mkdtemp(join(config.runsDir, 'grade-'))
  try {
    await writeFiles(dir, files)
    return await grade(dir, checks, sampleId)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** 语言服务；忙或卡住时返回 null */
export async function languageRequest(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (workerHub.available) {
    try {
      return await workerHub.language(body)
    } catch (error) {
      if (!(error instanceof WorkerUnavailable)) throw error
    }
  }
  return languageService.request(body)
}

// 学生的数据库：每个用户一个目录（data/databases/<用户编号>），每个库一个 SQLite 文件，长期保存，
// 就像学生自己电脑上的 SQL Server。学生程序运行时挂进沙箱可读写；数据库页面通过 SQL 服务访问。
// 评分时不用学生自己的库，而是按实验的 database.sql 新建一套干净的库。
import { cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { config } from './config'
import { sqlService } from './sql-service'

/** 用户的数据库目录（不存在时创建） */
export async function userDatabaseDir(userId: number) {
  const dir = resolve(config.dataDir, 'databases', String(userId))
  await mkdir(dir, { recursive: true })
  return dir
}

/** 实验预置的数据库脚本（samples/<实验>/database.sql），没有时返回 undefined */
export async function experimentScript(sampleId: string): Promise<string | undefined> {
  const file = Bun.file(join(config.samplesDir, sampleId, 'database.sql'))
  return (await file.exists()) ? file.text() : undefined
}

/** 按脚本建库：先清空目录再执行（脚本里 CREATE DATABASE、CREATE TABLE、INSERT 都可以写） */
export async function runScript(dir: string, script: string) {
  await mkdir(dir, { recursive: true })
  await sqlService.request({ type: 'script', dir, sql: script })
}

/**
 * 把学生某个实验用到的库恢复成实验的初始数据：只替换脚本里建的库，学生的其他库不动。
 * onlyMissing 时只建学生还没有的库（第一次运行实验时自动建库，已有的库保留学生的数据）。
 * 返回恢复了哪些库。
 */
export async function restoreExperimentDatabases(userId: number, sampleId: string, onlyMissing = false) {
  const script = await experimentScript(sampleId)
  if (!script) return []
  const target = await userDatabaseDir(userId)
  const existing = new Set(await readdir(target))
  if (onlyMissing && scriptDatabases(script).every((name) => existing.has(`${name}.db`))) return []
  const temp = await mkdtemp(join(config.runsDir, 'db-'))
  try {
    await runScript(temp, script)
    const files = (await readdir(temp)).filter((f) => f.endsWith('.db') && f !== 'master.db' && !(onlyMissing && existing.has(f)))
    for (const file of files) {
      for (const suffix of ['', '-wal', '-shm']) await rm(join(target, file + suffix), { force: true })
      await cp(join(temp, file), join(target, file))
    }
    return files.map((f) => f.slice(0, -3))
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

/** 脚本里 CREATE DATABASE 建的库名 */
function scriptDatabases(script: string) {
  return [...script.matchAll(/^\s*CREATE\s+DATABASE\s+\[?([^\s\]]+)\]?/gim)].map((m) => m[1])
}

/** 评分用：实验数据库的模板按实验缓存，每个检查项复制一份（互不影响） */
const templates = new Map<string, Promise<string | undefined>>()

export async function gradingDatabaseDir(sampleId: string): Promise<string | undefined> {
  let template = templates.get(sampleId)
  if (!template) {
    template = (async () => {
      const script = await experimentScript(sampleId)
      if (script === undefined) return undefined
      const dir = resolve(config.runsDir, 'db-templates', sampleId)
      await rm(dir, { recursive: true, force: true })
      await runScript(dir, script)
      return dir
    })()
    templates.set(sampleId, template)
    template.catch(() => templates.delete(sampleId))
  }
  const source = await template
  const copy = await mkdtemp(join(config.runsDir, 'grade-db-'))
  if (source && (await stat(source).catch(() => null))) await cp(source, copy, { recursive: true })
  return copy
}

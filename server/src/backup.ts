// 手动备份：平台数据库（账号、班级、作品、作业、提交、评阅）和每个学生的数据库，导出到一个目录，
// 目录结构和 data/ 一样。服务器上用 deploy/backup.sh 备份、deploy/restore.sh 恢复（见 deploy/README.md）。
import { Database } from 'bun:sqlite'
import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config'

/**
 * 把一个 SQLite 数据库完整导出成文件。serialize 在读事务里读出所有页，
 * 学生程序或平台正在写入时也能得到一份一致的数据库（直接拷文件可能拷到写了一半的状态）
 */
async function saveCopy(path: string, target: string) {
  const source = new Database(path, { readonly: true })
  try {
    await Bun.write(target, source.serialize())
  } finally {
    source.close()
  }
}

/** 把 data/ 里的数据库导出到 target（已有备份时报错，不覆盖） */
export async function backupTo(target: string) {
  if (await Bun.file(join(target, 'iot-sim.db')).exists()) throw new Error(`${target} 里已经有备份`)
  // 先写到临时目录，写完再改名，不会留下做了一半的备份
  const temp = `${target}.partial`
  await rm(temp, { recursive: true, force: true })
  await mkdir(temp, { recursive: true })

  await saveCopy(join(config.dataDir, 'iot-sim.db'), join(temp, 'iot-sim.db'))
  const databases = join(config.dataDir, 'databases')
  for (const user of await readdir(databases).catch(() => [] as string[])) {
    const files = (await readdir(join(databases, user)).catch(() => [] as string[])).filter((f) => f.endsWith('.db'))
    if (files.length > 0) await mkdir(join(temp, 'databases', user), { recursive: true })
    for (const file of files) await saveCopy(join(databases, user, file), join(temp, 'databases', user, file))
  }
  await rm(target, { recursive: true, force: true })
  await rename(temp, target)
}

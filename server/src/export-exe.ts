// 导出 EXE：学生工程照教材工程编译成 Windows 程序（嵌入教材的真机版设备类库），在机房双击就能控制真的实训台。
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Diagnostic, SourceFile } from '@iot/shared'
import { compileService, EXPORT_FILE } from './compile-service'
import { config } from './config'
import { safeJoin } from './run-session'

export type ExportResult = { ok: true; exe: Uint8Array; name: string } | { ok: false; diagnostics: Diagnostic[] }

/** exe 的名字：只留文字、数字、下划线和减号（也是程序集名），空了就叫"上位机程序" */
export function exeName(name: unknown) {
  const cleaned = typeof name === 'string' ? name.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40) : ''
  return cleaned || '上位机程序'
}

/** 编译失败返回报错；服务器上没有教材 dll 等情况抛出异常（消息给学生看） */
export async function exportExe(files: SourceFile[], name: string): Promise<ExportResult> {
  await mkdir(config.runsDir, { recursive: true })
  const dir = await mkdtemp(join(config.runsDir, 'export-'))
  try {
    for (const file of files) {
      const target = safeJoin(dir, file.path)
      await mkdir(dirname(target), { recursive: true })
      await Bun.write(target, file.content)
    }
    const result = await compileService.exportExe(dir, name)
    if (!result.ok) return { ok: false, diagnostics: result.diagnostics }
    return { ok: true, exe: await Bun.file(join(dir, EXPORT_FILE)).bytes(), name }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

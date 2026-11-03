// 导出 EXE：学生工程照教材工程编译成 Windows 程序（嵌入教材的真机版设备类库），在机房双击就能控制真的实训台。
// 导出工程：打包成教材那样的 VS 2012 工程（zip），在机房电脑上用 VS 打开接着改。
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Diagnostic, SourceFile } from '@iot/shared'
import { compileService, EXPORT_FILE, EXPORT_PROJECT_FILE } from './compile-service'
import { config } from './config'
import { safeJoin } from './run-session'

export type ExportResult = { ok: true; file: Uint8Array; name: string } | { ok: false; diagnostics: Diagnostic[] }

export type ExportKind = 'exe' | 'project'

/** exe、工程的名字：只留文字、数字、下划线和减号（也是程序集名），空了就叫"上位机程序" */
export function programName(name: unknown) {
  const cleaned = typeof name === 'string' ? name.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40) : ''
  return cleaned || '上位机程序'
}

/** 编译失败返回报错；服务器上没有教材 dll 等情况抛出异常（消息给学生看） */
export async function exportProgram(files: SourceFile[], name: string, kind: ExportKind): Promise<ExportResult> {
  await mkdir(config.runsDir, { recursive: true })
  const dir = await mkdtemp(join(config.runsDir, 'export-'))
  try {
    for (const file of files) {
      const target = safeJoin(dir, file.path)
      await mkdir(dirname(target), { recursive: true })
      await Bun.write(target, file.content)
    }
    const result = kind === 'project' ? await compileService.exportProject(dir, name) : await compileService.exportExe(dir, name)
    if (!result.ok) return { ok: false, diagnostics: result.diagnostics }
    return { ok: true, file: await Bun.file(join(dir, kind === 'project' ? EXPORT_PROJECT_FILE : EXPORT_FILE)).bytes(), name }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

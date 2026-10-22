import { readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { SourceFile } from '@iot/shared'
import { config } from './config'

const SAMPLES_DIR = config.samplesDir

export interface SampleInfo {
  id: string
  title: string
}

/** 示例工程：samples/ 下每个子目录是一个工程，meta.json 里写标题 */
export async function listSamples(): Promise<SampleInfo[]> {
  const entries = await readdir(SAMPLES_DIR, { withFileTypes: true })
  const samples: SampleInfo[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = await Bun.file(join(SAMPLES_DIR, entry.name, 'meta.json')).json()
    samples.push({ id: entry.name, title: meta.title })
  }
  return samples.sort((a, b) => a.id.localeCompare(b.id))
}

export async function loadSample(id: string): Promise<SourceFile[] | null> {
  const dir = resolve(SAMPLES_DIR, id)
  if (!dir.startsWith(`${SAMPLES_DIR}/`)) return null
  const files: SourceFile[] = []
  const glob = new Bun.Glob('**/*.cs')
  for await (const path of glob.scan({ cwd: dir })) {
    files.push({ path: relative(dir, join(dir, path)), content: await Bun.file(join(dir, path)).text() })
  }
  return files.length > 0 ? files.sort((a, b) => a.path.localeCompare(b.path)) : null
}

/** 示例的评分规则（checks.yaml 原文）；没有规则返回 null */
export async function loadChecks(id: string): Promise<string | null> {
  const path = resolve(SAMPLES_DIR, id, 'checks.yaml')
  if (!path.startsWith(`${SAMPLES_DIR}/`)) return null
  const file = Bun.file(path)
  return (await file.exists()) ? file.text() : null
}

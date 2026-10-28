import { readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { BOARD_PORTS, DEFAULT_WIRING, PORT_DEVICES, type SourceFile, type Wiring } from '@iot/shared'
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

/** 浏览器传来的实验编号：是已有的示例才返回 */
export async function knownSample(id: unknown): Promise<string | undefined> {
  return typeof id === 'string' && (await listSamples()).some((s) => s.id === id) ? id : undefined
}

/**
 * 实验的实训台接线：meta.json 的 wiring 只写和默认接线不同的设备，如项目 7 的 { "adam4150": "COM2" }。
 * 没有这个实验（或没给 id）时用默认接线
 */
export async function sampleWiring(id?: string): Promise<Wiring> {
  const wiring = { ...DEFAULT_WIRING }
  if (!id) return wiring
  const path = resolve(SAMPLES_DIR, id, 'meta.json')
  if (!path.startsWith(`${SAMPLES_DIR}/`)) return wiring
  const file = Bun.file(path)
  if (!(await file.exists())) return wiring
  const custom = ((await file.json()) as { wiring?: Partial<Wiring> }).wiring ?? {}
  for (const device of PORT_DEVICES) {
    const port = custom[device]
    if (port !== undefined && BOARD_PORTS.includes(port)) wiring[device] = port
  }
  return wiring
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

/** 示例的任务说明（task.md 原文，Markdown）；没有说明返回 null */
export async function loadTask(id: string): Promise<string | null> {
  const path = resolve(SAMPLES_DIR, id, 'task.md')
  if (!path.startsWith(`${SAMPLES_DIR}/`)) return null
  const file = Bun.file(path)
  return (await file.exists()) ? file.text() : null
}

/** 示例的评分规则（checks.yaml 原文）；没有规则返回 null */
export async function loadChecks(id: string): Promise<string | null> {
  const path = resolve(SAMPLES_DIR, id, 'checks.yaml')
  if (!path.startsWith(`${SAMPLES_DIR}/`)) return null
  const file = Bun.file(path)
  return (await file.exists()) ? file.text() : null
}

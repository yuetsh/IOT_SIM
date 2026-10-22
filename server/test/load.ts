// 并发压力测试：同时运行 N 个学生程序（教材项目 2 任务 1），测量内存、启动时间和操作往返延迟。
// 用法：bun test/load.ts [N]，默认 100。运行前先编译运行时：bun run build:runtime
import { readFileSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ControlNode, RunnerMessage } from '@iot/shared'
import { compileService } from '../src/compile-service'
import { config, ROOT } from '../src/config'
import { readLines } from '../src/runner-process'

const COUNT = Number(process.argv[2] ?? 100)
const dir = resolve(ROOT, '.runs/load-test')

await rm(dir, { recursive: true, force: true })
await mkdir(dir, { recursive: true })
await cp(resolve(ROOT, 'samples/p2-t1-LED显示屏'), dir, { recursive: true })
const compiled = await compileService.compile(dir)
compileService.stop()
if (!compiled.ok) throw new Error('示例编译失败')

interface Instance {
  proc: Bun.Subprocess<'pipe', 'pipe', 'inherit'>
  form?: ControlNode
  onMessage?: (m: RunnerMessage) => void
}

function findId(node: ControlNode, name: string): string | undefined {
  if (node.name === name) return node.id
  for (const child of node.children) {
    const id = findId(child, name)
    if (id) return id
  }
}

function send(instance: Instance, message: object) {
  instance.proc.stdin.write(`${JSON.stringify(message)}\n`)
  instance.proc.stdin.flush()
}

/** 读取 /proc 里的内存数据（MB）。Rss 会把多个进程共享的 .NET 运行库重复计算，Pss 按进程数平摊，合计值更接近真实占用 */
function memoryMb(pid: number, field: 'Rss' | 'Pss') {
  const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8')
  return Number(new RegExp(`^${field}:\\s+(\\d+)`, 'm').exec(rollup)![1]) / 1024
}

console.log(`启动 ${COUNT} 个学生程序…`)
const startAt = performance.now()
const instances: Instance[] = []
const shown: Promise<void>[] = []
for (let i = 0; i < COUNT; i++) {
  const proc = Bun.spawn(['dotnet', config.runnerDll, 'run', dir], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
  const instance: Instance = { proc }
  instances.push(instance)
  shown.push(
    new Promise((resolveShown) => {
      void readLines(proc.stdout, (line) => {
        const message = JSON.parse(line) as RunnerMessage
        if (message.type === 'formShown') {
          instance.form = message.form
          resolveShown()
        }
        instance.onMessage?.(message)
      })
    }),
  )
}
await Promise.all(shown)
console.log(`全部窗体显示完成：${Math.round(performance.now() - startAt)} ms`)

await Bun.sleep(3000)
for (const field of ['Rss', 'Pss'] as const) {
  const values = instances.map((i) => memoryMb(i.proc.pid, field))
  const total = values.reduce((a, b) => a + b, 0)
  console.log(`内存 ${field}：合计 ${Math.round(total)} MB，平均 ${Math.round(total / COUNT)} MB`)
}

// 每个程序：选 COM5 → 打开 → 输入文字 → 推送，测量从发出"推送"到收到 LED 变化的往返时间
const latencies = await Promise.all(
  instances.map(async (instance) => {
    const form = instance.form!
    const id = (name: string) => findId(form, name)!
    send(instance, { type: 'action', id: id('com_Port'), action: 'dropDown' })
    send(instance, { type: 'action', id: id('com_Port'), action: 'select', index: 4 })
    send(instance, { type: 'action', id: id('btn_Open'), action: 'click' })
    send(instance, { type: 'action', id: id('txt_SendText'), action: 'text', value: '压力测试' })
    await Bun.sleep(200)
    const led = id('led')
    const sentAt = performance.now()
    const done = new Promise<number>((resolveDone) => {
      instance.onMessage = (m) => {
        if (m.type === 'patch' && m.changes.some((c) => c.id === led && c.prop === 'LedText')) resolveDone(performance.now() - sentAt)
      }
    })
    send(instance, { type: 'action', id: id('btn_Send'), action: 'click' })
    return done
  }),
)
latencies.sort((a, b) => a - b)
const pct = (p: number) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor((latencies.length * p) / 100))])
console.log(`操作往返（${COUNT} 个程序同时点击）：中位数 ${pct(50)} ms，P95 ${pct(95)} ms，最大 ${pct(100)} ms`)

for (const instance of instances) instance.proc.kill()
await rm(dir, { recursive: true, force: true })

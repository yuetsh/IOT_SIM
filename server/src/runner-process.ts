import { resolve } from 'node:path'

export const ROOT = resolve(import.meta.dir, '../..')
export const RUNNER_DLL = resolve(ROOT, 'runtime/Sim.Runner/bin/Debug/net10.0/Sim.Runner.dll')

/** 逐行读取子进程输出 */
export async function readLines(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index).trimEnd()
      buffer = buffer.slice(index + 1)
      if (line) onLine(line)
      index = buffer.indexOf('\n')
    }
  }
  if (buffer.trim()) onLine(buffer.trim())
}

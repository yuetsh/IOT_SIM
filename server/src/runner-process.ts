/**
 * 逐行读取子进程输出。onLine 返回 Promise 时等它完成再读下一行：处理不过来时不再读，
 * 管道写满后子进程自己停下来等（计算节点往服务器发输出时用，见 worker.ts）
 */
export async function readLines(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void | Promise<void>) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index).trimEnd()
      buffer = buffer.slice(index + 1)
      if (line) await onLine(line)
      index = buffer.indexOf('\n')
    }
  }
  if (buffer.trim()) await onLine(buffer.trim())
}

/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateDesigner, parseDesigner } from './document'

const ROOT = resolve(import.meta.dir, '../../..')
// 教材配套的参考工程不在仓库里（版权），本机有时才测
const REFERENCE_DIR = resolve(ROOT, 'docs/物联网编程与应用配套/物联网编程与应用')

async function designerFiles(dir: string) {
  const files: string[] = []
  for await (const path of new Bun.Glob('**/*.Designer.cs').scan({ cwd: dir })) {
    if (path.includes('/obj/') || path.includes('/Properties/')) continue
    files.push(resolve(dir, path))
  }
  return files.sort()
}

describe('读入 Designer.cs 再原样写出，内容逐字节不变', async () => {
  const files = [...(await designerFiles(resolve(ROOT, 'samples'))), ...(existsSync(REFERENCE_DIR) ? await designerFiles(REFERENCE_DIR) : [])]
  for (const file of files) {
    test(file.replace(`${ROOT}/`, ''), async () => {
      const text = await Bun.file(file).text()
      expect(generateDesigner(parseDesigner(text))).toBe(text)
    })
  }
})

test('窗体属性 this.ClientSize = new Size(...) 不会被当成创建控件', async () => {
  const text = await Bun.file(resolve(ROOT, 'samples/p2-t2-模拟量采集/frm_analog.Designer.cs')).text()
  const doc = parseDesigner(text)
  const creates = doc.prologue.filter((s) => s.kind === 'create').map((s) => (s.kind === 'create' ? s.name : ''))
  expect(creates).not.toContain('ClientSize')
  expect(creates).not.toContain('AutoScaleDimensions')
  const formProps = doc.blocks.at(-1)!.stmts.flatMap((s) => (s.kind === 'prop' ? [s.path] : []))
  expect(formProps).toContain('ClientSize')
})

// 编译服务同时编译几个工程（计算节点上 SIM_COMPILE_CONCURRENCY 调大）：回复先编完先回，要和各自的请求对得上。
// 运行前先编译运行时：bun run build:runtime
import { afterAll, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compileService } from '../src/compile-service'
import { config, ROOT } from '../src/config'

afterAll(() => compileService.stop())

const BASE = resolve(ROOT, '.runs', 'test-compile')

test('同时编译多个工程，每个结果对应自己的工程', async () => {
  config.compileConcurrency = 4
  compileService.stop()
  await rm(BASE, { recursive: true, force: true })
  // 一半能编过，一半各有一个不同的错误（变量名不同），看错误有没有回到别人那里
  const projects = Array.from({ length: 12 }, (_, i) => ({ dir: resolve(BASE, `p${i}`), broken: i % 2 === 1, name: `未定义变量${i}` }))
  for (const project of projects) {
    await mkdir(project.dir, { recursive: true })
    await Bun.write(
      resolve(project.dir, 'Program.cs'),
      `using System.Windows.Forms;
static class Program
{
    static void Main()
    {
        var form = new Form();
        form.Text = ${project.broken ? project.name : `"${project.name}"`};
    }
}
`,
    )
  }

  const results = await Promise.all(projects.map((project) => compileService.compile(project.dir)))
  results.forEach((result, i) => {
    const project = projects[i]
    expect(result.ok).toBe(!project.broken)
    const errors = result.diagnostics.filter((d) => d.severity === 'error')
    if (project.broken) {
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain(project.name)
    } else {
      expect(errors).toHaveLength(0)
    }
  })
  for (const [i, project] of projects.entries()) {
    expect(await Bun.file(resolve(project.dir, 'StudentApp.dll')).exists()).toBe(!projects[i].broken)
  }
}, 60_000)

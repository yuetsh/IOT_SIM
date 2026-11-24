// 链接文件：学生程序在自己的数据库目录里建一个链接，指向服务器上的其他文件（平台的数据库、别的学生的库），
// 数据库页面的 SQL 服务（不在沙箱里）打开学生的库时就会跟着读写过去。两道防线：编译时不允许建链接；SQL 服务不用链接。
// 运行前先编译运行时：bun run build:runtime
import { afterAll, expect, test } from 'bun:test'
import { mkdir, rm, symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compileService } from '../src/compile-service'
import { ROOT } from '../src/config'
import { sqlService } from '../src/sql-service'

afterAll(() => {
  compileService.stop()
  sqlService.stop()
})

const BASE = resolve(ROOT, '.runs', 'test-links')

test('编译时不允许建链接文件', async () => {
  const dir = resolve(BASE, 'compile')
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  await Bun.write(
    resolve(dir, 'Program.cs'),
    `using System.IO;
static class Program
{
    static void Main()
    {
        File.CreateSymbolicLink("/sim/db/x.db", "/data/iot-sim.db");
        Directory.CreateSymbolicLink("/sim/db/d", "/");
        new FileInfo("/sim/db/a.db").CreateAsSymbolicLink("/data/iot-sim.db");
        File.Exists("/sim/db/x.db");
    }
}
`,
  )
  const result = await compileService.compile(dir)
  expect(result.ok).toBe(false)
  const errors = result.diagnostics.filter((d) => d.severity === 'error')
  expect(errors.map((d) => d.code)).toEqual(['SIM001', 'SIM001', 'SIM001'])
  expect(errors[0].message).toContain('创建链接文件')
}, 30000)

test('编译时不允许用 tar 包（解压能建出链接文件）', async () => {
  const dir = resolve(BASE, 'tar')
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  await Bun.write(
    resolve(dir, 'Program.cs'),
    `using System.IO;
using System.Formats.Tar;
static class Program
{
    static void Main()
    {
        var ms = new MemoryStream();
        using (var w = new TarWriter(ms, true)) w.WriteEntry(new PaxTarEntry(TarEntryType.SymbolicLink, "sim/db/x.db") { LinkName = "/data/iot-sim.db" });
        ms.Position = 0;
        TarFile.ExtractToDirectory(ms, "/", true);
    }
}
`,
  )
  const result = await compileService.compile(dir)
  expect(result.ok).toBe(false)
  expect(result.diagnostics.filter((d) => d.severity === 'error').every((d) => d.code === 'SIM001')).toBe(true)
  expect(result.diagnostics.some((d) => d.message.includes('解压 tar 包'))).toBe(true)
}, 30000)

test('SQL 服务不用链接文件：不列出、不打开、不在链接上建库，链接指向的库不受影响', async () => {
  await rm(BASE, { recursive: true, force: true })
  // 别的学生的库（带平台的元数据表，能被 SQL 服务正常打开）
  const other = resolve(BASE, 'other')
  await mkdir(other, { recursive: true })
  await sqlService.request({
    type: 'script',
    dir: other,
    sql: "CREATE DATABASE 别人的库\nGO\nUSE 别人的库\nGO\nCREATE TABLE t (secret varchar(50))\nINSERT INTO t VALUES ('B 的数据')",
  })
  const target = resolve(other, '别人的库.db')

  const mine = resolve(BASE, 'mine')
  await mkdir(mine, { recursive: true })
  await symlink(target, resolve(mine, 'x.db'))
  const explorer = (await sqlService.request({ type: 'explorer', dir: mine })) as { databases: { name: string }[] }
  expect(explorer.databases.map((d) => d.name)).not.toContain('x')
  await expect(sqlService.request({ type: 'exec', dir: mine, database: 'x', sql: 'SELECT * FROM t' })).rejects.toThrow()
  await expect(sqlService.request({ type: 'exec', dir: mine, database: 'master', sql: 'CREATE DATABASE x' })).rejects.toThrow('链接')

  // master 本身是链接
  const linkedMaster = resolve(BASE, 'linked-master')
  await mkdir(linkedMaster, { recursive: true })
  await symlink(target, resolve(linkedMaster, 'master.db'))
  await expect(sqlService.request({ type: 'exec', dir: linkedMaster, database: 'master', sql: 'SELECT * FROM t' })).rejects.toThrow('链接')

  // 链接指向的库原样未动，正常目录照常能用
  const check = await sqlService.request({ type: 'exec', dir: other, database: '别人的库', sql: 'SELECT * FROM t' })
  expect(JSON.stringify(check)).toContain('B 的数据')
}, 30000)

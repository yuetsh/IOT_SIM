// 自动评分测试：示例的参考答案应该全部通过；改坏的代码在对应的项上不通过，原因写得清楚。
import { afterAll, describe, expect, test } from 'bun:test'
import { cp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compileService } from '../src/compile-service'
import { ROOT } from '../src/config'
import { parseChecks } from '../src/grading/checks'
import { grade } from '../src/grading/grader'

afterAll(() => compileService.stop())

const SAMPLES = resolve(ROOT, 'samples')

async function checksOf(id: string) {
  return parseChecks(await Bun.file(resolve(SAMPLES, id, 'checks.yaml')).text())
}

/** 复制示例到临时目录；edit 可以改坏某个文件 */
async function prepare(id: string, name: string, edit?: { file: string; from: string; to: string }) {
  const dir = resolve(ROOT, '.runs', `grade-${name}`)
  await rm(dir, { recursive: true, force: true })
  await cp(resolve(SAMPLES, id), dir, { recursive: true })
  if (edit) {
    const path = resolve(dir, edit.file)
    const text = await Bun.file(path).text()
    if (!text.includes(edit.from)) throw new Error(`${edit.file} 里没有 ${edit.from}`)
    await Bun.write(path, text.replace(edit.from, edit.to))
  }
  return dir
}

describe('参考答案全部通过', async () => {
  const ids = (await Array.fromAsync(new Bun.Glob('*/checks.yaml').scan({ cwd: SAMPLES }))).map((p) => p.split('/')[0]).sort()
  test('每个示例都有评分规则', () => expect(ids.length).toBe(12))
  for (const id of ids) {
    test(id, async () => {
      const result = await grade(await prepare(id, id), await checksOf(id))
      expect(result.compiled).toBe(true)
      expect(result.results.filter((r) => !r.passed)).toEqual([])
    }, 60000)
  }
})

describe('改坏的代码', () => {
  test('编译不通过时所有项都不通过', async () => {
    const id = 'p2-t1-LED显示屏'
    const dir = await prepare(id, 'compile-error', { file: 'Form1.cs', from: 'led.setLedText(res);', to: 'led.setLedText(res)' })
    const result = await grade(dir, await checksOf(id))
    expect(result.compiled).toBe(false)
    expect(result.results.every((r) => !r.passed && r.message === '编译没有通过，先改正编译错误')).toBe(true)
  }, 60000)

  test('控件名和书上不一样：提示找不到控件', async () => {
    const id = 'p2-t1-LED显示屏'
    const dir = await prepare(id, 'rename', { file: 'Form1.cs', from: 'txt_SendText.Text', to: 'textBox1.Text' })
    // 同时把 Designer.cs 里的控件改名，模拟学生没按书上命名
    const designer = resolve(dir, 'Form1.Designer.cs')
    await Bun.write(designer, (await Bun.file(designer).text()).replaceAll('txt_SendText', 'textBox1'))
    const result = await grade(dir, await checksOf(id))
    expect(result.results[0]).toMatchObject({ passed: false, message: '找不到名为 txt_SendText 的控件（书上规定的控件名，注意大小写）' })
  }, 60000)

  test('判断写反：入侵时显示"正常"', async () => {
    const id = 'p4-t1-红外对射'
    const dir = await prepare(id, 'reversed', { file: 'Form1.cs', from: 'if (DeviceCtrlHelper.adam4150Helper.SetData().infraredValue)', to: 'if (!DeviceCtrlHelper.adam4150Helper.SetData().infraredValue)' })
    const result = await grade(dir, await checksOf(id))
    const realtime = result.results.find((r) => r.title === '能实时显示入侵数据')!
    expect(realtime.passed).toBe(false)
    expect(realtime.message).toBe('期望6 秒内 txt_even 的文字包含"发现入侵"，实际是"正常"')
    // 开关按钮的两项不受影响
    expect(result.results.filter((r) => r.passed).length).toBe(2)
  }, 60000)

  test('关闭时忘了停定时器', async () => {
    const id = 'p4-t1-红外对射'
    const dir = await prepare(id, 'timer', { file: 'Form1.cs', from: 'timer1.Stop();', to: '' })
    const result = await grade(dir, await checksOf(id))
    const stop = result.results.find((r) => r.title === '再点按钮能关闭串口、停止定时器')!
    expect(stop.passed).toBe(false)
    expect(stop.message).toStartWith('期望 txt_time 不再更新时间（定时器应已停止），实际从')
  }, 60000)

  test('关闭时忘了挂起线程', async () => {
    const id = 'p5-t2-烟雾'
    const dir = await prepare(id, 'thread', { file: 'Form1.cs', from: 'thd.Suspend();//挂起线程', to: '' })
    const result = await grade(dir, await checksOf(id))
    const stop = result.results.find((r) => r.title === '再点按钮能关闭串口、挂起线程，再次打开时线程继续')!
    expect(stop.passed).toBe(false)
    expect(stop.message).toStartWith('期望 txt_time 不再更新时间（线程应已挂起），实际从')
  }, 60000)

  test('历史灾情窗体没有把数组里的记录加入列表框', async () => {
    const id = 'p5-t3-推送灾情'
    const dir = await prepare(id, 'listbox', { file: 'Form2.cs', from: 'lstbRecored.Items.Add(', to: 'Console.WriteLine(' })
    const result = await grade(dir, await checksOf(id))
    expect(result.results[2]).toMatchObject({ passed: false, message: '期望 lstbRecored 列表里有"发现火情"的记录，实际列表是空的' })
  }, 60000)

  test('报警灯接错了 DO 口', async () => {
    const id = 'p4-t3-报警灯'
    const dir = await prepare(id, 'relay', { file: 'Form1.cs', from: 'DeviceCtrlHelper.adam4150Helper.OnOff(0, IsOpen);', to: 'DeviceCtrlHelper.adam4150Helper.OnOff(1, IsOpen);' })
    const result = await grade(dir, await checksOf(id))
    expect(result.results[0]).toMatchObject({ passed: false, message: '期望实训台的报警灯（ADAM-4150 DO0）打开，实际是关闭的' })
  }, 60000)
})

describe('评分规则写错时指出位置', () => {
  test('不认识的操作', () => {
    expect(() => parseChecks('- title: 测试\n  steps:\n    - press: btn\n')).toThrow('第 1 项"测试"第 1 步：不认识的操作 press')
  })

  test('实训台没有这个传感器', () => {
    expect(() => parseChecks('- title: 测试\n  steps:\n    - board: { rain: true }\n')).toThrow('实训台没有 rain')
  })

  test('时长格式不对', () => {
    expect(() => parseChecks('- title: 测试\n  steps:\n    - wait: 6\n')).not.toThrow()
    expect(() => parseChecks('- title: 测试\n  steps:\n    - wait: 6秒\n')).toThrow('时长要写成 6s 或 500ms')
  })
})

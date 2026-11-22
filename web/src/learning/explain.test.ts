import { expect, test } from 'bun:test'
import { exceptionFix, explainCompileError } from './explain'

test('编译错误按代码给说明，没收录的返回 null', () => {
  expect(explainCompileError('CS1002')).toContain('分号')
  expect(explainCompileError('CS9999')).toBeNull()
})

test('运行出错按最后一对括号里的异常类型给改法', () => {
  expect(exceptionFix('文字转换成数字或日期时格式不对（System.FormatException: Input string was not in a correct format.）')).toContain('TryParse')
  expect(exceptionFix('串口（COM3）没有打开（System.InvalidOperationException）')).toContain('Open')
  expect(exceptionFix('System.Exception: 坏了')).toBeNull()
})

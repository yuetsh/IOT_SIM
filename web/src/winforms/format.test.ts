import { describe, expect, test } from 'bun:test'
import { contentAlignCss } from './format'

describe('Label 的 TextAlign', () => {
  test('默认左上不加样式，其他位置用 flex 对齐', () => {
    expect(contentAlignCss('TopLeft')).toEqual({})
    expect(contentAlignCss(undefined)).toEqual({})
    expect(contentAlignCss('MiddleCenter')).toEqual({ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' })
    expect(contentAlignCss('BottomRight')).toEqual({ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', textAlign: 'right' })
  })
})

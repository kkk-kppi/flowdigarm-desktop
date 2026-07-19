// tests/unit/domain/paper-presets.test.ts
import { PAPER_SIZES, paperSizeFor } from '@/domain/paper-presets'

describe('纸张预设', () => {
  const cases: Array<[keyof typeof PAPER_SIZES, number, number]> = [
    ['letter', 612, 792],
    ['tabloid', 792, 1224],
    ['legal', 612, 1008],
    ['statement', 396, 612],
    ['executive', 522, 756],
    ['a3', 841.89, 1190.551],
    ['a4', 595.276, 841.89],
    ['a5', 419.528, 595.276],
    ['b4-jis', 728.504, 1031.811],
    ['b5-jis', 515.906, 728.504],
  ]

  it.each(cases)('%s 尺寸正确（pt，纵向，误差 <0.01）', (preset, width, height) => {
    const size = PAPER_SIZES[preset]
    expect(Math.abs(size.width - width)).toBeLessThan(0.01)
    expect(Math.abs(size.height - height)).toBeLessThan(0.01)
  })

  it('paperSizeFor 返回预设尺寸', () => {
    const size = paperSizeFor('a4')
    expect(size.width).toBeCloseTo(595.276, 2)
    expect(size.height).toBeCloseTo(841.89, 2)
  })

  it('custom 返回自定义尺寸', () => {
    const custom = { width: 300, height: 400 }
    expect(paperSizeFor('custom', custom)).toEqual({ width: 300, height: 400 })
  })

  it('custom 未提供尺寸时抛中文错误', () => {
    expect(() => paperSizeFor('custom')).toThrow('自定义纸张必须提供尺寸。')
  })
})

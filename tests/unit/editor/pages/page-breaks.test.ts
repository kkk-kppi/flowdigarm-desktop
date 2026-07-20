// tests/unit/editor/pages/page-breaks.test.ts
// 分页符：以 A4 打印纸减四边 5mm 打印机边距得到的单张可打印区域分块；
// 线位于可打印宽/高的整数倍处（严格小于页面尺寸），可打印区域 ≥ 页面则无分页线。
import { computePageBreaks, PRINTER_MARGIN_PT } from '@/application/pages/page-breaks'
import { unitToPt } from '@/domain/measurement'
import { paperSizeFor } from '@/domain/paper-presets'

describe('page-breaks', () => {
  it('PRINTER_MARGIN_PT 为 5mm 的 pt 值（保留 3 位小数）', () => {
    expect(PRINTER_MARGIN_PT).toBe(14.173)
    expect(unitToPt(5, 'mm')).toBeCloseTo(14.173, 3)
  })

  it('A4 → 2×2：vertical/horizontal 各 1 条线（数值手算写死）', () => {
    const a4 = paperSizeFor('a4')
    const breaks = computePageBreaks(a4)
    expect(breaks.vertical).toHaveLength(1)
    expect(breaks.horizontal).toHaveLength(1)
    // 595.2756 − 2×14.173 = 566.9296；841.8898 − 2×14.173 = 813.5438
    expect(breaks.vertical[0]).toBeCloseTo(566.9296, 3)
    expect(breaks.horizontal[0]).toBeCloseTo(813.5438, 3)
  })

  it('小于单张可打印区域的自定义页 → 无分页线', () => {
    expect(computePageBreaks({ width: 500, height: 700 })).toEqual({
      vertical: [],
      horizontal: [],
    })
  })

  it('超大页 1700×800 → 3×1：vertical 2 条线、horizontal 无', () => {
    const breaks = computePageBreaks({ width: 1700, height: 800 })
    expect(breaks.vertical).toHaveLength(2)
    expect(breaks.vertical[0]).toBeCloseTo(566.9296, 3)
    expect(breaks.vertical[1]).toBeCloseTo(1133.8592, 3)
    expect(breaks.horizontal).toHaveLength(0)
  })

  it('分页线严格小于页面尺寸（恰为整数倍边界时不产生越界线）', () => {
    // 宽度恰为可打印宽 2 倍：第 2 条线等于页面宽度，不生成
    const sheetWidth = paperSizeFor('a4').width - 2 * PRINTER_MARGIN_PT
    const breaks = computePageBreaks({ width: sheetWidth * 2, height: 100 })
    expect(breaks.vertical).toHaveLength(1)
    expect(breaks.vertical[0]).toBeCloseTo(sheetWidth, 6)
  })
})

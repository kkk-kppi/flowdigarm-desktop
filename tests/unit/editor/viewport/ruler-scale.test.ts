// tests/unit/editor/viewport/ruler-scale.test.ts
// 标尺刻度自适应：majorStep 取 1/2/5×10ⁿ（单位制）中换算后首个 ≥ 60 CSS px 者。
import type { Unit } from '@/domain/measurement'
import { computeRulerScale } from '@/infrastructure/x6/ruler-scale'

const ALL_UNITS: Unit[] = ['mm', 'cm', 'in', 'pt', 'px']
const ALL_ZOOMS = [0.1, 0.25, 0.5, 1, 2, 4]

describe('computeRulerScale', () => {
  it('cm、zoom=1：majorStep=2（75.59px）、minorStep=0.4、labelDecimals=0', () => {
    const scale = computeRulerScale('cm', 1)
    expect(scale.majorStep).toBe(2)
    expect(scale.majorPx).toBeCloseTo(75.59, 2)
    expect(scale.minorStep).toBeCloseTo(0.4, 10)
    expect(scale.minorPx).toBeCloseTo(15.12, 2)
    expect(scale.labelDecimals).toBe(0)
  })

  it('mm、zoom=1：majorStep=20', () => {
    expect(computeRulerScale('mm', 1).majorStep).toBe(20)
  })

  it('全部 5 单位 × zoom∈{0.1,0.25,0.5,1,2,4}：60≤majorPx≤134 且 5≤minorPx≤30', () => {
    // 上界说明：规则为"首个 ≥60 的 1/2/5 步进"，相邻候选最大比率 2.5（2→5），
    // 理论极端为 60×2.5=150；本网格实测最大 133.33（pt、zoom=2：20pt→53.33px<60，50pt→133.33px）。
    for (const unit of ALL_UNITS) {
      for (const zoom of ALL_ZOOMS) {
        const scale = computeRulerScale(unit, zoom)
        expect(scale.majorPx, `${unit}@${zoom} majorPx`).toBeGreaterThanOrEqual(60)
        expect(scale.majorPx, `${unit}@${zoom} majorPx`).toBeLessThanOrEqual(134)
        expect(scale.minorPx, `${unit}@${zoom} minorPx`).toBeGreaterThanOrEqual(5)
        expect(scale.minorPx, `${unit}@${zoom} minorPx`).toBeLessThanOrEqual(30)
      }
    }
  })

  it('majorStep 为单位整数时 labelDecimals=0', () => {
    expect(computeRulerScale('cm', 1).labelDecimals).toBe(0) // 2cm
    expect(computeRulerScale('cm', 2).labelDecimals).toBe(0) // 1cm
    expect(computeRulerScale('pt', 1).labelDecimals).toBe(0) // 50pt
    expect(computeRulerScale('mm', 0.25).labelDecimals).toBe(0) // 100mm
  })

  it('majorStep 为小数时 labelDecimals 按需：0.2→1 位、0.5→1 位、0.05→2 位', () => {
    expect(computeRulerScale('in', 4).majorStep).toBe(0.2)
    expect(computeRulerScale('in', 4).labelDecimals).toBe(1)
    expect(computeRulerScale('cm', 4).majorStep).toBe(0.5)
    expect(computeRulerScale('cm', 4).labelDecimals).toBe(1)
    expect(computeRulerScale('in', 16).majorStep).toBe(0.05)
    expect(computeRulerScale('in', 16).labelDecimals).toBe(2)
  })

  it('极端缩放下仍取首个 ≥60px 的刻度（n 可正可负，总能满足）', () => {
    // px 单位、zoom=0.1：1px→0.1px，需要 1000px 步长才 ≥60px
    const tiny = computeRulerScale('px', 0.1)
    expect(tiny.majorStep).toBe(1000)
    expect(tiny.majorPx).toBeCloseTo(100, 5)
    // mm、zoom=4：5mm→75.59px
    expect(computeRulerScale('mm', 4).majorStep).toBe(5)
  })
})

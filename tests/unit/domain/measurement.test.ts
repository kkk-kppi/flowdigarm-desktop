// tests/unit/domain/measurement.test.ts
import { formatMeasure, ptToUnit, unitToPt, type Unit } from '@/domain/measurement'

describe('度量换算（pt 体系）', () => {
  it('should convert 2.54 cm to 72 pt', () => {
    expect(unitToPt(2.54, 'cm')).toBeCloseTo(72)
  })

  it('should convert 72 pt to 1 inch', () => {
    expect(ptToUnit(72, 'in')).toBeCloseTo(1)
  })

  it('A4 尺寸', () => {
    expect(unitToPt(210, 'mm')).toBeCloseTo(595.276, 3)
    expect(unitToPt(297, 'mm')).toBeCloseTo(841.89, 2)
  })

  it('px 换算：96 CSS px 等于 72 pt', () => {
    expect(unitToPt(96, 'px')).toBe(72)
  })

  it('五种单位往返换算一致', () => {
    const units: Unit[] = ['mm', 'cm', 'in', 'pt', 'px']
    for (const unit of units) {
      expect(ptToUnit(unitToPt(123.456, unit), unit)).toBeCloseTo(123.456, 10)
    }
  })

  it('formatMeasure 按单位保留小数位且不修改数值', () => {
    expect(formatMeasure(595.276, 'mm')).toBe('210.0')
    expect(formatMeasure(72, 'in')).toBe('1.00')
    expect(formatMeasure(72, 'px')).toBe('96')
    expect(formatMeasure(841.89, 'cm')).toBe('29.70')
    expect(formatMeasure(12.34, 'pt')).toBe('12.3')
  })

  it('未知单位抛中文错误', () => {
    expect(() => unitToPt(1, '尺' as unknown as Unit)).toThrow('未知单位')
    expect(() => ptToUnit(1, '尺' as unknown as Unit)).toThrow('未知单位')
    expect(() => formatMeasure(1, '尺' as unknown as Unit)).toThrow('未知单位')
  })
})

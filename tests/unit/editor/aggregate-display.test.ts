// tests/unit/editor/aggregate-display.test.ts
// 聚合显示辅助纯函数：colorValue（回退色）、numberValue（空串）、boolPressed/alignPressed
// （mixed/value/其余三态）、toggledStyleBool（mixed 或不全 true → true，全 true → false）。
import {
  alignPressed,
  boolPressed,
  colorValue,
  numberValue,
  toggledStyleBool,
} from '@/application/inspector/aggregate-display'

describe('colorValue', () => {
  it('value 且为字符串 → 返回该值', () => {
    expect(colorValue({ kind: 'value', value: '#FF0000' })).toBe('#FF0000')
  })

  it('value 为 null/非字符串 → 回退色（默认 #FFFFFF）', () => {
    expect(colorValue({ kind: 'value', value: null })).toBe('#FFFFFF')
    expect(colorValue({ kind: 'value', value: 12 })).toBe('#FFFFFF')
  })

  it('mixed / none → 回退色', () => {
    expect(colorValue({ kind: 'mixed' })).toBe('#FFFFFF')
    expect(colorValue({ kind: 'none' })).toBe('#FFFFFF')
  })

  it('可指定回退色（工具栏文字颜色用 #000000）', () => {
    expect(colorValue({ kind: 'none' }, '#000000')).toBe('#000000')
    expect(colorValue({ kind: 'value', value: '#00FF00' }, '#000000')).toBe('#00FF00')
  })
})

describe('numberValue', () => {
  it('value 且非 null → 字符串', () => {
    expect(numberValue({ kind: 'value', value: 12 })).toBe('12')
    expect(numberValue({ kind: 'value', value: 0 })).toBe('0')
    expect(numberValue({ kind: 'value', value: '微软雅黑' })).toBe('微软雅黑')
  })

  it('value 为 null / mixed / none → 空串', () => {
    expect(numberValue({ kind: 'value', value: null })).toBe('')
    expect(numberValue({ kind: 'mixed' })).toBe('')
    expect(numberValue({ kind: 'none' })).toBe('')
  })
})

describe('boolPressed', () => {
  it('mixed → "mixed"；value true → "true"；value false/null/none → "false"', () => {
    expect(boolPressed({ kind: 'mixed' })).toBe('mixed')
    expect(boolPressed({ kind: 'value', value: true })).toBe('true')
    expect(boolPressed({ kind: 'value', value: false })).toBe('false')
    expect(boolPressed({ kind: 'value', value: null })).toBe('false')
    expect(boolPressed({ kind: 'none' })).toBe('false')
  })
})

describe('alignPressed', () => {
  it('mixed → "mixed"；value 等于选项 → "true"；不等于/none → "false"', () => {
    expect(alignPressed({ kind: 'mixed' }, 'center')).toBe('mixed')
    expect(alignPressed({ kind: 'value', value: 'center' }, 'center')).toBe('true')
    expect(alignPressed({ kind: 'value', value: 'left' }, 'center')).toBe('false')
    expect(alignPressed({ kind: 'none' }, 'center')).toBe('false')
  })
})

describe('toggledStyleBool', () => {
  it('value true → false（全 true 时点击置 false）', () => {
    expect(toggledStyleBool({ kind: 'value', value: true })).toBe(false)
  })

  it('value false/null、mixed、none → true（其余情形点击统一置 true）', () => {
    expect(toggledStyleBool({ kind: 'value', value: false })).toBe(true)
    expect(toggledStyleBool({ kind: 'value', value: null })).toBe(true)
    expect(toggledStyleBool({ kind: 'mixed' })).toBe(true)
    expect(toggledStyleBool({ kind: 'none' })).toBe(true)
  })
})

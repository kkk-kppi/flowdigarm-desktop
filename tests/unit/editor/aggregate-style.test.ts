// tests/unit/editor/aggregate-style.test.ts
// 多选聚合：一致显示值、不一致 mixed、无文本 none（控件禁用）；
// 文本样式三段逐键聚合；节点样式含嵌套 shadow 深等比较。
import {
  aggregateField,
  aggregateNodeStyles,
  aggregateTextStyles,
} from '@/application/inspector/aggregate-style'
import {
  createDefaultNodeStyle,
  createDefaultTextContent,
  type TextContent,
} from '@/domain/diagram'
import { createTestNode } from '../../helpers/test-document'

describe('aggregateField', () => {
  it('全 undefined → none', () => {
    expect(aggregateField([undefined, undefined])).toEqual({ kind: 'none' })
    expect(aggregateField([])).toEqual({ kind: 'none' })
  })

  it('全等 → value', () => {
    expect(aggregateField([12, 12, 12])).toEqual({ kind: 'value', value: 12 })
    expect(aggregateField(['微软雅黑', '微软雅黑'])).toEqual({ kind: 'value', value: '微软雅黑' })
  })

  it('不一致 → mixed', () => {
    expect(aggregateField([12, 14])).toEqual({ kind: 'mixed' })
    expect(aggregateField([true, false])).toEqual({ kind: 'mixed' })
  })

  it('部分 undefined 部分有值 → mixed', () => {
    expect(aggregateField([12, undefined])).toEqual({ kind: 'mixed' })
  })

  it('嵌套对象深等（JSON 序列化）：字段相同 → value，不同 → mixed', () => {
    const a = { color: '#000000', opacity: 0.3, offsetX: 2, offsetY: 4, blur: 8 }
    const b = { color: '#000000', opacity: 0.3, offsetX: 2, offsetY: 4, blur: 8 }
    const c = { ...a, blur: 10 }
    expect(aggregateField([a, b])).toEqual({ kind: 'value', value: a })
    expect(aggregateField([a, c])).toEqual({ kind: 'mixed' })
  })
})

describe('aggregateTextStyles', () => {
  it('全部无文本 → 三段全部 none', () => {
    const result = aggregateTextStyles([undefined, undefined])
    for (const aggregate of Object.values(result.style)) {
      expect(aggregate).toEqual({ kind: 'none' })
    }
    for (const aggregate of Object.values(result.block)) {
      expect(aggregate).toEqual({ kind: 'none' })
    }
    for (const aggregate of Object.values(result.paragraph)) {
      expect(aggregate).toEqual({ kind: 'none' })
    }
  })

  it('一致的默认文本 → 全 value；字号不一致 → fontSize mixed 其余 value', () => {
    const a: TextContent = createDefaultTextContent('甲')
    const b: TextContent = {
      ...createDefaultTextContent('乙'),
      style: { ...createDefaultTextContent().style, fontSize: 20 },
    }
    const result = aggregateTextStyles([a, b])
    expect(result.style.fontSize).toEqual({ kind: 'mixed' })
    expect(result.style.fontFamily).toEqual({ kind: 'value', value: '微软雅黑' })
    expect(result.style.bold).toEqual({ kind: 'value', value: false })
    expect(result.block.horizontalAlign).toEqual({ kind: 'value', value: 'center' })
    expect(result.block.direction).toEqual({ kind: 'value', value: 'horizontal' })
    expect(result.paragraph.lineHeight).toEqual({ kind: 'value', value: 1.2 })
  })

  it('有文本与无文本混选 → 全部 mixed', () => {
    const result = aggregateTextStyles([createDefaultTextContent('甲'), undefined])
    expect(result.style.fontSize).toEqual({ kind: 'mixed' })
    expect(result.block.horizontalAlign).toEqual({ kind: 'mixed' })
    expect(result.paragraph.before).toEqual({ kind: 'mixed' })
  })

  it('返回键覆盖 TextStyle/TextBlock/TextParagraph 全部字段（含 background）', () => {
    const result = aggregateTextStyles([createDefaultTextContent('甲')])
    expect(Object.keys(result.style)).toEqual([
      'fontFamily',
      'fontSize',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'color',
      'background',
    ])
    expect(Object.keys(result.block)).toEqual([
      'horizontalAlign',
      'verticalAlign',
      'direction',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
    ])
    expect(Object.keys(result.paragraph)).toEqual(['before', 'after', 'lineHeight'])
    // 可选字段未设置时聚合为 value null（规范化的「未设置」值），而非 none（none 表示无文本）
    expect(result.style.background).toEqual({ kind: 'value', value: null })
  })
})

describe('aggregateNodeStyles', () => {
  it('默认样式一致 → 全 value；填充不同 → fill mixed', () => {
    const a = createTestNode({ id: 'n-1' })
    const b = createTestNode({ id: 'n-2', style: { ...createDefaultNodeStyle(), fill: '#FF0000' } })
    const result = aggregateNodeStyles([a, b])
    expect(result.fill).toEqual({ kind: 'mixed' })
    expect(result.stroke).toEqual({ kind: 'value', value: '#000000' })
    expect(result.strokeWidth).toEqual({ kind: 'value', value: 1 })
  })

  it('嵌套 shadow：同值 → value、不同 → mixed、一方未设置 → mixed', () => {
    const shadow = { color: '#000000', opacity: 0.3, offsetX: 2, offsetY: 4, blur: 8 }
    const a = createTestNode({ id: 'n-1', style: { ...createDefaultNodeStyle(), shadow } })
    const b = createTestNode({ id: 'n-2', style: { ...createDefaultNodeStyle(), shadow: { ...shadow } } })
    const c = createTestNode({
      id: 'n-3',
      style: { ...createDefaultNodeStyle(), shadow: { ...shadow, blur: 10 } },
    })
    const d = createTestNode({ id: 'n-4' })
    expect(aggregateNodeStyles([a, b]).shadow).toEqual({ kind: 'value', value: shadow })
    expect(aggregateNodeStyles([a, c]).shadow).toEqual({ kind: 'mixed' })
    expect(aggregateNodeStyles([a, d]).shadow).toEqual({ kind: 'mixed' })
  })

  it('返回键覆盖 NodeStyle 全部字段', () => {
    const result = aggregateNodeStyles([createTestNode({ id: 'n-1' })])
    expect(Object.keys(result)).toEqual([
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeDash',
      'cornerRadius',
      'shadow',
    ])
  })
})

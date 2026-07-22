// tests/unit/editor/cell-mapper-text.test.ts
// 节点/边标签文本渲染映射（Task 6b）：节点 label 经 layoutText 按文本区布局；
// 竖排逐字分行且关闭 textWrap；边标签渲染其 TextContent 字体样式。
import { createDefaultTextContent, createEmptyPage, type TextContent } from '@/domain/diagram'
import { pageToCells } from '@/infrastructure/x6/cell-mapper'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'
import { createTestEdge, createTestNode } from '../../helpers/test-document'

function textWith(partial: { style?: Partial<TextContent['style']>; block?: Partial<TextContent['block']> }, value = '开始'): TextContent {
  const base = createDefaultTextContent(value)
  return {
    ...base,
    style: { ...base.style, ...partial.style },
    block: { ...base.block, ...partial.block },
  }
}

describe('节点 label 文本渲染', () => {
  it('默认文本：label 为原文；attrs 含字体/颜色/居中锚点且不使用 X6 textWrap', () => {
    // rect textAreaInset 为默认 4pt
    const inset = shapeRegistry.get('rect').textAreaInset
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1', x: 10, y: 20, width: 100, height: 60, text: textWith({}, '开始') })],
    })
    const meta = pageToCells(page)[0]
    expect(meta.label).toBe('开始')
    expect(meta.style['label/fontFamily']).toBe('微软雅黑')
    expect(meta.style['label/fontSize']).toBe(12)
    expect(meta.style['label/fontWeight']).toBe(400)
    expect(meta.style['label/fontStyle']).toBe('normal')
    expect(meta.style['label/textDecoration']).toBe('none')
    expect(meta.style['label/fill']).toBe('#000000')
    expect(meta.style['label/textAnchor']).toBe('middle')
    expect(meta.style['label/textVerticalAnchor']).toBe('middle')
    // 文本区（文档坐标减节点原点 → 局部）：居中锚点定位到文本区中心
    const areaWidth = 100 - inset.left - inset.right - 8
    const areaHeight = 60 - inset.top - inset.bottom - 8
    expect(meta.style['label/x']).toBe(inset.left + 4 + areaWidth / 2)
    expect(meta.style['label/y']).toBe(inset.top + 4 + areaHeight / 2)
    expect(meta.style['label/refX']).toBe(0)
    expect(meta.style['label/refY']).toBe(0)
    expect(meta.style['label/textWrap']).toBeUndefined()
  })

  it('左上对齐：锚点 start/top，定位到文本区左上角', () => {
    const inset = shapeRegistry.get('rect').textAreaInset
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'n-1',
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          text: textWith({ block: { horizontalAlign: 'left', verticalAlign: 'top' } }),
        }),
      ],
    })
    const meta = pageToCells(page)[0]
    expect(meta.style['label/textAnchor']).toBe('start')
    expect(meta.style['label/textVerticalAnchor']).toBe('top')
    expect(meta.style['label/x']).toBe(inset.left + 4)
    expect(meta.style['label/y']).toBe(inset.top + 4)
  })

  it('右下对齐：锚点 end/bottom，定位到文本区右下角', () => {
    const inset = shapeRegistry.get('rect').textAreaInset
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'n-1',
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          text: textWith({ block: { horizontalAlign: 'right', verticalAlign: 'bottom' } }),
        }),
      ],
    })
    const meta = pageToCells(page)[0]
    const areaWidth = 100 - inset.left - inset.right - 8
    const areaHeight = 60 - inset.top - inset.bottom - 8
    expect(meta.style['label/textAnchor']).toBe('end')
    expect(meta.style['label/textVerticalAnchor']).toBe('bottom')
    expect(meta.style['label/x']).toBe(inset.left + 4 + areaWidth)
    expect(meta.style['label/y']).toBe(inset.top + 4 + areaHeight)
  })

  it('竖排：label 为逐字 \\n 分行；textWrap 关闭（无 textWrap 键）', () => {
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'n-1',
          text: textWith({ block: { direction: 'vertical' } }, '流程'),
        }),
      ],
    })
    const meta = pageToCells(page)[0]
    expect(meta.label).toBe('流\n程')
    expect(meta.style['label/textWrap']).toBeUndefined()
  })

  it('粗斜体与下划线删除线映射；背景色与行距写入 attrs', () => {
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'n-1',
          text: textWith({
            style: { bold: true, italic: true, underline: true, strikethrough: true, background: '#FFFF00' },
          }),
        }),
      ],
    })
    const meta = pageToCells(page)[0]
    expect(meta.style['label/fontWeight']).toBe(700)
    expect(meta.style['label/fontStyle']).toBe('italic')
    expect(meta.style['label/textDecoration']).toBe('underline line-through')
    expect(meta.style['label/textBackground']).toBe('#FFFF00')
    // X6 tspan dy 需要绝对行距：默认 12pt × 1.2 = 14.4pt。
    expect(meta.style['label/lineHeight']).toBeCloseTo(14.4)
  })

  it('无文本节点不出现任何 label/* 键', () => {
    const page = createEmptyPage({ nodes: [createTestNode({ id: 'n-1' })] })
    const meta = pageToCells(page)[0]
    expect(meta.label).toBeUndefined()
    expect(Object.keys(meta.style).some((key) => key.startsWith('label/'))).toBe(false)
  })

  it('段前段后参与实时画布文本区高度与定位', () => {
    const content = textWith({ block: { verticalAlign: 'top' } })
    content.paragraph = { ...content.paragraph, before: 6, after: 10 }
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1', x: 0, y: 0, width: 100, height: 80, text: content })],
    })
    const meta = pageToCells(page)[0]
    const inset = shapeRegistry.get('rect').textAreaInset
    expect(meta.style['label/y']).toBe(inset.top + content.block.marginTop + content.paragraph.before)
    expect(meta.style['label/textWrap']).toBeUndefined()
  })

  it('节点高度不足时只限制换行宽度，不以文本区高度截断行', () => {
    const content = createDefaultTextContent('第一行\n第二行\n第三行\n第四行\n第五行')
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1', width: 120, height: 36, text: content })],
    })
    const meta = pageToCells(page)[0]
    expect(meta.label?.split('\n')).toHaveLength(5)
    expect(meta.style['label/textWrap']).toBeUndefined()
  })

  it('文本区窄于一个字时跳过 X6 自动换行，避免无进展循环', () => {
    const content = createDefaultTextContent('甲乙')
    content.style.fontSize = 12
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1', width: 20, height: 36, text: content })],
    })
    const meta = pageToCells(page)[0]
    expect(meta.label).toBe('甲乙')
    expect(meta.style['label/textWrap']).toBeUndefined()
  })

  it('长横排文本在映射阶段按文本区宽度预分行', () => {
    const content = createDefaultTextContent('甲乙丙丁戊')
    content.style.fontSize = 10
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1', width: 40, height: 36, text: content })],
    })
    const meta = pageToCells(page)[0]
    expect(meta.label).toBe('甲乙\n丙丁\n戊')
    expect(meta.style['label/textWrap']).toBeUndefined()
  })
})

describe('边 label 文本渲染', () => {
  it('边标签渲染 TextContent 字体样式（水平排版，逐标签 attrs）', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1' }), createTestNode({ id: 'n-2' })],
      edges: [
        createTestEdge({
          id: 'e-1',
          labels: [
            {
              text: textWith({ style: { fontSize: 16, bold: true, color: '#FF0000' } }, '是'),
              position: 0.5,
            },
          ],
        }),
      ],
    })
    const meta = pageToCells(page).find((cell) => cell.kind === 'edge')!
    expect(meta.label).toBe('是')
    expect(meta.labels).toHaveLength(1)
    expect(meta.labels![0].attrs).toMatchObject({
      fontSize: 16,
      fontWeight: 700,
      fill: '#FF0000',
      fontFamily: '微软雅黑',
    })
  })

  it('多标签边：labels 元数据逐条携带文本/位置/attrs', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1' }), createTestNode({ id: 'n-2' })],
      edges: [
        createTestEdge({
          id: 'e-1',
          labels: [
            { text: createDefaultTextContent('是'), position: 0.3 },
            { text: createDefaultTextContent('备注'), position: 0.7 },
          ],
        }),
      ],
    })
    const meta = pageToCells(page).find((cell) => cell.kind === 'edge')!
    expect(meta.labels).toHaveLength(2)
    expect(meta.labels![0]).toMatchObject({ text: '是', position: 0.3 })
    expect(meta.labels![1]).toMatchObject({ text: '备注', position: 0.7 })
    expect(meta.labels![0].attrs.fontFamily).toBe('微软雅黑')
  })

  it('无标签边不出现 labels 元数据', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1' }), createTestNode({ id: 'n-2' })],
      edges: [createTestEdge({ id: 'e-1' })],
    })
    const meta = pageToCells(page).find((cell) => cell.kind === 'edge')!
    expect(meta.labels).toBeUndefined()
  })
})

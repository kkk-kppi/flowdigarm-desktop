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
  it('默认文本：label 为原文；attrs 含字体/颜色/居中锚点与文本区 textWrap', () => {
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
    const areaWidth = 100 - inset.left - inset.right
    const areaHeight = 60 - inset.top - inset.bottom
    expect(meta.style['label/x']).toBe(inset.left + areaWidth / 2)
    expect(meta.style['label/y']).toBe(inset.top + areaHeight / 2)
    expect(meta.style['label/refX']).toBe(0)
    expect(meta.style['label/refY']).toBe(0)
    expect(meta.style['label/textWrap']).toEqual({
      width: areaWidth,
      height: areaHeight,
      breakWord: true,
    })
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
    expect(meta.style['label/x']).toBe(inset.left)
    expect(meta.style['label/y']).toBe(inset.top)
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
    const areaWidth = 100 - inset.left - inset.right
    const areaHeight = 60 - inset.top - inset.bottom
    expect(meta.style['label/textAnchor']).toBe('end')
    expect(meta.style['label/textVerticalAnchor']).toBe('bottom')
    expect(meta.style['label/x']).toBe(inset.left + areaWidth)
    expect(meta.style['label/y']).toBe(inset.top + areaHeight)
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
    expect(meta.style['label/lineHeight']).toBe(1.2)
  })

  it('无文本节点不出现任何 label/* 键', () => {
    const page = createEmptyPage({ nodes: [createTestNode({ id: 'n-1' })] })
    const meta = pageToCells(page)[0]
    expect(meta.label).toBeUndefined()
    expect(Object.keys(meta.style).some((key) => key.startsWith('label/'))).toBe(false)
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

// tests/unit/domain/diagram.test.ts
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createDefaultTextContent,
  createEmptyDocument,
  createEmptyPage,
} from '@/domain/diagram'

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('文档模型工厂', () => {
  it('createDefaultTextContent 使用微软雅黑 12pt 居中默认', () => {
    const text = createDefaultTextContent()
    expect(text.value).toBe('')
    expect(text.style).toEqual({
      fontFamily: '微软雅黑',
      fontSize: 12,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      color: '#000000',
    })
    expect(text.block).toEqual({
      horizontalAlign: 'center',
      verticalAlign: 'middle',
      direction: 'horizontal',
      marginTop: 4,
      marginRight: 4,
      marginBottom: 4,
      marginLeft: 4,
    })
    expect(text.paragraph).toEqual({ before: 0, after: 0, lineHeight: 1.2 })
  })

  it('createDefaultTextContent 保留传入的中文文本', () => {
    expect(createDefaultTextContent('开始').value).toBe('开始')
  })

  it('createDefaultNodeStyle 默认白底黑边', () => {
    expect(createDefaultNodeStyle()).toEqual({
      fill: '#FFFFFF',
      fillOpacity: 1,
      stroke: '#000000',
      strokeWidth: 1,
    })
  })

  it('createDefaultEdgeStyle 默认灰线末端箭头', () => {
    expect(createDefaultEdgeStyle()).toEqual({
      stroke: '#666666',
      strokeWidth: 1,
      opacity: 1,
      dash: 'solid',
      sourceArrow: 'none',
      targetArrow: 'arrow',
    })
  })

  it('createEmptyPage 默认 A4 纵向毫米页', () => {
    const page = createEmptyPage()
    expect(page.id).toMatch(UUID_V4_PATTERN)
    expect(page.name).toBe('页面 1')
    expect(page.type).toBe('foreground')
    expect(page.unit).toBe('mm')
    expect(page.pageSize.preset).toBe('a4')
    expect(page.pageSize.width).toBeCloseTo(595.276, 2)
    expect(page.pageSize.height).toBeCloseTo(841.89, 2)
    expect(page.orientation).toBe('portrait')
    expect(page.defaultConnector).toBe('orthogonal')
    expect(page.defaultArrow).toBe('single')
    expect(page.autoConnectLabel).toBe(true)
    expect(page.showLineJumps).toBe(false)
    expect(page.canvas).toEqual({ gridSize: 10, background: '#FFFFFF' })
    expect(page.nodes).toEqual([])
    expect(page.edges).toEqual([])
  })

  it('createEmptyPage 支持部分覆盖且每次生成唯一 id', () => {
    const page = createEmptyPage({ name: '背景页', type: 'background' })
    expect(page.name).toBe('背景页')
    expect(page.type).toBe('background')
    expect(page.unit).toBe('mm')
    expect(createEmptyPage().id).not.toBe(createEmptyPage().id)
  })

  it('createEmptyDocument 默认未命名单页文档', () => {
    const doc = createEmptyDocument()
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.schemaVersion).toBe(1)
    expect(doc.id).toMatch(UUID_V4_PATTERN)
    expect(doc.name).toBe('未命名流程图')
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0].type).toBe('foreground')
  })

  it('createEmptyDocument 接受中文名称', () => {
    expect(createEmptyDocument('订单流程').name).toBe('订单流程')
  })
})

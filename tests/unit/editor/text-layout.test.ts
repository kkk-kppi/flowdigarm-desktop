// tests/unit/editor/text-layout.test.ts
// 文本布局纯函数：竖排逐字排版（禁止旋转整段）、对齐/粗斜下划线 attrs 映射、文本区内缩计算。
import { layoutText, textAreaForNode } from '@/infrastructure/x6/text-layout'
import { createDefaultTextContent, type TextContent } from '@/domain/diagram'
import { createTestNode } from '../../helpers/test-document'

function verticalText(value: string): TextContent {
  const content = createDefaultTextContent(value)
  return { ...content, block: { ...content.block, direction: 'vertical' } }
}

describe('layoutText 竖排逐字排版', () => {
  it('竖排「流程」拆为两行单字符；wrap 关闭', () => {
    const result = layoutText({ content: verticalText('流程'), areaPt: { width: 40, height: 80 } })
    expect(result.lines).toEqual(['流', '程'])
    expect(result.wrap).toBe(false)
  })

  it('英文混排同样逐字：「流程A1」→ 四行单字符', () => {
    const result = layoutText({
      content: verticalText('流程A1'),
      areaPt: { width: 40, height: 80 },
    })
    expect(result.lines).toEqual(['流', '程', 'A', '1'])
  })

  it('竖排换行视为换列：源文本 \\n 产生空行占位', () => {
    const result = layoutText({
      content: verticalText('流\n程'),
      areaPt: { width: 40, height: 80 },
    })
    expect(result.lines).toEqual(['流', '', '程'])
  })

  it('横排保持源文本行；wrap 开启交给 X6 textWrap', () => {
    const result = layoutText({
      content: createDefaultTextContent('第一行\n第二行'),
      areaPt: { width: 100, height: 40 },
    })
    expect(result.lines).toEqual(['第一行', '第二行'])
    expect(result.wrap).toBe(true)
  })
})

describe('layoutText attrs 映射', () => {
  it('默认样式：微软雅黑 12 号、正常字重字形、无装饰、居中锚点', () => {
    const { attrs } = layoutText({
      content: createDefaultTextContent('甲'),
      areaPt: { width: 100, height: 40 },
    })
    expect(attrs.fontFamily).toBe('微软雅黑')
    expect(attrs.fontSize).toBe(12)
    expect(attrs.fontWeight).toBe(400)
    expect(attrs.fontStyle).toBe('normal')
    expect(attrs.textDecoration).toBe('none')
    expect(attrs.fill).toBe('#000000')
    expect(attrs.textAnchor).toBe('middle')
    expect(attrs.textVerticalAnchor).toBe('middle')
  })

  it('粗体/斜体/下划线+删除线合并映射', () => {
    const content = createDefaultTextContent('甲')
    const styled: TextContent = {
      ...content,
      style: {
        ...content.style,
        bold: true,
        italic: true,
        underline: true,
        strikethrough: true,
        color: '#FF0000',
      },
    }
    const { attrs } = layoutText({ content: styled, areaPt: { width: 100, height: 40 } })
    expect(attrs.fontWeight).toBe(700)
    expect(attrs.fontStyle).toBe('italic')
    expect(attrs.textDecoration).toBe('underline line-through')
    expect(attrs.fill).toBe('#FF0000')
  })

  it('仅下划线 / 仅删除线单独映射', () => {
    const base = createDefaultTextContent('甲')
    const underline: TextContent = {
      ...base,
      style: { ...base.style, underline: true },
    }
    const strike: TextContent = {
      ...base,
      style: { ...base.style, strikethrough: true },
    }
    expect(
      layoutText({ content: underline, areaPt: { width: 10, height: 10 } }).attrs.textDecoration,
    ).toBe('underline')
    expect(
      layoutText({ content: strike, areaPt: { width: 10, height: 10 } }).attrs.textDecoration,
    ).toBe('line-through')
  })

  it('水平对齐 left/center/right → textAnchor start/middle/end', () => {
    const base = createDefaultTextContent('甲')
    for (const [align, anchor] of [
      ['left', 'start'],
      ['center', 'middle'],
      ['right', 'end'],
    ] as const) {
      const content: TextContent = {
        ...base,
        block: { ...base.block, horizontalAlign: align },
      }
      expect(layoutText({ content, areaPt: { width: 10, height: 10 } }).attrs.textAnchor).toBe(
        anchor,
      )
    }
  })

  it('垂直对齐 top/middle/bottom → textVerticalAnchor top/middle/bottom', () => {
    const base = createDefaultTextContent('甲')
    for (const [align, anchor] of [
      ['top', 'top'],
      ['middle', 'middle'],
      ['bottom', 'bottom'],
    ] as const) {
      const content: TextContent = {
        ...base,
        block: { ...base.block, verticalAlign: align },
      }
      expect(
        layoutText({ content, areaPt: { width: 10, height: 10 } }).attrs.textVerticalAnchor,
      ).toBe(anchor)
    }
  })

  it('字体背景色写入 textBackground；行距写入 lineHeight', () => {
    const base = createDefaultTextContent('甲')
    const content: TextContent = {
      ...base,
      style: { ...base.style, background: '#FFFF00' },
      paragraph: { ...base.paragraph, lineHeight: 1.5 },
    }
    const { attrs } = layoutText({ content, areaPt: { width: 10, height: 10 } })
    expect(attrs.textBackground).toBe('#FFFF00')
    expect(attrs.lineHeight).toBe(1.5)
  })

  it('未设置背景色时不出现 textBackground 键', () => {
    const { attrs } = layoutText({
      content: createDefaultTextContent('甲'),
      areaPt: { width: 10, height: 10 },
    })
    expect('textBackground' in attrs).toBe(false)
  })
})

describe('textAreaForNode 文本区内缩', () => {
  it('bbox 减四边内缩', () => {
    const node = createTestNode({ id: 'n-1', x: 10, y: 20, width: 100, height: 60 })
    const area = textAreaForNode(node, { top: 4, right: 8, bottom: 12, left: 16 })
    expect(area).toEqual({ x: 26, y: 24, width: 76, height: 44 })
  })

  it('内缩大于尺寸时宽高钳制为 0', () => {
    const node = createTestNode({ id: 'n-1', x: 0, y: 0, width: 10, height: 10 })
    const area = textAreaForNode(node, { top: 8, right: 8, bottom: 8, left: 8 })
    expect(area.width).toBe(0)
    expect(area.height).toBe(0)
  })
})

// tests/unit/editor/format-paint.test.ts
// 格式刷命令：复制填充/边框/阴影/字体/文本块/段落（节点）与 EdgeStyle 全键（边）；
// 不复制内容/几何/链接/业务数据/形状类型/结构关系（逐键断言）；
// 节点→边类型不匹配跳过；全部不匹配 → null；多目标一次应用一条记录。
import { describe, expect, it } from 'vitest'
import {
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createDefaultTextContent,
  createEmptyPage,
  type DiagramPage,
} from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import {
  captureFormatPaintSource,
  createFormatPaintCommand,
} from '@/application/commands/apply-format-paint'
import { createTestDocument, createTestEdge, createTestNode } from '../../helpers/test-document'

const SOURCE_STYLE = {
  fill: '#FF0000',
  fillOpacity: 0.5,
  stroke: '#00FF00',
  strokeWidth: 3,
  strokeDash: 'dash' as const,
  cornerRadius: 6,
  shadow: { color: '#0000FF', opacity: 0.4, offsetX: 3, offsetY: 4, blur: 8 },
}

function sourceText() {
  const text = createDefaultTextContent('源文本')
  text.style = {
    fontFamily: '宋体',
    fontSize: 18,
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    color: '#123456',
    background: '#ABCDEF',
  }
  text.block = {
    horizontalAlign: 'right',
    verticalAlign: 'bottom',
    direction: 'vertical',
    marginTop: 8,
    marginRight: 9,
    marginBottom: 10,
    marginLeft: 11,
  }
  text.paragraph = { before: 5, after: 6, lineHeight: 2 }
  return text
}

function paintPage(): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    nodes: [
      createTestNode({
        id: 'source',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        angle: 30,
        zIndex: 0,
        shape: 'diamond',
        style: structuredClone(SOURCE_STYLE),
        text: sourceText(),
        link: 'https://example.com',
        data: { 业务: '源数据' },
        parentId: 'some-container',
      }),
      createTestNode({
        id: 'target-1',
        x: 300,
        y: 400,
        width: 60,
        height: 30,
        zIndex: 1,
        text: createDefaultTextContent('目标文本'),
      }),
      createTestNode({ id: 'target-2', x: 500, y: 600, zIndex: 2 }), // 无文本节点
    ],
    edges: [
      createTestEdge({
        id: 'edge-source',
        source: { nodeId: 'source', port: 'right' },
        target: { nodeId: 'target-1', port: 'left' },
        style: {
          stroke: '#111111',
          strokeWidth: 5,
          opacity: 0.6,
          dash: 'dot',
          sourceArrow: 'arrow',
          targetArrow: 'none',
        },
        link: 'mailto:a@b.c',
        zIndex: 3,
      }),
      createTestEdge({
        id: 'edge-target',
        source: { nodeId: 'target-1' },
        target: { nodeId: 'target-2' },
        zIndex: 4,
      }),
    ],
  })
}

describe('captureFormatPaintSource', () => {
  it('节点：捕获节点样式全键与文本 style/block/paragraph', () => {
    const page = paintPage()
    const source = page.nodes.find((n) => n.id === 'source')!
    const snapshot = captureFormatPaintSource(source)
    expect(snapshot.nodeStyle).toEqual(SOURCE_STYLE)
    expect(snapshot.text?.style).toEqual(sourceText().style)
    expect(snapshot.text?.block).toEqual(sourceText().block)
    expect(snapshot.text?.paragraph).toEqual(sourceText().paragraph)
    expect(snapshot.edgeStyle).toBeUndefined()
  })

  it('边：捕获 EdgeStyle 全键', () => {
    const page = paintPage()
    const edge = page.edges.find((e) => e.id === 'edge-source')!
    const snapshot = captureFormatPaintSource(edge)
    expect(snapshot.edgeStyle).toEqual(edge.style)
    expect(snapshot.nodeStyle).toBeUndefined()
  })
})

describe('createFormatPaintCommand 节点→节点', () => {
  it('复制填充/填充透明度/边框/虚线/圆角/阴影与字体/文本块/段落', () => {
    const page = paintPage()
    const command = createFormatPaintCommand(page, 'source', ['target-1'])!
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const target = next.nodes.find((n) => n.id === 'target-1')!
    expect(target.style).toEqual(SOURCE_STYLE)
    expect(target.text?.style).toEqual(sourceText().style)
    expect(target.text?.block).toEqual(sourceText().block)
    expect(target.text?.paragraph).toEqual(sourceText().paragraph)
  })

  it('不复制位置/尺寸/旋转/文本内容/链接/业务数据/形状类型/结构关系（逐键断言）', () => {
    const page = paintPage()
    const command = createFormatPaintCommand(page, 'source', ['target-1'])!
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const target = next.nodes.find((n) => n.id === 'target-1')!
    // 几何
    expect(target.x).toBe(300)
    expect(target.y).toBe(400)
    expect(target.width).toBe(60)
    expect(target.height).toBe(30)
    expect(target.angle).toBe(0)
    // 内容与标识
    expect(target.id).toBe('target-1')
    expect(target.text?.value).toBe('目标文本')
    expect(target.shape).toBe('rect')
    // 链接/业务数据/结构关系/图片
    expect(target.link).toBeUndefined()
    expect(target.data).toBeUndefined()
    expect(target.parentId).toBeUndefined()
    expect(target.imageHref).toBeUndefined()
  })

  it('目标无文本时以默认 TextContent 为底合并（不产生文本内容）', () => {
    const page = paintPage()
    const command = createFormatPaintCommand(page, 'source', ['target-2'])!
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const target = next.nodes.find((n) => n.id === 'target-2')!
    expect(target.text?.value).toBe('')
    expect(target.text?.style).toEqual(sourceText().style)
  })

  it('多目标一次应用一条「格式刷」记录，撤销一步全部恢复', () => {
    const page = paintPage()
    const command = createFormatPaintCommand(page, 'source', ['target-1', 'target-2'])!
    expect(command.label).toBe('格式刷')
    const history = new CommandHistory()
    const next = history.execute(command, { ...createTestDocument(), pages: [page] })
    expect(history.size).toBe(1)
    expect(next.pages[0].nodes.find((n) => n.id === 'target-1')?.style).toEqual(SOURCE_STYLE)
    expect(next.pages[0].nodes.find((n) => n.id === 'target-2')?.style).toEqual(SOURCE_STYLE)

    const reverted = history.undo(next)!
    const t1 = reverted.pages[0].nodes.find((n) => n.id === 'target-1')!
    const t2 = reverted.pages[0].nodes.find((n) => n.id === 'target-2')!
    expect(t1.style).toEqual(createDefaultNodeStyle())
    expect(t1.text?.style).toEqual(createDefaultTextContent('目标文本').style)
    expect(t2.style).toEqual(createDefaultNodeStyle())
    expect(t2.text).toBeUndefined()
  })
})

describe('createFormatPaintCommand 边→边与类型匹配', () => {
  it('边→边复制 EdgeStyle 全键；不复制连接关系/拐点/标签/链接', () => {
    const page = paintPage()
    const command = createFormatPaintCommand(page, 'edge-source', ['edge-target'])!
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const target = next.edges.find((e) => e.id === 'edge-target')!
    expect(target.style).toEqual(page.edges.find((e) => e.id === 'edge-source')!.style)
    // 结构与内容不变
    expect(target.source).toEqual({ nodeId: 'target-1' })
    expect(target.target).toEqual({ nodeId: 'target-2' })
    expect(target.connector).toBe('orthogonal')
    expect(target.vertices).toEqual([])
    expect(target.labels).toEqual([])
    expect(target.link).toBeUndefined()
    expect(target.style).not.toEqual(createDefaultEdgeStyle())
  })

  it('节点源→边目标跳过；边源→节点目标跳过；混合目标仅应用匹配者', () => {
    const page = paintPage()
    const command = createFormatPaintCommand(page, 'source', ['edge-target', 'target-1'])!
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    expect(next.edges.find((e) => e.id === 'edge-target')!.style).toEqual(createDefaultEdgeStyle())
    expect(next.nodes.find((n) => n.id === 'target-1')!.style).toEqual(SOURCE_STYLE)
  })

  it('全部目标类型不匹配 → null；源不存在 → null', () => {
    const page = paintPage()
    expect(createFormatPaintCommand(page, 'source', ['edge-target'])).toBeNull()
    expect(createFormatPaintCommand(page, 'edge-source', ['target-1'])).toBeNull()
    expect(createFormatPaintCommand(page, '不存在', ['target-1'])).toBeNull()
  })

  it('目标与源样式完全一致（无变化）→ 跳过；全部跳过 → null', () => {
    const page = paintPage()
    // target-1 先刷成源样式
    const first = createFormatPaintCommand(page, 'source', ['target-1'])!
    const painted = first.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    // 再刷一次：target-1 已无变化 → null
    expect(createFormatPaintCommand(painted, 'source', ['target-1'])).toBeNull()
    // 混合：target-1 跳过、target-2 应用
    const second = createFormatPaintCommand(painted, 'source', ['target-1', 'target-2'])
    expect(second).not.toBeNull()
  })
})

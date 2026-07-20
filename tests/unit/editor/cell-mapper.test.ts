// tests/unit/editor/cell-mapper.test.ts
// 文档 → X6 Cell 元数据映射：坐标直接用 pt 数值，样式映射为 X6 attrs 路径键。
// 本任务增补：节点端口/主体几何元数据、连线 connector 名称映射（含跳线）。
import {
  createDefaultNodeStyle,
  createDefaultTextContent,
  type DiagramPage,
} from '@/domain/diagram'
import { pageToCells, type CellMetadata } from '@/infrastructure/x6/cell-mapper'
import { x6ConnectorName } from '@/infrastructure/x6/edge-connector-map'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'
import { createEmptyPage } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../helpers/test-document'

function cellsOf(page: DiagramPage): { nodes: CellMetadata[]; edges: CellMetadata[] } {
  const cells = pageToCells(page)
  return {
    nodes: cells.filter((cell) => cell.kind === 'node'),
    edges: cells.filter((cell) => cell.kind === 'edge'),
  }
}

describe('pageToCells 节点映射', () => {
  it('映射 id/kind/shape/pt 坐标/尺寸/角度/zIndex/标签', () => {
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'node-1',
          shape: 'process',
          x: 10,
          y: 20,
          width: 120,
          height: 72,
          angle: 30,
          zIndex: 3,
          text: createDefaultTextContent('开始'),
        }),
      ],
    })
    const { nodes } = cellsOf(page)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'node-1',
      kind: 'node',
      shape: 'process',
      x: 10,
      y: 20,
      width: 120,
      height: 72,
      angle: 30,
      zIndex: 3,
      label: '开始',
    })
  })

  it('无文本节点的 label 为 undefined', () => {
    const page = createEmptyPage({ nodes: [createTestNode({ id: 'node-1' })] })
    expect(cellsOf(page).nodes[0].label).toBeUndefined()
  })

  it('节点样式映射为 body attrs：填充/描边/线宽/不透明度', () => {
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'node-1',
          style: {
            ...createDefaultNodeStyle(),
            fill: '#FF0000',
            fillOpacity: 0.5,
            stroke: '#00FF00',
            strokeWidth: 2,
          },
        }),
      ],
    })
    const style = cellsOf(page).nodes[0].style
    expect(style['body/fill']).toBe('#FF0000')
    expect(style['body/fillOpacity']).toBe(0.5)
    expect(style['body/stroke']).toBe('#00FF00')
    expect(style['body/strokeWidth']).toBe(2)
  })

  it('圆角映射为 rx/ry；虚线映射为 strokeDasharray；实线/未设置则不出现', () => {
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'node-1',
          style: { ...createDefaultNodeStyle(), cornerRadius: 6, strokeDash: 'dash' },
        }),
        createTestNode({ id: 'node-2', style: { ...createDefaultNodeStyle(), strokeDash: 'solid' } }),
      ],
    })
    const [dashed, solid] = cellsOf(page).nodes
    expect(dashed.style['body/rx']).toBe(6)
    expect(dashed.style['body/ry']).toBe(6)
    expect(dashed.style['body/strokeDasharray']).toBeTruthy()
    expect(solid.style['body/rx']).toBeUndefined()
    expect(solid.style['body/strokeDasharray']).toBeUndefined()
  })

  it('阴影映射为 dropShadow filter', () => {
    const page = createEmptyPage({
      nodes: [
        createTestNode({
          id: 'node-1',
          style: {
            ...createDefaultNodeStyle(),
            shadow: { color: '#000000', opacity: 0.3, offsetX: 2, offsetY: 4, blur: 8 },
          },
        }),
      ],
    })
    expect(cellsOf(page).nodes[0].style['body/filter']).toEqual({
      name: 'dropShadow',
      args: { dx: 2, dy: 4, blur: 8, color: '#000000', opacity: 0.3 },
    })
  })
})

describe('pageToCells 边映射', () => {
  it('映射 id/kind/端口/连接类型/zIndex，vertices 保留', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'node-1' }), createTestNode({ id: 'node-2' })],
      edges: [
        createTestEdge({
          id: 'edge-1',
          source: { nodeId: 'node-1', port: 'right' },
          target: { nodeId: 'node-2', port: 'left' },
          connector: 'curved',
          vertices: [
            { x: 50, y: 60 },
            { x: 70, y: 80 },
          ],
          zIndex: 2,
        }),
      ],
    })
    const { edges } = cellsOf(page)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      id: 'edge-1',
      kind: 'edge',
      connector: 'curved',
      source: { cell: 'node-1', port: 'right' },
      target: { cell: 'node-2', port: 'left' },
      vertices: [
        { x: 50, y: 60 },
        { x: 70, y: 80 },
      ],
      zIndex: 2,
    })
  })

  it('箭头映射为 block marker：targetArrow=arrow 生成 targetMarker，none 则不出现', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'node-1' }), createTestNode({ id: 'node-2' })],
      edges: [
        createTestEdge({
          id: 'edge-1',
          style: {
            stroke: '#333333',
            strokeWidth: 2,
            opacity: 0.8,
            dash: 'dot',
            sourceArrow: 'none',
            targetArrow: 'arrow',
          },
        }),
      ],
    })
    const style = cellsOf(page).edges[0].style
    expect(style['line/stroke']).toBe('#333333')
    expect(style['line/strokeWidth']).toBe(2)
    expect(style['line/opacity']).toBe(0.8)
    expect(style['line/strokeDasharray']).toBeTruthy()
    expect(style['line/sourceMarker']).toBeUndefined()
    expect(style['line/targetMarker']).toEqual({ name: 'block', size: 8 })
  })

  it('双向箭头时 sourceMarker 也为 block', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'node-1' }), createTestNode({ id: 'node-2' })],
      edges: [
        createTestEdge({
          id: 'edge-1',
          style: {
            stroke: '#666666',
            strokeWidth: 1,
            opacity: 1,
            dash: 'solid',
            sourceArrow: 'arrow',
            targetArrow: 'arrow',
          },
        }),
      ],
    })
    const style = cellsOf(page).edges[0].style
    expect(style['line/sourceMarker']).toEqual({ name: 'block', size: 8 })
    expect(style['line/targetMarker']).toEqual({ name: 'block', size: 8 })
    expect(style['line/strokeDasharray']).toBeUndefined()
  })

  it('边首标签文本映射为 label；无标签为 undefined', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'node-1' }), createTestNode({ id: 'node-2' })],
      edges: [
        createTestEdge({
          id: 'edge-1',
          labels: [{ text: createDefaultTextContent('是'), position: 0.5 }],
        }),
        createTestEdge({ id: 'edge-2' }),
      ],
    })
    const { edges } = cellsOf(page)
    expect(edges[0].label).toBe('是')
    expect(edges[1].label).toBeUndefined()
  })

  it('返回顺序为先节点后边', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'node-1' }), createTestNode({ id: 'node-2' })],
      edges: [createTestEdge({ id: 'edge-1' })],
    })
    const cells = pageToCells(page)
    expect(cells.map((cell) => cell.id)).toEqual(['node-1', 'node-2', 'edge-1'])
  })
})

describe('pageToCells 端口与主体几何元数据', () => {
  it('节点元数据写入注册表 portIds 与 bodyMarkup', () => {
    const page = createEmptyPage({ nodes: [createTestNode({ id: 'node-1', shape: 'diamond' })] })
    const meta = cellsOf(page).nodes[0]
    expect(meta.ports).toEqual(['top', 'right', 'bottom', 'left'])
    expect(meta.bodyMarkup).toEqual(shapeRegistry.get('diamond').body)
  })

  it('rect/ellipse/path 三类主体几何均可序列化', () => {
    const page = createEmptyPage({
      nodes: [
        createTestNode({ id: 'node-1', shape: 'rect' }),
        createTestNode({ id: 'node-2', shape: 'circle' }),
        createTestNode({ id: 'node-3', shape: 'triangle' }),
      ],
    })
    const { nodes } = cellsOf(page)
    expect(nodes[0].bodyMarkup).toEqual({ markup: 'rect' })
    expect(nodes[1].bodyMarkup).toEqual({ markup: 'ellipse' })
    expect(nodes[2].bodyMarkup?.markup).toBe('path')
    expect(nodes[2].bodyMarkup?.path).toBeTruthy()
  })

  it('未知形状类型抛「未知形状类型：」', () => {
    const page = createEmptyPage({ nodes: [createTestNode({ id: 'node-1', shape: '幽灵形状' })] })
    expect(() => pageToCells(page)).toThrow('未知形状类型：幽灵形状')
  })
})

describe('x6ConnectorName 连线映射', () => {
  it('三种 connector 映射：straight→normal、orthogonal→orth、curved→smooth', () => {
    expect(x6ConnectorName('straight', false)).toBe('normal')
    expect(x6ConnectorName('orthogonal', false)).toBe('orth')
    expect(x6ConnectorName('curved', false)).toBe('smooth')
  })

  it('showLineJumps 开：straight/orthogonal 改用 jumpover；curved 除外仍为 smooth', () => {
    expect(x6ConnectorName('straight', true)).toBe('jumpover')
    expect(x6ConnectorName('orthogonal', true)).toBe('jumpover')
    expect(x6ConnectorName('curved', true)).toBe('smooth')
  })

  it('边元数据 connectorName 随页面 showLineJumps 变化；跳线不写入 data（仅视觉跨越）', () => {
    const 跳线页 = createEmptyPage({
      showLineJumps: true,
      nodes: [createTestNode({ id: 'node-1' }), createTestNode({ id: 'node-2' })],
      edges: [
        createTestEdge({ id: 'edge-1', connector: 'straight' }),
        createTestEdge({ id: 'edge-2', connector: 'curved' }),
      ],
    })
    const { edges } = cellsOf(跳线页)
    expect(edges[0].connectorName).toBe('jumpover')
    expect(edges[1].connectorName).toBe('smooth')
    expect(edges[0].data).toBeUndefined()
    expect(edges[1].data).toBeUndefined()

    const 普通页 = createEmptyPage({
      showLineJumps: false,
      nodes: [createTestNode({ id: 'node-1' }), createTestNode({ id: 'node-2' })],
      edges: [createTestEdge({ id: 'edge-1', connector: 'orthogonal' })],
    })
    expect(cellsOf(普通页).edges[0].connectorName).toBe('orth')
  })
})

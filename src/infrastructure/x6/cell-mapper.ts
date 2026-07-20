// src/infrastructure/x6/cell-mapper.ts
// 文档页 → X6 Cell 元数据的纯函数映射（无 Graph 实例，可在 jsdom 中直接测试）。
// 坐标直接使用 pt 数值（X6 Cell 以 pt 为逻辑单位）；样式映射为 X6 attrs 路径键，
// 由 graph-adapter 展开后写入 Cell。
import type {
  ConnectorKind,
  DiagramEdge,
  DiagramNode,
  DiagramPage,
} from '@/domain/diagram'

export interface CellMetadata {
  id: string
  kind: 'node' | 'edge'
  x?: number
  y?: number
  width?: number
  height?: number
  angle?: number
  zIndex: number
  label?: string
  shape: string
  connector?: ConnectorKind
  source?: { cell: string; port?: string }
  target?: { cell: string; port?: string }
  vertices?: { x: number; y: number }[]
  style: Record<string, unknown>
  /** X6 cell data（前景页为空；背景页由 background-cells 写入标记）。 */
  data?: Record<string, unknown>
}

/** X6 block 箭头 marker（边端箭头唯一形态）。 */
const BLOCK_ARROW = { name: 'block', size: 8 } as const

/** 线型 → SVG stroke-dasharray；solid 返回 undefined（不写入 attrs）。 */
const DASH_ARRAYS: Record<Exclude<DiagramEdge['style']['dash'], 'solid'>, string> = {
  dash: '6 3',
  dot: '2 3',
  dashdot: '6 3 2 3',
}

function dashArrayOf(dash: 'solid' | 'dash' | 'dot' | 'dashdot' | undefined): string | undefined {
  if (!dash || dash === 'solid') {
    return undefined
  }
  return DASH_ARRAYS[dash]
}

function nodeStyleOf(node: DiagramNode): Record<string, unknown> {
  const style: Record<string, unknown> = {
    'body/fill': node.style.fill,
    'body/fillOpacity': node.style.fillOpacity,
    'body/stroke': node.style.stroke,
    'body/strokeWidth': node.style.strokeWidth,
  }
  const dashArray = dashArrayOf(node.style.strokeDash)
  if (dashArray) {
    style['body/strokeDasharray'] = dashArray
  }
  if (node.style.cornerRadius && node.style.cornerRadius > 0) {
    style['body/rx'] = node.style.cornerRadius
    style['body/ry'] = node.style.cornerRadius
  }
  if (node.style.shadow) {
    style['body/filter'] = {
      name: 'dropShadow',
      args: {
        dx: node.style.shadow.offsetX,
        dy: node.style.shadow.offsetY,
        blur: node.style.shadow.blur,
        color: node.style.shadow.color,
        opacity: node.style.shadow.opacity,
      },
    }
  }
  return style
}

function edgeStyleOf(edge: DiagramEdge): Record<string, unknown> {
  const style: Record<string, unknown> = {
    'line/stroke': edge.style.stroke,
    'line/strokeWidth': edge.style.strokeWidth,
    'line/opacity': edge.style.opacity,
  }
  const dashArray = dashArrayOf(edge.style.dash)
  if (dashArray) {
    style['line/strokeDasharray'] = dashArray
  }
  if (edge.style.sourceArrow === 'arrow') {
    style['line/sourceMarker'] = { ...BLOCK_ARROW }
  }
  if (edge.style.targetArrow === 'arrow') {
    style['line/targetMarker'] = { ...BLOCK_ARROW }
  }
  return style
}

function nodeToCell(node: DiagramNode): CellMetadata {
  return {
    id: node.id,
    kind: 'node',
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    angle: node.angle,
    zIndex: node.zIndex,
    label: node.text?.value,
    shape: node.shape,
    style: nodeStyleOf(node),
  }
}

function edgeToCell(edge: DiagramEdge): CellMetadata {
  return {
    id: edge.id,
    kind: 'edge',
    zIndex: edge.zIndex,
    label: edge.labels[0]?.text.value,
    shape: 'edge',
    connector: edge.connector,
    source: { cell: edge.source.nodeId, port: edge.source.port },
    target: { cell: edge.target.nodeId, port: edge.target.port },
    vertices: edge.vertices.map((vertex) => ({ ...vertex })),
    style: edgeStyleOf(edge),
  }
}

/** 将文档页映射为 X6 可消费的 Cell 元数据列表：先节点后边。 */
export function pageToCells(page: DiagramPage): CellMetadata[] {
  return [...page.nodes.map(nodeToCell), ...page.edges.map(edgeToCell)]
}

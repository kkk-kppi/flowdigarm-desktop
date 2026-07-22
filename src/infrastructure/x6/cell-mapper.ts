// src/infrastructure/x6/cell-mapper.ts
// 文档页 → X6 Cell 元数据的纯函数映射（无 Graph 实例，可在 jsdom 中直接测试）。
// 坐标直接使用 pt 数值（X6 Cell 以 pt 为逻辑单位）；样式映射为 X6 attrs 路径键，
// 由 graph-adapter 展开后写入 Cell。
// 节点端口与主体几何来自形状注册表（供 adapter 动态注册 X6 节点）；
// 连线 connector 名称经 edge-connector-map 计算（跳线仅视觉，不改拓扑）。
import type {
  ConnectorKind,
  DiagramEdge,
  DiagramNode,
  DiagramPage,
} from '@/domain/diagram'
import { shapeRegistry, type ShapeDefinition } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：保证内置形状已注册
import { x6ConnectorName } from './edge-connector-map'
import { layoutText, textAreaForNode } from './text-layout'

/** 边标签渲染元数据：文本、沿线位置与 label attrs（字体样式）。 */
export interface EdgeLabelMetadata {
  text: string
  position: number
  attrs: Record<string, unknown>
}

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
  /** 边多标签元数据（无标签时缺省）；节点不使用。 */
  labels?: EdgeLabelMetadata[]
  shape: string
  connector?: ConnectorKind
  /** X6 连接器名称（normal/orth/smooth/jumpover），由 connector + 页面跳线开关算出。 */
  connectorName?: string
  /** 节点端口 id 列表（来自 ShapeDefinition，四边中点）。 */
  ports?: string[]
  /** 节点主体几何（ShapeDefinition.body 序列化），供 adapter 注册/创建 X6 节点。 */
  bodyMarkup?: ShapeDefinition['body']
  source?: { cell: string; port?: string }
  target?: { cell: string; port?: string }
  vertices?: { x: number; y: number }[]
  /** 组合/容器成员关系（节点父节点 id）；adapter 据此组装 X6 父子。 */
  parentId?: string
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
  if (node.shape === 'image' && node.imageHref) {
    return {
      'image/xlinkHref': node.imageHref,
      'image/preserveAspectRatio': 'xMidYMid meet',
    }
  }
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

/**
 * 节点 label 渲染：文本区 = bbox − textAreaInset（经 layoutText 布局一次，文本与样式同源）。
 * 锚点定位：textAnchor/textVerticalAnchor 决定 x/y 落在文本区左中右/上中下；
 * refX/refY 归 0（覆盖 X6 默认 0.5 相对定位，避免与绝对 x/y 叠乘）。
 * 横排由共享测量函数按文本区宽度预分行；竖排逐字 \n 分行；两者都不使用 X6 textWrap。
 */
function nodeLabelOf(
  node: DiagramNode,
  definition: ShapeDefinition,
): { text?: string; style: Record<string, unknown> } {
  if (!node.text) {
    return { style: {} }
  }
  const area = textAreaForNode(node, definition.textAreaInset, node.text)
  const layout = layoutText({
    content: node.text,
    areaPt: { width: area.width, height: area.height },
  })
  const localX = area.x - node.x
  const localY = area.y - node.y
  const anchor = layout.attrs.textAnchor
  const vAnchor = layout.attrs.textVerticalAnchor
  const x =
    anchor === 'start' ? localX : anchor === 'end' ? localX + area.width : localX + area.width / 2
  const y =
    vAnchor === 'top'
      ? localY
      : vAnchor === 'bottom'
        ? localY + area.height
        : localY + area.height / 2
  const style: Record<string, unknown> = {
    'label/refX': 0,
    'label/refY': 0,
    'label/x': x,
    'label/y': y,
  }
  for (const [key, value] of Object.entries(layout.attrs)) {
    style[`label/${key}`] = value
  }
  return { text: layout.lines.join('\n'), style }
}

/** 边标签渲染：TextContent 水平排版（字体/颜色/行距；无边文本区，不映射对齐锚点）。 */
function edgeLabelAttrs(label: DiagramEdge['labels'][number]): Record<string, unknown> {
  const layout = layoutText({ content: label.text, areaPt: { width: 0, height: 0 } })
  const attrs: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(layout.attrs)) {
    if (key === 'textAnchor' || key === 'textVerticalAnchor') continue
    attrs[key] = value
  }
  return attrs
}

function nodeToCell(node: DiagramNode): CellMetadata {
  // 未知形状在此抛出「未知形状类型：xxx」（注册表为唯一形状真源）
  const definition = shapeRegistry.get(node.shape)
  const label = nodeLabelOf(node, definition)
  return {
    id: node.id,
    kind: 'node',
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    angle: node.angle,
    zIndex: node.zIndex,
    label: label.text,
    shape: node.shape,
    ports: shapeRegistry.portIds(node.shape),
    bodyMarkup: { ...definition.body },
    parentId: node.parentId,
    style: { ...nodeStyleOf(node), ...label.style },
  }
}

/** X6 父子相对坐标：子节点局部坐标 = 节点文档坐标 − 父节点文档坐标（pt，纯函数）。 */
export function relativePositionFor(
  node: { x: number; y: number },
  parent: { x: number; y: number },
): { x: number; y: number } {
  return { x: node.x - parent.x, y: node.y - parent.y }
}

function edgeToCell(edge: DiagramEdge, showLineJumps: boolean): CellMetadata {
  return {
    id: edge.id,
    kind: 'edge',
    zIndex: edge.zIndex,
    label: edge.labels[0]?.text.value,
    // 标签字体样式逐标签携带（cell 级 label/* 会串扰到全部标签，故不入 style）
    labels:
      edge.labels.length > 0
        ? edge.labels.map((label) => ({
            text: label.text.value,
            position: label.position,
            attrs: edgeLabelAttrs(label),
          }))
        : undefined,
    shape: 'edge',
    connector: edge.connector,
    connectorName: x6ConnectorName(edge.connector, showLineJumps),
    source: { cell: edge.source.nodeId, port: edge.source.port },
    target: { cell: edge.target.nodeId, port: edge.target.port },
    vertices: edge.vertices.map((vertex) => ({ ...vertex })),
    style: edgeStyleOf(edge),
  }
}

/** 将文档页映射为 X6 可消费的 Cell 元数据列表：先节点后边。 */
export function pageToCells(page: DiagramPage): CellMetadata[] {
  return [
    ...page.nodes.map(nodeToCell),
    ...page.edges.map((edge) => edgeToCell(edge, page.showLineJumps)),
  ]
}

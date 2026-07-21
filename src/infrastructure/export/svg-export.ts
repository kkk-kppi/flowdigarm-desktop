import { resolveBackgroundPage } from '@/application/pages/background-page-resolver'
import '@/application/shapes/common-shapes'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import type {
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  DiagramPage,
  TextContent,
} from '@/domain/diagram'
import type { ExportLinkAnnotation } from '@/application/export/export-ports'

export interface RenderedPageSvg {
  svg: string
  links: ExportLinkAnnotation[]
}

const dashArrays = { solid: '', dash: '8 4', dot: '2 3', dashdot: '8 4 2 4' }

function number(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`
}

function xml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function safeLink(value: string | undefined): value is string {
  if (!value) return false
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol.toLowerCase())
  } catch {
    return false
  }
}

function safeImage(value: string | undefined): value is string {
  return Boolean(value && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value))
}

function paint(style: DiagramNode['style']): string {
  const dash = style.strokeDash && dashArrays[style.strokeDash]
  return `fill="${xml(style.fill)}" fill-opacity="${number(style.fillOpacity)}" stroke="${xml(style.stroke)}" stroke-width="${number(style.strokeWidth)}"${dash ? ` stroke-dasharray="${dash}"` : ''}`
}

function nodeBody(node: DiagramNode): string {
  const definition = shapeRegistry.get(node.shape)
  const common = `${paint(node.style)} vector-effect="non-scaling-stroke"`
  if (definition.body.markup === 'ellipse') {
    return `<ellipse cx="${number(node.x + node.width / 2)}" cy="${number(node.y + node.height / 2)}" rx="${number(node.width / 2)}" ry="${number(node.height / 2)}" ${common}/>`
  }
  if (definition.body.markup === 'path') {
    return `<path d="${xml(definition.body.path ?? '')}" transform="translate(${number(node.x)} ${number(node.y)}) scale(${number(node.width / 100)} ${number(node.height / 100)})" ${common}/>`
  }
  if (definition.body.markup === 'image') {
    const image = safeImage(node.imageHref)
      ? `<image x="${number(node.x)}" y="${number(node.y)}" width="${number(node.width)}" height="${number(node.height)}" href="${xml(node.imageHref)}" preserveAspectRatio="xMidYMid meet"/>`
      : ''
    return `<rect x="${number(node.x)}" y="${number(node.y)}" width="${number(node.width)}" height="${number(node.height)}" ${common}/>${image}`
  }
  const configuredRadius = node.style.cornerRadius ?? definition.body.roundedRadius ?? 0
  const radius = definition.type === 'terminator'
    ? node.height / 2
    : Math.min(configuredRadius, node.width / 2, node.height / 2)
  return `<rect x="${number(node.x)}" y="${number(node.y)}" width="${number(node.width)}" height="${number(node.height)}"${radius ? ` rx="${number(radius)}" ry="${number(radius)}"` : ''} ${common}/>`
}

function textAnchor(content: TextContent): 'start' | 'middle' | 'end' {
  return { left: 'start', center: 'middle', right: 'end' }[content.block.horizontalAlign] as 'start' | 'middle' | 'end'
}

function textPosition(node: DiagramNode, content: TextContent): { x: number; y: number } {
  const { block, style } = content
  const x = block.horizontalAlign === 'left' ? node.x + block.marginLeft
    : block.horizontalAlign === 'right' ? node.x + node.width - block.marginRight
      : node.x + node.width / 2
  const usableTop = node.y + block.marginTop + content.paragraph.before
  const usableBottom = node.y + node.height - block.marginBottom - content.paragraph.after
  const y = block.verticalAlign === 'top' ? usableTop + style.fontSize
    : block.verticalAlign === 'bottom' ? usableBottom
      : (usableTop + usableBottom) / 2 + style.fontSize * 0.35
  return { x, y }
}

function renderText(node: DiagramNode): string {
  const content = node.text
  if (!content?.value) return ''
  const { style, paragraph } = content
  const position = textPosition(node, content)
  const decoration = [style.underline && 'underline', style.strikethrough && 'line-through'].filter(Boolean).join(' ')
  const attrs = `x="${number(position.x)}" y="${number(position.y)}" text-anchor="${textAnchor(content)}" font-family="${xml(style.fontFamily)}" font-size="${number(style.fontSize)}pt" font-weight="${style.bold ? '700' : '400'}" font-style="${style.italic ? 'italic' : 'normal'}" fill="${xml(style.color)}"${decoration ? ` text-decoration="${decoration}"` : ''}`
  const background = style.background
    ? `<rect x="${number(node.x + content.block.marginLeft)}" y="${number(node.y + content.block.marginTop)}" width="${number(Math.max(0, node.width - content.block.marginLeft - content.block.marginRight))}" height="${number(Math.max(0, node.height - content.block.marginTop - content.block.marginBottom))}" fill="${xml(style.background)}"/>`
    : ''
  if (content.block.direction === 'vertical') {
    const glyphs = [...content.value].map((character, index) => `<tspan x="${number(position.x)}" dy="${index === 0 ? 0 : number(style.fontSize * paragraph.lineHeight)}">${xml(character)}</tspan>`).join('')
    return `${background}<text ${attrs}>${glyphs}</text>`
  }
  const lines = content.value.split('\n')
  const spans = lines.map((line, index) => `<tspan x="${number(position.x)}" dy="${index === 0 ? 0 : number(style.fontSize * paragraph.lineHeight)}">${xml(line)}</tspan>`).join('')
  return `${background}<text ${attrs}>${spans}</text>`
}

function renderNode(node: DiagramNode, links: ExportLinkAnnotation[]): string {
  const rotation = node.angle
    ? ` transform="rotate(${number(node.angle)} ${number(node.x + node.width / 2)} ${number(node.y + node.height / 2)})"`
    : ''
  const group = `<g data-cell-id="${xml(node.id)}"${rotation}>${nodeBody(node)}${renderText(node)}</g>`
  if (!safeLink(node.link)) return group
  links.push({ url: node.link, xPt: node.x, yPt: node.y, widthPt: node.width, heightPt: node.height })
  return `<a href="${xml(node.link)}">${group}</a>`
}

function endpoint(page: DiagramPage, nodeId: string): { x: number; y: number } {
  const node = page.nodes.find((candidate) => candidate.id === nodeId)
  return node ? { x: node.x + node.width / 2, y: node.y + node.height / 2 } : { x: 0, y: 0 }
}

function edgePoints(page: DiagramPage, edge: DiagramEdge): Array<{ x: number; y: number }> {
  return [endpoint(page, edge.source.nodeId), ...edge.vertices, endpoint(page, edge.target.nodeId)]
}

function edgePath(page: DiagramPage, edge: DiagramEdge): string {
  const points = edgePoints(page, edge)
  const start = points[0]
  if (edge.connector === 'curved') {
    if (points.length >= 4) {
      const controls = points.slice(1, -1)
      return `M ${number(start.x)} ${number(start.y)} C ${number(controls[0].x)} ${number(controls[0].y)} ${number(controls.at(-1)!.x)} ${number(controls.at(-1)!.y)} ${number(points.at(-1)!.x)} ${number(points.at(-1)!.y)}`
    }
    const end = points.at(-1)!
    const control = points[1] ?? { x: (start.x + end.x) / 2, y: start.y }
    return `M ${number(start.x)} ${number(start.y)} Q ${number(control.x)} ${number(control.y)} ${number(end.x)} ${number(end.y)}`
  }
  if (edge.connector === 'orthogonal' && points.length === 2) {
    const end = points[1]
    const mid = (start.x + end.x) / 2
    return `M ${number(start.x)} ${number(start.y)} L ${number(mid)} ${number(start.y)} L ${number(mid)} ${number(end.y)} L ${number(end.x)} ${number(end.y)}`
  }
  return `M ${number(start.x)} ${number(start.y)} ${points.slice(1).map((point) => `L ${number(point.x)} ${number(point.y)}`).join(' ')}`
}

function pointAlong(points: Array<{ x: number; y: number }>, position: number): { x: number; y: number } {
  const start = points[0]
  const end = points.at(-1)!
  return { x: start.x + (end.x - start.x) * position, y: start.y + (end.y - start.y) * position }
}

function renderEdge(page: DiagramPage, edge: DiagramEdge, links: ExportLinkAnnotation[]): string {
  const dash = dashArrays[edge.style.dash]
  const markers = `${edge.style.sourceArrow === 'arrow' ? ' marker-start="url(#arrow-start)"' : ''}${edge.style.targetArrow === 'arrow' ? ' marker-end="url(#arrow-end)"' : ''}`
  const path = `<path d="${edgePath(page, edge)}" fill="none" stroke="${xml(edge.style.stroke)}" stroke-width="${number(edge.style.strokeWidth)}" opacity="${number(edge.style.opacity)}"${dash ? ` stroke-dasharray="${dash}"` : ''}${markers}/>`
  const labels = edge.labels.map((label) => {
    const point = pointAlong(edgePoints(page, edge), label.position)
    const syntheticNode: DiagramNode = {
      id: `${edge.id}-label`, shape: 'text', x: point.x - 50, y: point.y - 20,
      width: 100, height: 40, angle: 0, zIndex: edge.zIndex, text: label.text,
      style: { fill: '#ffffff', fillOpacity: 0, stroke: '#000000', strokeWidth: 0 },
    }
    return renderText(syntheticNode)
  }).join('')
  const group = `<g data-cell-id="${xml(edge.id)}">${path}${labels}</g>`
  if (!safeLink(edge.link)) return group
  const points = edgePoints(page, edge)
  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  const x = Math.min(...xs); const y = Math.min(...ys)
  links.push({ url: edge.link, xPt: x, yPt: y, widthPt: Math.max(1, Math.max(...xs) - x), heightPt: Math.max(1, Math.max(...ys) - y) })
  return `<a href="${xml(edge.link)}">${group}</a>`
}

function renderCells(page: DiagramPage, links: ExportLinkAnnotation[]): string {
  const cells = [
    ...page.nodes.map((node, order) => ({ zIndex: node.zIndex, order, render: () => renderNode(node, links) })),
    ...page.edges.map((edge, order) => ({ zIndex: edge.zIndex, order: page.nodes.length + order, render: () => renderEdge(page, edge, links) })),
  ].sort((a, b) => a.zIndex - b.zIndex || a.order - b.order)
  return cells.map(({ render }) => render()).join('')
}

export function renderPageSvg(document: DiagramDocument, pageId: string): RenderedPageSvg {
  const page = document.pages.find((candidate) => candidate.id === pageId)
  if (!page) throw new Error('导出页面不存在。')
  const links: ExportLinkAnnotation[] = []
  const background = resolveBackgroundPage(document, page.id)
  const content = `${background ? renderCells(background, links) : ''}${renderCells(page, links)}`
  const width = number(page.pageSize.width)
  const height = number(page.pageSize.height)
  const defs = '<defs><marker id="arrow-end" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke"/></marker><marker id="arrow-start" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse"><path d="M8 0 L0 4 L8 8 Z" fill="context-stroke"/></marker></defs>'
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}">${defs}<rect width="100%" height="100%" fill="${xml(page.canvas.background)}"/>${content}</svg>`,
    links,
  }
}

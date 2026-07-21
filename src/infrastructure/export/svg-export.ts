import { resolvePageBackgroundChain } from '@/application/pages/page-background-chain'
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
import { buildEdgeGeometry } from './svg-edge-geometry'

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
    return safeImage(node.imageHref)
      ? `<image x="${number(node.x)}" y="${number(node.y)}" width="${number(node.width)}" height="${number(node.height)}" href="${xml(node.imageHref)}" preserveAspectRatio="xMidYMid meet"/>`
      : '<g data-image-placeholder="true"/>'
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

function textLayout(node: DiagramNode, content: TextContent): { x: number; baselines: number[]; area: { x: number; y: number; width: number; height: number } } {
  const { block, style, paragraph } = content
  const inset = shapeRegistry.get(node.shape).textAreaInset
  const left = node.x + inset.left + block.marginLeft
  const right = Math.max(left, node.x + node.width - inset.right - block.marginRight)
  const top = node.y + inset.top + block.marginTop + paragraph.before
  const bottom = Math.max(top, node.y + node.height - inset.bottom - block.marginBottom - paragraph.after)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  const lineCount = Math.max(1, content.block.direction === 'vertical' ? [...content.value].length : content.value.split('\n').length)
  const baselineOffset = Math.min(style.fontSize, height)
  const advance = lineCount > 1
    ? Math.min(style.fontSize * paragraph.lineHeight, Math.max(0, height - baselineOffset) / (lineCount - 1))
    : 0
  const blockHeight = baselineOffset + advance * (lineCount - 1)
  const firstBaseline = block.verticalAlign === 'top' ? top + baselineOffset
    : block.verticalAlign === 'bottom' ? bottom - advance * (lineCount - 1)
      : top + (height - blockHeight) / 2 + baselineOffset
  const x = block.horizontalAlign === 'left' ? left : block.horizontalAlign === 'right' ? right : (left + right) / 2
  return {
    x,
    baselines: Array.from({ length: lineCount }, (_, index) => firstBaseline + advance * index),
    area: { x: left, y: top, width, height },
  }
}

function renderText(node: DiagramNode): string {
  const content = node.text
  if (!content?.value) return ''
  const { style } = content
  const layout = textLayout(node, content)
  const decoration = [style.underline && 'underline', style.strikethrough && 'line-through'].filter(Boolean).join(' ')
  const attrs = `text-anchor="${textAnchor(content)}" font-family="${xml(style.fontFamily)}" font-size="${number(style.fontSize)}pt" font-weight="${style.bold ? '700' : '400'}" font-style="${style.italic ? 'italic' : 'normal'}" fill="${xml(style.color)}"${decoration ? ` text-decoration="${decoration}"` : ''}`
  const background = style.background
    ? `<rect x="${number(layout.area.x)}" y="${number(layout.area.y)}" width="${number(layout.area.width)}" height="${number(layout.area.height)}" fill="${xml(style.background)}"/>`
    : ''
  if (content.block.direction === 'vertical') {
    const glyphs = [...content.value].map((character, index) => `<tspan x="${number(layout.x)}" y="${number(layout.baselines[index])}">${xml(character)}</tspan>`).join('')
    return `${background}<text ${attrs}>${glyphs}</text>`
  }
  const lines = content.value.split('\n')
  const spans = lines.map((line, index) => `<tspan x="${number(layout.x)}" y="${number(layout.baselines[index])}">${xml(line)}</tspan>`).join('')
  return `${background}<text ${attrs}>${spans}</text>`
}

function renderNode(node: DiagramNode, links: ExportLinkAnnotation[]): string {
  const rotation = node.angle
    ? ` transform="rotate(${number(node.angle)} ${number(node.x + node.width / 2)} ${number(node.y + node.height / 2)})"`
    : ''
  const text = shapeRegistry.get(node.shape).body.markup === 'image' ? '' : renderText(node)
  const group = `<g data-cell-id="${xml(node.id)}"${rotation}>${nodeBody(node)}${text}</g>`
  if (!safeLink(node.link)) return group
  links.push({ url: node.link, xPt: node.x, yPt: node.y, widthPt: node.width, heightPt: node.height })
  return `<a href="${xml(node.link)}">${group}</a>`
}

function renderEdge(page: DiagramPage, edge: DiagramEdge, links: ExportLinkAnnotation[]): string {
  const geometry = buildEdgeGeometry(page, edge)
  const dash = dashArrays[edge.style.dash]
  const markers = `${edge.style.sourceArrow === 'arrow' ? ' marker-start="url(#arrow-start)"' : ''}${edge.style.targetArrow === 'arrow' ? ' marker-end="url(#arrow-end)"' : ''}`
  const path = `<path d="${geometry.path}" fill="none" stroke="${xml(edge.style.stroke)}" stroke-width="${number(edge.style.strokeWidth)}" opacity="${number(edge.style.opacity)}"${dash ? ` stroke-dasharray="${dash}"` : ''}${markers}/>`
  const labels = edge.labels.map((label) => {
    const point = geometry.pointAt(label.position)
    const syntheticNode: DiagramNode = {
      id: `${edge.id}-label`, shape: 'text', x: point.x - 50, y: point.y - 20,
      width: 100, height: 40, angle: 0, zIndex: edge.zIndex, text: label.text,
      style: { fill: '#ffffff', fillOpacity: 0, stroke: '#000000', strokeWidth: 0 },
    }
    return renderText(syntheticNode)
  }).join('')
  const group = `<g data-cell-id="${xml(edge.id)}">${path}${labels}</g>`
  if (!safeLink(edge.link)) return group
  const points = geometry.points
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
  const content = resolvePageBackgroundChain(document, page.id)
    .map((layer) => renderCells(layer, links))
    .join('')
  const width = number(page.pageSize.width)
  const height = number(page.pageSize.height)
  const defs = '<defs><marker id="arrow-end" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke"/></marker><marker id="arrow-start" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse"><path d="M8 0 L0 4 L8 8 Z" fill="context-stroke"/></marker></defs>'
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}">${defs}<rect width="100%" height="100%" fill="${xml(page.canvas.background)}"/>${content}</svg>`,
    links,
  }
}

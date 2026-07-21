import '@/application/shapes/common-shapes'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import type { DiagramEdge, DiagramPage } from '@/domain/diagram'

export interface EdgePoint { x: number; y: number }

export interface EdgeGeometry {
  path: string
  points: EdgePoint[]
  pointAt(position: number): EdgePoint
}

function number(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`
}

export function resolveEdgeEndpoint(
  page: DiagramPage,
  endpoint: DiagramEdge['source'],
): EdgePoint {
  const node = page.nodes.find(({ id }) => id === endpoint.nodeId)
  if (!node) return { x: 0, y: 0 }
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
  const port = endpoint.port
    ? shapeRegistry.get(node.shape).ports.find(({ id }) => id === endpoint.port)
    : undefined
  if (!port) return center
  if (port.position === 'top') return { x: center.x, y: node.y }
  if (port.position === 'right') return { x: node.x + node.width, y: center.y }
  if (port.position === 'bottom') return { x: center.x, y: node.y + node.height }
  return { x: node.x, y: center.y }
}

function samePoint(left: EdgePoint, right: EdgePoint): boolean {
  return left.x === right.x && left.y === right.y
}

function orthogonalPoints(anchors: EdgePoint[]): EdgePoint[] {
  const routed = [anchors[0]]
  for (const anchor of anchors.slice(1)) {
    const previous = routed.at(-1)!
    if (previous.x !== anchor.x && previous.y !== anchor.y) {
      routed.push({ x: anchor.x, y: previous.y })
    }
    if (!samePoint(routed.at(-1)!, anchor)) routed.push(anchor)
  }
  return routed
}

function pointAlong(points: EdgePoint[], position: number): EdgePoint {
  const normalized = Math.min(1, Math.max(0, position))
  if (normalized === 0) return { ...points[0] }
  if (normalized === 1) return { ...points.at(-1)! }
  const segments = points.slice(1).map((point, index) => ({
    start: points[index],
    end: point,
    length: Math.hypot(point.x - points[index].x, point.y - points[index].y),
  }))
  const total = segments.reduce((sum, segment) => sum + segment.length, 0)
  if (total === 0) return { ...points[0] }
  const target = total * normalized
  let traversed = 0
  for (const segment of segments) {
    if (traversed + segment.length >= target) {
      const ratio = segment.length === 0 ? 0 : (target - traversed) / segment.length
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      }
    }
    traversed += segment.length
  }
  return { ...points.at(-1)! }
}

function cubicPoint(start: EdgePoint, first: EdgePoint, second: EdgePoint, end: EdgePoint, t: number): EdgePoint {
  const inverse = 1 - t
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * first.x + 3 * inverse * t ** 2 * second.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * first.y + 3 * inverse * t ** 2 * second.y + t ** 3 * end.y,
  }
}

function curveControls(start: EdgePoint, end: EdgePoint, vertices: EdgePoint[]): [EdgePoint, EdgePoint] {
  if (vertices.length >= 2) return [vertices[0], vertices.at(-1)!]
  if (vertices.length === 1) {
    const control = vertices[0]
    return [
      { x: start.x + (control.x - start.x) * 2 / 3, y: start.y + (control.y - start.y) * 2 / 3 },
      { x: end.x + (control.x - end.x) * 2 / 3, y: end.y + (control.y - end.y) * 2 / 3 },
    ]
  }
  return [
    { x: start.x + (end.x - start.x) / 3, y: start.y },
    { x: start.x + (end.x - start.x) * 2 / 3, y: end.y },
  ]
}

export function buildEdgeGeometry(page: DiagramPage, edge: DiagramEdge): EdgeGeometry {
  const start = resolveEdgeEndpoint(page, edge.source)
  const end = resolveEdgeEndpoint(page, edge.target)
  const anchors = [start, ...edge.vertices, end]
  if (edge.connector === 'curved') {
    const [first, second] = curveControls(start, end, edge.vertices)
    const points = Array.from({ length: 101 }, (_, index) => cubicPoint(start, first, second, end, index / 100))
    return {
      path: `M ${number(start.x)} ${number(start.y)} C ${number(first.x)} ${number(first.y)} ${number(second.x)} ${number(second.y)} ${number(end.x)} ${number(end.y)}`,
      points,
      pointAt: (position) => pointAlong(points, position),
    }
  }
  const points = edge.connector === 'orthogonal' ? orthogonalPoints(anchors) : anchors
  const commands = points.slice(1).map((point, index) => {
    const previous = points[index]
    if (edge.connector === 'orthogonal') {
      return previous.y === point.y ? `H ${number(point.x)}` : `V ${number(point.y)}`
    }
    return `L ${number(point.x)} ${number(point.y)}`
  })
  return {
    path: `M ${number(start.x)} ${number(start.y)}${commands.length ? ` ${commands.join(' ')}` : ''}`,
    points,
    pointAt: (position) => pointAlong(points, position),
  }
}

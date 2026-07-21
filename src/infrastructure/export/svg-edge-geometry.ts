import '@/application/shapes/common-shapes'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import type { DiagramEdge, DiagramNode, DiagramPage } from '@/domain/diagram'

export interface EdgePoint { x: number; y: number }

export interface EdgeGeometry {
  path: string
  points: EdgePoint[]
  pointAt(position: number): EdgePoint
}

interface EdgeTerminal {
  point: EdgePoint
  direction?: EdgePoint
  node?: DiagramNode
}

const ORTHOGONAL_STUB = 12
const CURVE_SAMPLES_PER_SEGMENT = 32

function number(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`
}

function clean(value: number): number {
  if (Math.abs(value) < 1e-9) return 0
  const rounded = Math.round(value)
  return Math.abs(value - rounded) < 1e-9 ? rounded : value
}

function rotate(point: EdgePoint, center: EdgePoint, angle: number): EdgePoint {
  const radians = angle * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const x = point.x - center.x
  const y = point.y - center.y
  return {
    x: clean(center.x + x * cosine - y * sine),
    y: clean(center.y + x * sine + y * cosine),
  }
}

function cardinalDirection(direction: EdgePoint): EdgePoint {
  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return { x: direction.x < 0 ? -1 : 1, y: 0 }
  }
  return { x: 0, y: direction.y < 0 ? -1 : 1 }
}

function resolveEdgeTerminal(page: DiagramPage, endpoint: DiagramEdge['source']): EdgeTerminal {
  const node = page.nodes.find(({ id }) => id === endpoint.nodeId)
  if (!node) return { point: { x: 0, y: 0 } }
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
  const port = endpoint.port
    ? shapeRegistry.get(node.shape).ports.find(({ id }) => id === endpoint.port)
    : undefined
  if (!port) return { point: center, node }

  const unrotated = {
    top: { point: { x: center.x, y: node.y }, direction: { x: 0, y: -1 } },
    right: { point: { x: node.x + node.width, y: center.y }, direction: { x: 1, y: 0 } },
    bottom: { point: { x: center.x, y: node.y + node.height }, direction: { x: 0, y: 1 } },
    left: { point: { x: node.x, y: center.y }, direction: { x: -1, y: 0 } },
  }[port.position]
  const point = rotate(unrotated.point, center, node.angle)
  const rotatedDirection = rotate({
    x: center.x + unrotated.direction.x,
    y: center.y + unrotated.direction.y,
  }, center, node.angle)

  return {
    point,
    direction: cardinalDirection({
      x: rotatedDirection.x - center.x,
      y: rotatedDirection.y - center.y,
    }),
    node,
  }
}

export function resolveEdgeEndpoint(
  page: DiagramPage,
  endpoint: DiagramEdge['source'],
): EdgePoint {
  return resolveEdgeTerminal(page, endpoint).point
}

function samePoint(left: EdgePoint, right: EdgePoint): boolean {
  return left.x === right.x && left.y === right.y
}

function appendPoint(points: EdgePoint[], point: EdgePoint): void {
  if (!samePoint(points.at(-1)!, point)) points.push(point)
}

function orthogonalize(anchors: EdgePoint[]): EdgePoint[] {
  const routed = [anchors[0]]
  for (const anchor of anchors.slice(1)) {
    const previous = routed.at(-1)!
    if (previous.x !== anchor.x && previous.y !== anchor.y) {
      appendPoint(routed, { x: anchor.x, y: previous.y })
    }
    appendPoint(routed, anchor)
  }
  return routed
}

function rotatedBounds(node: DiagramNode): { left: number; right: number; top: number; bottom: number } {
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
  const corners = [
    { x: node.x, y: node.y },
    { x: node.x + node.width, y: node.y },
    { x: node.x + node.width, y: node.y + node.height },
    { x: node.x, y: node.y + node.height },
  ].map((corner) => rotate(corner, center, node.angle))
  return {
    left: Math.min(...corners.map(({ x }) => x)),
    right: Math.max(...corners.map(({ x }) => x)),
    top: Math.min(...corners.map(({ y }) => y)),
    bottom: Math.max(...corners.map(({ y }) => y)),
  }
}

function automaticOrthogonalPoints(source: EdgeTerminal, target: EdgeTerminal): EdgePoint[] {
  const sourceDirection = source.direction!
  const targetDirection = target.direction!
  const sourceStub = {
    x: source.point.x + sourceDirection.x * ORTHOGONAL_STUB,
    y: source.point.y + sourceDirection.y * ORTHOGONAL_STUB,
  }
  const targetStub = {
    x: target.point.x + targetDirection.x * ORTHOGONAL_STUB,
    y: target.point.y + targetDirection.y * ORTHOGONAL_STUB,
  }
  const points = [source.point, sourceStub]
  const perpendicular = (sourceDirection.x !== 0) !== (targetDirection.x !== 0)
  const opposite = sourceDirection.x === -targetDirection.x && sourceDirection.y === -targetDirection.y

  if (perpendicular) {
    appendPoint(points, sourceDirection.x !== 0
      ? { x: targetStub.x, y: sourceStub.y }
      : { x: sourceStub.x, y: targetStub.y })
  } else if (opposite) {
    const forwardGap = sourceDirection.x !== 0
      ? (targetStub.x - sourceStub.x) * sourceDirection.x >= 0
      : (targetStub.y - sourceStub.y) * sourceDirection.y >= 0
    if (forwardGap) {
      if (sourceDirection.x !== 0) {
        const middle = (sourceStub.x + targetStub.x) / 2
        appendPoint(points, { x: middle, y: sourceStub.y })
        appendPoint(points, { x: middle, y: targetStub.y })
      } else {
        const middle = (sourceStub.y + targetStub.y) / 2
        appendPoint(points, { x: sourceStub.x, y: middle })
        appendPoint(points, { x: targetStub.x, y: middle })
      }
    } else {
      const sourceBox = rotatedBounds(source.node!)
      const targetBox = rotatedBounds(target.node!)
      if (sourceDirection.x !== 0) {
        const outside = Math.min(sourceBox.top, targetBox.top) - ORTHOGONAL_STUB
        appendPoint(points, { x: sourceStub.x, y: outside })
        appendPoint(points, { x: targetStub.x, y: outside })
      } else {
        const outside = Math.max(sourceBox.right, targetBox.right) + ORTHOGONAL_STUB
        appendPoint(points, { x: outside, y: sourceStub.y })
        appendPoint(points, { x: outside, y: targetStub.y })
      }
    }
  } else {
    const sourceBox = rotatedBounds(source.node!)
    const targetBox = rotatedBounds(target.node!)
    if (sourceDirection.x !== 0) {
      const outside = sourceDirection.x > 0
        ? Math.max(sourceBox.right, targetBox.right) + ORTHOGONAL_STUB
        : Math.min(sourceBox.left, targetBox.left) - ORTHOGONAL_STUB
      appendPoint(points, { x: outside, y: sourceStub.y })
      appendPoint(points, { x: outside, y: targetStub.y })
    } else {
      const outside = sourceDirection.y > 0
        ? Math.max(sourceBox.bottom, targetBox.bottom) + ORTHOGONAL_STUB
        : Math.min(sourceBox.top, targetBox.top) - ORTHOGONAL_STUB
      appendPoint(points, { x: sourceStub.x, y: outside })
      appendPoint(points, { x: targetStub.x, y: outside })
    }
  }

  appendPoint(points, targetStub)
  appendPoint(points, target.point)
  return points
}

function orthogonalPoints(source: EdgeTerminal, target: EdgeTerminal, vertices: EdgePoint[]): EdgePoint[] {
  if (vertices.length === 0 && source.direction && target.direction && source.node && target.node) {
    return automaticOrthogonalPoints(source, target)
  }
  const anchors = [source.point]
  if (source.direction) anchors.push({
    x: source.point.x + source.direction.x * ORTHOGONAL_STUB,
    y: source.point.y + source.direction.y * ORTHOGONAL_STUB,
  })
  anchors.push(...vertices)
  if (target.direction) anchors.push({
    x: target.point.x + target.direction.x * ORTHOGONAL_STUB,
    y: target.point.y + target.direction.y * ORTHOGONAL_STUB,
  })
  anchors.push(target.point)
  return orthogonalize(anchors)
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

function curvedGeometry(anchors: EdgePoint[]): EdgeGeometry {
  const commands: string[] = []
  const sampled = [anchors[0]]
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const previous = anchors[Math.max(0, index - 1)]
    const start = anchors[index]
    const end = anchors[index + 1]
    const next = anchors[Math.min(anchors.length - 1, index + 2)]
    const first = {
      x: start.x + (end.x - previous.x) / 6,
      y: start.y + (end.y - previous.y) / 6,
    }
    const second = {
      x: end.x - (next.x - start.x) / 6,
      y: end.y - (next.y - start.y) / 6,
    }
    commands.push(`C ${number(first.x)} ${number(first.y)} ${number(second.x)} ${number(second.y)} ${number(end.x)} ${number(end.y)}`)
    for (let sample = 1; sample <= CURVE_SAMPLES_PER_SEGMENT; sample += 1) {
      sampled.push(cubicPoint(start, first, second, end, sample / CURVE_SAMPLES_PER_SEGMENT))
    }
  }
  return {
    path: `M ${number(anchors[0].x)} ${number(anchors[0].y)} ${commands.join(' ')}`,
    points: sampled,
    pointAt: (position) => pointAlong(sampled, position),
  }
}

export function buildEdgeGeometry(page: DiagramPage, edge: DiagramEdge): EdgeGeometry {
  const source = resolveEdgeTerminal(page, edge.source)
  const target = resolveEdgeTerminal(page, edge.target)
  if (edge.connector === 'curved') {
    return curvedGeometry([source.point, ...edge.vertices, target.point])
  }
  const points = edge.connector === 'orthogonal'
    ? orthogonalPoints(source, target, edge.vertices)
    : [source.point, ...edge.vertices, target.point]
  const commands = points.slice(1).map((point, index) => {
    const previous = points[index]
    if (edge.connector === 'orthogonal') {
      return previous.y === point.y ? `H ${number(point.x)}` : `V ${number(point.y)}`
    }
    return `L ${number(point.x)} ${number(point.y)}`
  })
  return {
    path: `M ${number(source.point.x)} ${number(source.point.y)}${commands.length ? ` ${commands.join(' ')}` : ''}`,
    points,
    pointAt: (position) => pointAlong(points, position),
  }
}

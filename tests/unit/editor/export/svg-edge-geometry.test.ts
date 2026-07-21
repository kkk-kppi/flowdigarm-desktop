import { createEmptyPage } from '@/domain/diagram'
import {
  buildEdgeGeometry,
  resolveEdgeEndpoint,
} from '@/infrastructure/export/svg-edge-geometry'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

const page = createEmptyPage({
  id: 'page',
  nodes: [
    createTestNode({ id: 'a', x: 10, y: 20, width: 80, height: 40 }),
    createTestNode({ id: 'b', x: 210, y: 110, width: 80, height: 40 }),
  ],
})

describe('SVG edge geometry', () => {
  it('resolves all port midpoints and falls back to the node center for absent or invalid ports', () => {
    expect(resolveEdgeEndpoint(page, { nodeId: 'a', port: 'top' })).toEqual({ x: 50, y: 20 })
    expect(resolveEdgeEndpoint(page, { nodeId: 'a', port: 'right' })).toEqual({ x: 90, y: 40 })
    expect(resolveEdgeEndpoint(page, { nodeId: 'a', port: 'bottom' })).toEqual({ x: 50, y: 60 })
    expect(resolveEdgeEndpoint(page, { nodeId: 'a', port: 'left' })).toEqual({ x: 10, y: 40 })
    expect(resolveEdgeEndpoint(page, { nodeId: 'a' })).toEqual({ x: 50, y: 40 })
    expect(resolveEdgeEndpoint(page, { nodeId: 'a', port: 'missing' })).toEqual({ x: 50, y: 40 })
  })

  it.each([
    ['right', 'left', { x: 12, y: 0 }, { x: -12, y: 0 }],
    ['left', 'right', { x: -12, y: 0 }, { x: 12, y: 0 }],
    ['top', 'bottom', { x: 0, y: -12 }, { x: 0, y: 12 }],
    ['bottom', 'top', { x: 0, y: 12 }, { x: 0, y: -12 }],
    ['right', 'top', { x: 12, y: 0 }, { x: 0, y: -12 }],
    ['top', 'left', { x: 0, y: -12 }, { x: -12, y: 0 }],
  ] as const)('routes %s to %s with outward stubs and an inward terminal approach', (sourcePort, targetPort, sourceDelta, targetDelta) => {
    const geometry = buildEdgeGeometry(page, createTestEdge({
      id: `${sourcePort}-${targetPort}`,
      source: { nodeId: 'a', port: sourcePort }, target: { nodeId: 'b', port: targetPort },
      connector: 'orthogonal', vertices: [],
    }))
    const source = resolveEdgeEndpoint(page, { nodeId: 'a', port: sourcePort })
    const target = resolveEdgeEndpoint(page, { nodeId: 'b', port: targetPort })

    expect(geometry.points[1]).toEqual({ x: source.x + sourceDelta.x, y: source.y + sourceDelta.y })
    expect(geometry.points.at(-2)).toEqual({ x: target.x + targetDelta.x, y: target.y + targetDelta.y })
    expect(geometry.points.every((point, index) => index === 0
      || point.x === geometry.points[index - 1].x
      || point.y === geometry.points[index - 1].y)).toBe(true)
    expect(geometry.path).not.toMatch(/\bL\b/)
  })

  it('orthogonalizes every manual leg while retaining every vertex', () => {
    const vertices = [{ x: 130, y: 10 }, { x: 155, y: 95 }, { x: 180, y: 65 }]
    const geometry = buildEdgeGeometry(page, createTestEdge({
      id: 'manual', source: { nodeId: 'a', port: 'right' }, target: { nodeId: 'b', port: 'left' },
      connector: 'orthogonal', vertices,
    }))

    for (const vertex of vertices) expect(geometry.points).toContainEqual(vertex)
    expect(geometry.points.every((point, index) => index === 0
      || point.x === geometry.points[index - 1].x
      || point.y === geometry.points[index - 1].y)).toBe(true)
  })

  it('builds a sampled cubic segment through every vertex and moves the label point', () => {
    const curvePage = createEmptyPage({
      id: 'curve',
      nodes: [
        createTestNode({ id: 'a', x: -5, y: -5, width: 10, height: 10 }),
        createTestNode({ id: 'b', x: 95, y: -5, width: 10, height: 10 }),
      ],
    })
    const geometry = buildEdgeGeometry(curvePage, createTestEdge({
      id: 'curve', connector: 'curved',
      source: { nodeId: 'a' }, target: { nodeId: 'b' },
      vertices: [{ x: 0, y: 100 }, { x: 50, y: -100 }, { x: 100, y: 100 }],
    }))

    expect(geometry.path.match(/\bC\b/g)).toHaveLength(4)
    expect(geometry.path).toMatch(/C [^C]+ 0 100 C [^C]+ 50 -100 C [^C]+ 100 100 C /)
    expect(geometry.points).toContainEqual({ x: 0, y: 100 })
    expect(geometry.points).toContainEqual({ x: 50, y: -100 })
    expect(geometry.points).toContainEqual({ x: 100, y: 100 })
    expect(geometry.pointAt(0)).toEqual({ x: 0, y: 0 })
    expect(geometry.pointAt(0.5).x).toBeCloseTo(50, 1)
    expect(geometry.pointAt(0.5).y).toBeCloseTo(-100, 1)
    expect(geometry.pointAt(0.5).y).not.toBeCloseTo(75, 1)
    expect(geometry.pointAt(1)).toEqual({ x: 100, y: 0 })
  })

  it('rotates port endpoints and orthogonal terminal directions with the node body', () => {
    const rotatedPage = createEmptyPage({
      id: 'rotated',
      nodes: [
        createTestNode({ id: 'a', x: 10, y: 20, width: 80, height: 40, angle: 90 }),
        createTestNode({ id: 'b', x: 210, y: 110, width: 80, height: 40, angle: 180 }),
      ],
    })

    expect(resolveEdgeEndpoint(rotatedPage, { nodeId: 'a', port: 'top' })).toEqual({ x: 70, y: 40 })
    expect(resolveEdgeEndpoint(rotatedPage, { nodeId: 'a', port: 'right' })).toEqual({ x: 50, y: 80 })
    expect(resolveEdgeEndpoint(rotatedPage, { nodeId: 'b', port: 'left' })).toEqual({ x: 290, y: 130 })
    const geometry = buildEdgeGeometry(rotatedPage, createTestEdge({
      id: 'rotated-edge', source: { nodeId: 'a', port: 'right' }, target: { nodeId: 'b', port: 'left' },
      connector: 'orthogonal', vertices: [],
    }))
    expect(geometry.points.slice(0, 2)).toEqual([{ x: 50, y: 80 }, { x: 50, y: 92 }])
    expect(geometry.points.slice(-2)).toEqual([{ x: 302, y: 130 }, { x: 290, y: 130 }])
  })

  it('measures polyline positions by routed arc length rather than endpoint interpolation', () => {
    const linePage = createEmptyPage({
      id: 'line',
      nodes: [
        createTestNode({ id: 'a', x: -5, y: -5, width: 10, height: 10 }),
        createTestNode({ id: 'b', x: 95, y: 95, width: 10, height: 10 }),
      ],
    })
    const geometry = buildEdgeGeometry(linePage, createTestEdge({
      id: 'line', connector: 'straight',
      source: { nodeId: 'a' }, target: { nodeId: 'b' },
      vertices: [{ x: 100, y: 0 }],
    }))

    expect(geometry.pointAt(0)).toEqual({ x: 0, y: 0 })
    expect(geometry.pointAt(0.5)).toEqual({ x: 100, y: 0 })
    expect(geometry.pointAt(1)).toEqual({ x: 100, y: 100 })
  })
})

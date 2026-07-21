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

  it('uses deterministic horizontal-first H/V segments and retains manual vertices', () => {
    const automatic = buildEdgeGeometry(page, createTestEdge({
      id: 'auto', source: { nodeId: 'a', port: 'right' }, target: { nodeId: 'b', port: 'left' },
      connector: 'orthogonal', vertices: [],
    }))
    expect(automatic.path).toBe('M 90 40 H 210 V 130')

    const manual = buildEdgeGeometry(page, createTestEdge({
      id: 'manual', source: { nodeId: 'a', port: 'right' }, target: { nodeId: 'b', port: 'left' },
      connector: 'orthogonal', vertices: [{ x: 140, y: 80 }],
    }))
    expect(manual.path).toBe('M 90 40 H 140 V 80 H 210 V 130')
    expect(manual.points).toContainEqual({ x: 140, y: 80 })
  })

  it('uses cubic controls and measures positions along the sampled curve', () => {
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
      vertices: [{ x: 0, y: 100 }, { x: 100, y: 100 }],
    }))

    expect(geometry.path).toBe('M 0 0 C 0 100 100 100 100 0')
    expect(geometry.pointAt(0)).toEqual({ x: 0, y: 0 })
    expect(geometry.pointAt(0.5).x).toBeCloseTo(50, 1)
    expect(geometry.pointAt(0.5).y).toBeCloseTo(75, 1)
    expect(geometry.pointAt(1)).toEqual({ x: 100, y: 0 })
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

import {
  CURRENT_SCHEMA_VERSION,
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createDefaultTextContent,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
} from '@/domain/diagram'

const NODE_COUNT = 500
const EDGE_COUNT = 800
const COLUMN_COUNT = 25

function stableId(kind: 'document' | 'page' | 'node' | 'edge', index = 0): string {
  const kindCode = { document: 'd', page: 'a', node: 'b', edge: 'e' }[kind]
  return `00000000-0000-4000-8000-${kindCode}${index.toString().padStart(11, '0')}`
}

export function createBenchmarkDocument(): DiagramDocument {
  const nodes: DiagramNode[] = Array.from({ length: NODE_COUNT }, (_, index) => ({
    id: stableId('node', index + 1),
    shape: 'rect',
    x: 30 + (index % COLUMN_COUNT) * 90,
    y: 30 + Math.floor(index / COLUMN_COUNT) * 100,
    width: 64,
    height: 40,
    angle: 0,
    zIndex: index,
    text: createDefaultTextContent(`性能节点 ${index + 1}`),
    style: createDefaultNodeStyle(),
  }))

  const edges: DiagramEdge[] = Array.from({ length: EDGE_COUNT }, (_, index) => {
    const sourceIndex = index % NODE_COUNT
    const targetIndex = index < NODE_COUNT
      ? (sourceIndex + 1) % NODE_COUNT
      : (sourceIndex + COLUMN_COUNT) % NODE_COUNT
    return {
      id: stableId('edge', index + 1),
      source: { nodeId: nodes[sourceIndex].id, port: 'right' },
      target: { nodeId: nodes[targetIndex].id, port: 'left' },
      connector: 'orthogonal',
      vertices: [],
      labels: [],
      style: createDefaultEdgeStyle(),
      zIndex: index - EDGE_COUNT,
    }
  })

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: stableId('document'),
    name: '500 节点性能基准',
    pages: [{
      id: stableId('page'),
      name: '性能页面',
      type: 'foreground',
      unit: 'mm',
      pageSize: { preset: 'custom', width: 2300, height: 2000 },
      orientation: 'landscape',
      defaultConnector: 'orthogonal',
      defaultArrow: 'single',
      autoConnectLabel: true,
      showLineJumps: false,
      canvas: { gridSize: 10, background: '#FFFFFF' },
      nodes,
      edges,
    }],
  }
}

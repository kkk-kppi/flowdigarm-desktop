// tests/helpers/test-document.ts
// 命令层测试辅助：固定 id 的中文测试文档（一页、三节点、两条边）。
import {
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createDefaultTextContent,
  createEmptyDocument,
  createEmptyPage,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
} from '@/domain/diagram'

export function createTestNode(partial: Partial<DiagramNode> & { id: string }): DiagramNode {
  return {
    shape: 'rect',
    x: 0,
    y: 0,
    width: 80,
    height: 40,
    angle: 0,
    zIndex: 0,
    style: createDefaultNodeStyle(),
    ...partial,
  }
}

export function createTestEdge(partial: Partial<DiagramEdge> & { id: string }): DiagramEdge {
  return {
    source: { nodeId: 'node-1' },
    target: { nodeId: 'node-2' },
    connector: 'orthogonal',
    vertices: [],
    labels: [],
    style: createDefaultEdgeStyle(),
    zIndex: 0,
    ...partial,
  }
}

export function createTestDocument(): DiagramDocument {
  const page = createEmptyPage({
    id: 'page-1',
    name: '流程页',
    nodes: [
      createTestNode({ id: 'node-1', x: 10, y: 20, text: createDefaultTextContent('开始') }),
      createTestNode({ id: 'node-2', x: 110, y: 20, text: createDefaultTextContent('处理数据') }),
      createTestNode({ id: 'node-3', x: 210, y: 20, text: createDefaultTextContent('结束') }),
    ],
    edges: [
      createTestEdge({ id: 'edge-1', source: { nodeId: 'node-1' }, target: { nodeId: 'node-2' } }),
      createTestEdge({ id: 'edge-2', source: { nodeId: 'node-2' }, target: { nodeId: 'node-3' } }),
    ],
  })
  const document = createEmptyDocument('测试流程图')
  return { ...document, id: 'doc-1', pages: [page] }
}

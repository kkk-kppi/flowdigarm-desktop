// tests/unit/editor/commands/reconnect-vertices.test.ts
// 重连/拐点命令：边端点 before/after 互换、拐点数组 before/after 互换，均可逆。
import { ReconnectEdgeCommand } from '@/application/commands/reconnect-edge'
import { UpdateEdgeVerticesCommand } from '@/application/commands/update-edge-vertices'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

function 测试文档(): DiagramDocument {
  return {
    ...createEmptyDocument('测试文档'),
    id: 'doc-1',
    pages: [
      createEmptyPage({
        id: 'page-1',
        name: '流程页',
        nodes: [
          createTestNode({ id: 'node-1' }),
          createTestNode({ id: 'node-2' }),
          createTestNode({ id: 'node-3' }),
        ],
        edges: [
          createTestEdge({
            id: 'edge-1',
            source: { nodeId: 'node-1', port: 'right' },
            target: { nodeId: 'node-2', port: 'left' },
            vertices: [{ x: 50, y: 60 }],
          }),
        ],
      }),
    ],
  }
}

describe('ReconnectEdgeCommand', () => {
  it('label 为「重新连接」', () => {
    const command = new ReconnectEdgeCommand({
      pageId: 'page-1',
      edgeId: 'edge-1',
      end: 'target',
      before: { nodeId: 'node-2', port: 'left' },
      after: { nodeId: 'node-3', port: 'top' },
    })
    expect(command.label).toBe('重新连接')
  })

  it('apply 重写指定端点为 after（含端口）', () => {
    const command = new ReconnectEdgeCommand({
      pageId: 'page-1',
      edgeId: 'edge-1',
      end: 'target',
      before: { nodeId: 'node-2', port: 'left' },
      after: { nodeId: 'node-3', port: 'top' },
    })
    const edge = command.apply(测试文档()).pages[0].edges[0]
    expect(edge.target).toEqual({ nodeId: 'node-3', port: 'top' })
    expect(edge.source).toEqual({ nodeId: 'node-1', port: 'right' })
  })

  it('revert 恢复 before；可改为不带端口的节点主体连接', () => {
    const command = new ReconnectEdgeCommand({
      pageId: 'page-1',
      edgeId: 'edge-1',
      end: 'source',
      before: { nodeId: 'node-1', port: 'right' },
      after: { nodeId: 'node-3' },
    })
    const doc = 测试文档()
    const reconnected = command.apply(doc)
    expect(reconnected.pages[0].edges[0].source).toEqual({ nodeId: 'node-3' })
    const restored = command.revert(reconnected)
    expect(restored.pages[0].edges[0].source).toEqual({ nodeId: 'node-1', port: 'right' })
  })

  it('目标边不存在时抛「命令目标不存在。」', () => {
    const command = new ReconnectEdgeCommand({
      pageId: 'page-1',
      edgeId: '幽灵边',
      end: 'target',
      before: { nodeId: 'node-2' },
      after: { nodeId: 'node-3' },
    })
    expect(() => command.apply(测试文档())).toThrow('命令目标不存在。')
  })
})

describe('UpdateEdgeVerticesCommand', () => {
  it('label 为「编辑拐点」', () => {
    const command = new UpdateEdgeVerticesCommand({
      pageId: 'page-1',
      edgeId: 'edge-1',
      before: [],
      after: [{ x: 1, y: 2 }],
    })
    expect(command.label).toBe('编辑拐点')
  })

  it('apply 写入 after 拐点数组，revert 恢复 before', () => {
    const command = new UpdateEdgeVerticesCommand({
      pageId: 'page-1',
      edgeId: 'edge-1',
      before: [{ x: 50, y: 60 }],
      after: [
        { x: 55, y: 66 },
        { x: 88, y: 99 },
      ],
    })
    const doc = 测试文档()
    const updated = command.apply(doc)
    expect(updated.pages[0].edges[0].vertices).toEqual([
      { x: 55, y: 66 },
      { x: 88, y: 99 },
    ])
    const restored = command.revert(updated)
    expect(restored.pages[0].edges[0].vertices).toEqual([{ x: 50, y: 60 }])
  })

  it('写入的拐点为深拷贝：调用方后续修改不影响文档', () => {
    const after = [{ x: 1, y: 2 }]
    const command = new UpdateEdgeVerticesCommand({
      pageId: 'page-1',
      edgeId: 'edge-1',
      before: [],
      after,
    })
    const updated = command.apply(测试文档())
    after[0].x = 999
    expect(updated.pages[0].edges[0].vertices[0].x).toBe(1)
  })

  it('目标边不存在时抛「命令目标不存在。」', () => {
    const command = new UpdateEdgeVerticesCommand({
      pageId: 'page-1',
      edgeId: '幽灵边',
      before: [],
      after: [],
    })
    expect(() => command.apply(测试文档())).toThrow('命令目标不存在。')
  })
})

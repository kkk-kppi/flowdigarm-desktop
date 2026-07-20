// tests/unit/editor/commands/delete-cells.test.ts
// 删除图元命令：工厂预计算完整删除集（指定节点 + 指定边 + 关联边）并深拷贝快照；
// apply 删除、revert 按原 zIndex 顺序完整恢复，反复 undo/redo 稳定。
import { createDeleteCellsCommand } from '@/application/commands/delete-cells'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

function 三节点文档(): DiagramDocument {
  return {
    ...createEmptyDocument('测试文档'),
    id: 'doc-1',
    pages: [
      createEmptyPage({
        id: 'page-1',
        name: '流程页',
        nodes: [
          createTestNode({ id: 'node-1', zIndex: 0 }),
          createTestNode({ id: 'node-2', zIndex: 1 }),
          createTestNode({ id: 'node-3', zIndex: 2 }),
          createTestNode({ id: 'node-4', zIndex: 3 }),
        ],
        edges: [
          createTestEdge({ id: 'edge-1', source: { nodeId: 'node-1' }, target: { nodeId: 'node-2' }, zIndex: 4 }),
          createTestEdge({ id: 'edge-2', source: { nodeId: 'node-2' }, target: { nodeId: 'node-3' }, zIndex: 5 }),
          createTestEdge({ id: 'edge-3', source: { nodeId: 'node-3' }, target: { nodeId: 'node-4' }, zIndex: 6 }),
        ],
      }),
    ],
  }
}

function 当前页(document: DiagramDocument) {
  return document.pages[0]
}

describe('createDeleteCellsCommand', () => {
  it('label 为「删除图元」', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), ['node-1'], [])
    expect(command.label).toBe('删除图元')
  })

  it('apply 删除指定节点并连带其全部关联边（详细设计 §10.3）', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), ['node-2'], [])
    const page = 当前页(command.apply(三节点文档()))
    expect(page.nodes.map((n) => n.id)).toEqual(['node-1', 'node-3', 'node-4'])
    // edge-1 与 edge-2 均连接 node-2，应一并删除；edge-3 保留
    expect(page.edges.map((e) => e.id)).toEqual(['edge-3'])
  })

  it('apply 同时删除指定边与指定节点（指定边不与节点相连也删除）', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), ['node-1'], ['edge-3'])
    const page = 当前页(command.apply(三节点文档()))
    expect(page.nodes.map((n) => n.id)).toEqual(['node-2', 'node-3', 'node-4'])
    expect(page.edges.map((e) => e.id)).toEqual(['edge-2'])
  })

  it('仅删除指定边时节点不受影响', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), [], ['edge-1', 'edge-3'])
    const page = 当前页(command.apply(三节点文档()))
    expect(page.nodes.map((n) => n.id)).toEqual(['node-1', 'node-2', 'node-3', 'node-4'])
    expect(page.edges.map((e) => e.id)).toEqual(['edge-2'])
  })

  it('部分 ID 不存在时删除存在的部分', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), ['node-1', '幽灵节点'], [])
    const page = 当前页(command.apply(三节点文档()))
    expect(page.nodes.map((n) => n.id)).toEqual(['node-2', 'node-3', 'node-4'])
    expect(page.edges.map((e) => e.id)).toEqual(['edge-2', 'edge-3'])
  })

  it('revert 按原 zIndex 顺序完整恢复节点与边', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), ['node-2'], ['edge-3'])
    const deleted = command.apply(三节点文档())
    const restored = command.revert(deleted)
    const page = 当前页(restored)
    expect(page.nodes.map((n) => n.id)).toEqual(['node-1', 'node-2', 'node-3', 'node-4'])
    expect(page.nodes.map((n) => n.zIndex)).toEqual([0, 1, 2, 3])
    expect(page.edges.map((e) => e.id)).toEqual(['edge-1', 'edge-2', 'edge-3'])
    expect(page.edges.map((e) => e.zIndex)).toEqual([4, 5, 6])
  })

  it('恢复的节点内容与删除前一致（深拷贝快照）', () => {
    const doc = 三节点文档()
    const command = createDeleteCellsCommand(当前页(doc), ['node-2'], [])
    const restored = command.revert(command.apply(doc))
    const 原节点 = 当前页(doc).nodes.find((n) => n.id === 'node-2')!
    const 恢复节点 = 当前页(restored).nodes.find((n) => n.id === 'node-2')!
    expect(恢复节点).toEqual(原节点)
    expect(恢复节点).not.toBe(原节点)
  })

  it('反复 undo/redo 稳定：快照不被 revert 污染', () => {
    const doc = 三节点文档()
    const command = createDeleteCellsCommand(当前页(doc), ['node-2'], [])
    const 第一次删除 = command.apply(doc)
    const 第一次恢复 = command.revert(第一次删除)
    const 第二次删除 = command.apply(第一次恢复)
    const 第二次恢复 = command.revert(第二次删除)
    expect(当前页(第二次删除).nodes.map((n) => n.id)).toEqual(当前页(第一次删除).nodes.map((n) => n.id))
    expect(当前页(第二次恢复).nodes).toEqual(当前页(doc).nodes)
    expect(当前页(第二次恢复).edges).toEqual(当前页(doc).edges)
  })

  it('apply 不修改入参文档（不可变）', () => {
    const doc = 三节点文档()
    const command = createDeleteCellsCommand(当前页(doc), ['node-2'], [])
    command.apply(doc)
    expect(当前页(doc).nodes).toHaveLength(4)
    expect(当前页(doc).edges).toHaveLength(3)
  })

  it('全部 ID 不存在时 apply 抛「命令目标不存在。」', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), ['幽灵节点'], ['幽灵边'])
    expect(() => command.apply(三节点文档())).toThrow('命令目标不存在。')
  })

  it('空 ID 列表时 apply 抛「命令目标不存在。」', () => {
    const command = createDeleteCellsCommand(当前页(三节点文档()), [], [])
    expect(() => command.apply(三节点文档())).toThrow('命令目标不存在。')
  })
})

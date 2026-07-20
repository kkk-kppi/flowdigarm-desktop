// tests/unit/editor/commands/create-cells.test.ts
// 创建图元命令：apply 追加节点/边、zIndex 取页面现有最大递增（自带 zIndex 尊重）、revert 删净。
import { CreateCellsCommand } from '@/application/commands/create-cells'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

function 单页文档(): DiagramDocument {
  return {
    ...createEmptyDocument('测试文档'),
    id: 'doc-1',
    pages: [
      createEmptyPage({
        id: 'page-1',
        name: '流程页',
        nodes: [createTestNode({ id: 'node-1', zIndex: 3 })],
        edges: [createTestEdge({ id: 'edge-1', zIndex: 5 })],
      }),
    ],
  }
}

describe('CreateCellsCommand', () => {
  it('apply 追加节点与边；不带 zIndex 时取页面现有最大并递增', () => {
    const command = new CreateCellsCommand({
      pageId: 'page-1',
      nodes: [
        { ...createTestNode({ id: 'node-新1' }), zIndex: undefined },
        { ...createTestNode({ id: 'node-新2' }), zIndex: undefined },
      ],
      edges: [{ ...createTestEdge({ id: 'edge-新1' }), zIndex: undefined }],
    })
    const next = command.apply(单页文档())
    const page = next.pages[0]
    expect(page.nodes.map((n) => n.id)).toEqual(['node-1', 'node-新1', 'node-新2'])
    expect(page.edges.map((e) => e.id)).toEqual(['edge-1', 'edge-新1'])
    // 页面现有最大 zIndex = 5（edge-1），依次递增
    expect(page.nodes[1].zIndex).toBe(6)
    expect(page.nodes[2].zIndex).toBe(7)
    expect(page.edges[1].zIndex).toBe(8)
  })

  it('节点自带 zIndex 时尊重原值，且不消耗递增序号', () => {
    const command = new CreateCellsCommand({
      pageId: 'page-1',
      nodes: [
        { ...createTestNode({ id: 'node-带' }), zIndex: 99 },
        { ...createTestNode({ id: 'node-不带' }), zIndex: undefined },
      ],
    })
    const page = command.apply(单页文档()).pages[0]
    expect(page.nodes.find((n) => n.id === 'node-带')?.zIndex).toBe(99)
    expect(page.nodes.find((n) => n.id === 'node-不带')?.zIndex).toBe(6)
  })

  it('空页面首个图元 zIndex 从 0 开始', () => {
    const doc: DiagramDocument = {
      ...createEmptyDocument('空文档'),
      id: 'doc-1',
      pages: [createEmptyPage({ id: 'page-1', name: '空白页' })],
    }
    const command = new CreateCellsCommand({
      pageId: 'page-1',
      nodes: [{ ...createTestNode({ id: 'node-首' }), zIndex: undefined }],
    })
    expect(command.apply(doc).pages[0].nodes[0].zIndex).toBe(0)
  })

  it('label 默认「创建图元」，可通过入参覆盖（如粘贴图元）', () => {
    const 默认命令 = new CreateCellsCommand({ pageId: 'page-1', nodes: [] })
    expect(默认命令.label).toBe('创建图元')
    const 粘贴命令 = new CreateCellsCommand({ pageId: 'page-1', nodes: [], label: '粘贴图元' })
    expect(粘贴命令.label).toBe('粘贴图元')
  })

  it('revert 删除这些 ID 的节点与边（删净）', () => {
    const command = new CreateCellsCommand({
      pageId: 'page-1',
      nodes: [{ ...createTestNode({ id: 'node-新' }), zIndex: undefined }],
      edges: [{ ...createTestEdge({ id: 'edge-新' }), zIndex: undefined }],
    })
    const created = command.apply(单页文档())
    const reverted = command.revert(created)
    expect(reverted.pages[0].nodes.map((n) => n.id)).toEqual(['node-1'])
    expect(reverted.pages[0].edges.map((e) => e.id)).toEqual(['edge-1'])
  })

  it('undo/redo 反复执行结果稳定', () => {
    const command = new CreateCellsCommand({
      pageId: 'page-1',
      nodes: [{ ...createTestNode({ id: 'node-新' }), zIndex: undefined }],
    })
    const doc = 单页文档()
    const created = command.apply(doc)
    const reverted = command.revert(created)
    const recreated = command.apply(reverted)
    expect(reverted.pages[0].nodes.map((n) => n.id)).toEqual(doc.pages[0].nodes.map((n) => n.id))
    expect(recreated.pages[0].nodes).toEqual(created.pages[0].nodes)
  })

  it('apply 不修改入参文档（不可变）', () => {
    const doc = 单页文档()
    const command = new CreateCellsCommand({
      pageId: 'page-1',
      nodes: [{ ...createTestNode({ id: 'node-新' }), zIndex: undefined }],
    })
    command.apply(doc)
    expect(doc.pages[0].nodes).toHaveLength(1)
  })

  it('目标页不存在时 apply 抛「命令目标不存在。」', () => {
    const command = new CreateCellsCommand({
      pageId: '不存在页',
      nodes: [{ ...createTestNode({ id: 'node-新' }), zIndex: undefined }],
    })
    expect(() => command.apply(单页文档())).toThrow('命令目标不存在。')
  })

  it('目标页不存在时 revert 抛「命令目标不存在。」', () => {
    const command = new CreateCellsCommand({
      pageId: '不存在页',
      nodes: [{ ...createTestNode({ id: 'node-新' }), zIndex: undefined }],
    })
    expect(() => command.revert(单页文档())).toThrow('命令目标不存在。')
  })
})

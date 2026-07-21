// tests/unit/editor/clipboard/clipboard-service.test.ts
// 应用内剪贴板：复制仅保留内部边（源与目标均在复制集内）、深拷贝；
// 粘贴生成全新 UUID、端点按旧→新映射重写、整体偏移 12pt×pasteIndex。
import { copyCells, createPasteCommand } from '@/application/clipboard/clipboard-service'
import { createEmptyPage, type DiagramPage } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

const UUID图案 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function 测试页(): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    name: '流程页',
    nodes: [
      createTestNode({ id: 'node-1', x: 10, y: 20, zIndex: 0 }),
      createTestNode({ id: 'node-2', x: 110, y: 20, zIndex: 1 }),
      createTestNode({ id: 'node-3', x: 210, y: 20, zIndex: 2 }),
    ],
    edges: [
      createTestEdge({
        id: 'edge-1',
        source: { nodeId: 'node-1', port: 'right' },
        target: { nodeId: 'node-2', port: 'left' },
        vertices: [{ x: 60, y: 40 }],
        zIndex: 3,
      }),
      createTestEdge({
        id: 'edge-2',
        source: { nodeId: 'node-2' },
        target: { nodeId: 'node-3' },
        zIndex: 4,
      }),
      createTestEdge({
        id: 'edge-3',
        source: { nodeId: 'node-1' },
        target: { nodeId: 'node-3' },
        zIndex: 5,
      }),
    ],
  })
}

describe('copyCells', () => {
  it('仅保留源与目标均在复制集内的边（内部边保留、外部边剔除）', () => {
    const payload = copyCells(测试页(), ['node-1', 'node-2'])
    expect(payload.nodes.map((n) => n.id)).toEqual(['node-1', 'node-2'])
    // edge-1 两端都在复制集 → 保留；edge-2/edge-3 触及未复制的 node-3 → 剔除
    expect(payload.edges.map((e) => e.id)).toEqual(['edge-1'])
  })

  it('选中的边若端点未全部选中也被剔除', () => {
    const payload = copyCells(测试页(), ['node-1', 'edge-2'])
    expect(payload.nodes.map((n) => n.id)).toEqual(['node-1'])
    expect(payload.edges).toEqual([])
  })

  it('空选择返回空 payload', () => {
    expect(copyCells(测试页(), [])).toEqual({ nodes: [], edges: [] })
  })

  it('payload 为深拷贝：修改 payload 不影响页面', () => {
    const page = 测试页()
    const payload = copyCells(page, ['node-1', 'node-2'])
    payload.nodes[0].x = 9999
    payload.edges[0].vertices[0].x = 9999
    expect(page.nodes[0].x).toBe(10)
    expect(page.edges[0].vertices[0].x).toBe(60)
  })

  it('drops a parent reference when its container is outside the copied node set', () => {
    const page = 测试页()
    page.nodes[0].parentId = 'node-3'
    expect(copyCells(page, ['node-1']).nodes[0].parentId).toBeUndefined()
    expect(page.nodes[0].parentId).toBe('node-3')
  })
})

describe('createPasteCommand', () => {
  it('label 为「粘贴图元」', () => {
    const payload = copyCells(测试页(), ['node-1'])
    expect(createPasteCommand(payload, 'page-1', 1).label).toBe('粘贴图元')
  })

  it('粘贴生成全部新 UUID，节点位置偏移 12pt×pasteIndex', () => {
    const page = 测试页()
    const payload = copyCells(page, ['node-1', 'node-2'])
    const next = createPasteCommand(payload, 'page-1', 1).apply({
      schemaVersion: 1,
      id: 'doc-1',
      name: '测试文档',
      pages: [page],
    })
    const 新节点 = next.pages[0].nodes.slice(3)
    expect(新节点).toHaveLength(2)
    for (const node of 新节点) {
      expect(node.id).toMatch(UUID图案)
      expect(['node-1', 'node-2', 'node-3']).not.toContain(node.id)
    }
    expect(新节点[0]).toMatchObject({ x: 10 + 12, y: 20 + 12 })
    expect(新节点[1]).toMatchObject({ x: 110 + 12, y: 20 + 12 })
    // 新图元落在页面现有最大 zIndex 之上（粘贴内容置顶）
    expect(新节点[0].zIndex).toBe(6)
    expect(新节点[1].zIndex).toBe(7)
  })

  it('边端点按旧→新 ID 映射重写，拐点同样偏移', () => {
    const page = 测试页()
    const payload = copyCells(page, ['node-1', 'node-2'])
    const next = createPasteCommand(payload, 'page-1', 1).apply({
      schemaVersion: 1,
      id: 'doc-1',
      name: '测试文档',
      pages: [page],
    })
    const 新边 = next.pages[0].edges[3]
    const 新节点Ids = next.pages[0].nodes.slice(3).map((n) => n.id)
    expect(新边.id).toMatch(UUID图案)
    expect(新边.id).not.toBe('edge-1')
    expect(新节点Ids).toContain(新边.source.nodeId)
    expect(新节点Ids).toContain(新边.target.nodeId)
    // 端口保留、拐点偏移 12pt
    expect(新边.source.port).toBe('right')
    expect(新边.target.port).toBe('left')
    expect(新边.vertices).toEqual([{ x: 60 + 12, y: 40 + 12 }])
  })

  it('pasteIndex 累计偏移：同一 payload 连续粘贴逐次 +12pt', () => {
    const page = 测试页()
    const payload = copyCells(page, ['node-1'])
    const doc = { schemaVersion: 1, id: 'doc-1', name: '测试文档', pages: [page] }
    const 第一次 = createPasteCommand(payload, 'page-1', 1).apply(doc)
    const 第二次 = createPasteCommand(payload, 'page-1', 2).apply(第一次)
    expect(第一次.pages[0].nodes[3]).toMatchObject({ x: 10 + 12, y: 20 + 12 })
    expect(第二次.pages[0].nodes[4]).toMatchObject({ x: 10 + 24, y: 20 + 24 })
  })

  it('空 payload 粘贴后页面不变', () => {
    const page = 测试页()
    const doc = { schemaVersion: 1, id: 'doc-1', name: '测试文档', pages: [page] }
    const next = createPasteCommand({ nodes: [], edges: [] }, 'page-1', 1).apply(doc)
    expect(next.pages[0].nodes).toHaveLength(3)
    expect(next.pages[0].edges).toHaveLength(3)
  })
})

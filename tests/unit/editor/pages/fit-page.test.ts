// tests/unit/editor/pages/fit-page.test.ts
// 自动调整页面大小：按本页全部图元（节点 bbox + 边顶点）外接矩形 + margin 重设 pageSize 与方向。
// before/after 由工厂 createFitPageCommand 在构造前读取当前页计算（空页返回 null，不入历史）。
import {
  computeContentBBox,
  createFitPageCommand,
} from '@/application/commands/fit-page-to-content'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

function documentOfPage(page: ReturnType<typeof createEmptyPage>): DiagramDocument {
  return { ...createEmptyDocument(), pages: [page] }
}

describe('computeContentBBox', () => {
  it('页面无图元时返回 null（调用方据此禁用入口、不产生命令）', () => {
    expect(computeContentBBox(createEmptyPage())).toBeNull()
  })

  it('边无顶点且无节点时也返回 null', () => {
    const page = createEmptyPage({
      nodes: [],
      edges: [createTestEdge({ id: 'e-1', vertices: [] })],
    })
    expect(computeContentBBox(page)).toBeNull()
  })

  it('返回全部节点与边顶点的最小外接矩形', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1', x: 10, y: 20, width: 80, height: 40 })],
      edges: [
        createTestEdge({
          id: 'e-1',
          vertices: [
            { x: -30, y: 90 },
            { x: 300, y: 5 },
          ],
        }),
      ],
    })
    expect(computeContentBBox(page)).toEqual({ x: -30, y: 5, width: 330, height: 85 })
  })
})

describe('createFitPageCommand', () => {
  it('两节点外接矩形 + 默认 36pt margin：期望宽高与横向方向', () => {
    const page = createEmptyPage({
      id: 'p-1',
      nodes: [
        createTestNode({ id: 'n-1', x: 10, y: 20, width: 80, height: 40 }),
        createTestNode({ id: 'n-2', x: 110, y: 20, width: 80, height: 40 }),
      ],
    })
    const command = createFitPageCommand(page)
    expect(command).not.toBeNull()
    expect(command?.label).toBe('自动调整页面大小')

    const document = documentOfPage(page)
    const next = command!.apply(document)
    // 外接矩形 180×40，margin 36pt × 2 → 252×112；宽 > 高 → 横向
    expect(next.pages[0].pageSize.width).toBe(252)
    expect(next.pages[0].pageSize.height).toBe(112)
    expect(next.pages[0].orientation).toBe('landscape')
    // 尺寸不再匹配 A4 预设 → 自定义
    expect(next.pages[0].pageSize.preset).toBe('custom')

    const reverted = command!.revert(next)
    expect(reverted.pages[0].pageSize).toEqual(page.pageSize)
    expect(reverted.pages[0].orientation).toBe(page.orientation)
  })

  it('内容高于宽时方向为纵向', () => {
    const page = createEmptyPage({
      id: 'p-1',
      nodes: [createTestNode({ id: 'n-1', x: 0, y: 0, width: 40, height: 200 })],
    })
    const command = createFitPageCommand(page)
    const next = command!.apply(documentOfPage(page))
    expect(next.pages[0].pageSize.width).toBe(112)
    expect(next.pages[0].pageSize.height).toBe(272)
    expect(next.pages[0].orientation).toBe('portrait')
  })

  it('自定义 margin 生效（margin=0 时页面尺寸即外接矩形）', () => {
    const page = createEmptyPage({
      id: 'p-1',
      nodes: [createTestNode({ id: 'n-1', x: 10, y: 20, width: 80, height: 40 })],
    })
    const command = createFitPageCommand(page, 0)
    const next = command!.apply(documentOfPage(page))
    expect(next.pages[0].pageSize.width).toBe(80)
    expect(next.pages[0].pageSize.height).toBe(40)
  })

  it('新尺寸仍匹配原预设时保留预设（不降级为自定义）', () => {
    // 构造内容使其外接矩形 + margin 恰好等于当前页（A4）尺寸
    const page = createEmptyPage({ id: 'p-1' })
    const margin = 36
    const width = page.pageSize.width - 2 * margin
    const height = page.pageSize.height - 2 * margin
    const filled = createEmptyPage({
      ...page,
      nodes: [createTestNode({ id: 'n-1', x: 0, y: 0, width, height })],
    })
    const command = createFitPageCommand(filled, margin)
    const next = command!.apply(documentOfPage(filled))
    expect(next.pages[0].pageSize.preset).toBe('a4')
    expect(next.pages[0].orientation).toBe('portrait')
  })

  it('页面无图元时返回 null', () => {
    expect(createFitPageCommand(createEmptyPage())).toBeNull()
  })
})

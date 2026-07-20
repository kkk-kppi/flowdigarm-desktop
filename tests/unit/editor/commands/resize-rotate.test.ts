// tests/unit/editor/commands/resize-rotate.test.ts
// 缩放/旋转图元命令：一次手势的全部图元合并为一条记录；旋转角度规范化 0≤a<360。
import { ResizeCellsCommand } from '@/application/commands/resize-cells'
import { RotateCellsCommand } from '@/application/commands/rotate-cells'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestNode } from '../../../helpers/test-document'

function 双节点文档(): DiagramDocument {
  return {
    ...createEmptyDocument('测试文档'),
    id: 'doc-1',
    pages: [
      createEmptyPage({
        id: 'page-1',
        name: '流程页',
        nodes: [
          createTestNode({ id: 'node-1', x: 10, y: 20, width: 80, height: 40, angle: 30 }),
          createTestNode({ id: 'node-2', x: 200, y: 100, width: 120, height: 72, angle: 0 }),
        ],
      }),
    ],
  }
}

describe('ResizeCellsCommand', () => {
  it('label 为「缩放图元」', () => {
    expect(new ResizeCellsCommand([]).label).toBe('缩放图元')
  })

  it('apply 批量写入 after 几何（一次手势一条记录）', () => {
    const command = new ResizeCellsCommand([
      {
        pageId: 'page-1',
        nodeId: 'node-1',
        before: { x: 10, y: 20, width: 80, height: 40 },
        after: { x: 10, y: 20, width: 160, height: 80 },
      },
      {
        pageId: 'page-2',
        nodeId: 'node-9',
        before: { x: 0, y: 0, width: 10, height: 10 },
        after: { x: 0, y: 0, width: 20, height: 20 },
      },
      {
        pageId: 'page-1',
        nodeId: 'node-2',
        before: { x: 200, y: 100, width: 120, height: 72 },
        after: { x: 190, y: 90, width: 140, height: 92 },
      },
    ])
    // page-2 不存在 → 抛错
    expect(() => command.apply(双节点文档())).toThrow('命令目标不存在。')

    const 有效命令 = new ResizeCellsCommand([
      {
        pageId: 'page-1',
        nodeId: 'node-1',
        before: { x: 10, y: 20, width: 80, height: 40 },
        after: { x: 10, y: 20, width: 160, height: 80 },
      },
      {
        pageId: 'page-1',
        nodeId: 'node-2',
        before: { x: 200, y: 100, width: 120, height: 72 },
        after: { x: 190, y: 90, width: 140, height: 92 },
      },
    ])
    const page = 有效命令.apply(双节点文档()).pages[0]
    expect(page.nodes[0]).toMatchObject({ x: 10, y: 20, width: 160, height: 80 })
    expect(page.nodes[1]).toMatchObject({ x: 190, y: 90, width: 140, height: 92 })
  })

  it('revert 恢复 before 几何；undo/redo 可逆', () => {
    const command = new ResizeCellsCommand([
      {
        pageId: 'page-1',
        nodeId: 'node-1',
        before: { x: 10, y: 20, width: 80, height: 40 },
        after: { x: 5, y: 10, width: 100, height: 60 },
      },
    ])
    const doc = 双节点文档()
    const resized = command.apply(doc)
    const restored = command.revert(resized)
    expect(restored.pages[0].nodes[0]).toMatchObject({ x: 10, y: 20, width: 80, height: 40 })
    expect(command.apply(restored).pages[0].nodes[0]).toMatchObject({ width: 100, height: 60 })
  })

  it('目标节点不存在时抛「命令目标不存在。」', () => {
    const command = new ResizeCellsCommand([
      {
        pageId: 'page-1',
        nodeId: '幽灵节点',
        before: { x: 0, y: 0, width: 1, height: 1 },
        after: { x: 0, y: 0, width: 2, height: 2 },
      },
    ])
    expect(() => command.apply(双节点文档())).toThrow('命令目标不存在。')
  })

  it('空 moves 不改变文档', () => {
    const doc = 双节点文档()
    expect(new ResizeCellsCommand([]).apply(doc)).toBe(doc)
  })

  it('构造时深拷贝入参：调用方后续修改 moves 及嵌套 before/after 不影响命令', () => {
    const moves = [
      {
        pageId: 'page-1',
        nodeId: 'node-1',
        before: { x: 10, y: 20, width: 80, height: 40 },
        after: { x: 10, y: 20, width: 160, height: 80 },
      },
    ]
    const command = new ResizeCellsCommand(moves)
    moves[0].before.x = -999
    moves[0].after.width = 9999
    moves.push({
      pageId: 'page-1',
      nodeId: 'node-2',
      before: { x: 0, y: 0, width: 1, height: 1 },
      after: { x: 0, y: 0, width: 2, height: 2 },
    })
    const page = command.apply(双节点文档()).pages[0]
    expect(page.nodes[0]).toMatchObject({ x: 10, y: 20, width: 160, height: 80 })
    expect(page.nodes[1]).toMatchObject({ x: 200, y: 100, width: 120, height: 72 })
  })
})

describe('RotateCellsCommand', () => {
  it('label 为「旋转图元」', () => {
    expect(new RotateCellsCommand([]).label).toBe('旋转图元')
  })

  it('apply 写入规范化后的 after 角度：370→10、-10→350', () => {
    const command = new RotateCellsCommand([
      { pageId: 'page-1', nodeId: 'node-1', before: 30, after: 370 },
      { pageId: 'page-1', nodeId: 'node-2', before: 0, after: -10 },
    ])
    const page = command.apply(双节点文档()).pages[0]
    expect(page.nodes[0].angle).toBe(10)
    expect(page.nodes[1].angle).toBe(350)
  })

  it('revert 恢复规范化后的 before 角度', () => {
    const command = new RotateCellsCommand([
      { pageId: 'page-1', nodeId: 'node-1', before: 390, after: 45 },
    ])
    const doc = 双节点文档()
    const rotated = command.apply(doc)
    expect(rotated.pages[0].nodes[0].angle).toBe(45)
    const restored = command.revert(rotated)
    expect(restored.pages[0].nodes[0].angle).toBe(30)
  })

  it('边界：360 规范化为 0；359.5 保持', () => {
    const command = new RotateCellsCommand([
      { pageId: 'page-1', nodeId: 'node-1', before: 0, after: 360 },
      { pageId: 'page-1', nodeId: 'node-2', before: 0, after: 359.5 },
    ])
    const page = command.apply(双节点文档()).pages[0]
    expect(page.nodes[0].angle).toBe(0)
    expect(page.nodes[1].angle).toBe(359.5)
  })

  it('目标节点不存在时抛「命令目标不存在。」；空 moves 不改变文档', () => {
    const doc = 双节点文档()
    const command = new RotateCellsCommand([
      { pageId: 'page-1', nodeId: '幽灵节点', before: 0, after: 90 },
    ])
    expect(() => command.apply(doc)).toThrow('命令目标不存在。')
    expect(new RotateCellsCommand([]).apply(doc)).toBe(doc)
  })

  it('构造时深拷贝入参：调用方后续修改 moves 不影响命令', () => {
    const moves = [{ pageId: 'page-1', nodeId: 'node-1', before: 30, after: 45 }]
    const command = new RotateCellsCommand(moves)
    moves[0].after = 999
    moves.push({ pageId: 'page-1', nodeId: 'node-2', before: 0, after: 180 })
    const page = command.apply(双节点文档()).pages[0]
    expect(page.nodes[0].angle).toBe(45)
    expect(page.nodes[1].angle).toBe(0)
  })
})

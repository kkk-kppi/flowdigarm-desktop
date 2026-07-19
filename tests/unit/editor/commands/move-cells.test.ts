// tests/unit/editor/commands/move-cells.test.ts
import { CommandHistory } from '@/application/commands/command-history'
import { MoveCellsCommand, type CellMove } from '@/application/commands/move-cells'
import type { DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

function nodePosition(document: DiagramDocument, nodeId: string): { x: number; y: number } {
  const node = document.pages[0].nodes.find((n) => n.id === nodeId)
  if (!node) throw new Error(`测试文档缺少节点 ${nodeId}`)
  return { x: node.x, y: node.y }
}

describe('移动图元命令', () => {
  it('3 节点一次拖拽记为一条命令；undo 全部恢复 before；redo 全部为 after', () => {
    const history = new CommandHistory()
    const document = createTestDocument()
    const beforeSize = history.size

    const moves: CellMove[] = [
      { pageId: 'page-1', nodeId: 'node-1', before: { x: 10, y: 20 }, after: { x: 15, y: 30 } },
      { pageId: 'page-1', nodeId: 'node-2', before: { x: 110, y: 20 }, after: { x: 115, y: 30 } },
      { pageId: 'page-1', nodeId: 'node-3', before: { x: 210, y: 20 }, after: { x: 215, y: 30 } },
    ]
    const moved = history.execute(new MoveCellsCommand(moves), document)

    expect(history.size).toBe(beforeSize + 1)
    expect(nodePosition(moved, 'node-1')).toEqual({ x: 15, y: 30 })
    expect(nodePosition(moved, 'node-2')).toEqual({ x: 115, y: 30 })
    expect(nodePosition(moved, 'node-3')).toEqual({ x: 215, y: 30 })

    const restored = history.undo(moved) as DiagramDocument
    expect(nodePosition(restored, 'node-1')).toEqual({ x: 10, y: 20 })
    expect(nodePosition(restored, 'node-2')).toEqual({ x: 110, y: 20 })
    expect(nodePosition(restored, 'node-3')).toEqual({ x: 210, y: 20 })

    const replayed = history.redo(restored) as DiagramDocument
    expect(nodePosition(replayed, 'node-1')).toEqual({ x: 15, y: 30 })
    expect(nodePosition(replayed, 'node-2')).toEqual({ x: 115, y: 30 })
    expect(nodePosition(replayed, 'node-3')).toEqual({ x: 215, y: 30 })
  })

  it('入参文档不被修改', () => {
    const document = createTestDocument()
    const command = new MoveCellsCommand([
      { pageId: 'page-1', nodeId: 'node-1', before: { x: 10, y: 20 }, after: { x: 99, y: 99 } },
    ])

    command.apply(document)

    expect(nodePosition(document, 'node-1')).toEqual({ x: 10, y: 20 })
  })

  it('目标不存在时抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const missingNode = new MoveCellsCommand([
      { pageId: 'page-1', nodeId: 'node-x', before: { x: 0, y: 0 }, after: { x: 1, y: 1 } },
    ])
    const missingPage = new MoveCellsCommand([
      { pageId: 'page-x', nodeId: 'node-1', before: { x: 0, y: 0 }, after: { x: 1, y: 1 } },
    ])

    expect(() => missingNode.apply(document)).toThrow('命令目标不存在。')
    expect(() => missingNode.revert(document)).toThrow('命令目标不存在。')
    expect(() => missingPage.apply(document)).toThrow('命令目标不存在。')
  })

  it('moves 为空时 apply/revert 原样返回文档', () => {
    const document = createTestDocument()
    const command = new MoveCellsCommand([])

    expect(command.apply(document)).toBe(document)
    expect(command.revert(document)).toBe(document)
  })

  it('label 为「移动图元」', () => {
    expect(new MoveCellsCommand([]).label).toBe('移动图元')
  })
})

import { absoluteNodePosition, snapGridPosition } from '@/infrastructure/x6/x6-absolute-position'
import { ResizeCellsCommand } from '@/application/commands/resize-cells'
import { createTestDocument } from '../../helpers/test-document'

interface FakeNode {
  position(): { x: number; y: number }
  getParent(): FakeNode | null
  isNode(): boolean
}

function node(x: number, y: number, parent: FakeNode | null = null): FakeNode {
  return { position: () => ({ x, y }), getParent: () => parent, isNode: () => true }
}

it('converts grouped X6 child positions to absolute coordinates for resize apply and undo', () => {
  const parent = node(100, 100)
  const childBefore = node(30, 40, parent)
  const childAfter = node(35, 45, parent)
  const document = createTestDocument()
  document.pages[0].nodes[0] = { ...document.pages[0].nodes[0], x: 130, y: 140, width: 80, height: 40, parentId: 'node-3' }
  const before = { ...absoluteNodePosition(childBefore), width: 80, height: 40 }
  const after = { ...absoluteNodePosition(childAfter), width: 90, height: 50 }
  const command = new ResizeCellsCommand([{ pageId: 'page-1', nodeId: 'node-1', before, after }])

  const resized = command.apply(document)
  expect(resized.pages[0].nodes[0]).toMatchObject({ x: 135, y: 145, width: 90, height: 50 })
  expect(command.revert(resized).pages[0].nodes[0]).toMatchObject({ x: 130, y: 140, width: 80, height: 40 })
})

it('returns snapped coordinates only while grid snapping is enabled', () => {
  expect(snapGridPosition({ x: 14, y: -6 }, true, 10)).toEqual({ x: 10, y: -10 })
  expect(snapGridPosition({ x: 14, y: -6 }, false, 10)).toEqual({ x: 14, y: -6 })
})

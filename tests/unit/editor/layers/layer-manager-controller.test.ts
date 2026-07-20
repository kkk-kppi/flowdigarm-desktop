import { LayerManagerController } from '@/application/layers/layer-manager-controller'
import { createEmptyPage } from '@/domain/diagram'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

describe('LayerManagerController', () => {
  it('lists the active page, executes z-order, and locates a cell across pages', () => {
    let document = createTestDocument()
    document.pages.push(createEmptyPage({
      id: 'page-2',
      nodes: [createTestNode({ id: 'other', zIndex: 8 })],
    }))
    let activePageId = 'page-1'
    let selectedIds: string[] = ['node-1']
    const calls: string[] = []
    const controller = new LayerManagerController({
      getDocument: () => document,
      getActivePageId: () => activePageId,
      switchPage: (pageId) => { activePageId = pageId; calls.push(`page:${pageId}`) },
      getSelectedIds: () => selectedIds,
      setSelection: (ids) => { selectedIds = ids; calls.push(`select:${ids.join(',')}`) },
      executeCommand: (command) => { calls.push(`execute:${command.label}`); document = command.apply(document) },
      setNotice: (notice) => calls.push(`notice:${notice}`),
      canvas: { locateCell: (cellId) => calls.push(`locate:${cellId}`) },
    })

    expect(controller.cells().map((cell) => cell.id)).toEqual(['node-1', 'node-2', 'node-3', 'edge-1', 'edge-2'])
    controller.move('to-front')
    expect(calls).toContain('execute:置于顶层')
    controller.locate('other')
    expect(calls.slice(-3)).toEqual(['page:page-2', 'select:other', 'locate:other'])
    expect(controller.isSelected('other')).toBe(true)
  })
})

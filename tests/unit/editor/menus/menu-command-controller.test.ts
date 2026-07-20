import { createDefaultTextContent } from '@/domain/diagram'
import { MenuCommandController } from '@/application/menus/menu-command-controller'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

function setup() {
  const document = createTestDocument()
  document.pages[0].nodes = [
    createTestNode({ id: 'n1', x: 0, zIndex: 1, text: createDefaultTextContent('一') }),
    createTestNode({ id: 'n2', x: 100, zIndex: 2, text: createDefaultTextContent('二') }),
    createTestNode({ id: 'n3', x: 240, zIndex: 3, text: createDefaultTextContent('三') }),
  ]
  const calls: string[] = []
  const selection = {
    selectedIds: ['n1', 'n2', 'n3'],
    setSelection(ids: string[]) { this.selectedIds = ids; calls.push(`select:${ids.join(',')}`) },
  }
  const documentPort = {
    document,
    activePageId: 'page-1',
    clipboard: null as object | null,
    undo: () => calls.push('undo'), redo: () => calls.push('redo'),
    cutSelection: () => calls.push('cut'), copySelection: () => { calls.push('copy'); documentPort.clipboard = {} },
    pasteClipboard: () => calls.push('paste'), deleteSelection: () => calls.push('delete'),
    executeCommand: (command: { label: string }) => calls.push(`execute:${command.label}`),
    setNotice: (notice: string) => calls.push(`notice:${notice}`),
    createNodeFromShape: (shape: string) => calls.push(`shape:${shape}`),
  }
  const app = {
    toggleRulers: () => calls.push('rulers'), toggleGrid: () => calls.push('grid'),
    toggleGuides: () => calls.push('guides'), togglePageBreaks: () => calls.push('breaks'),
    toggleSnap: () => calls.push('snap'),
  }
  const callbacks = new Proxy<Record<string, () => void>>({}, {
    get: (_, key) => () => calls.push(`callback:${String(key)}`),
  })
  return { controller: new MenuCommandController({ document: documentPort, selection, app, callbacks }), calls, selection, documentPort }
}

describe('MenuCommandController', () => {
  it('delegates store and callback actions and duplicate is copy plus one paste', () => {
    const { controller, calls } = setup()
    controller.execute('edit-undo')
    controller.execute('edit-duplicate')
    controller.execute('view-grid')
    controller.execute('file-save')
    expect(calls).toEqual(['undo', 'copy', 'paste', 'grid', 'callback:save'])
  })

  it('selects current-page nodes then edges', () => {
    const { controller, selection } = setup()
    controller.execute('edit-select-all')
    expect(selection.selectedIds).toEqual(['n1', 'n2', 'n3', 'edge-1', 'edge-2'])
  })

  it('maps each shape menu to its exact registered shape type', () => {
    const { controller, calls } = setup()
    controller.execute('insert-rect')
    controller.execute('insert-circle')
    controller.execute('insert-diamond')
    controller.execute('insert-text')
    expect(calls).toEqual(['shape:rect', 'shape:circle', 'shape:diamond', 'shape:text'])
  })

  it('executes existing arrangement factories and reports failures in Chinese', () => {
    const { controller, calls, selection } = setup()
    controller.execute('arrange-align-left')
    controller.execute('arrange-distribute-horizontal')
    selection.selectedIds = ['n1']
    controller.execute('arrange-to-front')
    expect(calls).toContain('execute:对齐图元')
    expect(calls).toContain('execute:等距排列')
    expect(calls).toContain('execute:置于顶层')

    controller.execute('unknown-command')
    expect(calls.at(-1)).toBe('notice:此命令暂不可用。')
  })

  it('uses the existing remove-from-container command for a non-group member', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes[0].parentId = 'container-1'
    selection.selectedIds = ['n1']
    controller.execute('arrange-ungroup')
    expect(calls).toContain('execute:移出容器')
  })
})

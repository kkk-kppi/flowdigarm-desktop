import { createDefaultTextContent } from '@/domain/diagram'
import { MenuCommandController } from '@/application/menus/menu-command-controller'
import type { EditorCommand } from '@/application/commands/editor-command'
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
    executeCommand: (command: EditorCommand) => { calls.push(`execute:${command.label}`) },
    setNotice: (notice: string) => calls.push(`notice:${notice}`),
    createNodeFromShape: (shape: string) => calls.push(`shape:${shape}`),
  }
  const app = {
    toggleRulers: () => calls.push('rulers'), toggleGrid: () => calls.push('grid'),
    toggleGuides: () => calls.push('guides'), togglePageBreaks: () => calls.push('breaks'),
    toggleSnap: () => calls.push('snap'),
  }
  const formatPaint = {
    mode: 'off' as 'off' | 'once' | 'continuous',
    sourceCellId: null as string | null,
    armOnce: () => calls.push('format-paint'),
    applyToMany: (ids: string[]) => { calls.push(`format-paint:${ids.join(',')}`); return true },
  }
  const callbacks = {
    save: () => calls.push('callback:save'),
    editText: ({ cellId }: { cellId: string }) => calls.push(`edit-text:${cellId}`),
    editLabel: ({ cellId }: { cellId: string }) => calls.push(`edit-label:${cellId}`),
    focusInspector: ({ section }: { section: string }) => calls.push(`inspector:${section}`),
    openContainerPicker: (request: { mode: string }) => calls.push(`picker:${request.mode}`),
  }
  return { controller: new MenuCommandController({ document: documentPort, selection, app, formatPaint, callbacks }), calls, selection, documentPort, formatPaint }
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

  it('ungroups only when every selected target is a group', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes.push(
      createTestNode({ id: 'group-1', shape: 'group', isContainer: true }),
      createTestNode({ id: 'group-2', shape: 'group', isContainer: true }),
    )
    selection.selectedIds = ['group-1', 'group-2']
    controller.execute('ungroup-or-remove')
    expect(calls).toContain('execute:取消组合')
  })

  it('removes every selected ordinary member from its container in one command', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes[0].parentId = 'container-1'
    documentPort.document.pages[0].nodes[1].parentId = 'container-1'
    selection.selectedIds = ['n1', 'n2']
    controller.execute('ungroup-or-remove')
    expect(calls).toContain('execute:移出容器')
  })

  it('rejects mixed and partially unparented ungroup-or-remove selections precisely', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes.push(createTestNode({ id: 'group', shape: 'group', isContainer: true }))
    documentPort.document.pages[0].nodes[0].parentId = 'container-1'
    selection.selectedIds = ['group', 'n1']
    controller.execute('ungroup-or-remove')
    selection.selectedIds = ['n1', 'n2']
    controller.execute('ungroup-or-remove')
    expect(calls).toEqual([
      'notice:不能同时取消组合和移出容器。',
      'notice:所选图元必须全部位于容器内。',
    ])
  })

  it('routes former context placeholders through typed interaction ports', () => {
    const { controller, calls, selection } = setup()
    selection.selectedIds = ['n1']
    controller.execute('context-edit-text')
    controller.execute('context-link')
    controller.execute('format-font')
    expect(calls).toEqual(['edit-text:n1', 'inspector:link', 'inspector:text'])

    selection.selectedIds = ['edge-1']
    controller.execute('context-edit-label')
    controller.execute('context-line-style')
    expect(calls.slice(-2)).toEqual(['edit-label:edge-1', 'inspector:line'])
  })

  it('applies an armed format source to all compatible context targets', () => {
    const { controller, calls, selection, formatPaint, documentPort } = setup()
    documentPort.document.pages[0].nodes[0].style.fill = '#ff0000'
    formatPaint.mode = 'once'
    formatPaint.sourceCellId = 'n1'
    selection.selectedIds = ['n2', 'n3']
    controller.execute('context-format-paint')
    expect(calls).toEqual(['format-paint:n2,n3'])
  })

  it('uses the format-paint source prerequisite before target compatibility', () => {
    const { controller, calls, selection, formatPaint } = setup()
    selection.selectedIds = ['n2', 'n3']
    controller.execute('context-format-paint')
    expect(calls).toEqual(['notice:请先选择单个源图元并启用格式刷。'])

    formatPaint.mode = 'once'
    formatPaint.sourceCellId = 'edge-1'
    controller.execute('context-format-paint')
    expect(calls.at(-1)).toBe('notice:所选图元中没有可应用格式的目标。')
  })

  it('guards arrangement commands with the same exact prerequisites as menus', () => {
    const { controller, calls, selection } = setup()
    selection.selectedIds = ['n1']
    controller.execute('arrange-align-left')
    controller.execute('arrange-distribute-horizontal')
    controller.execute('arrange-auto-connect')
    expect(calls).toEqual([
      'notice:至少选择两个节点。',
      'notice:至少选择三个节点。',
      'notice:至少选择两个可自动连线的节点。',
    ])
  })

  it('guards auto-connect using eligible nodes rather than all selected nodes', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes[0].isContainer = true
    documentPort.document.pages[0].nodes[1].isContainer = true
    selection.selectedIds = ['n1', 'n2']
    controller.execute('arrange-auto-connect')
    selection.selectedIds = ['n1', 'n3']
    controller.execute('arrange-auto-connect')
    expect(calls).toEqual([
      'notice:至少选择两个可自动连线的节点。',
      'notice:至少选择两个可自动连线的节点。',
    ])
  })

  it('opens an explicit container picker and executes membership only after confirmation', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes.push(createTestNode({ id: 'container', isContainer: true }))
    documentPort.executeCommand = (command: EditorCommand) => {
      calls.push(`execute:${command.label}`)
      documentPort.document = command.apply(documentPort.document)
    }
    selection.selectedIds = ['n1']
    controller.execute('context-add-container')
    expect(calls).toEqual(['picker:add-to-container'])
    expect(documentPort.document.pages[0].nodes.find((node) => node.id === 'n1')?.parentId).toBeUndefined()
    expect(controller.confirmContainerMembership({ containerId: 'container', memberIds: ['n1'] })).toBe(true)
    expect(documentPort.document.pages[0].nodes.find((node) => node.id === 'n1')?.parentId).toBe('container')

    selection.selectedIds = ['container']
    controller.execute('context-add-members')
    expect(calls).toContain('picker:add-members')
  })

  it('keeps a pending container request when command execution fails', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes.push(createTestNode({ id: 'container', isContainer: true }))
    documentPort.executeCommand = () => { throw new Error('容器状态已变化。') }
    selection.selectedIds = ['n1']
    controller.execute('context-add-container')
    expect(controller.confirmContainerMembership({ containerId: 'container', memberIds: ['n1'] })).toBe(false)
    expect(controller.confirmContainerMembership({ containerId: 'container', memberIds: ['n1'] })).toBe(false)
    expect(calls.slice(-2)).toEqual(['notice:容器状态已变化。', 'notice:容器状态已变化。'])
  })

  it('does not offer a descendant container that would create a membership cycle', () => {
    const { controller, calls, selection, documentPort } = setup()
    documentPort.document.pages[0].nodes.push(createTestNode({
      id: 'container', isContainer: true, parentId: 'n1',
    }))
    selection.selectedIds = ['n1']
    controller.execute('context-add-container')
    expect(calls).toEqual(['notice:没有可加入的目标容器。'])
  })
})

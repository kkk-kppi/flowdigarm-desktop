// tests/component/CanvasArea.test.ts
// 画布链接点击：普通点击保持选择；Ctrl/Cmd+点击合法链接的平台失败转为中文通知；
// 非法协议保持精确校验提示且不调用平台。
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultTextContent, type DiagramDocument } from '@/domain/diagram'
import type { GraphAdapterEvents } from '@/infrastructure/x6/graph-adapter'
import CanvasArea from '@/ui/canvas/CanvasArea.vue'
import AppShell from '@/ui/shell/AppShell.vue'
import type { CanvasController } from '@/application/canvas/canvas-controller'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { createTestDocument } from '../helpers/test-document'

const mocks = vi.hoisted(() => ({
  events: null as GraphAdapterEvents | null,
  openExternalLink: vi.fn(),
}))

vi.mock('@/infrastructure/x6/graph-adapter', () => ({
  GraphAdapter: class {
    constructor(_container: HTMLElement, events: GraphAdapterEvents) {
      mocks.events = events
    }
    renderPage() {}
    syncSelection() {}
    syncViewport() {}
    setGridVisible() {}
    dispose() {}
  },
}))

vi.mock('@/platform/platform-provider', () => ({
  usePlatform: () => ({ openExternalLink: mocks.openExternalLink }),
}))

function linkedDocument(link: string): DiagramDocument {
  const document = createTestDocument()
  return {
    ...document,
    pages: document.pages.map((page, pageIndex) =>
      pageIndex === 0
        ? {
            ...page,
            nodes: page.nodes.map((node, nodeIndex) =>
              nodeIndex === 0
                ? { ...node, link, text: createDefaultTextContent('链接节点') }
                : node,
            ),
          }
        : page,
    ),
  }
}

function mountCanvas(link: string, attachToBody = false) {
  setActivePinia(createPinia())
  const documentStore = useDocumentStore()
  documentStore.loadDocument(linkedDocument(link))
  const selectionStore = useSelectionStore()
  const wrapper = mount(CanvasArea, {
    ...(attachToBody ? { attachTo: document.body } : {}),
    global: {
      stubs: {
        PageBreakOverlay: true,
        PageFrame: true,
        RulerCorner: true,
        RulerOverlay: true,
        TextEditorOverlay: true,
      },
    },
  })
  return { wrapper, documentStore, selectionStore }
}

describe('CanvasArea 超链接点击', () => {
  beforeEach(() => {
    mocks.events = null
    mocks.openExternalLink.mockReset()
  })

  it('平台拒绝合法链接时捕获 promise 并给出可操作中文提示', async () => {
    mocks.openExternalLink.mockRejectedValue(new Error('no default browser'))
    const { wrapper, documentStore } = mountCanvas('https://example.com')

    mocks.events!.onNodeClick?.('node-1', { ctrlKey: true, metaKey: false })
    await flushPromises()

    expect(documentStore.lastNotice).toBe('无法打开链接，请检查系统默认应用。')
    wrapper.unmount()
  })

  it('非法协议保持精确提示且不调用平台', async () => {
    const { wrapper, documentStore } = mountCanvas('javascript:alert(1)')

    mocks.events!.onNodeClick?.('node-1', { ctrlKey: false, metaKey: true })
    await flushPromises()

    expect(documentStore.lastNotice).toBe('仅支持 http、https、mailto 链接。')
    expect(mocks.openExternalLink).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('普通点击不打开链接并保留 X6 回流的选择语义', async () => {
    const { wrapper, documentStore, selectionStore } = mountCanvas('https://example.com')

    mocks.events!.onSelectionChanged?.(['node-1'])
    mocks.events!.onNodeClick?.('node-1', { ctrlKey: false, metaKey: false })
    await flushPromises()

    expect(selectionStore.selectedIds).toEqual(['node-1'])
    expect(mocks.openExternalLink).not.toHaveBeenCalled()
    expect(documentStore.lastNotice).toBeNull()
    wrapper.unmount()
  })

  it('emits the active page viewport immediately for the status bar', () => {
    const { wrapper } = mountCanvas('https://example.com')
    expect(wrapper.emitted('viewportChange')?.[0]?.[0]).toEqual({ zoom: 1, panX: 0, panY: 0 })
    wrapper.unmount()
  })

  it('exposes typed text-edit and locate interactions', async () => {
    const { wrapper, selectionStore } = mountCanvas('https://example.com')
    const canvas = wrapper.vm as unknown as CanvasController
    canvas.editNodeText('node-1')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'TextEditorOverlay' }).exists()).toBe(true)
    canvas.locateCell('node-2')
    expect(selectionStore.selectedIds).toEqual(['node-2'])
    wrapper.unmount()
  })

  it('按节点/多选/容器上下文生成菜单并只调用菜单控制器', async () => {
    setActivePinia(createPinia())
    const documentStore = useDocumentStore()
    const document = linkedDocument('https://example.com')
    document.pages[0].nodes[0].isContainer = true
    documentStore.loadDocument(document)
    const selectionStore = useSelectionStore()
    const execute = vi.fn()
    const wrapper = mount(CanvasArea, {
      props: { menuController: { execute } },
      global: { stubs: { PageBreakOverlay: true, PageFrame: true, RulerCorner: true, RulerOverlay: true, TextEditorOverlay: true } },
    })

    mocks.events!.onContextMenu?.({ kind: 'node', cellId: 'node-1', x: 30, y: 40 })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').text()).toContain('取消组合或移出容器')
    await wrapper.find('[data-command-id="edit-copy"]').trigger('click')
    expect(execute).toHaveBeenCalledWith('edit-copy', { trigger: expect.any(HTMLElement) })

    selectionStore.setSelection(['node-1', 'node-2'])
    mocks.events!.onContextMenu?.({ kind: 'node', cellId: 'node-1', x: 30, y: 40 })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').text()).toContain('格式刷')
    wrapper.unmount()
  })

  it('从真实节点与多选右键菜单执行取消组合或移出容器', async () => {
    setActivePinia(createPinia())
    const documentStore = useDocumentStore()
    const document = linkedDocument('https://example.com')
    document.pages[0].nodes[0].parentId = 'node-3'
    document.pages[0].nodes[2].isContainer = true
    documentStore.loadDocument(document)
    const selectionStore = useSelectionStore()
    const execute = vi.fn()
    const wrapper = mount(CanvasArea, {
      props: { menuController: { execute } },
      global: { stubs: { PageBreakOverlay: true, PageFrame: true, RulerCorner: true, RulerOverlay: true, TextEditorOverlay: true } },
    })

    mocks.events!.onContextMenu?.({ kind: 'node', cellId: 'node-1', x: 30, y: 40 })
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-command-id="ungroup-or-remove"]').trigger('click')
    expect(execute).toHaveBeenLastCalledWith('ungroup-or-remove', { trigger: wrapper.find('[data-testid="x6-canvas"]').element })

    documentStore.activePage!.nodes[0].shape = 'group'
    documentStore.activePage!.nodes[0].isContainer = true
    documentStore.activePage!.nodes[0].parentId = undefined
    documentStore.activePage!.nodes[1].shape = 'group'
    documentStore.activePage!.nodes[1].isContainer = true
    selectionStore.setSelection(['node-1', 'node-2'])
    mocks.events!.onContextMenu?.({ kind: 'node', cellId: 'node-1', x: 30, y: 40 })
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-command-id="ungroup-or-remove"]').trigger('click')
    expect(execute).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('makes the graph focusable and restores graph focus after pointer and context-menu interactions', async () => {
    const { wrapper } = mountCanvas('https://example.com', true)
    const graph = wrapper.find<HTMLElement>('[data-testid="x6-canvas"]')
    expect(graph.attributes('tabindex')).toBe('0')
    expect(graph.attributes('aria-label')).toBe('流程图画布')
    await graph.trigger('pointerdown')
    expect(document.activeElement).toBe(graph.element)

    mocks.events!.onContextMenu?.({ kind: 'blank', x: 30, y: 40 })
    await wrapper.vm.$nextTick()
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Escape' })
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(graph.element)
    wrapper.unmount()
  })

  it('restores a picker opened from a real CanvasArea context menu to the graph element', async () => {
    setActivePinia(createPinia())
    const documentStore = useDocumentStore()
    const diagram = linkedDocument('https://example.com')
    diagram.pages[0].nodes[2].isContainer = true
    documentStore.loadDocument(diagram)
    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: { stubs: { PageBreakOverlay: true, PageFrame: true, RulerCorner: true, RulerOverlay: true, TextEditorOverlay: true } },
    })

    mocks.events!.onContextMenu?.({ kind: 'node', cellId: 'node-1', x: 30, y: 40 })
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-command-id="context-add-container"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    const pickerInput = wrapper.find<HTMLInputElement>('[role="dialog"] input')
    expect(document.activeElement).toBe(pickerInput.element)
    pickerInput.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('[data-testid="x6-canvas"]').element)
    wrapper.unmount()
  })
})

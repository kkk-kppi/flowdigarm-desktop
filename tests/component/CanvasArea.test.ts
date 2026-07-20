// tests/component/CanvasArea.test.ts
// 画布链接点击：普通点击保持选择；Ctrl/Cmd+点击合法链接的平台失败转为中文通知；
// 非法协议保持精确校验提示且不调用平台。
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultTextContent, type DiagramDocument } from '@/domain/diagram'
import type { GraphAdapterEvents } from '@/infrastructure/x6/graph-adapter'
import CanvasArea from '@/ui/canvas/CanvasArea.vue'
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

function mountCanvas(link: string) {
  setActivePinia(createPinia())
  const documentStore = useDocumentStore()
  documentStore.loadDocument(linkedDocument(link))
  const selectionStore = useSelectionStore()
  const wrapper = mount(CanvasArea, {
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
})

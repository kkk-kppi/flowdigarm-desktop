// tests/unit/app-shell.test.ts
// 应用外壳组装：正式标题栏、七菜单、工具栏、页面标签、主区、状态栏与帮助/图层面板。
// CanvasArea 依赖 X6（jsdom 无法实例化），以 stub 替换。
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AppShell from '@/ui/shell/AppShell.vue'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useFormatPaintStore } from '@/stores/format-paint-store'
import { createTestDocument } from '../helpers/test-document'

const canvasCalls = {
  editNodeText: vi.fn(),
  editEdgeLabel: vi.fn(),
  locateCell: vi.fn(),
}

const CanvasAreaStub = defineComponent({
  props: ['menuController'],
  emits: ['viewportChange'],
  setup(_props, { expose }) {
    expose({
      editNodeText: canvasCalls.editNodeText,
      editEdgeLabel: canvasCalls.editEdgeLabel,
      locateCell: canvasCalls.locateCell,
      zoomIn: vi.fn(), zoomOut: vi.fn(), setZoom: vi.fn(), fitPage: vi.fn(), fitContent: vi.fn(), fitSelection: vi.fn(),
      createShapeAtViewportCenter: vi.fn(), startShapeDrag: vi.fn(),
    })
    return {}
  },
  template: `<div>
    <button data-testid="canvas-area-stub" @click="$emit('viewportChange', { zoom: 1.5, panX: 3, panY: 4 })" />
    <button data-testid="run-edit-text" @click="menuController.execute('context-edit-text')" />
    <button data-testid="run-edit-label" @click="menuController.execute('context-edit-label')" />
    <button data-testid="run-link" @click="menuController.execute('context-link')" />
    <button data-testid="run-line" @click="menuController.execute('context-line-style')" />
    <button data-testid="run-format-paint" @click="menuController.execute('context-format-paint')" />
    <button data-testid="run-add-container" @click="menuController.execute('context-add-container')" />
    <button data-testid="run-add-members" @click="menuController.execute('context-add-members')" />
  </div>`,
})

function mountShell(attachToBody = false) {
  canvasCalls.editNodeText.mockReset()
  canvasCalls.editEdgeLabel.mockReset()
  canvasCalls.locateCell.mockReset()
  setActivePinia(createPinia())
  const store = useDocumentStore()
  const selection = useSelectionStore()
  const formatPaint = useFormatPaintStore()
  store.newDocument()
  const wrapper = mount(AppShell, {
    ...(attachToBody ? { attachTo: document.body } : {}),
    global: {
      stubs: {
        // X6 画布在 jsdom 无法实例化；其余区域真实渲染
        CanvasArea: CanvasAreaStub,
      },
    },
  })
  return { wrapper, store, selection, formatPaint }
}

describe('AppShell 组装', () => {
  it('按序渲染标题栏/七菜单/紧凑工具栏/页面标签/主区/状态栏', () => {
    const { wrapper } = mountShell()
    expect(wrapper.find('[data-testid="editor-shell"]').exists()).toBe(true)
    const order = [
      'titlebar',
      'menubar',
      'compact-toolbar',
      'page-tabs',
      'shell-main',
      'statusbar',
    ].map((testid) => wrapper.find(`[data-testid="${testid}"]`).exists())
    expect(order).toEqual([true, true, true, true, true, true])
  })

  it('标题栏显示应用名与文档名', () => {
    const { wrapper, store } = mountShell()
    const titlebar = wrapper.find('[data-testid="titlebar"]')
    expect(titlebar.text()).toContain('流程图编辑器')
    expect(titlebar.text()).toContain(store.document.name)
  })

  it('主区包含图元库、画布区与右侧面板', () => {
    const { wrapper } = mountShell()
    const main = wrapper.find('[data-testid="shell-main"]')
    expect(main.find('[data-testid="element-library"]').exists()).toBe(true)
    expect(main.find('[data-testid="canvas-area-stub"]').exists()).toBe(true)
    expect(main.find('[data-testid="right-panel"]').exists()).toBe(true)
  })

  it('状态栏占位显示简单文本', () => {
    const { wrapper } = mountShell()
    expect(wrapper.find('[data-testid="statusbar"]').text().length).toBeGreaterThan(0)
  })

  it('工具菜单打开查找、图层与帮助视图', async () => {
    const { wrapper } = mountShell()
    await wrapper.find('[data-menu-id="tools"]').trigger('click')
    await wrapper.find('[data-command-id="tool-find"]').trigger('click')
    expect(wrapper.find('[data-testid="find-query"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rp-tab-property"]').exists()).toBe(false)

    await wrapper.find('[data-menu-id="tools"]').trigger('click')
    await wrapper.find('[data-command-id="tool-layers"]').trigger('click')
    expect(wrapper.find('[data-testid="layer-manager"]').exists()).toBe(true)

    await wrapper.find('[data-menu-id="help"]').trigger('click')
    await wrapper.find('[data-command-id="help-shortcuts"]').trigger('click')
    expect(wrapper.find('[aria-label="快捷键列表帮助"]').exists()).toBe(true)
  })

  it('file and window actions emit typed events without platform or file API calls', async () => {
    const { wrapper } = mountShell()
    await wrapper.find('[data-menu-id="file"]').trigger('click')
    await wrapper.find('[data-command-id="file-open"]').trigger('click')
    expect(wrapper.emitted('fileCommand')?.[0]).toEqual(['open'])
    await wrapper.find('[data-testid="title-minimize"]').trigger('click')
    expect(wrapper.emitted('windowCommand')?.[0]).toEqual(['minimize'])
  })

  it('accepts viewport snapshots from CanvasArea without reassigning reactive state', async () => {
    const { wrapper } = mountShell()
    await wrapper.find('[data-testid="canvas-area-stub"]').trigger('click')
    expect(wrapper.find<HTMLSelectElement>('[data-testid="status-zoom"]').element.value).toBe('1.5')
  })

  it('executes former context placeholders through real stores and typed controllers', async () => {
    const { wrapper, store, selection, formatPaint } = mountShell(true)
    const diagram = createTestDocument()
    diagram.pages[0].nodes[2].isContainer = true
    diagram.pages[0].nodes[2].text!.value = '目标容器'
    store.loadDocument(diagram)
    selection.setSelection(['node-1'])
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="run-edit-text"]').trigger('click')
    expect(canvasCalls.editNodeText).toHaveBeenCalledWith('node-1')
    await wrapper.find('[data-testid="run-link"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('[data-testid="node-link"]').element)
    await wrapper.find('[data-testid="run-format-paint"]').trigger('click')
    expect(formatPaint.mode).toBe('once')

    selection.setSelection(['edge-1'])
    await wrapper.find('[data-testid="run-edit-label"]').trigger('click')
    expect(canvasCalls.editEdgeLabel).toHaveBeenCalledWith('edge-1')
    await wrapper.find('[data-testid="run-line"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('[data-testid="edge-stroke"]').element)

    selection.setSelection(['node-1'])
    await wrapper.find('[data-testid="run-add-container"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    await wrapper.find<HTMLInputElement>('[value="node-3"]').setValue(true)
    await wrapper.find('[data-testid="membership-confirm"]').trigger('click')
    expect(store.activePage?.nodes.find(({ id }) => id === 'node-1')?.parentId).toBe('node-3')

    selection.setSelection(['node-3'])
    await wrapper.find('[data-testid="run-add-members"]').trigger('click')
    await wrapper.find<HTMLInputElement>('[value="node-2"]').setValue(true)
    await wrapper.find('[data-testid="membership-confirm"]').trigger('click')
    expect(store.activePage?.nodes.find(({ id }) => id === 'node-2')?.parentId).toBe('node-3')
    wrapper.unmount()
  })

  it('restores help focus to the persistent top-level menu trigger', async () => {
    const { wrapper } = mountShell(true)
    const helpTrigger = wrapper.find<HTMLButtonElement>('[data-menu-id="help"]')
    await helpTrigger.trigger('click')
    await wrapper.find('[data-command-id="help-about"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('[aria-label="关闭帮助"]').element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(helpTrigger.element)
    wrapper.unmount()
  })
})

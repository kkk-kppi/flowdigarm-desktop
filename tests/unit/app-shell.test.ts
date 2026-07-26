// tests/unit/app-shell.test.ts
// 应用外壳组装：正式标题栏、七菜单、工具栏、页面标签、主区、状态栏与帮助/图层面板。
// CanvasArea 依赖 X6（jsdom 无法实例化），以 stub 替换。
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AppShell from '@/ui/shell/AppShell.vue'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useFormatPaintStore } from '@/stores/format-paint-store'
import { createTestDocument } from '../helpers/test-document'
import { editorServicesKey, type EditorServices } from '@/ui/services/editor-services'
import { DEFAULT_EDITOR_PREFERENCES } from '@/application/settings/settings-controller'
import type { EditorPreferences } from '@/application/settings/settings-controller'
import type { RecoverySnapshot } from '@/application/persistence/persistence-ports'

const canvasCalls = {
  editNodeText: vi.fn(),
  editEdgeLabel: vi.fn(),
  locateCell: vi.fn(),
  fitPage: vi.fn(),
}

const CanvasAreaStub = defineComponent({
  props: ['menuController'],
  emits: ['viewportChange'],
  setup(_props, { expose }) {
    expose({
      editNodeText: canvasCalls.editNodeText,
      editEdgeLabel: canvasCalls.editEdgeLabel,
      locateCell: canvasCalls.locateCell,
      zoomIn: vi.fn(), zoomOut: vi.fn(), setZoom: vi.fn(), fitPage: canvasCalls.fitPage, fitContent: vi.fn(), fitSelection: vi.fn(),
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
    <button data-testid="run-add-container" @click="menuController.execute('context-add-container', { trigger: $event.currentTarget })" />
    <button data-testid="run-add-members" @click="menuController.execute('context-add-members', { trigger: $event.currentTarget })" />
  </div>`,
})

function mountShell(attachToBody = false) {
  canvasCalls.editNodeText.mockReset()
  canvasCalls.editEdgeLabel.mockReset()
  canvasCalls.locateCell.mockReset()
  canvasCalls.fitPage.mockReset()
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

function fakeServices(overrides: Partial<EditorServices> = {}): EditorServices {
  const services: EditorServices = {
    file: {
      busy: false,
      recentDocuments: [],
      newDocument: vi.fn(async () => true),
      openDocument: vi.fn(async () => true),
      openRecent: vi.fn(async () => true),
      save: vi.fn(async () => true),
      saveAs: vi.fn(async () => true),
      requestClose: vi.fn(async () => true),
      loadRecent: vi.fn(async () => [{
        path: 'C:/docs/recent.flowdiagram', documentId: 'doc-r', name: '最近流程',
        lastOpenedAt: 10, pinned: true,
      }]),
    },
    recovery: {
      pending: null,
      checkStartup: vi.fn(async () => null),
      restore: vi.fn(() => true),
      discard: vi.fn(async () => {}),
    },
    settings: {
      load: vi.fn(async () => ({ ...DEFAULT_EDITOR_PREFERENCES })),
      apply: vi.fn(async () => {}),
    },
    imageImport: vi.fn(async () => true),
    export: {
      chooseDestination: vi.fn(async () => 'C:/exports/流程.svg'),
      export: vi.fn(async () => ['C:/exports/流程.svg']),
    },
    window: {
      minimize: vi.fn(async () => {}),
      toggleMaximize: vi.fn(async () => {}),
      watchMaximized: vi.fn(async (handler) => { handler(false); return () => {} }),
      requestClose: vi.fn(async () => {}),
      onCloseRequested: vi.fn(async () => () => {}),
    },
    unsaved: {
      request: ref(null),
      choose: vi.fn(),
    },
    ...overrides,
  }
  return services
}

function mountShellWithServices(services: EditorServices, attachToBody = false) {
  setActivePinia(createPinia())
  useDocumentStore().newDocument()
  return mount(AppShell, {
    ...(attachToBody ? { attachTo: document.body } : {}),
    global: {
      provide: { [editorServicesKey as symbol]: services },
      stubs: { CanvasArea: CanvasAreaStub },
    },
  })
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

  it('routes file, recent, image, preferences, and window actions through injected services', async () => {
    const services = fakeServices()
    const wrapper = mountShellWithServices(services)
    await flushPromises()

    await wrapper.find('[data-menu-id="file"]').trigger('click')
    await wrapper.find('[data-command-id="file-open"]').trigger('click')
    expect(services.file.openDocument).toHaveBeenCalledOnce()

    await wrapper.find('[data-menu-id="file"]').trigger('click')
    await wrapper.find('[data-command-id="file-recent"]').trigger('mouseenter')
    await wrapper.find('[data-command-id="file-recent-0"]').trigger('click')
    expect(services.file.openRecent).toHaveBeenCalledWith('C:/docs/recent.flowdiagram')

    await wrapper.find('[data-menu-id="insert"]').trigger('click')
    await wrapper.find('[data-command-id="insert-image"]').trigger('click')
    expect(services.imageImport).toHaveBeenCalledOnce()

    await wrapper.find('[data-menu-id="tools"]').trigger('click')
    await wrapper.find('[data-command-id="tool-preferences"]').trigger('click')
    expect(wrapper.find('[aria-labelledby="preferences-title"]').exists()).toBe(true)
    await wrapper.find('[data-testid="preferences-apply"]').trigger('click')
    expect(services.settings.apply).toHaveBeenCalledOnce()

    await wrapper.find('[data-testid="title-minimize"]').trigger('click')
    await wrapper.find('[data-testid="title-maximize"]').trigger('click')
    expect(services.window.minimize).toHaveBeenCalledOnce()
    expect(services.window.toggleMaximize).toHaveBeenCalledOnce()
    expect(useDocumentStore().lastNotice ?? '').not.toContain('下一步桌面接线')
  })

  it('renders restore after the native maximize watcher confirms state', async () => {
    let maximizeHandler!: (maximized: boolean) => void
    const services = fakeServices({
      window: {
        ...fakeServices().window,
        watchMaximized: vi.fn(async (handler) => {
          maximizeHandler = handler
          handler(false)
          return () => {}
        }),
      },
    })
    const wrapper = mountShellWithServices(services)
    await flushPromises()

    maximizeHandler(true)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="title-maximize"] [data-icon="restore"]').exists()).toBe(true)
  })

  it('cleans up maximize watching when registration resolves after unmount', async () => {
    let resolveRegistration!: (stop: () => void) => void
    const stop = vi.fn()
    const services = fakeServices({
      window: {
        ...fakeServices().window,
        watchMaximized: vi.fn(() => new Promise<() => void>((resolve) => { resolveRegistration = resolve })),
      },
    })
    const wrapper = mountShellWithServices(services)
    wrapper.unmount()

    resolveRegistration(stop)
    await flushPromises()

    expect(stop).toHaveBeenCalledOnce()
  })

  it('opens export help and restores focus to the persistent File trigger when help closes', async () => {
    const services = fakeServices()
    const wrapper = mountShellWithServices(services, true)
    await flushPromises()
    const fileTrigger = wrapper.find<HTMLButtonElement>('[data-menu-id="file"]')
    await fileTrigger.trigger('click')
    await wrapper.find('[data-command-id="file-export"]').trigger('click')
    expect(wrapper.find('[aria-labelledby="export-title"]').exists()).toBe(true)
    const exportHelp = wrapper.find<HTMLButtonElement>('[data-testid="export-help"]')
    exportHelp.element.focus()
    await exportHelp.trigger('click')
    await flushPromises()
    expect(wrapper.find('[aria-label="导出帮助"]').exists()).toBe(true)
    await wrapper.find('[aria-label="关闭帮助"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(fileTrigger.element)
    wrapper.unmount()
  })

  it('shows startup recovery once and routes restore through the recovery controller', async () => {
    const snapshot = {
      documentId: 'doc-r', versionToken: '1:2', name: '恢复流程', json: '{}',
      sourcePath: 'C:/docs/recovery.flowdiagram', updatedAt: 10,
    }
    const services = fakeServices({
      recovery: {
        pending: snapshot,
        checkStartup: vi.fn(async () => snapshot),
        restore: vi.fn(() => true),
        discard: vi.fn(async () => {}),
      },
    })
    const wrapper = mountShellWithServices(services)
    await flushPromises()
    expect(wrapper.find('[aria-labelledby="recovery-title"]').exists()).toBe(true)
    await wrapper.find('[data-testid="recovery-restore"]').trigger('click')
    expect(services.recovery.restore).toHaveBeenCalledOnce()
    expect(wrapper.find('[aria-labelledby="recovery-title"]').exists()).toBe(false)
  })

  it('keeps the editor inaccessible until delayed settings and recovery complete, then requires a recovery decision', async () => {
    let resolveSettings!: (settings: EditorPreferences) => void
    let resolveRecovery!: (snapshot: RecoverySnapshot | null) => void
    const snapshot = {
      documentId: 'doc-r', versionToken: '1:2', name: '恢复流程', json: '{}', updatedAt: 10,
    }
    const services = fakeServices({
      settings: {
        load: vi.fn(() => new Promise<EditorPreferences>((resolve) => { resolveSettings = resolve })),
        apply: vi.fn(async () => {}),
      },
      recovery: {
        pending: null,
        checkStartup: vi.fn(() => new Promise<RecoverySnapshot | null>((resolve) => { resolveRecovery = resolve })),
        restore: vi.fn(() => true),
        discard: vi.fn(async () => {}),
      },
    })
    const wrapper = mountShellWithServices(services)

    expect(wrapper.find('[data-testid="canvas-area-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menubar"]').exists()).toBe(false)
    expect(wrapper.find('[aria-labelledby="preferences-title"]').exists()).toBe(false)
    resolveSettings({ ...DEFAULT_EDITOR_PREFERENCES, defaultZoom: 1.75, defaultPageUnit: 'in', defaultConnector: 'curved' })
    await flushPromises()
    expect(wrapper.find('[data-testid="canvas-area-stub"]').exists()).toBe(false)

    resolveRecovery(snapshot)
    await flushPromises()
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
    expect(wrapper.find('[aria-labelledby="recovery-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="canvas-area-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menubar"]').exists()).toBe(false)

    await wrapper.find('[data-testid="recovery-restore"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="canvas-area-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menubar"]').exists()).toBe(true)
    expect(useDocumentStore().activePage).toMatchObject({ unit: 'in', defaultConnector: 'curved' })
    expect(useDocumentStore().pageManager.controllerFor(useDocumentStore().activePageId).state.zoom).toBe(1.75)
  })

  it('loads settings and recents best-effort before recovery even when startup dependencies fail', async () => {
    let rejectSettings!: (error: Error) => void
    const checkStartup = vi.fn(async () => null)
    const loadRecent = vi.fn(async () => { throw new Error('recent db') })
    const services = fakeServices({
      settings: {
        load: vi.fn(() => new Promise<EditorPreferences>((_resolve, reject) => { rejectSettings = reject })),
        apply: vi.fn(async () => {}),
      },
      file: { ...fakeServices().file, loadRecent },
      recovery: {
        pending: null,
        checkStartup,
        restore: vi.fn(() => true),
        discard: vi.fn(async () => {}),
      },
    })
    const wrapper = mountShellWithServices(services)
    await flushPromises()

    expect(loadRecent).not.toHaveBeenCalled()
    expect(checkStartup).not.toHaveBeenCalled()
    rejectSettings(new Error('settings db'))
    await flushPromises()

    expect(loadRecent).toHaveBeenCalledWith(DEFAULT_EDITOR_PREFERENCES.recentLimit)
    expect(checkStartup).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="canvas-area-stub"]').exists()).toBe(true)
  })

  it('loads recents with the persisted recent limit after settings complete', async () => {
    const loadRecent = vi.fn(async () => [])
    const services = fakeServices({
      settings: {
        load: vi.fn(async () => ({ ...DEFAULT_EDITOR_PREFERENCES, recentLimit: 12 })),
        apply: vi.fn(async () => {}),
      },
      file: { ...fakeServices().file, loadRecent },
    })

    mountShellWithServices(services)
    await flushPromises()

    expect(loadRecent).toHaveBeenCalledOnce()
    expect(loadRecent).toHaveBeenCalledWith(12)
    expect(services.recovery.checkStartup).toHaveBeenCalledOnce()
  })

  it('shows a notice and opens the editor when recovery lookup fails', async () => {
    const services = fakeServices({
      recovery: {
        pending: null,
        checkStartup: vi.fn(async () => { throw new Error('recovery db') }),
        restore: vi.fn(() => true),
        discard: vi.fn(async () => {}),
      },
    })
    const wrapper = mountShellWithServices(services)
    await flushPromises()

    expect(wrapper.find('[data-testid="canvas-area-stub"]').exists()).toBe(true)
    expect(useDocumentStore().lastNotice).toContain('恢复')
  })

  it('captures a fresh focus target for an unsaved dialog after another shared dialog closes', async () => {
    const services = fakeServices()
    const wrapper = mountShellWithServices(services, true)
    await flushPromises()
    await wrapper.find('[data-menu-id="tools"]').trigger('click')
    await wrapper.find('[data-command-id="tool-preferences"]').trigger('click')
    await wrapper.find('[aria-labelledby="preferences-title"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()

    const nativeCloseOrigin = document.createElement('button')
    document.body.append(nativeCloseOrigin)
    nativeCloseOrigin.focus()
    services.unsaved.request.value = { action: 'close' }
    await flushPromises()
    await wrapper.find('[data-testid="unsaved-cancel"]').trigger('click')
    services.unsaved.request.value = null
    await flushPromises()

    expect(document.activeElement).toBe(nativeCloseOrigin)
    nativeCloseOrigin.remove()
    wrapper.unmount()
  })

  it('does not reuse a stale file menu target when native close opens the unsaved dialog', async () => {
    const services = fakeServices()
    const wrapper = mountShellWithServices(services, true)
    await flushPromises()
    await wrapper.find('[data-menu-id="file"]').trigger('click')
    await wrapper.find('[data-command-id="file-open"]').trigger('click')
    await flushPromises()

    const nativeCloseOrigin = document.createElement('button')
    document.body.append(nativeCloseOrigin)
    nativeCloseOrigin.focus()
    services.unsaved.request.value = { action: 'close' }
    await flushPromises()
    await wrapper.find('[data-testid="unsaved-cancel"]').trigger('click')
    services.unsaved.request.value = null
    await flushPromises()

    expect(document.activeElement).toBe(nativeCloseOrigin)
    nativeCloseOrigin.remove()
    wrapper.unmount()
  })

  it('returns File New cancel focus to the persistent File menu trigger', async () => {
    const request = ref<{ action: 'new' | 'open' | 'close' } | null>(null)
    const choose = vi.fn((choice: 'save' | 'discard' | 'cancel') => {
      if (choice === 'cancel') request.value = null
    })
    const base = fakeServices()
    const services = fakeServices({
      file: {
        ...base.file,
        newDocument: vi.fn(async () => {
          request.value = { action: 'new' }
          return false
        }),
      },
      unsaved: { request, choose },
    })
    const wrapper = mountShellWithServices(services, true)
    await flushPromises()
    const fileTrigger = wrapper.find<HTMLButtonElement>('[data-menu-id="file"]')

    fileTrigger.element.focus()
    await fileTrigger.trigger('click')
    const newItem = wrapper.find<HTMLButtonElement>('[data-command-id="file-new"]')
    newItem.element.focus()
    await newItem.trigger('click')
    await flushPromises()
    expect(wrapper.find('[aria-labelledby="unsaved-title"]').exists()).toBe(true)

    await wrapper.find('[data-testid="unsaved-cancel"]').trigger('click')
    await flushPromises()

    expect(choose).toHaveBeenCalledWith('cancel')
    expect(document.activeElement).toBe(fileTrigger.element)
    wrapper.unmount()
  })

  it('accepts viewport snapshots from CanvasArea without reassigning reactive state', async () => {
    const { wrapper } = mountShell()
    await wrapper.find('[data-testid="canvas-area-stub"]').trigger('click')
    expect(wrapper.find<HTMLSelectElement>('[data-testid="status-zoom"]').element.value).toBe('1.5')
  })

  it('routes the dedicated status fit control through the existing viewport fit behavior', async () => {
    const { wrapper } = mountShell()
    await wrapper.get('[data-testid="status-fit"]').trigger('click')
    expect(canvasCalls.fitPage).toHaveBeenCalledOnce()
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
    store.activePage!.nodes.find(({ id }) => id === 'node-1')!.style.fill = '#ff0000'
    formatPaint.armOnce()
    selection.setSelection(['node-2'])
    await wrapper.find('[data-testid="run-format-paint"]').trigger('click')
    expect(formatPaint.mode).toBe('off')
    expect(store.activePage?.nodes.find(({ id }) => id === 'node-2')?.style.fill).toBe('#ff0000')

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
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(helpTrigger.element)
    wrapper.unmount()
  })

  it('makes background content inert while the picker is open and restores trigger focus on cancel and confirm', async () => {
    const { wrapper, store, selection } = mountShell(true)
    const diagram = createTestDocument()
    diagram.pages[0].nodes[2].isContainer = true
    store.loadDocument(diagram)
    selection.setSelection(['node-1'])
    const trigger = wrapper.find<HTMLButtonElement>('[data-testid="run-add-container"]')
    trigger.element.focus()
    await trigger.trigger('click')
    const background = wrapper.find('[data-testid="shell-background"]')
    expect(background.attributes('inert')).toBeDefined()
    expect(background.attributes('aria-hidden')).toBe('true')
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await wrapper.find<HTMLInputElement>('[value="node-3"]').setValue(true)
    await wrapper.find('[data-testid="membership-confirm"]').trigger('click')
    await flushPromises()
    expect(background.attributes('inert')).toBeUndefined()
    expect(background.attributes('aria-hidden')).toBeUndefined()
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('closes only the stacked picker on first Escape and help on second Escape', async () => {
    const { wrapper, store, selection } = mountShell(true)
    const diagram = createTestDocument()
    diagram.pages[0].nodes[2].isContainer = true
    store.loadDocument(diagram)

    const helpTrigger = wrapper.find<HTMLButtonElement>('[data-menu-id="help"]')
    await helpTrigger.trigger('click')
    await wrapper.find('[data-command-id="help-about"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[aria-label="关于帮助"]').exists()).toBe(true)

    selection.setSelection(['node-1'])
    const pickerTrigger = wrapper.find<HTMLButtonElement>('[data-testid="run-add-container"]')
    pickerTrigger.element.focus()
    await pickerTrigger.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="关于帮助"]').exists()).toBe(true)
    expect(document.activeElement).toBe(pickerTrigger.element)

    pickerTrigger.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[aria-label="关于帮助"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

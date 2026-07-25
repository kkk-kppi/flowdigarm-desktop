// tests/component/RightPanel.test.ts
// 右侧面板（280px）：属性/页面设置两标签切换；中点折叠按钮展开/收起；
// 窄窗口（<1100px）浮层化类切换；关闭×收起面板。
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RightPanel from '@/ui/inspector/RightPanel.vue'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { createTestDocument } from '../helpers/test-document'

function mountPanel() {
  setActivePinia(createPinia())
  const appStore = useAppStore()
  const documentStore = useDocumentStore()
  documentStore.loadDocument(createTestDocument())
  const wrapper = mount(RightPanel, { attachTo: document.body })
  return { wrapper, appStore }
}

function setWindowWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('RightPanel', () => {
  it('默认显示属性标签；切换到页面设置标签', async () => {
    setWindowWidth(1280)
    const { wrapper } = mountPanel()
    expect(wrapper.find('[data-testid="right-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="property-tab"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rp-title"]').text()).toBe('属性')
    expect(wrapper.find('[data-testid="rp-collapse"] [data-icon="chevronRight"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rp-close"] [data-icon="close"]').exists()).toBe(true)

    await wrapper.find('[data-testid="rp-tab-page"]').trigger('click')
    expect(wrapper.find('[data-testid="page-setup-tab"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="property-tab"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rp-title"]').text()).toBe('页面设置')

    await wrapper.find('[data-testid="rp-tab-property"]').trigger('click')
    expect(wrapper.find('[data-testid="property-tab"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('折叠按钮收起整栏（仅留展开钮）；再次点击展开', async () => {
    setWindowWidth(1280)
    const { wrapper, appStore } = mountPanel()
    expect(wrapper.find('[data-testid="rp-collapse"] [data-icon="chevronRight"]').exists()).toBe(true)
    await wrapper.find('[data-testid="rp-collapse"]').trigger('click')
    expect(appStore.rightPanelCollapsed).toBe(true)
    expect(wrapper.find('[data-testid="right-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rp-collapse"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rp-collapse"] [data-icon="chevronLeft"]').exists()).toBe(true)

    await wrapper.find('[data-testid="rp-collapse"]').trigger('click')
    expect(appStore.rightPanelCollapsed).toBe(false)
    expect(wrapper.find('[data-testid="right-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rp-collapse"] [data-icon="chevronRight"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('关闭×收起面板', async () => {
    setWindowWidth(1280)
    const { wrapper, appStore } = mountPanel()
    await wrapper.find('[data-testid="rp-close"]').trigger('click')
    expect(appStore.rightPanelCollapsed).toBe(true)
    expect(wrapper.find('[data-testid="right-panel"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('窄窗口（<1100px）带浮层类；宽窗口不带', async () => {
    setWindowWidth(1000)
    const { wrapper } = mountPanel()
    await wrapper.vm.$nextTick() // onMounted 读取窗口宽度后重渲染
    expect(wrapper.find('[data-testid="right-panel"]').classes()).toContain('floating')

    setWindowWidth(1280)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="right-panel"]').classes()).not.toContain('floating')
    wrapper.unmount()
  })

  it('find 模式显示插槽内容（Task 8 预留）', async () => {
    setWindowWidth(1280)
    setActivePinia(createPinia())
    const wrapper = mount(RightPanel, {
      props: { mode: 'find' },
      slots: { find: '<div data-testid="find-placeholder">查找替换占位</div>' },
      attachTo: document.body,
    })
    expect(wrapper.find('[data-testid="find-placeholder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rp-tab-property"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('由 app-store 正式切换 find 模式并隐藏标签栏', async () => {
    setWindowWidth(1280)
    setActivePinia(createPinia())
    const appStore = useAppStore()
    appStore.openFindPanel()
    const wrapper = mount(RightPanel, {
      slots: { find: '<div data-testid="find-live">查找替换</div>' },
      attachTo: document.body,
    })
    expect(wrapper.find('[data-testid="rp-title"]').text()).toBe('查找替换')
    expect(wrapper.find('[data-testid="find-live"]').exists()).toBe(true)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens and focuses requested link, text, and line inspector sections', async () => {
    const { wrapper } = mountPanel()
    const selection = useSelectionStore()
    selection.setSelection(['node-1'])
    await (wrapper.vm as unknown as { focusSection(section: 'link' | 'text' | 'line'): Promise<void> }).focusSection('link')
    expect(document.activeElement).toBe(wrapper.find('[data-testid="node-link"]').element)
    await (wrapper.vm as unknown as { focusSection(section: 'link' | 'text' | 'line'): Promise<void> }).focusSection('text')
    expect(document.activeElement).toBe(wrapper.find('[data-testid="font-family"]').element)
    selection.setSelection(['edge-1'])
    await wrapper.vm.$nextTick()
    await (wrapper.vm as unknown as { focusSection(section: 'link' | 'text' | 'line'): Promise<void> }).focusSection('line')
    expect(document.activeElement).toBe(wrapper.find('[data-testid="edge-stroke"]').element)
    wrapper.unmount()
  })
})

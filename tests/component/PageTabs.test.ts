// tests/component/PageTabs.test.ts
// 页面标签栏：页签切换/行内重命名/内联确认删除/新建页/缩放控件。
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PageTabs from '@/ui/pages/PageTabs.vue'
import { useDocumentStore } from '@/stores/document-store'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'

function twoPageDocument(): DiagramDocument {
  return {
    ...createEmptyDocument(),
    pages: [
      createEmptyPage({ id: 'page-a', name: '页面 1' }),
      createEmptyPage({ id: 'page-b', name: '页面 2' }),
    ],
  }
}

function mountTabs(document: DiagramDocument = twoPageDocument()) {
  setActivePinia(createPinia())
  const store = useDocumentStore()
  store.loadDocument(document)
  const wrapper = mount(PageTabs)
  return { wrapper, store }
}

describe('PageTabs', () => {
  it('渲染全部页签并高亮活动页', () => {
    const { wrapper } = mountTabs()
    expect(wrapper.attributes('data-testid')).toBe('page-tabs')
    const tabs = wrapper.findAll('[data-testid="page-tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].text()).toContain('页面 1')
    expect(tabs[1].text()).toContain('页面 2')
    expect(tabs[0].classes()).toContain('active')
    expect(tabs[1].classes()).not.toContain('active')
  })

  it('单击页签切换活动页（视图行为，不产生命令）', async () => {
    const { wrapper, store } = mountTabs()
    await wrapper.findAll('[data-testid="page-tab"]')[1].trigger('click')
    expect(store.activePageId).toBe('page-b')
    expect(store.canUndo).toBe(false)
    const tabs = wrapper.findAll('[data-testid="page-tab"]')
    expect(tabs[1].classes()).toContain('active')
  })

  it('双击进入行内重命名，回车提交产生一条「重命名页面」记录', async () => {
    const { wrapper, store } = mountTabs()
    await wrapper.findAll('[data-testid="page-tab"]')[0].trigger('dblclick')
    const input = wrapper.find('[data-testid="rename-input"]')
    expect(input.exists()).toBe(true)
    await input.setValue('主流程')
    await input.trigger('keydown.enter')
    expect(store.document.pages[0].name).toBe('主流程')
    expect(store.undoLabel).toBe('重命名页面')
    expect(wrapper.find('[data-testid="rename-input"]').exists()).toBe(false)
  })

  it('重命名时 Esc 取消：名称不变、不产生命令', async () => {
    const { wrapper, store } = mountTabs()
    await wrapper.findAll('[data-testid="page-tab"]')[0].trigger('dblclick')
    const input = wrapper.find('[data-testid="rename-input"]')
    await input.setValue('被放弃的名字')
    await input.trigger('keydown.esc')
    expect(store.document.pages[0].name).toBe('页面 1')
    expect(store.canUndo).toBe(false)
    expect(wrapper.find('[data-testid="rename-input"]').exists()).toBe(false)
  })

  it('重命名提交空白名称视为取消（不产生命令）', async () => {
    const { wrapper, store } = mountTabs()
    await wrapper.findAll('[data-testid="page-tab"]')[0].trigger('dblclick')
    const input = wrapper.find('[data-testid="rename-input"]')
    await input.setValue('   ')
    await input.trigger('keydown.enter')
    expect(store.document.pages[0].name).toBe('页面 1')
    expect(store.canUndo).toBe(false)
  })

  it('删除需内联确认：点 × 出现「删除此页？」，确认后才删除', async () => {
    const { wrapper, store } = mountTabs()
    const secondTab = wrapper.findAll('[data-testid="page-tab"]')[1]
    await secondTab.find('[data-testid="close-tab"]').trigger('click')
    // 确认弹层出现，页面仍在
    expect(wrapper.find('[data-testid="delete-confirm"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('删除此页？')
    expect(store.document.pages).toHaveLength(2)

    await wrapper.find('[data-testid="confirm-delete"]').trigger('click')
    expect(store.document.pages).toHaveLength(1)
    expect(store.document.pages[0].id).toBe('page-a')
    expect(store.undoLabel).toBe('删除页面')
    expect(wrapper.find('[data-testid="delete-confirm"]').exists()).toBe(false)
  })

  it('删除确认中点「取消」保留页面', async () => {
    const { wrapper, store } = mountTabs()
    await wrapper.findAll('[data-testid="page-tab"]')[1].find('[data-testid="close-tab"]').trigger('click')
    await wrapper.find('[data-testid="cancel-delete"]').trigger('click')
    expect(store.document.pages).toHaveLength(2)
    expect(store.canUndo).toBe(false)
    expect(wrapper.find('[data-testid="delete-confirm"]').exists()).toBe(false)
  })

  it('仅剩一页时不显示关闭按钮', () => {
    const single: DiagramDocument = {
      ...createEmptyDocument(),
      pages: [createEmptyPage({ id: 'only', name: '页面 1' })],
    }
    const { wrapper } = mountTabs(single)
    expect(wrapper.find('[data-testid="close-tab"]').exists()).toBe(false)
  })

  it('末尾 + 按钮新建页面并切换过去', async () => {
    const { wrapper, store } = mountTabs()
    const addButton = wrapper.find('[aria-label="新建页面"]')
    expect(addButton.exists()).toBe(true)
    await addButton.trigger('click')
    expect(store.document.pages).toHaveLength(3)
    expect(store.document.pages[2].name).toBe('页面 3')
    expect(store.activePageId).toBe(store.document.pages[2].id)
    // 新建命令落在原活动页（page-a）的栈中；新页栈为空
    expect(store.undoLabel).toBeUndefined()
    store.switchPage('page-a')
    expect(store.undoLabel).toBe('新建页面')
  })

  it('缩放滑块调整当前页视口缩放并显示百分比', async () => {
    const { wrapper, store } = mountTabs()
    expect(wrapper.find('[data-testid="zoom-percent"]').text()).toBe('100%')
    const slider = wrapper.find('[data-testid="zoom-slider"]')
    expect(slider.attributes('min')).toBe('10')
    expect(slider.attributes('max')).toBe('400')
    await slider.setValue('200')
    const controller = store.pageManager.controllerFor(store.activePageId)
    expect(controller.state.zoom).toBe(2)
    expect(wrapper.find('[data-testid="zoom-percent"]').text()).toBe('200%')
  })

  it('切换页后缩放控件绑定新页的视口状态', async () => {
    const { wrapper, store } = mountTabs()
    store.pageManager.controllerFor('page-b').setZoom(1.5)
    await wrapper.findAll('[data-testid="page-tab"]')[1].trigger('click')
    expect(wrapper.find('[data-testid="zoom-percent"]').text()).toBe('150%')
  })
})

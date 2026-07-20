// tests/component/PageSetupTab.test.ts
// 页面设置标签页：本地草稿编辑，「应用」聚合为一条 UpdatePageCommand；「重置」不产生命令；
// 单位切换只改显示值；自动调整大小在无图元页禁用。
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PageSetupTab from '@/ui/pages/PageSetupTab.vue'
import { useDocumentStore } from '@/stores/document-store'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestNode } from '../helpers/test-document'

function singlePageDocument(): DiagramDocument {
  return {
    ...createEmptyDocument(),
    pages: [createEmptyPage({ id: 'page-1', name: '页面 1' })],
  }
}

function mountTab(document: DiagramDocument = singlePageDocument()) {
  setActivePinia(createPinia())
  const store = useDocumentStore()
  store.loadDocument(document)
  const wrapper = mount(PageSetupTab)
  return { wrapper, store }
}

describe('PageSetupTab', () => {
  it('修改纸张与方向后点「应用」：页面更新且撤销栈仅 +1', async () => {
    const { wrapper, store } = mountTab()
    expect(wrapper.attributes('data-testid')).toBe('page-setup-tab')

    await wrapper.find('[data-testid="paper-preset"]').setValue('a3')
    await wrapper.find('[data-testid="orientation-landscape"]').trigger('click')
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')

    const page = store.document.pages[0]
    expect(page.pageSize.preset).toBe('a3')
    expect(page.pageSize.width).toBeCloseTo(1190.5512, 3)
    expect(page.pageSize.height).toBeCloseTo(841.8898, 3)
    expect(page.orientation).toBe('landscape')
    expect(store.undoLabel).toBe('页面设置')

    // 撤销栈仅 +1：undo 后回到 A4 纵向且栈空
    store.undo()
    const reverted = store.document.pages[0]
    expect(reverted.pageSize.preset).toBe('a4')
    expect(reverted.orientation).toBe('portrait')
    expect(store.canUndo).toBe(false)
  })

  it('无变化时点「应用」不产生命令', async () => {
    const { wrapper, store } = mountTab()
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')
    expect(store.canUndo).toBe(false)
    expect(store.dirty).toBe(false)
  })

  it('「重置」恢复显示为页面当前值且不产生命令', async () => {
    const { wrapper, store } = mountTab()
    await wrapper.find('[data-testid="paper-preset"]').setValue('a3')
    await wrapper.find('[data-testid="page-unit"]').setValue('cm')
    await wrapper.find('[data-testid="reset-settings"]').trigger('click')

    expect((wrapper.find('[data-testid="paper-preset"]').element as HTMLSelectElement).value).toBe('a4')
    expect((wrapper.find('[data-testid="page-unit"]').element as HTMLSelectElement).value).toBe('mm')
    expect(store.canUndo).toBe(false)
    expect(store.document.pages[0].pageSize.preset).toBe('a4')
  })

  it('自定义尺寸按当前单位显示；单位切换 mm↔cm 显示值换算正确', async () => {
    const { wrapper } = mountTab()
    await wrapper.find('[data-testid="paper-preset"]').setValue('custom')
    const widthInput = wrapper.find('[data-testid="custom-width"]')
    const heightInput = wrapper.find('[data-testid="custom-height"]')
    expect(widthInput.exists()).toBe(true)
    // A4 595.2756×841.8898 pt → mm 显示 210.0 / 297.0
    expect((widthInput.element as HTMLInputElement).value).toBe('210.0')
    expect((heightInput.element as HTMLInputElement).value).toBe('297.0')

    await wrapper.find('[data-testid="page-unit"]').setValue('cm')
    expect((widthInput.element as HTMLInputElement).value).toBe('21.00')
    expect((heightInput.element as HTMLInputElement).value).toBe('29.70')

    await wrapper.find('[data-testid="page-unit"]').setValue('mm')
    expect((widthInput.element as HTMLInputElement).value).toBe('210.0')
  })

  it('编辑自定义宽度（按当前单位输入）经「应用」写回为 pt', async () => {
    const { wrapper, store } = mountTab()
    await wrapper.find('[data-testid="paper-preset"]').setValue('custom')
    const widthInput = wrapper.find('[data-testid="custom-width"]')
    await widthInput.setValue('100') // 100mm
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')
    // 100mm = 283.4646pt
    expect(store.document.pages[0].pageSize.width).toBeCloseTo(283.4646, 3)
    expect(store.document.pages[0].pageSize.preset).toBe('custom')
  })

  it('连线配置编辑后「应用」写入页面', async () => {
    const { wrapper, store } = mountTab()
    await wrapper.find('[data-testid="default-connector"]').setValue('straight')
    await wrapper.find('[data-testid="arrow-double"]').trigger('click')
    await wrapper.find('[data-testid="auto-connect-label"]').setValue(false)
    await wrapper.find('[data-testid="show-line-jumps"]').setValue(true)
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')

    const page = store.document.pages[0]
    expect(page.defaultConnector).toBe('straight')
    expect(page.defaultArrow).toBe('double')
    expect(page.autoConnectLabel).toBe(false)
    expect(page.showLineJumps).toBe(true)
    expect(store.undoLabel).toBe('页面设置')
  })

  it('背景页下拉仅列出背景类型页面；选择后「应用」写入引用', async () => {
    const document: DiagramDocument = {
      ...createEmptyDocument(),
      pages: [
        createEmptyPage({ id: 'fg-1', name: '页面 1' }),
        createEmptyPage({ id: 'bg-1', name: '通用背景', type: 'background' }),
        createEmptyPage({ id: 'fg-2', name: '页面 2' }),
      ],
    }
    const { wrapper, store } = mountTab(document)
    const select = wrapper.find('[data-testid="background-page"]')
    const optionTexts = select.findAll('option').map((option) => option.text())
    expect(optionTexts).toEqual(['无', '通用背景'])

    await select.setValue('bg-1')
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')
    expect(store.document.pages[0].backgroundPageId).toBe('bg-1')
  })

  it('「自动调整大小」在无图元页禁用并提示「页面无图元」', () => {
    const { wrapper } = mountTab()
    const button = wrapper.find('[data-testid="fit-page"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toBe('页面无图元')
  })

  it('「自动调整大小」在有图元页可用：点击执行一条「自动调整页面大小」记录', async () => {
    const document: DiagramDocument = {
      ...createEmptyDocument(),
      pages: [
        createEmptyPage({
          id: 'page-1',
          name: '页面 1',
          nodes: [
            createTestNode({ id: 'n-1', x: 10, y: 20, width: 80, height: 40 }),
            createTestNode({ id: 'n-2', x: 110, y: 20, width: 80, height: 40 }),
          ],
        }),
      ],
    }
    const { wrapper, store } = mountTab(document)
    const button = wrapper.find('[data-testid="fit-page"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    const page = store.document.pages[0]
    expect(page.pageSize.width).toBe(252)
    expect(page.pageSize.height).toBe(112)
    expect(page.orientation).toBe('landscape')
    expect(store.undoLabel).toBe('自动调整页面大小')
  })

  it('自动调整后草稿同步：再点「应用」不回退 fit 结果', async () => {
    const document: DiagramDocument = {
      ...createEmptyDocument(),
      pages: [
        createEmptyPage({
          id: 'page-1',
          name: '页面 1',
          nodes: [
            createTestNode({ id: 'n-1', x: 10, y: 20, width: 80, height: 40 }),
            createTestNode({ id: 'n-2', x: 110, y: 20, width: 80, height: 40 }),
          ],
        }),
      ],
    }
    const { wrapper, store } = mountTab(document)
    await wrapper.find('[data-testid="fit-page"]').trigger('click')
    expect(store.document.pages[0].pageSize.width).toBe(252)

    // fit 后仅改其他设置（单位），再应用：pageSize 不得残留 fit 前的 A4 纵向旧值
    await wrapper.find('[data-testid="page-unit"]').setValue('cm')
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')

    const page = store.document.pages[0]
    expect(page.pageSize.width).toBe(252)
    expect(page.pageSize.height).toBe(112)
    expect(page.orientation).toBe('landscape')
    expect(page.unit).toBe('cm')
    expect(store.undoLabel).toBe('页面设置')

    // 撤销仅回退单位变更；页面尺寸保持 fit 结果，栈顶回到「自动调整页面大小」
    store.undo()
    const reverted = store.document.pages[0]
    expect(reverted.pageSize.width).toBe(252)
    expect(reverted.pageSize.height).toBe(112)
    expect(reverted.orientation).toBe('landscape')
    expect(reverted.unit).toBe('mm')
    expect(store.undoLabel).toBe('自动调整页面大小')
  })

  it('编辑背景页时，背景下拉排除自身', () => {
    const document: DiagramDocument = {
      ...createEmptyDocument(),
      pages: [
        createEmptyPage({ id: 'bg-a', name: '背景 A', type: 'background' }),
        createEmptyPage({ id: 'bg-b', name: '背景 B', type: 'background' }),
      ],
    }
    const { wrapper } = mountTab(document)
    const optionTexts = wrapper
      .find('[data-testid="background-page"]')
      .findAll('option')
      .map((option) => option.text())
    expect(optionTexts).toEqual(['无', '背景 B'])
  })

  it('「应用」报错后：编辑草稿或切页清除错误提示', async () => {
    const document: DiagramDocument = {
      ...createEmptyDocument(),
      pages: [
        createEmptyPage({ id: 'fg-1', name: '页面 1' }),
        createEmptyPage({ id: 'fg-2', name: '页面 2' }),
        // bg-1 反向引用 fg-1：选它作 fg-1 背景会成环，命令抛「背景页设置无效。」
        createEmptyPage({ id: 'bg-1', name: '背景', type: 'background', backgroundPageId: 'fg-1' }),
      ],
    }
    const { wrapper, store } = mountTab(document)
    await wrapper.find('[data-testid="background-page"]').setValue('bg-1')
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')
    expect(wrapper.find('.setup-error').exists()).toBe(true)

    // 草稿编辑清除错误
    await wrapper.find('[data-testid="page-unit"]').setValue('cm')
    expect(wrapper.find('.setup-error').exists()).toBe(false)

    // 再次报错后切页清除错误
    await wrapper.find('[data-testid="apply-settings"]').trigger('click')
    expect(wrapper.find('.setup-error').exists()).toBe(true)
    store.switchPage('fg-2')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.setup-error').exists()).toBe(false)
  })
})

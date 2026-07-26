import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TitleBar from '@/ui/shell/TitleBar.vue'
import StatusBar from '@/ui/shell/StatusBar.vue'
import { useAppStore } from '@/stores/app-store'

describe('desktop shell bars', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows dirty title and emits all window controls with accessible tooltips', async () => {
    const wrapper = mount(TitleBar, { props: { fileName: '示例.flowdiagram', dirty: true, maximized: false } })
    expect(wrapper.find('[data-testid="titlebar"]').attributes('data-tauri-drag-region')).toBeDefined()
    expect(wrapper.text()).toContain('流程图编辑器 - 示例.flowdiagram*未保存')
    for (const [testid, event] of [['minimize', 'minimize'], ['maximize', 'maximize'], ['close', 'close']] as const) {
      const button = wrapper.find(`[data-testid="title-${testid}"]`)
      expect(button.attributes('aria-label')).toBeTruthy()
      expect(button.attributes('title')).toContain('。')
      await button.trigger('click')
      expect(wrapper.emitted(event)).toBeTruthy()
    }
  })

  it('shows confirmed maximize and restore controls', () => {
    const normal = mount(TitleBar, { props: { fileName: '示例.flowdiagram', dirty: false, maximized: false } })
    const maximized = mount(TitleBar, { props: { fileName: '示例.flowdiagram', dirty: false, maximized: true } })

    expect(normal.find('[data-testid="title-maximize"] [data-icon="maximize"]').exists()).toBe(true)
    expect(normal.get('[data-testid="title-maximize"]').attributes('aria-label')).toBe('最大化窗口')
    expect(maximized.find('[data-testid="title-maximize"] [data-icon="restore"]').exists()).toBe(true)
    expect(maximized.get('[data-testid="title-maximize"]').attributes('aria-label')).toBe('还原窗口')
  })

  it('centers every window action icon in its button box', () => {
    const wrapper = mount(TitleBar, { props: { fileName: '示例.flowdiagram', dirty: false, maximized: false } })

    expect(wrapper.get('[data-icon="appGraph"]').classes()).toContain('title-brand-icon')
    for (const action of ['minimize', 'maximize', 'close']) {
      expect(wrapper.get(`[data-testid="title-${action}"] [data-icon]`).classes()).not.toContain('title-brand-icon')
    }
  })

  it('shows selection/page/zoom/save state and toggles view settings outside history', async () => {
    const app = useAppStore()
    const wrapper = mount(StatusBar, { props: { selectedCount: 2, anchorX: '10.0 mm', anchorY: '20.0 mm', pageIndex: 2, pageCount: 4, zoom: 1.25, dirty: true } })
    expect(wrapper.text()).toContain('已选择 2 个图元')
    expect(wrapper.text()).toContain('X 10.0 mm')
    expect(wrapper.text()).toContain('页 2/4')
    expect(wrapper.text()).toContain('未保存')
    expect(wrapper.find('option[value="fit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="status-fit"] [data-icon="fitToScreen"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="status-grid"] [data-icon="gridOff"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="status-snap"] [data-icon="magnet"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="status-snap"]').attributes('aria-pressed')).toBe('true')
    await wrapper.find('[data-testid="status-grid"]').trigger('click')
    await wrapper.find('[data-testid="status-snap"]').trigger('click')
    expect(app.showGrid).toBe(true)
    expect(app.snapToGrid).toBe(false)
    expect(wrapper.find('[data-testid="status-grid"] [data-icon="gridOn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="status-snap"] [data-icon="magnet"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="status-snap"]').attributes('aria-pressed')).toBe('false')
    await wrapper.find('[data-testid="status-zoom"]').setValue('1.5')
    expect(wrapper.emitted('setZoom')?.[0]).toEqual([1.5])
    await wrapper.get('[data-testid="status-fit"]').trigger('click')
    expect(wrapper.emitted('setZoom')?.at(-1)).toEqual(['fit'])
  })

  it('shows a selected custom option for a fit-derived zoom', () => {
    const wrapper = mount(StatusBar, { props: { selectedCount: 0, pageIndex: 1, pageCount: 1, zoom: 0.87, dirty: false } })
    const select = wrapper.find<HTMLSelectElement>('[data-testid="status-zoom"]')
    expect(select.element.value).toBe('0.87')
    expect(select.find('option:checked').text()).toBe('87%')
  })
})

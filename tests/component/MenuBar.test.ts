import { mount } from '@vue/test-utils'
import MenuBar from '@/ui/shell/MenuBar.vue'
import { createMainMenus } from '@/application/menus/menu-model'

const readyState = {
  canUndo: true, canRedo: true, hasSelection: true, canPaste: true,
  selectedNodeCount: 3, selectedGroupCount: 1, selectedContainerCount: 1, hasTextSelection: true,
}
const menus = createMainMenus(readyState)

describe('MenuBar', () => {
  it('renders seven menus and executes an item', async () => {
    const wrapper = mount(MenuBar, { props: { menus }, attachTo: document.body })
    expect(wrapper.findAll('[data-menu-id]')).toHaveLength(7)
    await wrapper.find('[data-menu-id="edit"]').trigger('click')
    await wrapper.find('[data-command-id="edit-copy"]').trigger('click')
    expect(wrapper.emitted('execute')?.[0]?.[0]).toBe('edit-copy')
    expect(wrapper.emitted('execute')?.[0]?.[1]).toBe(wrapper.find('[data-menu-id="edit"]').element)
    wrapper.unmount()
  })

  it('supports top-level arrows, item arrows, Enter, and Escape focus return', async () => {
    const wrapper = mount(MenuBar, { props: { menus }, attachTo: document.body })
    const file = wrapper.find<HTMLButtonElement>('[data-menu-id="file"]')
    await file.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(wrapper.find('[data-menu-id="edit"]').element)
    await wrapper.find('[data-menu-id="edit"]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('execute')).toBeTruthy()
    await wrapper.find('[data-menu-id="edit"]').trigger('click')
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('[data-menu-id="edit"]').element)
    wrapper.unmount()
  })

  it('closes on outside click and removes its document listener on unmount', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(MenuBar, { props: { menus }, attachTo: document.body })
    await wrapper.find('[data-menu-id="file"]').trigger('click')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('mousedown', expect.any(Function))
    remove.mockRestore()
  })

  it('shows checked text and disabled Chinese reason', async () => {
    const stateMenus = createMainMenus({
      canUndo: false, canRedo: false, hasSelection: false, canPaste: false, showGrid: true,
      selectedNodeCount: 0, selectedGroupCount: 0, selectedContainerCount: 0, hasTextSelection: false,
    })
    const wrapper = mount(MenuBar, { props: { menus: stateMenus } })
    await wrapper.find('[data-menu-id="view"]').trigger('click')
    expect(wrapper.find('[data-command-id="view-grid"]').text()).toContain('✓')
    await wrapper.find('[data-menu-id="edit"]').trigger('click')
    const undo = wrapper.find('[data-command-id="edit-undo"]')
    expect(undo.attributes('aria-disabled')).toBe('true')
    expect(undo.attributes('title')).toBe('没有可撤销的操作。')
  })

  it('expands a submenu with ArrowRight and executes its active child', async () => {
    const wrapper = mount(MenuBar, { props: { menus }, attachTo: document.body })
    await wrapper.find('[data-menu-id="tools"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.find('[data-command-id="arrange-align-left"]').exists()).toBe(true)
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('execute')?.[0]?.[0]).toBe('arrange-align-left')
    wrapper.unmount()
  })
})

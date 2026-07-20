import { mount } from '@vue/test-utils'
import CanvasContextMenu from '@/ui/components/CanvasContextMenu.vue'
import { contextMenuItems } from '@/application/menus/context-menu-model'

describe('CanvasContextMenu', () => {
  it('clamps to viewport and executes with Enter', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true })
    const wrapper = mount(CanvasContextMenu, {
      props: { x: 290, y: 190, items: contextMenuItems('blank', { canPaste: true, canGroup: false, canUngroup: false }) },
      attachTo: document.body,
    })
    const style = wrapper.find('[role="menu"]').attributes('style')
    expect(style).toContain('left: 80px')
    expect(style).toContain('top: 104px')
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('execute')?.[0]).toEqual(['edit-paste'])
    wrapper.unmount()
  })

  it('Escape closes, restores canvas focus, and cleanup removes listener', async () => {
    const canvas = document.createElement('button')
    document.body.append(canvas)
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(CanvasContextMenu, {
      props: { x: 0, y: 0, items: contextMenuItems('blank', { canPaste: true, canGroup: false, canUngroup: false }), returnFocus: canvas },
      attachTo: document.body,
    })
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(document.activeElement).toBe(canvas)
    wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('mousedown', expect.any(Function))
    remove.mockRestore()
    canvas.remove()
  })

  it('opens command submenus with ArrowRight and executes a child', async () => {
    const items = contextMenuItems('multi', { canPaste: true, canGroup: true, canUngroup: false })
    const wrapper = mount(CanvasContextMenu, { props: { x: 0, y: 0, items } })
    for (let index = 0; index < 4; index += 1) {
      await wrapper.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    }
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.find('[aria-label="对齐子菜单"]').exists()).toBe(true)
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('execute')?.[0]).toEqual(['arrange-align-left'])
  })
})

import { mount } from '@vue/test-utils'
import FeatureHelp from '@/ui/help/FeatureHelp.vue'
import { featureHelpRegistry } from '@/ui/help/feature-help-registry'

describe('FeatureHelp', () => {
  it('registers all Task 8b1 entries with complete fields', () => {
    for (const id of ['find-replace', 'menus', 'context-menu', 'layer-manager', 'preferences', 'export', 'shortcuts', 'about']) {
      const entry = featureHelpRegistry.get(id)
      expect(entry).toBeTruthy()
      expect(entry?.docAnchor).toBeTruthy()
      expect(entry?.undoBoundary).toBeTruthy()
    }
  })

  it('focuses its close button and document Escape closes with connected focus return', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mount(FeatureHelp, { props: { helpId: 'find-replace' }, attachTo: document.body })
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('role')).toBe('complementary')
    expect(wrapper.text()).toContain('影响范围')
    expect(document.activeElement).toBe(wrapper.find<HTMLButtonElement>('[aria-label="关闭帮助"]').element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
    trigger.remove()
  })

  it('renders a valid document path with exactly one hash and removes Escape listener', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(FeatureHelp, { props: { helpId: 'find-replace' } })
    const href = wrapper.find('a').attributes('href')!
    expect(href).toBe('docs/user-guide.md#查找替换')
    expect(href.match(/#/g)).toHaveLength(1)
    wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    remove.mockRestore()
  })
})

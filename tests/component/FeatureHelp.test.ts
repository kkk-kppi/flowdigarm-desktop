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

  it('renders a non-modal help panel and Escape closes with focus return', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mount(FeatureHelp, { props: { helpId: 'find-replace' }, attachTo: document.body })
    expect(wrapper.attributes('role')).toBe('complementary')
    expect(wrapper.text()).toContain('影响范围')
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
    trigger.remove()
  })
})

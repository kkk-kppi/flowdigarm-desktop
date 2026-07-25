import { mount } from '@vue/test-utils'
import AppIcon from '@/ui/icons/AppIcon.vue'

describe('AppIcon', () => {
  it('renders a decorative current-color mask with a stable semantic marker', () => {
    const wrapper = mount(AppIcon, { props: { name: 'undo', size: 18 } })
    const icon = wrapper.get('[data-icon="undo"]')
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(icon.attributes('style')).toContain('18px')
    expect(icon.attributes('style')).toContain('--app-icon-url')
    expect(icon.classes()).toContain('app-icon')
  })
})

// tests/unit/app-shell.test.ts
import { mount } from '@vue/test-utils'
import AppShell from '@/ui/shell/AppShell.vue'

describe('AppShell', () => {
  it('should render editor shell', () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('[data-testid="editor-shell"]').exists()).toBe(true)
  })
})

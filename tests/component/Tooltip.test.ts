import { mount } from '@vue/test-utils'
import Tooltip from '@/ui/help/Tooltip.vue'

describe('Tooltip 组件', () => {
  it('渲染提示文本与快捷键，根元素带 role="tooltip"', () => {
    const wrapper = mount(Tooltip, {
      props: { text: '撤销', shortcut: 'Ctrl+Z' },
    })
    expect(wrapper.text()).toContain('撤销')
    expect(wrapper.text()).toContain('Ctrl+Z')
    expect(wrapper.attributes('role')).toBe('tooltip')
  })
})

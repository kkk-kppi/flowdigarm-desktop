import { mount } from '@vue/test-utils'
import ContainerMembershipPicker from '@/ui/components/ContainerMembershipPicker.vue'

describe('ContainerMembershipPicker', () => {
  it('requires an explicit target container selection before confirming selected members', async () => {
    const wrapper = mount(ContainerMembershipPicker, {
      props: {
        request: {
          mode: 'add-to-container',
          containers: [{ id: 'c1', label: '容器一' }, { id: 'c2', label: '容器二' }],
          members: [{ id: 'n1', label: '节点一' }],
        },
      },
      attachTo: document.body,
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="membership-confirm"]').element.disabled).toBe(true)
    await wrapper.find<HTMLInputElement>('[value="c2"]').setValue(true)
    await wrapper.find('[data-testid="membership-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ containerId: 'c2', memberIds: ['n1'] }])
    wrapper.unmount()
  })

  it('requires explicit member selection and closes with document Escape', async () => {
    const wrapper = mount(ContainerMembershipPicker, {
      props: {
        request: {
          mode: 'add-members',
          containers: [{ id: 'c1', label: '容器一' }],
          members: [{ id: 'n1', label: '节点一' }, { id: 'n2', label: '节点二' }],
        },
      },
      attachTo: document.body,
    })
    await wrapper.find<HTMLInputElement>('[value="n2"]').setValue(true)
    await wrapper.find('[data-testid="membership-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ containerId: 'c1', memberIds: ['n2'] }])
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })

  it('traps Tab and Shift+Tab, focuses initially, and cancels from the backdrop', async () => {
    const wrapper = mount(ContainerMembershipPicker, {
      props: {
        request: {
          mode: 'add-to-container',
          containers: [{ id: 'c1', label: '容器一' }],
          members: [{ id: 'n1', label: '节点一' }],
        },
      },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    const input = wrapper.find<HTMLInputElement>('input')
    const buttons = wrapper.findAll<HTMLButtonElement>('button')
    expect(document.activeElement).toBe(input.element)
    await input.setValue(true)
    buttons.at(-1)!.element.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(input.element)
    input.element.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(buttons.at(-1)!.element)
    await wrapper.find('[data-testid="membership-backdrop"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })

  it('presents an unexpected command error inside the open modal', () => {
    const wrapper = mount(ContainerMembershipPicker, {
      props: {
        request: {
          mode: 'add-to-container',
          containers: [{ id: 'c1', label: '容器一' }],
          members: [{ id: 'n1', label: '节点一' }],
        },
        error: '容器状态已变化。',
      },
    })
    expect(wrapper.find('[role="alert"]').text()).toBe('容器状态已变化。')
  })
})

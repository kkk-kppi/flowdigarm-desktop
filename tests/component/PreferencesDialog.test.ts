import { mount } from '@vue/test-utils'
import PreferencesDialog from '@/ui/dialogs/PreferencesDialog.vue'
import { DEFAULT_EDITOR_PREFERENCES } from '@/application/settings/settings-controller'

describe('PreferencesDialog', () => {
  it('renders controls for all twelve settings with an accessible startup explanation', async () => {
    const wrapper = mount(PreferencesDialog, {
      props: { modelValue: { ...DEFAULT_EDITOR_PREFERENCES } },
    })
    const ids = [
      'theme', 'show-rulers', 'show-grid', 'show-guides', 'show-page-breaks',
      'snap-to-grid', 'default-zoom', 'default-unit', 'default-connector',
      'recent-limit', 'png-dpi', 'center-on-startup',
    ]
    expect(ids.every((id) => wrapper.find(`[data-testid="preference-${id}"]`).exists())).toBe(true)

    const center = wrapper.get<HTMLInputElement>('[data-testid="preference-center-on-startup"]')
    expect(center.attributes('aria-describedby')).toBe('preference-center-on-startup-description')
    expect(wrapper.get('#preference-center-on-startup-description').text()).toBe(
      '下次打开应用时，窗口会显示在上次使用的屏幕中央。窗口大小和最大化状态保持不变。',
    )
    expect(wrapper.text()).toContain('应用启动居中')

    await wrapper.find('[data-testid="preference-theme"]').setValue('dark')
    await wrapper.find('[data-testid="preference-show-grid"]').setValue(true)
    await wrapper.find('[data-testid="preference-recent-limit"]').setValue(12)
    await center.setValue(true)
    await wrapper.find('[data-testid="preferences-apply"]').trigger('click')

    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({
      theme: 'dark',
      showGrid: true,
      recentLimit: 12,
      centerOnStartup: true,
    })
    expect(Object.keys(wrapper.emitted('apply')?.[0]?.[0] as object)).toHaveLength(12)
  })

  it('restores defaults in the draft and closes on Escape with focus cleanup', async () => {
    const origin = document.createElement('button')
    document.body.append(origin)
    origin.focus()
    const wrapper = mount(PreferencesDialog, {
      attachTo: document.body,
      props: {
        modelValue: {
          ...DEFAULT_EDITOR_PREFERENCES,
          theme: 'dark',
          pngDpi: 600,
          centerOnStartup: true,
        },
      },
    })
    await wrapper.find('[data-testid="preferences-defaults"]').trigger('click')
    expect(wrapper.find<HTMLSelectElement>('[data-testid="preference-theme"]').element.value).toBe('system')
    expect(wrapper.find<HTMLInputElement>('[data-testid="preference-png-dpi"]').element.value).toBe('150')
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="preference-center-on-startup"]').element.checked,
    ).toBe(false)
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
    expect(document.activeElement).toBe(origin)
    origin.remove()
  })
})

import { mount } from '@vue/test-utils'
import PreferencesDialog from '@/ui/dialogs/PreferencesDialog.vue'
import { DEFAULT_EDITOR_PREFERENCES } from '@/application/settings/settings-controller'

describe('PreferencesDialog', () => {
  it('renders controls for all eleven settings and applies one complete value', async () => {
    const wrapper = mount(PreferencesDialog, {
      props: { modelValue: { ...DEFAULT_EDITOR_PREFERENCES } },
    })
    const ids = [
      'theme', 'show-rulers', 'show-grid', 'show-guides', 'show-page-breaks',
      'default-zoom', 'default-unit', 'default-connector', 'recent-limit', 'png-dpi',
    ]
    expect(ids.every((id) => wrapper.find(`[data-testid="preference-${id}"]`).exists())).toBe(true)

    await wrapper.find('[data-testid="preference-theme"]').setValue('dark')
    await wrapper.find('[data-testid="preference-show-grid"]').setValue(true)
    await wrapper.find('[data-testid="preference-recent-limit"]').setValue(12)
    await wrapper.find('[data-testid="preferences-apply"]').trigger('click')

    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ theme: 'dark', showGrid: true, recentLimit: 12 })
    expect(Object.keys(wrapper.emitted('apply')?.[0]?.[0] as object)).toHaveLength(11)
  })

  it('restores defaults in the draft and closes on Escape with focus cleanup', async () => {
    const origin = document.createElement('button')
    document.body.append(origin)
    origin.focus()
    const wrapper = mount(PreferencesDialog, {
      attachTo: document.body,
      props: { modelValue: { ...DEFAULT_EDITOR_PREFERENCES, theme: 'dark', pngDpi: 600 } },
    })
    await wrapper.find('[data-testid="preferences-defaults"]').trigger('click')
    expect(wrapper.find<HTMLSelectElement>('[data-testid="preference-theme"]').element.value).toBe('system')
    expect(wrapper.find<HTMLInputElement>('[data-testid="preference-png-dpi"]').element.value).toBe('150')
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
    expect(document.activeElement).toBe(origin)
    origin.remove()
  })
})

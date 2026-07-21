import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import UnsavedChangesDialog from '@/ui/dialogs/UnsavedChangesDialog.vue'
import RecoveryDialog from '@/ui/dialogs/RecoveryDialog.vue'
import type { RecoverySnapshot } from '@/application/persistence/persistence-ports'
import { createUnsavedDialogService } from '@/ui/services/editor-services'

describe('unsaved workflow UI bridge', () => {
  it('exposes one deferred decision and forwards application errors', async () => {
    const showError = vi.fn()
    const { unsaved, ui } = createUnsavedDialogService(showError)
    const decision = ui.confirmUnsaved('close')
    expect(unsaved.request.value?.action).toBe('close')
    unsaved.choose('discard')
    await expect(decision).resolves.toBe('discard')
    expect(unsaved.request.value).toBeNull()
    ui.showError('无法保存。')
    expect(showError).toHaveBeenCalledWith('无法保存。')
  })
})

describe('UnsavedChangesDialog', () => {
  it('focuses the primary action, traps Tab, maps Escape to cancel, and restores focus', async () => {
    const origin = document.createElement('button')
    document.body.append(origin)
    origin.focus()
    const wrapper = mount(UnsavedChangesDialog, {
      attachTo: document.body,
      props: { action: 'open' },
    })
    await nextTick()

    const save = wrapper.find<HTMLButtonElement>('[data-testid="unsaved-save"]')
    const cancel = wrapper.find<HTMLButtonElement>('[data-testid="unsaved-cancel"]')
    expect(document.activeElement).toBe(save.element)
    cancel.element.focus()
    await cancel.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(save.element)
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('choose')?.at(-1)).toEqual(['cancel'])

    wrapper.unmount()
    expect(document.activeElement).toBe(origin)
    origin.remove()
  })

  it('offers save, discard, and cancel with the required Chinese heading', async () => {
    const wrapper = mount(UnsavedChangesDialog, { props: { action: 'new' } })
    expect(wrapper.text()).toContain('未保存的更改')
    await wrapper.find('[data-testid="unsaved-save"]').trigger('click')
    await wrapper.find('[data-testid="unsaved-discard"]').trigger('click')
    await wrapper.find('[data-testid="unsaved-cancel"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['save'], ['discard'], ['cancel']])
  })
})

describe('RecoveryDialog', () => {
  const snapshot: RecoverySnapshot = {
    documentId: 'doc-1', versionToken: '2:4', name: '审批流程', json: '{}',
    sourcePath: 'C:/docs/approval.flowdiagram', updatedAt: Date.UTC(2026, 6, 21, 8, 30),
  }

  it('shows recovery metadata, restores directly, and ignores Escape', async () => {
    const wrapper = mount(RecoveryDialog, { props: { snapshot } })
    expect(wrapper.text()).toContain('审批流程')
    expect(wrapper.text()).toContain('C:/docs/approval.flowdiagram')
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('restore')).toBeUndefined()
    expect(wrapper.emitted('discard')).toBeUndefined()
    await wrapper.find('[data-testid="recovery-restore"]').trigger('click')
    expect(wrapper.emitted('restore')).toHaveLength(1)
  })

  it('requires a second explicit action before discarding and focuses that confirmation', async () => {
    const wrapper = mount(RecoveryDialog, { attachTo: document.body, props: { snapshot } })
    await wrapper.find('[data-testid="recovery-discard"]').trigger('click')
    await nextTick()
    expect(wrapper.emitted('discard')).toBeUndefined()
    expect(wrapper.text()).toContain('确认丢弃')
    const confirm = wrapper.find<HTMLButtonElement>('[data-testid="recovery-confirm-discard"]')
    expect(document.activeElement).toBe(confirm.element)
    await confirm.trigger('click')
    expect(wrapper.emitted('discard')).toHaveLength(1)
    wrapper.unmount()
  })
})

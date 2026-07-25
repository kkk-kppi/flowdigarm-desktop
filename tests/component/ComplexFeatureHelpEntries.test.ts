import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import QuickHelpButton from '@/ui/help/QuickHelpButton.vue'
import ElementLibrary from '@/ui/shapes/ElementLibrary.vue'
import PageSetupTab from '@/ui/pages/PageSetupTab.vue'
import CompactToolbar from '@/ui/toolbar/CompactToolbar.vue'
import PropertyTab from '@/ui/inspector/PropertyTab.vue'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { createTestDocument } from '../helpers/test-document'
import { getFeatureHelp } from '@/ui/help/feature-help-registry'

function prepare() {
  setActivePinia(createPinia())
  useDocumentStore().loadDocument(createTestDocument())
  useSelectionStore().setSelection(['node-1', 'node-2'])
}

describe('complex feature help entries', () => {
  it('opens registry help with an accessible icon button', async () => {
    prepare()
    const entry = getFeatureHelp('page-setup')!
    const wrapper = mount(QuickHelpButton, { props: { helpId: 'page-setup', label: '错误的重复标签' } })
    expect(wrapper.attributes('aria-label')).toBe('页面设置帮助')
    expect(wrapper.attributes('title')).toContain(entry.purpose)
    await wrapper.trigger('click')
    expect(useAppStore().helpId).toBe('page-setup')
  })

  it('shows help entry points for page setup, text formatting, format painter, connections, shapes, and groups', () => {
    prepare()
    const wrappers = [mount(ElementLibrary), mount(PageSetupTab), mount(CompactToolbar), mount(PropertyTab)]
    const ids = wrappers.flatMap((wrapper) => wrapper.findAll('[data-help-id]').map((button) => button.attributes('data-help-id')))
    expect(ids).toEqual(expect.arrayContaining(['page-setup', 'text-style', 'format-paint', 'connect', 'shape-library', 'group-container']))
    expect(wrappers.some((wrapper) => wrapper.find('[data-help-id="shape-library"] [data-icon="help"]').exists())).toBe(true)
    wrappers.forEach((wrapper) => wrapper.unmount())
  })
})

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LayerManager from '@/ui/layers/LayerManager.vue'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { createTestDocument } from '../helpers/test-document'

describe('LayerManager', () => {
  it('lists nodes and edges descending by zIndex, selects, and uses z-order commands', async () => {
    setActivePinia(createPinia())
    const documentStore = useDocumentStore()
    const selection = useSelectionStore()
    const document = createTestDocument()
    document.pages[0].nodes.forEach((node, index) => { node.zIndex = index + 1 })
    document.pages[0].edges.forEach((edge, index) => { edge.zIndex = index + 4 })
    documentStore.loadDocument(document)
    const wrapper = mount(LayerManager)
    expect(wrapper.findAll('[data-testid="layer-item"]').map((item) => item.attributes('data-cell-id'))).toEqual(['edge-2', 'edge-1', 'node-3', 'node-2', 'node-1'])
    await wrapper.find('[data-cell-id="node-1"]').trigger('click')
    expect(selection.selectedIds).toEqual(['node-1'])
    await wrapper.find('[data-testid="layer-front"]').trigger('click')
    expect(documentStore.undoLabel).toBe('置于顶层')
    expect(wrapper.text()).not.toContain('隐藏')
  })
})

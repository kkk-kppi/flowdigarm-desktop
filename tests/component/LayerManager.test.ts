import { mount } from '@vue/test-utils'
import LayerManager from '@/ui/layers/LayerManager.vue'

describe('LayerManager', () => {
  it('lists nodes and edges descending by zIndex, selects, and uses z-order commands', async () => {
    const calls: string[] = []
    let selected = ''
    const controller = {
      cells: () => [
        { id: 'edge-2', kind: 'edge' as const, name: '边2', zIndex: 5 },
        { id: 'edge-1', kind: 'edge' as const, name: '边1', zIndex: 4 },
        { id: 'node-3', kind: 'node' as const, name: '三', zIndex: 3 },
        { id: 'node-2', kind: 'node' as const, name: '二', zIndex: 2 },
        { id: 'node-1', kind: 'node' as const, name: '一', zIndex: 1 },
      ],
      isSelected: (id: string) => selected === id,
      locate: (id: string) => { selected = id; calls.push(`locate:${id}`) },
      move: (action: string) => calls.push(`move:${action}`),
    }
    const wrapper = mount(LayerManager, { props: { controller } })
    expect(wrapper.findAll('[data-testid="layer-item"]').map((item) => item.attributes('data-cell-id'))).toEqual(['edge-2', 'edge-1', 'node-3', 'node-2', 'node-1'])
    await wrapper.find('[data-cell-id="node-1"]').trigger('click')
    expect(calls).toContain('locate:node-1')
    await wrapper.find('[data-testid="layer-front"]').trigger('click')
    expect(calls).toContain('move:to-front')
    expect(wrapper.text()).not.toContain('隐藏')
  })
})

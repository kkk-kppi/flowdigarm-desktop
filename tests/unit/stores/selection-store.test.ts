// tests/unit/stores/selection-store.test.ts
// 选择 store：保序选择列表（首元素=选择锚点）、toggle、增删、清空。
import { createPinia, setActivePinia } from 'pinia'
import { useSelectionStore } from '@/stores/selection-store'

describe('selection-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始为空选择', () => {
    const store = useSelectionStore()
    expect(store.selectedIds).toEqual([])
    expect(store.anchorId).toBeUndefined()
    expect(store.count).toBe(0)
    expect(store.hasSelection).toBe(false)
  })

  it('setSelection 保序：首元素为选择锚点', () => {
    const store = useSelectionStore()
    store.setSelection(['节点-丙', '节点-甲', '节点-乙'])
    expect(store.selectedIds).toEqual(['节点-丙', '节点-甲', '节点-乙'])
    expect(store.anchorId).toBe('节点-丙')
    expect(store.count).toBe(3)
    expect(store.hasSelection).toBe(true)
  })

  it('isSelected 命中判断', () => {
    const store = useSelectionStore()
    store.setSelection(['节点-甲'])
    expect(store.isSelected('节点-甲')).toBe(true)
    expect(store.isSelected('节点-乙')).toBe(false)
  })

  it('toggle：未选中则追加末尾，已选中则移除', () => {
    const store = useSelectionStore()
    store.setSelection(['节点-甲', '节点-乙'])
    store.toggle('节点-丙')
    expect(store.selectedIds).toEqual(['节点-甲', '节点-乙', '节点-丙'])
    store.toggle('节点-甲')
    expect(store.selectedIds).toEqual(['节点-乙', '节点-丙'])
    // 锚点被移除后锚点变为新首元素
    expect(store.anchorId).toBe('节点-乙')
  })

  it('addToSelection 追加未选中的，已存在的不重复', () => {
    const store = useSelectionStore()
    store.setSelection(['节点-甲'])
    store.addToSelection(['节点-乙', '节点-甲', '节点-丙'])
    expect(store.selectedIds).toEqual(['节点-甲', '节点-乙', '节点-丙'])
  })

  it('removeFromSelection 移除指定项并保持剩余顺序', () => {
    const store = useSelectionStore()
    store.setSelection(['节点-甲', '节点-乙', '节点-丙', '节点-丁'])
    store.removeFromSelection(['节点-乙', '节点-丁', '不存在'])
    expect(store.selectedIds).toEqual(['节点-甲', '节点-丙'])
  })

  it('clear 清空选择', () => {
    const store = useSelectionStore()
    store.setSelection(['节点-甲', '节点-乙'])
    store.clear()
    expect(store.selectedIds).toEqual([])
    expect(store.hasSelection).toBe(false)
    expect(store.anchorId).toBeUndefined()
  })
})

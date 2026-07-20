// tests/unit/stores/app-store.test.ts
// 应用视图设置：默认值对齐详细设计 §9.4；这些开关为视图操作，不进入撤销历史。
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '@/stores/app-store'

describe('app-store 视图设置', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认值：标尺开、网格关、参考线开、分页符关、吸附开、主题跟随系统', () => {
    const store = useAppStore()
    expect(store.showRulers).toBe(true)
    expect(store.showGrid).toBe(false)
    expect(store.showGuides).toBe(true)
    expect(store.showPageBreaks).toBe(false)
    expect(store.snapToGrid).toBe(true)
    expect(store.theme).toBe('system')
  })

  it('toggle 动作逐项取反且互不影响', () => {
    const store = useAppStore()
    store.toggleRulers()
    expect(store.showRulers).toBe(false)
    expect(store.showGrid).toBe(false)
    store.toggleGrid()
    expect(store.showGrid).toBe(true)
    store.toggleGuides()
    expect(store.showGuides).toBe(false)
    store.togglePageBreaks()
    expect(store.showPageBreaks).toBe(true)
    store.toggleSnap()
    expect(store.snapToGrid).toBe(false)
    store.toggleRulers()
    expect(store.showRulers).toBe(true)
  })

  it('右侧面板折叠默认展开；toggleRightPanel 取反（视图状态）', () => {
    const store = useAppStore()
    expect(store.rightPanelCollapsed).toBe(false)
    store.toggleRightPanel()
    expect(store.rightPanelCollapsed).toBe(true)
    store.toggleRightPanel()
    expect(store.rightPanelCollapsed).toBe(false)
  })

  it('管理查找、图层与帮助面板状态而不承载业务命令', () => {
    const store = useAppStore()
    expect(store.rightPanelMode).toBe('properties')
    store.openFindPanel()
    expect(store.rightPanelMode).toBe('find')
    expect(store.rightPanelCollapsed).toBe(false)
    store.openLayerManager()
    expect(store.layerManagerOpen).toBe(true)
    store.openHelp('find-replace')
    expect(store.helpId).toBe('find-replace')
    store.closeHelp()
    expect(store.helpId).toBeNull()
    store.showProperties()
    expect(store.rightPanelMode).toBe('properties')
  })
})

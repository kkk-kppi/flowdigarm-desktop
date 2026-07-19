import { featureHelpRegistry, getFeatureHelp } from '@/ui/help/feature-help-registry'

describe('功能帮助注册表', () => {
  it('至少包含 undo 与 redo 两条首批条目', () => {
    expect(featureHelpRegistry.has('undo')).toBe(true)
    expect(featureHelpRegistry.has('redo')).toBe(true)
  })

  it('每个条目的 8 个必填字段均非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const entry of featureHelpRegistry.values()) {
      for (const field of requiredFields) {
        expect(entry[field]).toBeTruthy()
      }
    }
  })

  it('getFeatureHelp 命中返回条目，未命中返回 undefined', () => {
    expect(getFeatureHelp('undo')?.id).toBe('undo')
    expect(getFeatureHelp('不存在')).toBeUndefined()
  })

  it('画布与视图条目（rulers/grid/zoom/fit-view）均可取出且 8 字段非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const id of ['rulers', 'grid', 'zoom', 'fit-view']) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
      // 视图操作的撤销边界必须写明不进入撤销历史
      expect(entry?.undoBoundary).toContain('不进入撤销历史')
      expect(entry?.docAnchor).toBe('user-guide#画布与视图')
    }
  })
})

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

  it('页面管理条目（page-setup/page-breaks/background-page/page-tabs）均已注册且 8 字段非空', () => {
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
    for (const id of ['page-setup', 'page-breaks', 'background-page', 'page-tabs']) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
    }
  })

  it('page-setup 撤销边界写明「一次应用一条记录」', () => {
    expect(getFeatureHelp('page-setup')?.undoBoundary).toContain('一次应用一条记录')
  })

  it('page-breaks 撤销边界写明视图开关不进入撤销历史', () => {
    expect(getFeatureHelp('page-breaks')?.undoBoundary).toContain('不进入撤销历史')
  })

  it('page-tabs 撤销边界写明切换页不产生命令', () => {
    expect(getFeatureHelp('page-tabs')?.undoBoundary).toContain('不产生命令')
  })

  it('background-page 限制条件写明背景页内容不可在前景页选择', () => {
    expect(getFeatureHelp('background-page')?.limits).toContain('不可在前景页直接选择')
  })

  it('图元/连接/剪贴板/删除条目（shape-library/connect/clipboard/delete-cells）均已注册且 8 字段非空', () => {
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
    for (const id of ['shape-library', 'connect', 'clipboard', 'delete-cells']) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
    }
  })

  it('clipboard 撤销边界写明一次粘贴只产生一条记录', () => {
    expect(getFeatureHelp('clipboard')?.undoBoundary).toContain('一次粘贴')
    expect(getFeatureHelp('clipboard')?.undoBoundary).toContain('一条记录')
  })

  it('delete-cells 撤销边界写明一次删除多个图元只产生一条记录', () => {
    expect(getFeatureHelp('delete-cells')?.undoBoundary).toContain('一条记录')
  })
})

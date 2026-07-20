import { contextMenuItems, type ContextKind } from '@/application/menus/context-menu-model'

describe('contextMenuItems', () => {
  const unavailable = {
    canPaste: false, selectedTargetCount: 0, selectedNodeCount: 0, selectedGroupCount: 0,
    selectedContainerCount: 0, selectedParentedNodeCount: 0, eligibleNodeCount: 0,
    hasTextSelection: false, hasFormatPaintSource: false, compatibleFormatPaintTargetCount: 0,
    canAddToContainer: false, canAddMembers: false,
  }
  const expected: Record<ContextKind, string[]> = {
    blank: ['粘贴', '全选', '页面设置'],
    node: ['剪切', '复制', '粘贴', '删除', '编辑文本', '链接', '置于顶层', '置于底层', '上移一层', '下移一层', '组合', '加入容器', '文本样式'],
    edge: ['剪切', '复制', '删除', '编辑标签', '链接', '线条样式'],
    multi: ['剪切', '复制', '删除', '格式刷', '对齐', '分布', '自动连线', '组合'],
    container: ['复制', '删除', '取消组合或移出容器', '添加成员', '置于顶层', '置于底层'],
  }

  it.each(Object.entries(expected) as Array<[ContextKind, string[]]>)('returns exact %s items', (kind, labels) => {
    expect(contextMenuItems(kind, unavailable).map((item) => item.label)).toEqual(labels)
  })

  it('returns command IDs and disabled reasons without business callbacks', () => {
    const items = contextMenuItems('blank', unavailable)
    expect(items.every((item) => typeof item.id === 'string')).toBe(true)
    expect(items[0].disabledReason).toBe('剪贴板为空。')
  })

  it('provides existing alignment and distribution command IDs as submenus', () => {
    const items = contextMenuItems('multi', { ...unavailable, canPaste: true, selectedTargetCount: 3, selectedNodeCount: 3, eligibleNodeCount: 3, hasTextSelection: true })
    expect(items.find((item) => item.label === '对齐')?.children?.map((item) => item.id)).toEqual([
      'arrange-align-left', 'arrange-align-center-h', 'arrange-align-right',
      'arrange-align-top', 'arrange-align-middle-v', 'arrange-align-bottom',
    ])
    expect(items.find((item) => item.label === '分布')?.children?.map((item) => item.id)).toEqual([
      'arrange-distribute-horizontal', 'arrange-distribute-vertical',
    ])
  })

  it('disables commands using their exact prerequisites and exposes Chinese reasons', () => {
    const multi = contextMenuItems('multi', { ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, eligibleNodeCount: 2 })
    expect(multi.find((item) => item.id === 'arrange-align')?.disabledReason).toBeUndefined()
    expect(multi.find((item) => item.id === 'arrange-distribute')?.disabledReason).toBe('至少选择三个节点。')
    expect(multi.find((item) => item.id === 'arrange-auto-connect')?.disabledReason).toBeUndefined()
    expect(multi.find((item) => item.id === 'context-format-paint')?.disabledReason).toBe('请先选择单个源图元并启用格式刷。')

    const node = contextMenuItems('node', unavailable)
    expect(node.find((item) => item.id === 'context-add-container')?.disabledReason).toBe('没有可加入的目标容器。')
    expect(node.find((item) => item.id === 'format-font')?.disabledReason).toBe('所选图元没有可编辑文本。')

    const container = contextMenuItems('container', { ...unavailable, selectedContainerCount: 1 })
    expect(container.find((item) => item.id === 'context-add-members')?.disabledReason).toBe('没有可添加的成员。')
  })

  it('enables context format paint only with an armed source and effective compatible target', () => {
    const noTarget = contextMenuItems('multi', {
      ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, eligibleNodeCount: 2, hasFormatPaintSource: true,
    })
    expect(noTarget.find((item) => item.id === 'context-format-paint')?.disabledReason).toBe('所选图元中没有可应用格式的目标。')
    const enabled = contextMenuItems('multi', {
      ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, eligibleNodeCount: 2,
      hasFormatPaintSource: true, compatibleFormatPaintTargetCount: 1,
    })
    expect(enabled.find((item) => item.id === 'context-format-paint')?.disabledReason).toBeUndefined()
  })

  it('uses eligible node count for auto-connect and exact ungroup-or-remove prerequisites', () => {
    const multi = contextMenuItems('multi', { ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, eligibleNodeCount: 1 })
    expect(multi.find((item) => item.id === 'arrange-auto-connect')?.disabledReason).toBe('至少选择两个可自动连线的节点。')

    const allGroups = contextMenuItems('container', { ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, selectedGroupCount: 2 })
    expect(allGroups.find((item) => item.id === 'ungroup-or-remove')?.disabledReason).toBeUndefined()
    const parented = contextMenuItems('container', { ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, selectedParentedNodeCount: 2 })
    expect(parented.find((item) => item.id === 'ungroup-or-remove')?.disabledReason).toBeUndefined()
    const mixed = contextMenuItems('container', {
      ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, selectedGroupCount: 1, selectedParentedNodeCount: 1,
    })
    expect(mixed.find((item) => item.id === 'ungroup-or-remove')?.disabledReason).toBe('不能同时取消组合和移出容器。')
  })

  it('exposes ungroup-or-remove only in eligible node and multi contexts', () => {
    expect(contextMenuItems('node', unavailable).some((item) => item.id === 'ungroup-or-remove')).toBe(false)
    expect(contextMenuItems('node', {
      ...unavailable, selectedTargetCount: 1, selectedNodeCount: 1, selectedParentedNodeCount: 1,
    }).find((item) => item.id === 'ungroup-or-remove')).toMatchObject({ disabledReason: undefined })

    expect(contextMenuItems('multi', {
      ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, selectedGroupCount: 2,
    }).find((item) => item.id === 'ungroup-or-remove')).toMatchObject({ disabledReason: undefined })
    expect(contextMenuItems('multi', {
      ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, selectedParentedNodeCount: 2,
    }).find((item) => item.id === 'ungroup-or-remove')).toMatchObject({ disabledReason: undefined })
    expect(contextMenuItems('multi', {
      ...unavailable, selectedTargetCount: 2, selectedNodeCount: 2, selectedParentedNodeCount: 1,
    }).some((item) => item.id === 'ungroup-or-remove')).toBe(false)
  })
})

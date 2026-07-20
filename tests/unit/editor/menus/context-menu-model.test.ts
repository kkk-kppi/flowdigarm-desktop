import { contextMenuItems, type ContextKind } from '@/application/menus/context-menu-model'

describe('contextMenuItems', () => {
  const unavailable = {
    canPaste: false, selectedNodeCount: 0, selectedGroupCount: 0,
    selectedContainerCount: 0, hasTextSelection: false,
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
    const items = contextMenuItems('multi', { ...unavailable, canPaste: true, selectedNodeCount: 3, hasTextSelection: true })
    expect(items.find((item) => item.label === '对齐')?.children?.map((item) => item.id)).toEqual([
      'arrange-align-left', 'arrange-align-center-h', 'arrange-align-right',
      'arrange-align-top', 'arrange-align-middle-v', 'arrange-align-bottom',
    ])
    expect(items.find((item) => item.label === '分布')?.children?.map((item) => item.id)).toEqual([
      'arrange-distribute-horizontal', 'arrange-distribute-vertical',
    ])
  })

  it('disables commands using their exact prerequisites and exposes Chinese reasons', () => {
    const multi = contextMenuItems('multi', { ...unavailable, selectedNodeCount: 2 })
    expect(multi.find((item) => item.id === 'arrange-align')?.disabledReason).toBeUndefined()
    expect(multi.find((item) => item.id === 'arrange-distribute')?.disabledReason).toBe('至少选择三个节点。')
    expect(multi.find((item) => item.id === 'arrange-auto-connect')?.disabledReason).toBeUndefined()
    expect(multi.find((item) => item.id === 'context-format-paint')?.disabledReason).toBe('格式刷需要恰好一个源图元。')

    const node = contextMenuItems('node', unavailable)
    expect(node.find((item) => item.id === 'context-add-container')?.disabledReason).toBe('没有可加入的目标容器。')
    expect(node.find((item) => item.id === 'format-font')?.disabledReason).toBe('所选图元没有可编辑文本。')

    const container = contextMenuItems('container', { ...unavailable, selectedContainerCount: 1 })
    expect(container.find((item) => item.id === 'context-add-members')?.disabledReason).toBe('没有可添加的成员。')
  })
})

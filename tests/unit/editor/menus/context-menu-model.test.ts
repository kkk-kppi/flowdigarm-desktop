import { contextMenuItems, type ContextKind } from '@/application/menus/context-menu-model'

describe('contextMenuItems', () => {
  const expected: Record<ContextKind, string[]> = {
    blank: ['粘贴', '全选', '页面设置'],
    node: ['剪切', '复制', '粘贴', '删除', '编辑文本', '链接', '置于顶层', '置于底层', '上移一层', '下移一层', '组合', '加入容器', '文本样式'],
    edge: ['剪切', '复制', '删除', '编辑标签', '链接', '线条样式'],
    multi: ['剪切', '复制', '删除', '格式刷', '对齐', '分布', '自动连线', '组合'],
    container: ['复制', '删除', '取消组合或移出容器', '添加成员', '置于顶层', '置于底层'],
  }

  it.each(Object.entries(expected) as Array<[ContextKind, string[]]>)('returns exact %s items', (kind, labels) => {
    expect(contextMenuItems(kind, { canPaste: false, canGroup: false, canUngroup: false }).map((item) => item.label)).toEqual(labels)
  })

  it('returns command IDs and disabled reasons without business callbacks', () => {
    const items = contextMenuItems('blank', { canPaste: false, canGroup: false, canUngroup: false })
    expect(items.every((item) => typeof item.id === 'string')).toBe(true)
    expect(items[0].disabledReason).toBe('剪贴板为空。')
  })

  it('provides existing alignment and distribution command IDs as submenus', () => {
    const items = contextMenuItems('multi', { canPaste: true, canGroup: true, canUngroup: false })
    expect(items.find((item) => item.label === '对齐')?.children?.map((item) => item.id)).toEqual([
      'arrange-align-left', 'arrange-align-center-h', 'arrange-align-right',
      'arrange-align-top', 'arrange-align-middle-v', 'arrange-align-bottom',
    ])
    expect(items.find((item) => item.label === '分布')?.children?.map((item) => item.id)).toEqual([
      'arrange-distribute-horizontal', 'arrange-distribute-vertical',
    ])
  })
})

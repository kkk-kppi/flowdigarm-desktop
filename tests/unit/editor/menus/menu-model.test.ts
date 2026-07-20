import { createMainMenus } from '@/application/menus/menu-model'

describe('createMainMenus', () => {
  it('defines the seven exact Chinese top-level menus and item labels', () => {
    const menus = createMainMenus({ canUndo: true, canRedo: true, hasSelection: true, canPaste: true })
    expect(menus.map((menu) => menu.label)).toEqual(['文件', '编辑', '视图', '插入', '格式', '工具', '帮助'])
    expect(menus[0].items.map((item) => item.label)).toEqual([
      '新建', '打开', '保存', '另存为', '最近文件', '导出', '页面设置',
    ])
    expect(menus[1].items.map((item) => item.label)).toEqual([
      '撤销', '重做', '剪切', '复制', '粘贴', '重复', '全选', '删除',
    ])
    expect(menus[2].items.map((item) => item.label)).toEqual([
      '放大', '缩小', '适应屏幕', '适应页面', '适应内容', '适应选区', '标尺', '网格', '参考线', '分页符',
    ])
    expect(menus[3].items.map((item) => item.label)).toEqual(['矩形', '圆形', '菱形', '文本框', '连接线', '外部图片'])
    expect(menus[4].items.map((item) => item.label)).toEqual([
      '字体设置', '水平/垂直对齐', '置于顶层', '置于底层', '上移一层', '下移一层', '组合', '取消组合',
    ])
    expect(menus[5].items.map((item) => item.label)).toEqual([
      '自动对齐', '自动连线', '对齐', '分布', '查找替换', '图层管理', '首选项',
    ])
    expect(menus[6].items.map((item) => item.label)).toEqual(['帮助中心', '快捷键列表', '关于'])
    expect(menus[5].items.find((item) => item.label === '对齐')?.children?.map((item) => item.label)).toEqual([
      '左对齐', '水平居中', '右对齐', '顶端对齐', '垂直居中', '底端对齐',
    ])
    expect(menus[5].items.find((item) => item.label === '分布')?.children?.map((item) => item.label)).toEqual(['水平分布', '垂直分布'])
  })

  it('gives every disabled item a Chinese reason and exposes checked states', () => {
    const menus = createMainMenus({
      canUndo: false, canRedo: false, hasSelection: false, canPaste: false,
      showGrid: true, showRulers: false,
    })
    const items = menus.flatMap((menu) => menu.items.flatMap((item) => [item, ...(item.children ?? [])]))
    expect(items.filter((item) => item.disabledReason !== undefined).every((item) => /[\u4e00-\u9fff]/.test(item.disabledReason!))).toBe(true)
    expect(items.find((item) => item.id === 'view-grid')?.checked).toBe(true)
    expect(items.find((item) => item.id === 'edit-undo')?.disabledReason).toBe('没有可撤销的操作。')
  })
})

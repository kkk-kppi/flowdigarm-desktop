export interface MenuItem {
  id: string
  label: string
  shortcut?: string
  helpId?: string
  children?: MenuItem[]
  separatorBefore?: boolean
  checked?: boolean
  disabledReason?: string
}

export interface MenuDefinition {
  id: string
  label: string
  items: MenuItem[]
}

export interface MenuState {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  canPaste: boolean
  selectedNodeCount: number
  selectedGroupCount: number
  selectedContainerCount: number
  hasTextSelection: boolean
  showRulers?: boolean
  showGrid?: boolean
  showGuides?: boolean
  showPageBreaks?: boolean
}

function disabled(condition: boolean, reason: string): string | undefined {
  return condition ? undefined : reason
}

export function createMainMenus(state: MenuState): MenuDefinition[] {
  const selectionReason = disabled(state.hasSelection, '请先选择图元。')
  const twoNodesReason = disabled(state.selectedNodeCount >= 2, '至少选择两个节点。')
  const threeNodesReason = disabled(state.selectedNodeCount >= 3, '至少选择三个节点。')
  const groupReason = disabled(state.selectedGroupCount > 0, '请先选择组合。')
  const textReason = disabled(state.hasTextSelection, '所选图元没有可编辑文本。')
  return [
    {
      id: 'file', label: '文件', items: [
        { id: 'file-new', label: '新建', shortcut: 'Ctrl+N' },
        { id: 'file-open', label: '打开', shortcut: 'Ctrl+O' },
        { id: 'file-save', label: '保存', shortcut: 'Ctrl+S' },
        { id: 'file-save-as', label: '另存为', shortcut: 'Ctrl+Shift+S' },
        { id: 'file-recent', label: '最近文件', separatorBefore: true },
        { id: 'file-export', label: '导出', helpId: 'export' },
        { id: 'file-page-setup', label: '页面设置', helpId: 'page-setup' },
      ],
    },
    {
      id: 'edit', label: '编辑', items: [
        { id: 'edit-undo', label: '撤销', shortcut: 'Ctrl+Z', helpId: 'undo', disabledReason: disabled(state.canUndo, '没有可撤销的操作。') },
        { id: 'edit-redo', label: '重做', shortcut: 'Ctrl+Y', helpId: 'redo', disabledReason: disabled(state.canRedo, '没有可重做的操作。') },
        { id: 'edit-cut', label: '剪切', shortcut: 'Ctrl+X', separatorBefore: true, disabledReason: selectionReason },
        { id: 'edit-copy', label: '复制', shortcut: 'Ctrl+C', disabledReason: selectionReason },
        { id: 'edit-paste', label: '粘贴', shortcut: 'Ctrl+V', disabledReason: disabled(state.canPaste, '剪贴板为空。') },
        { id: 'edit-duplicate', label: '重复', shortcut: 'Ctrl+D', disabledReason: selectionReason },
        { id: 'edit-select-all', label: '全选', shortcut: 'Ctrl+A', separatorBefore: true },
        { id: 'edit-delete', label: '删除', shortcut: 'Delete', disabledReason: selectionReason },
      ],
    },
    {
      id: 'view', label: '视图', items: [
        { id: 'view-zoom-in', label: '放大', shortcut: 'Ctrl++' },
        { id: 'view-zoom-out', label: '缩小', shortcut: 'Ctrl+-' },
        { id: 'view-fit-screen', label: '适应屏幕', separatorBefore: true, helpId: 'fit-view' },
        { id: 'view-fit-page', label: '适应页面', helpId: 'fit-view' },
        { id: 'view-fit-content', label: '适应内容', helpId: 'fit-view' },
        { id: 'view-fit-selection', label: '适应选区', helpId: 'fit-view', disabledReason: selectionReason },
        { id: 'view-rulers', label: '标尺', separatorBefore: true, checked: state.showRulers, helpId: 'rulers' },
        { id: 'view-grid', label: '网格', checked: state.showGrid, helpId: 'grid' },
        { id: 'view-guides', label: '参考线', checked: state.showGuides },
        { id: 'view-page-breaks', label: '分页符', checked: state.showPageBreaks, helpId: 'page-breaks' },
      ],
    },
    {
      id: 'insert', label: '插入', items: [
        { id: 'insert-rect', label: '矩形' },
        { id: 'insert-circle', label: '圆形' },
        { id: 'insert-diamond', label: '菱形' },
        { id: 'insert-text', label: '文本框' },
        { id: 'insert-edge', label: '连接线', helpId: 'connect' },
        { id: 'insert-image', label: '外部图片' },
      ],
    },
    {
      id: 'format', label: '格式', items: [
        { id: 'format-font', label: '字体设置', helpId: 'text-style', disabledReason: textReason },
        { id: 'format-alignment', label: '水平/垂直对齐', disabledReason: twoNodesReason },
        { id: 'arrange-to-front', label: '置于顶层', separatorBefore: true, helpId: 'z-order', disabledReason: selectionReason },
        { id: 'arrange-to-back', label: '置于底层', helpId: 'z-order', disabledReason: selectionReason },
        { id: 'arrange-forward', label: '上移一层', helpId: 'z-order', disabledReason: selectionReason },
        { id: 'arrange-backward', label: '下移一层', helpId: 'z-order', disabledReason: selectionReason },
        { id: 'arrange-group', label: '组合', separatorBefore: true, helpId: 'group-container', disabledReason: twoNodesReason },
        { id: 'arrange-ungroup', label: '取消组合', helpId: 'group-container', disabledReason: groupReason },
      ],
    },
    {
      id: 'tools', label: '工具', items: [
        { id: 'tool-auto-align', label: '自动对齐', disabledReason: twoNodesReason },
        { id: 'arrange-auto-connect', label: '自动连线', helpId: 'auto-connect', disabledReason: twoNodesReason },
        {
          id: 'arrange-align', label: '对齐', helpId: 'align', children: [
            { id: 'arrange-align-left', label: '左对齐' },
            { id: 'arrange-align-center-h', label: '水平居中' },
            { id: 'arrange-align-right', label: '右对齐' },
            { id: 'arrange-align-top', label: '顶端对齐' },
            { id: 'arrange-align-middle-v', label: '垂直居中' },
            { id: 'arrange-align-bottom', label: '底端对齐' },
          ], disabledReason: twoNodesReason,
        },
        {
          id: 'arrange-distribute', label: '分布', helpId: 'distribute', children: [
            { id: 'arrange-distribute-horizontal', label: '水平分布' },
            { id: 'arrange-distribute-vertical', label: '垂直分布' },
          ], disabledReason: threeNodesReason,
        },
        { id: 'tool-find', label: '查找替换', separatorBefore: true, helpId: 'find-replace' },
        { id: 'tool-layers', label: '图层管理', helpId: 'layer-manager' },
        { id: 'tool-preferences', label: '首选项', helpId: 'preferences' },
      ],
    },
    {
      id: 'help', label: '帮助', items: [
        { id: 'help-center', label: '帮助中心', helpId: 'menus' },
        { id: 'help-shortcuts', label: '快捷键列表', helpId: 'shortcuts' },
        { id: 'help-about', label: '关于', helpId: 'about' },
      ],
    },
  ]
}

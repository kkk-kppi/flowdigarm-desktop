/**
 * 功能帮助注册表：为每个功能提供面向用户的说明条目。
 * 条目内容使用简体中文；后续任务按功能逐个补全注册。
 */
export interface FeatureHelpEntry {
  /** 功能唯一标识，如 undo */
  id: string
  /** 功能名称 */
  title: string
  /** 快捷键（无快捷键的功能可省略） */
  shortcut?: string
  /** 功能目的 */
  purpose: string
  /** 操作方式 */
  operation: string
  /** 作用范围 */
  scope: string
  /** 撤销边界 */
  undoBoundary: string
  /** 限制条件 */
  limits: string
  /** 文档锚点，指向 docs/user-guide.md 等文档章节 */
  docAnchor: string
}

const firstEntries: readonly FeatureHelpEntry[] = [
  {
    id: 'undo',
    title: '撤销',
    shortcut: 'Ctrl+Z',
    purpose: '回退上一次编辑，让文档恢复到该次编辑发生前的状态。',
    operation: '点击工具栏"撤销"按钮，或按 Ctrl+Z（macOS 为 Cmd+Z）。',
    scope: '作用于当前文档的编辑命令历史，按时间倒序逐条回退。',
    undoBoundary: '一次用户行为一条记录：撤销回退最近一条记录，撤销本身不再产生新记录。',
    limits: '缩放、平移、网格与标尺开关等视图操作不进入历史，无法撤销。',
    docAnchor: 'user-guide#编辑',
  },
  {
    id: 'redo',
    title: '重做',
    shortcut: 'Ctrl+Y',
    purpose: '重新应用刚被撤销的编辑，恢复到撤销之前的状态。',
    operation: '点击工具栏"重做"按钮，或按 Ctrl+Y（macOS 为 Cmd+Shift+Z）。',
    scope: '作用于当前文档已被撤销的命令，按时间顺序逐条重做。',
    undoBoundary: '一次用户行为一条记录：重做恢复被撤销的记录；一旦发生新编辑，重做分支即被清空。',
    limits: '没有已撤销的命令时不可用；新命令产生后旧的撤销分支不可再重做。',
    docAnchor: 'user-guide#编辑',
  },
  {
    id: 'rulers',
    title: '标尺',
    purpose: '在画布顶部与左侧显示随页面单位、缩放和平移实时换算的刻度，帮助对齐与度量。',
    operation: '通过"视图"菜单的"标尺"开关显示或隐藏；刻度随缩放、平移与页面单位自动更新。',
    scope: '作用于当前画布的水平与垂直两条标尺叠层，仅为视觉辅助，不修改文档。',
    undoBoundary: '视图操作不进入撤销历史：显示或隐藏标尺不产生可撤销记录。',
    limits: '刻度按 1/2/5×10ⁿ 自适应，主刻度约 60–120 CSS px；仅支持 mm/cm/in/pt/px 五种页面单位。',
    docAnchor: 'user-guide#画布与视图',
  },
  {
    id: 'grid',
    title: '网格',
    purpose: '在画布上显示点阵网格，配合吸附帮助图元对齐。',
    operation: '通过"视图"菜单的"网格"开关显示或隐藏；默认隐藏。',
    scope: '作用于当前画布背景的点阵网格显示状态，仅为视觉辅助，不修改文档。',
    undoBoundary: '视图操作不进入撤销历史：显示或隐藏网格不产生可撤销记录。',
    limits: '网格为点阵样式；网格吸附的开启与"对齐到网格"设置联动，吸附间距取页面网格尺寸。',
    docAnchor: 'user-guide#画布与视图',
  },
  {
    id: 'zoom',
    title: '缩放',
    shortcut: 'Ctrl+滚轮',
    purpose: '放大或缩小画布视图，便于查看细节或整体布局。',
    operation:
      '按住 Ctrl（macOS 为 Cmd）滚动鼠标滚轮，以光标位置为锚点缩放；也可使用缩放控件或放大/缩小命令。',
    scope: '仅作用于当前视口的显示比例，不修改文档中任何 pt 几何。',
    undoBoundary: '视图操作不进入撤销历史：缩放不产生可撤销记录。',
    limits: '缩放范围为 10%–400%；100% 时 1 英寸等于 96 CSS px。',
    docAnchor: 'user-guide#画布与视图',
  },
  {
    id: 'fit-view',
    title: '适应视图',
    purpose: '一键将页面、全部内容或选中图元适配到当前视口大小并居中。',
    operation: '通过"视图"菜单选择适应窗口/页面、适应内容或适应选择；仅调整缩放与平移。',
    scope: '仅作用于当前视口的缩放与平移，不修改文档中任何 pt 几何。',
    undoBoundary: '视图操作不进入撤销历史：四种适应操作均不产生可撤销记录。',
    limits: '适应后的缩放同样钳制在 10%–400%；无选中图元时"适应选择"不可用，空页面时"适应内容"退化为适应页面。',
    docAnchor: 'user-guide#画布与视图',
  },
]

/** 全部已注册的功能帮助条目，按 id 索引。 */
export const featureHelpRegistry: ReadonlyMap<string, FeatureHelpEntry> = new Map(
  firstEntries.map((entry) => [entry.id, entry]),
)

/** 按 id 查询帮助条目；未注册时返回 undefined。 */
export function getFeatureHelp(id: string): FeatureHelpEntry | undefined {
  return featureHelpRegistry.get(id)
}

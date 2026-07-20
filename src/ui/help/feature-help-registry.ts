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

const entries: readonly FeatureHelpEntry[] = [
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
  {
    id: 'page-tabs',
    title: '页面标签',
    purpose: '在页面标签栏管理文档的多页：新建、切换、重命名与删除页面。',
    operation:
      '单击页签切换页面；双击页签进入行内重命名（回车/失焦提交、Esc 取消）；页数大于 1 时点击页签上的 × 并在内联确认中删除；末尾 + 按钮新建页面。',
    scope: '作用于当前文档的页面列表与活动页；每页拥有独立的撤销栈与视口状态。',
    undoBoundary:
      '新建/删除/重命名各为一条撤销记录；切换页不产生命令，不进入撤销历史。',
    limits: '至少保留一个页面；被引用为背景页的页面不能删除；页面名称不能为空。',
    docAnchor: 'user-guide#文件',
  },
  {
    id: 'page-setup',
    title: '页面设置',
    purpose: '集中编辑当前页的页面属性（纸张/方向/单位/背景）与连线配置（类型/箭头/标签/跳线）。',
    operation:
      '在右侧"页面设置"标签页中编辑，点击"应用"一次生效；"重置"恢复显示为页面当前值；"自动调整大小"按内容外接矩形加边距重设页面尺寸。',
    scope: '仅作用于当前页的页面设置字段；不修改任何图元几何（单位切换只改显示，pt 值不变）。',
    undoBoundary: '一次应用一条记录：点击"应用"把全部修改打包为一条页面设置记录；无变化时不产生记录。',
    limits: '背景页只能引用背景类型的页面且不允许循环引用；页面无图元时"自动调整大小"不可用。',
    docAnchor: 'user-guide#文件',
  },
  {
    id: 'page-breaks',
    title: '分页符',
    purpose: '以低对比虚线显示真实打印分块边界，帮助排版时避开打印拼接位置。',
    operation: '通过"视图"菜单的"分页符"开关显示或隐藏；默认隐藏。',
    scope: '作用于当前画布的分页符叠层，仅为视觉辅助，不修改文档。',
    undoBoundary: '视图开关不进入撤销历史：显示或隐藏分页符不产生可撤销记录。',
    limits: '分块按 A4 打印纸减四边 5mm 打印机边距的可打印区域计算；页面不大于单张可打印区域时不显示分页线。',
    docAnchor: 'user-guide#画布与视图',
  },
  {
    id: 'background-page',
    title: '背景页',
    purpose: '让多个前景页共享统一的底图（如页眉、边框、模板），集中维护公共内容。',
    operation:
      '将页面设为背景类型后，在前景页的"页面设置→背景页"下拉中选择引用；编辑背景内容需切换到该背景页。',
    scope: '渲染、打印与导出按先背景页后前景页绘制；一个前景页最多引用一个背景页（直接引用）。',
    undoBoundary: '设置或取消背景页引用随页面设置一次应用一条记录。',
    limits: '背景页内容不可在前景页直接选择；背景页引用不允许形成循环；被引用的背景页不能删除。',
    docAnchor: 'user-guide#文件',
  },
]

/** 全部已注册的功能帮助条目，按 id 索引。 */
export const featureHelpRegistry: ReadonlyMap<string, FeatureHelpEntry> = new Map(
  entries.map((entry) => [entry.id, entry]),
)

/** 按 id 查询帮助条目；未注册时返回 undefined。 */
export function getFeatureHelp(id: string): FeatureHelpEntry | undefined {
  return featureHelpRegistry.get(id)
}

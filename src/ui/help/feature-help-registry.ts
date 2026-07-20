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
  {
    id: 'shape-library',
    title: '图元库',
    purpose: '从内置形状库快速创建图元：搜索、按分类浏览，拖入画布或双击直接创建。',
    operation:
      '左栏图元库顶部搜索框按名称过滤；「基本形状」「流程图」分类可折叠；按住格子拖入画布放置，或双击/回车在视口中心创建。',
    scope: '内置 14 个形状中的 12 个（基本形状 6 + 流程图 6）；文本框与图片经插入入口创建。',
    undoBoundary: '一次创建一条记录：单次拖入、双击创建或粘贴均各自产生一条可撤销记录。',
    limits: '更多形状将在后续版本提供；缩略图按形状默认比例绘制。',
    docAnchor: 'user-guide#图元',
  },
  {
    id: 'connect',
    title: '连接',
    purpose: '在图元之间建立连线，表达流程走向；连线锚定在形状四边中点端口上。',
    operation:
      '悬停节点显示端口，从端口拖出连线，落到目标端口或目标节点主体（自动选择最近端口）；选中边后拖动两端箭头手柄重连、拖动拐点调整路径。',
    scope: '作用于当前页的边；新边使用页面设置的默认连线类型与默认箭头。',
    undoBoundary: '一次手势一条记录：单次连接、重连或拐点编辑各产生一条可撤销记录。',
    limits: '不允许自环与悬空端点；容器节点不可作为连接端点；跳线仅视觉跨越，不改变连接关系。',
    docAnchor: 'user-guide#图元',
  },
  {
    id: 'clipboard',
    title: '复制粘贴',
    shortcut: 'Ctrl+C/X/V',
    purpose: '复制、剪切、粘贴选中图元；粘贴时图元获得新 ID 并逐次偏移，避免与原图元重叠。',
    operation:
      'Ctrl+C 复制、Ctrl+X 剪切、Ctrl+V 粘贴（macOS 为 Cmd）；同一内容连续粘贴逐次偏移 12pt。',
    scope: '作用于当前页选中图元；仅保留源与目标都在复制集内的边（跨集边不随复制）。',
    undoBoundary: '一次粘贴一条记录（含多个图元）；剪切为一条删除记录。',
    limits: '使用应用内剪贴板，不访问系统剪贴板；剪贴板为空时粘贴仅提示「剪贴板为空。」。',
    docAnchor: 'user-guide#编辑',
  },
  {
    id: 'delete-cells',
    title: '删除图元',
    shortcut: 'Delete/Backspace',
    purpose: '删除选中的节点与边；删除节点时其相连边一并删除，保持图面无悬空连线。',
    operation: '选中图元后按 Delete 或 Backspace；多选时一次删除全部选中项。',
    scope: '作用于当前页选中图元；与被选节点相连的边连带删除。',
    undoBoundary: '一次删除多个图元只产生一条记录，撤销一步恢复全部。',
    limits: '删除即生效，可通过撤销恢复；无其他限制。',
    docAnchor: 'user-guide#编辑',
  },
  {
    id: 'text-edit',
    title: '文本编辑',
    shortcut: 'F2/Enter/双击',
    purpose: '以覆盖式编辑器就地修改节点文本或边标签文本。',
    operation:
      '双击节点、或选中单个节点按 F2/Enter 进入编辑；双击边编辑其标签。Esc 取消（文档不变），失焦或 Ctrl+Enter 提交；Enter 在文本内换行。',
    scope: '作用于当前编辑目标的文本值；编辑期间画布快捷键（如 Delete）挂起。',
    undoBoundary: '一次编辑会话一条记录：提交时文本有变更才产生「编辑文本」记录，未变更不产生。',
    limits: 'IME 组合过程（拼音上屏前）不入撤销栈；文本为纯文本，不支持段内局部富文本。',
    docAnchor: 'user-guide#图元',
  },
  {
    id: 'text-style',
    title: '文本样式',
    purpose: '批量设置选中图元的字体、字号、字形、颜色、对齐、方向、边距与段落间距。',
    operation:
      '在工具栏字体/段落分组或属性面板文本区操作；多选时值一致显示当前值，不一致显示「多个值」（不定态），无文本目标禁用。',
    scope: '作用于全部选中节点（含选中边的标签）；写入即对全部目标生效。',
    undoBoundary: '一次控件变更一条记录：一次操作全部目标合并为一条「文本样式」记录，撤销一步全部恢复。',
    limits: '竖排为逐字排版（不旋转整段）；段前/段后/行距在画布上以最简可靠方式呈现。',
    docAnchor: 'user-guide#图元',
  },
  {
    id: 'property-panel',
    title: '属性面板',
    purpose: '集中查看与编辑选中图元的节点信息、几何、样式与文本属性。',
    operation:
      '右侧面板「属性」标签页按选择显示四个手风琴区；无选择时提示「未选择图元」；几何值按当前页单位显示与输入。',
    scope: '作用于当前页选中图元；节点多选显示聚合值，边选中显示边属性区，混合选择仅显示共有区。',
    undoBoundary: '一次控件变更一条记录：几何修改、样式修改、文本修改各自合并为一条记录。',
    limits: '缩放尺寸受形状最小尺寸钳制；角度钳制在 0–360°；只读字段（类型/ID）不可编辑。',
    docAnchor: 'user-guide#图元',
  },
  {
    id: 'edge-style',
    title: '边样式与箭头',
    purpose: '设置连线的颜色、宽度、透明度、线型与起始/结束箭头，以及连线类型。',
    operation: '选中边后在属性面板边属性区操作；线型支持实线/虚线/点线/点划线，箭头支持无/有。',
    scope: '作用于全部选中边；多选边时聚合显示，不一致显示「多个值」。',
    undoBoundary: '一次控件变更一条记录（样式经「应用样式」、连线类型经「连线类型」），撤销一步全部恢复。',
    limits: '箭头为 block 形态；跳线仅视觉跨越，不在本区设置（页面设置控制）。',
    docAnchor: 'user-guide#图元',
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

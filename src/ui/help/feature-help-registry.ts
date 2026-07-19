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
]

/** 全部已注册的功能帮助条目，按 id 索引。 */
export const featureHelpRegistry: ReadonlyMap<string, FeatureHelpEntry> = new Map(
  firstEntries.map((entry) => [entry.id, entry]),
)

/** 按 id 查询帮助条目；未注册时返回 undefined。 */
export function getFeatureHelp(id: string): FeatureHelpEntry | undefined {
  return featureHelpRegistry.get(id)
}

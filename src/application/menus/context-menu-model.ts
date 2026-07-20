import type { MenuItem } from './menu-model'

export type ContextKind = 'blank' | 'node' | 'edge' | 'multi' | 'container'

export interface ContextMenuState {
  canPaste: boolean
  selectedTargetCount: number
  selectedNodeCount: number
  selectedGroupCount: number
  selectedContainerCount: number
  selectedParentedNodeCount: number
  eligibleNodeCount: number
  hasTextSelection: boolean
  hasFormatPaintSource: boolean
  compatibleFormatPaintTargetCount: number
  canAddToContainer: boolean
  canAddMembers: boolean
}

const item = (id: string, label: string, disabledReason?: string): MenuItem => ({ id, label, disabledReason })

export function ungroupOrRemoveDisabledReason(state: Pick<ContextMenuState,
  'selectedTargetCount' | 'selectedNodeCount' | 'selectedGroupCount' | 'selectedParentedNodeCount'
>): string | undefined {
  if (state.selectedTargetCount === 0) return '请先选择组合或容器内图元。'
  if (state.selectedTargetCount !== state.selectedNodeCount) return '只能选择组合或容器内图元。'
  if (state.selectedGroupCount === state.selectedTargetCount) return undefined
  if (state.selectedGroupCount > 0) return '不能同时取消组合和移出容器。'
  if (state.selectedParentedNodeCount === state.selectedTargetCount) return undefined
  return '所选图元必须全部位于容器内。'
}

function formatPaintDisabledReason(state: ContextMenuState): string | undefined {
  if (!state.hasFormatPaintSource) return '请先选择单个源图元并启用格式刷。'
  return state.compatibleFormatPaintTargetCount > 0 ? undefined : '所选图元中没有可应用格式的目标。'
}

export function contextMenuItems(kind: ContextKind, state: ContextMenuState): MenuItem[] {
  const paste = item('edit-paste', '粘贴', state.canPaste ? undefined : '剪贴板为空。')
  const group = item('arrange-group', '组合', state.selectedNodeCount >= 2 ? undefined : '至少选择两个节点。')
  const ungroupOrRemoveReason = ungroupOrRemoveDisabledReason(state)
  const ungroupOrRemove = item('ungroup-or-remove', '取消组合或移出容器', ungroupOrRemoveReason)
  const align: MenuItem = { id: 'arrange-align', label: '对齐', children: [
    item('arrange-align-left', '左对齐'), item('arrange-align-center-h', '水平居中'), item('arrange-align-right', '右对齐'),
    item('arrange-align-top', '顶端对齐'), item('arrange-align-middle-v', '垂直居中'), item('arrange-align-bottom', '底端对齐'),
  ], disabledReason: state.selectedNodeCount >= 2 ? undefined : '至少选择两个节点。' }
  const distribute: MenuItem = { id: 'arrange-distribute', label: '分布', children: [
    item('arrange-distribute-horizontal', '水平分布'), item('arrange-distribute-vertical', '垂直分布'),
  ], disabledReason: state.selectedNodeCount >= 3 ? undefined : '至少选择三个节点。' }
  const byKind: Record<ContextKind, MenuItem[]> = {
    blank: [paste, item('edit-select-all', '全选'), item('file-page-setup', '页面设置')],
    node: [
      item('edit-cut', '剪切'), item('edit-copy', '复制'), paste, item('edit-delete', '删除'),
      item('context-edit-text', '编辑文本'), item('context-link', '链接'),
      item('arrange-to-front', '置于顶层'), item('arrange-to-back', '置于底层'),
      item('arrange-forward', '上移一层'), item('arrange-backward', '下移一层'),
      group, item('context-add-container', '加入容器', state.canAddToContainer ? undefined : '没有可加入的目标容器。'),
      item('format-font', '文本样式', state.hasTextSelection ? undefined : '所选图元没有可编辑文本。'),
      ...(ungroupOrRemoveReason === undefined ? [ungroupOrRemove] : []),
    ],
    edge: [
      item('edit-cut', '剪切'), item('edit-copy', '复制'), item('edit-delete', '删除'),
      item('context-edit-label', '编辑标签'), item('context-link', '链接'), item('context-line-style', '线条样式'),
    ],
    multi: [
      item('edit-cut', '剪切'), item('edit-copy', '复制'), item('edit-delete', '删除'),
      item('context-format-paint', '格式刷', formatPaintDisabledReason(state)), align, distribute,
      item('arrange-auto-connect', '自动连线', state.eligibleNodeCount >= 2 ? undefined : '至少选择两个可自动连线的节点。'), group,
      ...(ungroupOrRemoveReason === undefined ? [ungroupOrRemove] : []),
    ],
    container: [
      item('edit-copy', '复制'), item('edit-delete', '删除'),
      ungroupOrRemove,
      item('context-add-members', '添加成员', state.selectedContainerCount === 1 && state.canAddMembers ? undefined : '没有可添加的成员。'),
      item('arrange-to-front', '置于顶层'), item('arrange-to-back', '置于底层'),
    ],
  }
  return byKind[kind]
}

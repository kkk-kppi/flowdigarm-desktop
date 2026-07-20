import type { MenuItem } from './menu-model'

export type ContextKind = 'blank' | 'node' | 'edge' | 'multi' | 'container'

export interface ContextMenuState {
  canPaste: boolean
  canGroup: boolean
  canUngroup: boolean
}

const item = (id: string, label: string, disabledReason?: string): MenuItem => ({ id, label, disabledReason })

export function contextMenuItems(kind: ContextKind, state: ContextMenuState): MenuItem[] {
  const paste = item('edit-paste', '粘贴', state.canPaste ? undefined : '剪贴板为空。')
  const group = item('arrange-group', '组合', state.canGroup ? undefined : '至少选择两个节点才能组合。')
  const align: MenuItem = { id: 'arrange-align', label: '对齐', children: [
    item('arrange-align-left', '左对齐'), item('arrange-align-center-h', '水平居中'), item('arrange-align-right', '右对齐'),
    item('arrange-align-top', '顶端对齐'), item('arrange-align-middle-v', '垂直居中'), item('arrange-align-bottom', '底端对齐'),
  ] }
  const distribute: MenuItem = { id: 'arrange-distribute', label: '分布', children: [
    item('arrange-distribute-horizontal', '水平分布'), item('arrange-distribute-vertical', '垂直分布'),
  ] }
  const byKind: Record<ContextKind, MenuItem[]> = {
    blank: [paste, item('edit-select-all', '全选'), item('file-page-setup', '页面设置')],
    node: [
      item('edit-cut', '剪切'), item('edit-copy', '复制'), paste, item('edit-delete', '删除'),
      item('context-edit-text', '编辑文本'), item('context-link', '链接'),
      item('arrange-to-front', '置于顶层'), item('arrange-to-back', '置于底层'),
      item('arrange-forward', '上移一层'), item('arrange-backward', '下移一层'),
      group, item('context-add-container', '加入容器'), item('format-font', '文本样式'),
    ],
    edge: [
      item('edit-cut', '剪切'), item('edit-copy', '复制'), item('edit-delete', '删除'),
      item('context-edit-label', '编辑标签'), item('context-link', '链接'), item('context-line-style', '线条样式'),
    ],
    multi: [
      item('edit-cut', '剪切'), item('edit-copy', '复制'), item('edit-delete', '删除'),
      item('context-format-paint', '格式刷'), align, distribute,
      item('arrange-auto-connect', '自动连线'), group,
    ],
    container: [
      item('edit-copy', '复制'), item('edit-delete', '删除'),
      item('arrange-ungroup', '取消组合或移出容器', state.canUngroup ? undefined : '所选容器不能取消组合。'),
      item('context-add-members', '添加成员'), item('arrange-to-front', '置于顶层'), item('arrange-to-back', '置于底层'),
    ],
  }
  return byKind[kind]
}

// src/application/selection/restore-selection.ts
// 重渲染后选择恢复：GraphAdapter.renderPage 的 clearCells 会经 X6 事件链
// （model clear → Selection unselect → selection:changed → 回流）同步清空选择 store，
// 故渲染前必须先快照领域选择，渲染后按「仍存在当前页的图元」过滤恢复（已删除图元丢弃）。
import type { DiagramPage } from '@/domain/diagram'

/**
 * 计算重建后应恢复的选择：保序（首元素仍为锚点），仅保留仍存在于页面的节点/边 id。
 * 纯函数，供画布渲染编排调用并单测。
 */
export function computeRestoredSelection(beforeIds: string[], page: DiagramPage): string[] {
  if (beforeIds.length === 0) {
    return []
  }
  const alive = new Set<string>([
    ...page.nodes.map((node) => node.id),
    ...page.edges.map((edge) => edge.id),
  ])
  return beforeIds.filter((id) => alive.has(id))
}

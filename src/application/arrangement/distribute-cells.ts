// src/application/arrangement/distribute-cells.ts
// 两两等距工厂：按轴几何顺序排序，固定最外两个；相邻图元边界间空隙相等（详细设计 §15）。
// gap = (last.start − first.end − Σ middle.size) / (n−1)；gap < 0 拒绝。
import type { DiagramNode, DiagramPage } from '@/domain/diagram'
import { MoveCellsCommand, type CellMove } from '@/application/commands/move-cells'

export type DistributeMode = 'horizontal' | 'vertical'

/** 生成一条「等距排列」命令；<3 个有效节点或间距不足时抛错（不产生命令）。 */
export function createDistributeCommand(
  page: DiagramPage,
  orderedIds: string[],
  mode: DistributeMode,
): MoveCellsCommand {
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  const nodes = orderedIds
    .map((id) => nodesById.get(id))
    .filter((node): node is DiagramNode => node !== undefined)
  if (nodes.length < 3) {
    throw new Error('等距排列至少需要三个图元。')
  }
  const horizontal = mode === 'horizontal'
  const startOf = (node: DiagramNode) => (horizontal ? node.x : node.y)
  const sizeOf = (node: DiagramNode) => (horizontal ? node.width : node.height)
  // 按轴几何顺序排序（稳定）：两端为固定锚点，与选择顺序无关
  const sorted = [...nodes].sort((a, b) => startOf(a) - startOf(b))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const middle = sorted.slice(1, -1)
  const middleSize = middle.reduce((sum, node) => sum + sizeOf(node), 0)
  const gap = (startOf(last) - (startOf(first) + sizeOf(first)) - middleSize) / (sorted.length - 1)
  if (gap < 0) {
    throw new Error('间距不足，无法等距排列。')
  }
  const moves: CellMove[] = []
  let cursor = startOf(first) + sizeOf(first) + gap
  for (const node of middle) {
    const before = { x: node.x, y: node.y }
    const after = horizontal ? { x: cursor, y: node.y } : { x: node.x, y: cursor }
    if (after.x !== before.x || after.y !== before.y) {
      moves.push({ pageId: page.id, nodeId: node.id, before, after })
    }
    cursor += sizeOf(node) + gap
  }
  return new MoveCellsCommand(moves, '等距排列')
}

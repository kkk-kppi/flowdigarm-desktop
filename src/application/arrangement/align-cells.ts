// src/application/arrangement/align-cells.ts
// 锚点对齐工厂：基准 = 选择序列第一个图元（详细设计 §15），非外接矩形/页面/最后点击。
// 对齐不产生几何变化的节点不进入 moves；全部无变化 → null（不产生空撤销记录）。
import type { DiagramNode, DiagramPage } from '@/domain/diagram'
import { MoveCellsCommand, type CellMove } from '@/application/commands/move-cells'

export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom'

/** 目标坐标：水平三模式改 x，垂直三模式改 y；基准为锚点 bbox。 */
function targetFor(anchor: DiagramNode, node: DiagramNode, mode: AlignMode): { x: number; y: number } {
  switch (mode) {
    case 'left':
      return { x: anchor.x, y: node.y }
    case 'center-h':
      return { x: anchor.x + anchor.width / 2 - node.width / 2, y: node.y }
    case 'right':
      return { x: anchor.x + anchor.width - node.width, y: node.y }
    case 'top':
      return { x: node.x, y: anchor.y }
    case 'middle-v':
      return { x: node.x, y: anchor.y + anchor.height / 2 - node.height / 2 }
    case 'bottom':
      return { x: node.x, y: anchor.y + anchor.height - node.height }
  }
}

/** 生成一条「对齐图元」命令；有效节点（页面内存在）不足 2 个或无实际移动 → null。 */
export function createAlignCommand(
  page: DiagramPage,
  orderedIds: string[],
  mode: AlignMode,
): MoveCellsCommand | null {
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  const orderedNodes = orderedIds
    .map((id) => nodesById.get(id))
    .filter((node): node is DiagramNode => node !== undefined)
  if (orderedNodes.length < 2) {
    return null
  }
  const anchor = orderedNodes[0]
  const moves: CellMove[] = []
  for (const node of orderedNodes) {
    const target = targetFor(anchor, node, mode)
    if (target.x !== node.x || target.y !== node.y) {
      moves.push({
        pageId: page.id,
        nodeId: node.id,
        before: { x: node.x, y: node.y },
        after: target,
      })
    }
  }
  if (moves.length === 0) {
    return null
  }
  return new MoveCellsCommand(moves, '对齐图元')
}

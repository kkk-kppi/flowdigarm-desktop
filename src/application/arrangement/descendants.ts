// src/application/arrangement/descendants.ts
// 后代收集纯函数：沿 parentId 链收集根集合的全部后代节点 id（不含根自身）。
// 容器/组合移动时，手势层据此把后代一并纳入 MoveCellsCommand（领域坐标为绝对 pt）。
// 环安全：visited 集合防死循环（损坏数据下退化为有限遍历）。
import type { DiagramPage } from '@/domain/diagram'

/** 根节点的全部后代 id（按页面节点顺序返回，确定性）。 */
export function collectDescendantIds(page: DiagramPage, rootIds: string[]): string[] {
  const visited = new Set(rootIds)
  const descendants = new Set<string>()
  let frontier = [...rootIds]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const node of page.nodes) {
      if (node.parentId === undefined || visited.has(node.id)) continue
      if (!frontier.includes(node.parentId)) continue
      visited.add(node.id)
      descendants.add(node.id)
      next.push(node.id)
    }
    frontier = next
  }
  return page.nodes.filter((node) => descendants.has(node.id)).map((node) => node.id)
}

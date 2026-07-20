// src/application/arrangement/z-order.ts
// 层级调整：置顶/置底/上移一层/下移一层（详细设计 §15）。
// 语义：置顶 = 选中图元移到全部图元之上（保持相互顺序）；置底对称；
// 上移/下移一层 = 与相邻图元交换（相邻同为选中时跳过，连续块整体移动一格）。
// 执行后全页 zIndex 规范化为 1..n；before/after 记录全部受影响图元（含规范化改号的未选中项），
// 撤销一步精确恢复原值。顺序无变化 → null（不产生空记录）。
import type { DiagramDocument, DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'

export type ZOrderAction = 'to-front' | 'to-back' | 'forward' | 'backward'

export interface ZOrderMove {
  cellId: string
  before: number
  after: number
}

const LABELS: Record<ZOrderAction, string> = {
  'to-front': '置于顶层',
  'to-back': '置于底层',
  forward: '上移一层',
  backward: '下移一层',
}

export class ZOrderCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label: string
  private readonly pageId: string
  private readonly moves: ZOrderMove[]

  constructor(input: { pageId: string; moves: ZOrderMove[]; action: ZOrderAction }) {
    this.pageId = input.pageId
    this.moves = input.moves.map((move) => ({ ...move }))
    this.label = LABELS[input.action]
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.writeAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.writeAll(document, 'before')
  }

  private writeAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.pageId)
    for (const move of this.moves) {
      const exists =
        page?.nodes.some((n) => n.id === move.cellId) ||
        page?.edges.some((e) => e.id === move.cellId)
      if (!exists) {
        throw new Error('命令目标不存在。')
      }
    }
    const zById = new Map(this.moves.map((move) => [move.cellId, move[key]]))
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.pageId
          ? {
              ...p,
              nodes: p.nodes.map((node) =>
                zById.has(node.id) ? { ...node, zIndex: zById.get(node.id)! } : node,
              ),
              edges: p.edges.map((edge) =>
                zById.has(edge.id) ? { ...edge, zIndex: zById.get(edge.id)! } : edge,
              ),
            }
          : p,
      ),
    }
  }
}

/** 页面全部图元（节点 + 边，共享 z 空间）按 zIndex 稳定排序的 id 列表。 */
function orderedCellIds(page: DiagramPage): string[] {
  const cells = [
    ...page.nodes.map((n) => ({ id: n.id, zIndex: n.zIndex })),
    ...page.edges.map((e) => ({ id: e.id, zIndex: e.zIndex })),
  ]
  return cells.sort((a, b) => a.zIndex - b.zIndex).map((cell) => cell.id)
}

/** 计算动作后的图元顺序；无变化返回 null。 */
function reordered(
  order: string[],
  selected: Set<string>,
  action: ZOrderAction,
): string[] | null {
  const next = [...order]
  if (action === 'to-front' || action === 'to-back') {
    const picked = next.filter((id) => selected.has(id))
    const rest = next.filter((id) => !selected.has(id))
    const result = action === 'to-front' ? [...rest, ...picked] : [...picked, ...rest]
    return result.every((id, index) => id === order[index]) ? null : result
  }
  let changed = false
  if (action === 'forward') {
    // 自顶向下：选中项与上方未选中邻项交换（连续选中块整体抬一格）
    for (let i = next.length - 1; i >= 0; i--) {
      if (!selected.has(next[i])) continue
      if (i + 1 < next.length && !selected.has(next[i + 1])) {
        ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
        changed = true
      }
    }
  } else {
    // 自底向上：选中项与下方未选中邻项交换
    for (let i = 0; i < next.length; i++) {
      if (!selected.has(next[i])) continue
      if (i - 1 >= 0 && !selected.has(next[i - 1])) {
        ;[next[i], next[i - 1]] = [next[i - 1], next[i]]
        changed = true
      }
    }
  }
  return changed ? next : null
}

/** 生成一条层级命令（全页规范化 1..n）；顺序无变化 → null。 */
export function createZOrderCommand(
  page: DiagramPage,
  cellIds: string[],
  action: ZOrderAction,
): ZOrderCommand | null {
  const selected = new Set(cellIds)
  const order = orderedCellIds(page)
  const next = reordered(order, selected, action)
  if (!next) {
    return null
  }
  const zById = new Map<string, number>()
  for (const node of page.nodes) zById.set(node.id, node.zIndex)
  for (const edge of page.edges) zById.set(edge.id, edge.zIndex)
  const moves: ZOrderMove[] = []
  next.forEach((id, index) => {
    const before = zById.get(id)
    const after = index + 1
    if (before !== undefined && before !== after) {
      moves.push({ cellId: id, before, after })
    }
  })
  if (moves.length === 0) {
    return null
  }
  return new ZOrderCommand({ pageId: page.id, moves, action })
}

// src/application/commands/rotate-cells.ts
// 旋转图元命令：一次旋转手势（pointer down→up）的全部节点合并为一条记录。
// 角度写入前规范化到 0≤a<360（370→10、-10→350）。
// 构造时深拷贝入参，命令自含快照（调用方后续修改不影响 before/after）。
import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export interface CellRotate {
  pageId: string
  nodeId: string
  before: number
  after: number
}

/** 角度规范化到 [0, 360)。 */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

export class RotateCellsCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '旋转图元'
  private readonly moves: CellRotate[]

  constructor(moves: CellRotate[]) {
    this.moves = structuredClone(moves)
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.rotateAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.rotateAll(document, 'before')
  }

  private rotateAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
    if (this.moves.length === 0) return document
    for (const move of this.moves) {
      const page = document.pages.find((p) => p.id === move.pageId)
      if (!page || !page.nodes.some((n) => n.id === move.nodeId)) {
        throw new Error('命令目标不存在。')
      }
    }
    return {
      ...document,
      pages: document.pages.map((page) => {
        const movesByNode = new Map(
          this.moves.filter((m) => m.pageId === page.id).map((m) => [m.nodeId, m]),
        )
        if (movesByNode.size === 0) return page
        return {
          ...page,
          nodes: page.nodes.map((node) => {
            const move = movesByNode.get(node.id)
            if (!move) return node
            return { ...node, angle: normalizeAngle(move[key]) }
          }),
        }
      }),
    }
  }
}

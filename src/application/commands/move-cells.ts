// src/application/commands/move-cells.ts
// 移动图元命令：一次拖拽的所有图元合并为一条命令。
import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export interface CellMove {
  pageId: string
  nodeId: string
  before: { x: number; y: number }
  after: { x: number; y: number }
}

export class MoveCellsCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label: string

  constructor(
    private readonly moves: CellMove[],
    label = '移动图元',
  ) {
    this.label = label
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.moveAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.moveAll(document, 'before')
  }

  private moveAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
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
            return { ...node, x: move[key].x, y: move[key].y }
          }),
        }
      }),
    }
  }
}

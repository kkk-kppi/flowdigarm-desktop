// src/application/commands/resize-cells.ts
// 缩放图元命令：一次缩放手势（pointer down→up）的全部节点合并为一条记录。
// 最小尺寸约束由调用方（手势层）按 ShapeDefinition.minSize 生成 after 时钳制，命令只写值。
// 构造时深拷贝入参，命令自含快照（调用方后续修改不影响 before/after）。
import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export interface CellResize {
  pageId: string
  nodeId: string
  before: { x: number; y: number; width: number; height: number }
  after: { x: number; y: number; width: number; height: number }
}

export class ResizeCellsCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '缩放图元'
  private readonly moves: CellResize[]

  constructor(moves: CellResize[]) {
    this.moves = structuredClone(moves)
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.resizeAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.resizeAll(document, 'before')
  }

  private resizeAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
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
            return { ...node, ...move[key] }
          }),
        }
      }),
    }
  }
}

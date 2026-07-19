// src/application/commands/apply-style.ts
// 应用样式命令：一次控件变更的全部目标合并为一条命令。
// before 由调用方在执行前从文档读取真实值（命令不猜测默认值）。
import type { DiagramDocument, EdgeStyle, NodeStyle } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export type StyleTarget =
  | { kind: 'node'; pageId: string; cellId: string; before: Partial<NodeStyle>; after: Partial<NodeStyle> }
  | { kind: 'edge'; pageId: string; cellId: string; before: Partial<EdgeStyle>; after: Partial<EdgeStyle> }

type NodeStyleTarget = Extract<StyleTarget, { kind: 'node' }>
type EdgeStyleTarget = Extract<StyleTarget, { kind: 'edge' }>

export class ApplyStyleCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '应用样式'

  constructor(private readonly targets: StyleTarget[]) {}

  apply(document: DiagramDocument): DiagramDocument {
    return this.patchAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.patchAll(document, 'before')
  }

  private patchAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
    if (this.targets.length === 0) return document
    for (const target of this.targets) {
      const page = document.pages.find((p) => p.id === target.pageId)
      const exists =
        target.kind === 'node'
          ? page?.nodes.some((n) => n.id === target.cellId)
          : page?.edges.some((e) => e.id === target.cellId)
      if (!exists) {
        throw new Error('命令目标不存在。')
      }
    }
    return {
      ...document,
      pages: document.pages.map((page) => {
        const pageTargets = this.targets.filter((t) => t.pageId === page.id)
        if (pageTargets.length === 0) return page
        const nodeTargets = new Map<string, NodeStyleTarget>(
          pageTargets
            .filter((t): t is NodeStyleTarget => t.kind === 'node')
            .map((t) => [t.cellId, t]),
        )
        const edgeTargets = new Map<string, EdgeStyleTarget>(
          pageTargets
            .filter((t): t is EdgeStyleTarget => t.kind === 'edge')
            .map((t) => [t.cellId, t]),
        )
        return {
          ...page,
          nodes: page.nodes.map((node) => {
            const target = nodeTargets.get(node.id)
            return target ? { ...node, style: { ...node.style, ...target[key] } } : node
          }),
          edges: page.edges.map((edge) => {
            const target = edgeTargets.get(edge.id)
            return target ? { ...edge, style: { ...edge.style, ...target[key] } } : edge
          }),
        }
      }),
    }
  }
}

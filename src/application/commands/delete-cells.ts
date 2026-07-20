// src/application/commands/delete-cells.ts
// 删除图元命令：一次删除（可含多个节点与边）一条记录。
// 删除集在工厂 createDeleteCellsCommand 中预计算并深拷贝快照：指定节点 + 指定边 +
// 所有与指定节点相连的边（详细设计 §10.3）。命令本体只持有不可变快照，
// apply 按 ID 删除，revert 按原 zIndex 顺序恢复（revert 内再克隆快照，反复 undo/redo 安全）。
import type { DiagramDocument, DiagramEdge, DiagramNode, DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

interface DeleteSnapshot {
  /** 按原 zIndex 升序排列的被删节点/边深拷贝。 */
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export class DeleteCellsCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '删除图元'

  constructor(
    private readonly pageId: string,
    private readonly snapshot: DeleteSnapshot,
  ) {}

  apply(document: DiagramDocument): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.pageId)
    if (!page || (this.snapshot.nodes.length === 0 && this.snapshot.edges.length === 0)) {
      throw new Error('命令目标不存在。')
    }
    const nodeIds = new Set(this.snapshot.nodes.map((n) => n.id))
    const edgeIds = new Set(this.snapshot.edges.map((e) => e.id))
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.pageId
          ? {
              ...p,
              nodes: p.nodes.filter((n) => !nodeIds.has(n.id)),
              edges: p.edges.filter((e) => !edgeIds.has(e.id)),
            }
          : p,
      ),
    }
  }

  revert(document: DiagramDocument): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.pageId)
    if (!page) {
      throw new Error('命令目标不存在。')
    }
    // 页面节点/边数组按 zIndex 升序维护（见 CreateCellsCommand），恢复后整体按 zIndex 稳定排序
    const nodes = [...page.nodes, ...structuredClone(this.snapshot.nodes)].sort(
      (a, b) => a.zIndex - b.zIndex,
    )
    const edges = [...page.edges, ...structuredClone(this.snapshot.edges)].sort(
      (a, b) => a.zIndex - b.zIndex,
    )
    return {
      ...document,
      pages: document.pages.map((p) => (p.id === this.pageId ? { ...p, nodes, edges } : p)),
    }
  }
}

/**
 * 工厂：读取页面计算完整删除集（指定节点 + 指定边 + 与指定节点相连的边），
 * 深拷贝快照后返回命令。快照为空（全部 ID 不存在）时命令 apply 将抛「命令目标不存在。」。
 */
export function createDeleteCellsCommand(
  page: DiagramPage,
  nodeIds: string[] = [],
  edgeIds: string[] = [],
): DeleteCellsCommand {
  const nodeIdSet = new Set(nodeIds)
  const edgeIdSet = new Set(edgeIds)
  const nodes = page.nodes
    .filter((n) => nodeIdSet.has(n.id))
    .sort((a, b) => a.zIndex - b.zIndex)
  const edges = page.edges
    .filter(
      (e) => edgeIdSet.has(e.id) || nodeIdSet.has(e.source.nodeId) || nodeIdSet.has(e.target.nodeId),
    )
    .sort((a, b) => a.zIndex - b.zIndex)
  return new DeleteCellsCommand(page.id, structuredClone({ nodes, edges }))
}

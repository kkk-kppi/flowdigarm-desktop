// src/application/clipboard/clipboard-service.ts
// 应用内剪贴板纯函数：复制仅保留内部边（源与目标均在复制集内，详细设计 §10.3）并深拷贝；
// 粘贴生成全新 UUID、边端点按旧→新 ID 映射重写、整体偏移 12pt×pasteIndex（pasteIndex 从 1 起，
// 同一 payload 连续粘贴逐次偏移）。剪贴板状态由调用方（document-store）持有，本文件无状态。
import type { DiagramEdge, DiagramNode, DiagramPage } from '@/domain/diagram'
import { CreateCellsCommand } from '@/application/commands/create-cells'

export interface ClipboardPayload {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export interface ClipboardRepository {
  write(payload: ClipboardPayload): Promise<void>
  read(): Promise<ClipboardPayload | null>
}

/** 粘贴偏移步长：12pt × pasteIndex。 */
const PASTE_OFFSET_PT = 12

/** 复制选中图元：深拷贝节点；仅保留两端节点都在复制集内的边。空选择返回空 payload。 */
export function copyCells(page: DiagramPage, ids: string[]): ClipboardPayload {
  const idSet = new Set(ids)
  const nodes = page.nodes.filter((node) => idSet.has(node.id))
  const copiedNodeIds = new Set(nodes.map((node) => node.id))
  const edges = page.edges.filter(
    (edge) => copiedNodeIds.has(edge.source.nodeId) && copiedNodeIds.has(edge.target.nodeId),
  )
  return structuredClone({ nodes, edges })
}

/**
 * 由 payload 生成粘贴命令：全部图元换新 UUID；边端点按旧→新 ID 映射重写；
 * 节点位置与边拐点整体偏移 12pt×pasteIndex；zIndex 清空（由 CreateCellsCommand 分配，
 * 粘贴内容落在页面最上层）。
 */
export function createPasteCommand(
  payload: ClipboardPayload,
  pageId: string,
  pasteIndex: number,
): CreateCellsCommand {
  const offset = PASTE_OFFSET_PT * pasteIndex
  const idMap = new Map<string, string>()
  const nodes = payload.nodes.map((node) => {
    const id = crypto.randomUUID()
    idMap.set(node.id, id)
    const clone: DiagramNode = structuredClone(node)
    return { ...clone, id, x: node.x + offset, y: node.y + offset, zIndex: undefined }
  })
  const edges = payload.edges.map((edge) => {
    const clone: DiagramEdge = structuredClone(edge)
    return {
      ...clone,
      id: crypto.randomUUID(),
      // payload 契约保证边两端均在复制集内，映射必然命中
      source: { ...edge.source, nodeId: idMap.get(edge.source.nodeId)! },
      target: { ...edge.target, nodeId: idMap.get(edge.target.nodeId)! },
      vertices: edge.vertices.map((v) => ({ x: v.x + offset, y: v.y + offset })),
      zIndex: undefined,
    }
  })
  return new CreateCellsCommand({ pageId, nodes, edges, label: '粘贴图元' })
}

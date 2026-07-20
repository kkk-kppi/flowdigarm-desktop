// src/application/commands/group-cells.ts
// 组合/取消组合命令（详细设计 §12/§15）。
// 组合：创建 group 节点（注册表 type='group' 容器，bbox=成员外接矩形，zIndex=成员最小值，
// 插入到最前成员之前保证渲染于成员之下），成员 parentId 指向组合；成员保留原 ID 与全部数据。
// 取消组合：删除 group 节点、成员 parentId 清除；revert 按快照恢复原 group 节点
// （含原 ID 与样式）及成员关系。嵌套组合允许（group 可作成员）。各为一条撤销记录。
import type { DiagramDocument, DiagramNode, DiagramPage } from '@/domain/diagram'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册内置形状（含 group）
import type { EditorCommand } from './editor-command'

interface GroupMember {
  cellId: string
  beforeParentId?: string
}

export class GroupCellsCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '组合'
  private readonly pageId: string
  private readonly group: DiagramNode
  private readonly members: GroupMember[]

  constructor(input: { pageId: string; group: DiagramNode; members: GroupMember[] }) {
    this.pageId = input.pageId
    this.group = structuredClone(input.group)
    this.members = structuredClone(input.members)
  }

  apply(document: DiagramDocument): DiagramDocument {
    const page = this.requireTargets(document)
    // 插入到最前成员（zIndex 最小者）之前：同 zIndex  tie 时数组序决定渲染序，组合在成员之下
    const frontMemberIndex = page.nodes.findIndex((n) => n.id === this.frontMemberId(page))
    const insertAt = frontMemberIndex === -1 ? page.nodes.length : frontMemberIndex
    const memberIds = new Map(this.members.map((m) => [m.cellId, this.group.id]))
    return {
      ...document,
      pages: document.pages.map((p) => {
        if (p.id !== this.pageId) return p
        const nodes = [
          ...p.nodes.slice(0, insertAt),
          structuredClone(this.group),
          ...p.nodes.slice(insertAt),
        ].map((node) =>
          memberIds.has(node.id) ? { ...node, parentId: memberIds.get(node.id) } : node,
        )
        return { ...p, nodes }
      }),
    }
  }

  revert(document: DiagramDocument): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.pageId)
    if (!page) {
      throw new Error('命令目标不存在。')
    }
    const beforeById = new Map(this.members.map((m) => [m.cellId, m.beforeParentId]))
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.pageId
          ? {
              ...p,
              nodes: p.nodes
                .filter((node) => node.id !== this.group.id)
                .map((node) =>
                  beforeById.has(node.id)
                    ? { ...node, parentId: beforeById.get(node.id) }
                    : node,
                ),
            }
          : p,
      ),
    }
  }

  private frontMemberId(page: DiagramPage): string | undefined {
    const memberIds = new Set(this.members.map((m) => m.cellId))
    let front: DiagramNode | undefined
    for (const node of page.nodes) {
      if (!memberIds.has(node.id)) continue
      if (!front || node.zIndex < front.zIndex) {
        front = node
      }
    }
    return front?.id
  }

  private requireTargets(document: DiagramDocument): DiagramPage {
    const page = document.pages.find((p) => p.id === this.pageId)
    const ok =
      page &&
      this.members.every((m) => page.nodes.some((n) => n.id === m.cellId)) &&
      !page.nodes.some((n) => n.id === this.group.id)
    if (!ok) {
      throw new Error('命令目标不存在。')
    }
    return page
  }
}

interface UngroupSnapshot {
  group: DiagramNode
  index: number // 原节点数组下标（revert 原位恢复）
  memberIds: string[]
}

export class UngroupCellsCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '取消组合'
  private readonly pageId: string
  private readonly snapshots: UngroupSnapshot[]

  constructor(input: { pageId: string; snapshots: UngroupSnapshot[] }) {
    this.pageId = input.pageId
    this.snapshots = structuredClone(input.snapshots)
  }

  apply(document: DiagramDocument): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.pageId)
    if (!page || this.snapshots.some((s) => !page.nodes.some((n) => n.id === s.group.id))) {
      throw new Error('命令目标不存在。')
    }
    const groupIds = new Set(this.snapshots.map((s) => s.group.id))
    const memberIds = new Set(this.snapshots.flatMap((s) => s.memberIds))
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.pageId
          ? {
              ...p,
              nodes: p.nodes
                .filter((node) => !groupIds.has(node.id))
                .map((node) =>
                  memberIds.has(node.id) ? { ...node, parentId: undefined } : node,
                ),
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
    const parentById = new Map(
      this.snapshots.flatMap((s) => s.memberIds.map((id) => [id, s.group.id] as const)),
    )
    return {
      ...document,
      pages: document.pages.map((p) => {
        if (p.id !== this.pageId) return p
        // 过滤全部组合后按原下标升序插回；先插回的组合已补齐后续组合前缺失的槽位，
        // 因此后续快照直接使用原下标，不能再叠加偏移。
        const ordered = [...this.snapshots].sort((a, b) => a.index - b.index)
        let nodes = p.nodes.map((node) =>
          parentById.has(node.id) ? { ...node, parentId: parentById.get(node.id) } : node,
        )
        ordered.forEach((snapshot) => {
          const at = Math.min(snapshot.index, nodes.length)
          nodes = [
            ...nodes.slice(0, at),
            structuredClone(snapshot.group),
            ...nodes.slice(at),
          ]
        })
        return { ...p, nodes }
      }),
    }
  }
}

/** 生成一条「组合」命令；有效节点不足 2 个 → null。 */
export function createGroupCommand(
  page: DiagramPage,
  orderedIds: string[],
  idGen: () => string = () => crypto.randomUUID(),
): GroupCellsCommand | null {
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  const members = orderedIds
    .map((id) => nodesById.get(id))
    .filter((node): node is DiagramNode => node !== undefined)
  if (members.length < 2) {
    return null
  }
  const minX = Math.min(...members.map((n) => n.x))
  const minY = Math.min(...members.map((n) => n.y))
  const maxX = Math.max(...members.map((n) => n.x + n.width))
  const maxY = Math.max(...members.map((n) => n.y + n.height))
  const group: DiagramNode = {
    id: idGen(),
    shape: 'group',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    angle: 0,
    zIndex: Math.min(...members.map((n) => n.zIndex)),
    style: structuredClone(shapeRegistry.get('group').defaultStyle),
    isContainer: true,
  }
  return new GroupCellsCommand({
    pageId: page.id,
    group,
    members: members.map((n) => ({ cellId: n.id, beforeParentId: n.parentId })),
  })
}

/** 生成一条「取消组合」命令；无有效组合节点 → null。 */
export function createUngroupCommand(page: DiagramPage, groupIds: string[]): UngroupCellsCommand | null {
  const wanted = new Set(groupIds)
  const snapshots: UngroupSnapshot[] = []
  page.nodes.forEach((node, index) => {
    if (!wanted.has(node.id) || node.shape !== 'group') {
      return
    }
    snapshots.push({
      group: structuredClone(node),
      index,
      memberIds: page.nodes.filter((n) => n.parentId === node.id).map((n) => n.id),
    })
  })
  if (snapshots.length === 0) {
    return null
  }
  return new UngroupCellsCommand({ pageId: page.id, snapshots })
}

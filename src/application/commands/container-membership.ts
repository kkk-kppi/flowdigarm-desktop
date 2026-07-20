// src/application/commands/container-membership.ts
// 容器成员关系命令：加入容器/移出容器（详细设计 §12）。
// container 必须 isContainer；加入时防环——成员不得包含容器自身及其祖先（沿 parentId 链）。
// 成员数据与 ID 保留（仅改 parentId）；before/after 逐成员记录，可逆。
import type { DiagramDocument, DiagramNode, DiagramPage } from '@/domain/diagram'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册内置形状
import type { EditorCommand } from './editor-command'

interface MembershipChange {
  memberId: string
  before?: string
  after?: string
}

export class ContainerMembershipCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label: string
  private readonly pageId: string
  private readonly changes: MembershipChange[]

  constructor(input: { pageId: string; label: string; changes: MembershipChange[] }) {
    this.pageId = input.pageId
    this.label = input.label
    this.changes = input.changes.map((change) => ({ ...change }))
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.writeAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.writeAll(document, 'before')
  }

  private writeAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.pageId)
    for (const change of this.changes) {
      if (!page?.nodes.some((n) => n.id === change.memberId)) {
        throw new Error('命令目标不存在。')
      }
    }
    const byId = new Map(this.changes.map((change) => [change.memberId, change[key]]))
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.pageId
          ? {
              ...p,
              nodes: p.nodes.map((node) =>
                byId.has(node.id) ? { ...node, parentId: byId.get(node.id) } : node,
              ),
            }
          : p,
      ),
    }
  }
}

/** 容器判定：节点显式 isContainer 或形状定义为容器。 */
function isContainerNode(node: DiagramNode): boolean {
  return (
    node.isContainer === true ||
    (shapeRegistry.has(node.shape) && shapeRegistry.get(node.shape).isContainer)
  )
}

/** 沿 parentId 链收集祖先 id（不含自身；环安全）。 */
function ancestorIds(page: DiagramPage, nodeId: string): Set<string> {
  const byId = new Map(page.nodes.map((node) => [node.id, node]))
  const ancestors = new Set<string>()
  let current = byId.get(nodeId)?.parentId
  while (current !== undefined && !ancestors.has(current)) {
    ancestors.add(current)
    current = byId.get(current)?.parentId
  }
  return ancestors
}

/** 生成一条「加入容器」命令；非容器/循环成员关系抛错。 */
export function createAddToContainerCommand(
  page: DiagramPage,
  memberIds: string[],
  containerId: string,
): ContainerMembershipCommand {
  const container = page.nodes.find((node) => node.id === containerId)
  if (!container || !isContainerNode(container)) {
    throw new Error('目标节点不是容器。')
  }
  const forbidden = new Set([containerId, ...ancestorIds(page, containerId)])
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  const changes: MembershipChange[] = []
  for (const memberId of memberIds) {
    if (forbidden.has(memberId)) {
      throw new Error('加入容器会形成循环。')
    }
    const member = nodesById.get(memberId)
    if (!member || member.parentId === containerId) {
      continue // 不存在或已在该容器中：跳过
    }
    changes.push({ memberId, before: member.parentId, after: containerId })
  }
  return new ContainerMembershipCommand({ pageId: page.id, label: '加入容器', changes })
}

/** 生成一条「移出容器」命令（无 parentId / 不存在的成员跳过）。 */
export function createRemoveFromContainerCommand(
  page: DiagramPage,
  memberIds: string[],
): ContainerMembershipCommand {
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  const changes: MembershipChange[] = []
  for (const memberId of memberIds) {
    const member = nodesById.get(memberId)
    if (!member || member.parentId === undefined) {
      continue
    }
    changes.push({ memberId, before: member.parentId, after: undefined })
  }
  return new ContainerMembershipCommand({ pageId: page.id, label: '移出容器', changes })
}

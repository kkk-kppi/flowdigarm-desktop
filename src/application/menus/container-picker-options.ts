import type { DiagramNode, DiagramPage } from '@/domain/diagram'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'

export function isContainerNode(node: DiagramNode): boolean {
  return node.isContainer === true || (shapeRegistry.has(node.shape) && shapeRegistry.get(node.shape).isContainer)
}

function ancestorIds(page: DiagramPage, nodeId: string): Set<string> {
  const byId = new Map(page.nodes.map((node) => [node.id, node]))
  const result = new Set<string>()
  let current = byId.get(nodeId)?.parentId
  while (current !== undefined && !result.has(current)) {
    result.add(current)
    current = byId.get(current)?.parentId
  }
  return result
}

export function validContainerTargets(page: DiagramPage, memberIds: string[]): DiagramNode[] {
  const members = page.nodes.filter(({ id }) => memberIds.includes(id))
  if (members.length === 0 || members.length !== new Set(memberIds).size) return []
  return page.nodes.filter((container) => {
    if (!isContainerNode(container)) return false
    const forbidden = new Set([container.id, ...ancestorIds(page, container.id)])
    return members.every((member) => !forbidden.has(member.id) && member.parentId !== container.id)
  })
}

export function validContainerMembers(page: DiagramPage, containerId: string): DiagramNode[] {
  const container = page.nodes.find(({ id }) => id === containerId)
  if (!container || !isContainerNode(container)) return []
  const forbidden = new Set([container.id, ...ancestorIds(page, container.id)])
  return page.nodes.filter((member) => !forbidden.has(member.id) && member.parentId !== container.id)
}

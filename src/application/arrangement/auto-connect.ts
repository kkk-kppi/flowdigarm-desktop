// src/application/arrangement/auto-connect.ts
// 自动连线工厂：按选择顺序生成 n−1 条边（shape[0]→shape[1]→…→shape[n]），一次操作一条撤销。
// 端口：source 端口 = 距目标节点中心最近的允许端口；target 端口 = 距源节点中心最近。
// 容器节点不作为连接端点（详细设计 §10.3），同节点自连跳过。
import { createDefaultEdgeStyle, createDefaultTextContent, type DiagramEdge, type DiagramNode, type DiagramPage } from '@/domain/diagram'
import { CreateCellsCommand, type NewCell } from '@/application/commands/create-cells'
import { nearestPortId } from '@/application/shapes/nearest-port'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册内置形状

function centerOf(node: DiagramNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

/** 组合和显式容器不可作为自动连线端点。 */
export function isAutoConnectEligibleNode(node: DiagramNode): boolean {
  return node.shape !== 'group' && node.isContainer !== true
}

/** 生成一条「自动连线」命令；有效节点（页面内存在且非容器）不足 2 个 → null。 */
export function createAutoConnectCommand(
  page: DiagramPage,
  orderedIds: string[],
  idGen: () => string = () => crypto.randomUUID(),
): CreateCellsCommand | null {
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  const nodes = orderedIds
    .map((id) => nodesById.get(id))
    .filter((node): node is DiagramNode => node !== undefined && isAutoConnectEligibleNode(node))
  if (nodes.length < 2) {
    return null
  }
  const edges: NewCell<DiagramEdge>[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const source = nodes[i]
    const target = nodes[i + 1]
    if (source.id === target.id) {
      continue // 禁止同节点自连
    }
    const sourcePorts = shapeRegistry.portIds(source.shape)
    const targetPorts = shapeRegistry.portIds(target.shape)
    const edge: NewCell<DiagramEdge> = {
      id: idGen(),
      source: {
        nodeId: source.id,
        port: nearestPortId(source, centerOf(target), sourcePorts),
      },
      target: {
        nodeId: target.id,
        port: nearestPortId(target, centerOf(source), targetPorts),
      },
      connector: page.defaultConnector,
      vertices: [],
      labels: page.autoConnectLabel
        ? [{ text: createDefaultTextContent(''), position: 0.5 }]
        : [],
      style: {
        ...createDefaultEdgeStyle(),
        sourceArrow: page.defaultArrow === 'double' ? 'arrow' : 'none',
        targetArrow: page.defaultArrow === 'none' ? 'none' : 'arrow',
      },
      zIndex: undefined,
    }
    edges.push(edge)
  }
  if (edges.length === 0) {
    return null
  }
  return new CreateCellsCommand({ pageId: page.id, edges, label: '自动连线' })
}

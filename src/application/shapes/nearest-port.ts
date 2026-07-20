// src/application/shapes/nearest-port.ts
// 端口定位与最近端口计算：端口位于形状未旋转 bbox 的四边中点；
// 连接落到节点主体时按距离取最近端口，等距按 top→right→bottom→left 优先级。

export interface NodeBBox {
  x: number
  y: number
  width: number
  height: number
}

/** 端口优先级（等距时生效）：top→right→bottom→left。 */
const PORT_PRIORITY = ['top', 'right', 'bottom', 'left'] as const

/** 端口在节点未旋转 bbox 上的 pt 坐标（四边中点）。 */
export function portPositionPt(node: NodeBBox, portId: string): { x: number; y: number } {
  switch (portId) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 }
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height }
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 }
    default:
      throw new Error(`未知端口：${portId}`)
  }
}

/**
 * 距离 pointPt 最近的端口 id；allowedPortIds 限定候选（缺省为四端口全集）。
 * 等距时按 top→right→bottom→left 优先级取先出现者。
 */
export function nearestPortId(
  node: NodeBBox,
  pointPt: { x: number; y: number },
  allowedPortIds?: string[],
): string {
  const candidates = allowedPortIds ?? [...PORT_PRIORITY]
  if (candidates.length === 0) {
    throw new Error('无可用端口。')
  }
  // 按优先级序遍历，严格小于才替换：等距自然保留先出现的高优先级端口
  const ordered = PORT_PRIORITY.filter((id) => candidates.includes(id))
  if (ordered.length === 0) {
    throw new Error('无可用端口。')
  }
  let best = ordered[0]
  let bestDistance = squaredDistance(portPositionPt(node, best), pointPt)
  for (const id of ordered.slice(1)) {
    const distance = squaredDistance(portPositionPt(node, id), pointPt)
    if (distance < bestDistance) {
      best = id
      bestDistance = distance
    }
  }
  return best
}

function squaredDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

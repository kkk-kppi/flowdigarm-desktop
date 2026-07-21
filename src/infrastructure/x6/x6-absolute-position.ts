export interface X6PositionNode {
  position(): { x: number; y: number }
  getParent(): X6PositionNode | null
  isNode(): boolean
}

/** Converts X6's parent-relative node position to document-absolute coordinates. */
export function absoluteNodePosition(node: X6PositionNode): { x: number; y: number } {
  const position = node.position()
  const parent = node.getParent()
  if (!parent || !parent.isNode()) return position
  const parentPosition = absoluteNodePosition(parent)
  return { x: parentPosition.x + position.x, y: parentPosition.y + position.y }
}

export function snapGridPosition(
  position: { x: number; y: number },
  enabled: boolean,
  gridSize: number,
): { x: number; y: number } {
  if (!enabled || !Number.isFinite(gridSize) || gridSize <= 0) return position
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  }
}

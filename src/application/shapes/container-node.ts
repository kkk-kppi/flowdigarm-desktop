import type { DiagramNode } from '@/domain/diagram'
import { shapeRegistry } from './shape-registry'
import './common-shapes'

export function isContainerNode(node: Pick<DiagramNode, 'shape' | 'isContainer'>): boolean {
  return node.isContainer === true
    || (shapeRegistry.has(node.shape) && shapeRegistry.get(node.shape).isContainer)
}

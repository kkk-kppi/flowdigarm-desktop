import type { DocumentValidationContext } from '@/domain/document-schema'
import { shapeRegistry } from './shape-registry'
import './common-shapes'

export const shapeDocumentValidationContext: DocumentValidationContext = {
  hasShape: (shape) => shapeRegistry.has(shape),
  portIds: (shape) => shapeRegistry.has(shape) ? shapeRegistry.portIds(shape) : [],
  isContainerShape: (shape) => shapeRegistry.has(shape) && shapeRegistry.get(shape).isContainer,
}

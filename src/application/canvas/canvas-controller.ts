export interface CanvasController {
  createShapeAtViewportCenter(shapeType: string): void
  startShapeDrag(shapeType: string, event: MouseEvent): void
  zoomIn(): void
  zoomOut(): void
  setZoom(value: number): void
  fitPage(): void
  fitContent(): void
  fitSelection(): void
  editNodeText(nodeId: string): void
  editEdgeLabel(edgeId: string): void
  locateCell(cellId: string): void
}

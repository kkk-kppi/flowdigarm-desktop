import {
  createDefaultEdgeStyle,
  type DiagramDocument,
  type DiagramEdge,
} from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { CreateCellsCommand } from '@/application/commands/create-cells'
import { MoveCellsCommand } from '@/application/commands/move-cells'
import { ResizeCellsCommand } from '@/application/commands/resize-cells'
import { RotateCellsCommand } from '@/application/commands/rotate-cells'
import { ReconnectEdgeCommand } from '@/application/commands/reconnect-edge'
import { UpdateEdgeVerticesCommand } from '@/application/commands/update-edge-vertices'
import { collectDescendantIds } from '@/application/arrangement/descendants'
import { shouldOpenHyperlink } from '@/application/links/open-hyperlink'
import { validateHyperlink } from '@/application/links/hyperlink-validator'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'

export interface CanvasInteractionDependencies {
  getDocument(): DiagramDocument
  getActivePageId(): string
  executeCommand(command: EditorCommand): void
  setNotice(message: string): void
  openExternalLink(url: string): Promise<void>
  select?(ids: string[]): void
  recordShapeUsage?(shape: string): void
}

export class CanvasInteractionController {
  constructor(private readonly dependencies: CanvasInteractionDependencies) {}

  moveNode(id: string, before: { x: number; y: number }, after: { x: number; y: number }): void {
    const page = this.activePage()
    if (!page) return
    const dx = after.x - before.x
    const dy = after.y - before.y
    const moves = [{ pageId: page.id, nodeId: id, before, after }]
    for (const descendantId of collectDescendantIds(page, [id])) {
      const node = page.nodes.find(({ id: nodeId }) => nodeId === descendantId)
      if (node) moves.push({
        pageId: page.id,
        nodeId: node.id,
        before: { x: node.x, y: node.y },
        after: { x: node.x + dx, y: node.y + dy },
      })
    }
    this.dependencies.executeCommand(new MoveCellsCommand(moves))
  }

  createEdge(source: DiagramEdge['source'], target: DiagramEdge['target']): void {
    const page = this.activePage()
    if (!page) return
    const style = createDefaultEdgeStyle()
    style.sourceArrow = page.defaultArrow === 'double' ? 'arrow' : 'none'
    style.targetArrow = page.defaultArrow === 'none' ? 'none' : 'arrow'
    this.dependencies.executeCommand(new CreateCellsCommand({
      pageId: page.id,
      edges: [{
        id: crypto.randomUUID(), source: { ...source }, target: { ...target },
        connector: page.defaultConnector, vertices: [], labels: [], style,
      }],
    }))
  }

  reconnectEdge(edgeId: string, end: 'source' | 'target', after: DiagramEdge['source']): void {
    const page = this.activePage()
    const edge = page?.edges.find(({ id }) => id === edgeId)
    if (!page || !edge) return
    this.dependencies.executeCommand(new ReconnectEdgeCommand({
      pageId: page.id, edgeId, end, before: { ...edge[end] }, after: { ...after },
    }))
  }

  updateVertices(edgeId: string, after: Array<{ x: number; y: number }>): void {
    const page = this.activePage()
    const edge = page?.edges.find(({ id }) => id === edgeId)
    if (!page || !edge) return
    this.dependencies.executeCommand(new UpdateEdgeVerticesCommand({
      pageId: page.id, edgeId, before: edge.vertices.map((vertex) => ({ ...vertex })), after,
    }))
  }

  resizeNode(nodeId: string, before: { x: number; y: number; width: number; height: number }, after: { x: number; y: number; width: number; height: number }): void {
    this.dependencies.executeCommand(new ResizeCellsCommand([{
      pageId: this.dependencies.getActivePageId(), nodeId, before, after,
    }]))
  }

  rotateNode(nodeId: string, before: number, after: number): void {
    this.dependencies.executeCommand(new RotateCellsCommand([{
      pageId: this.dependencies.getActivePageId(), nodeId, before, after,
    }]))
  }

  createShapeAtCenter(shapeType: string, center: { x: number; y: number }): void {
    const page = this.activePage()
    if (!page) return
    const definition = shapeRegistry.get(shapeType)
    const id = crypto.randomUUID()
    this.dependencies.executeCommand(new CreateCellsCommand({
      pageId: page.id,
      nodes: [{
        id,
        shape: definition.type,
        x: center.x - definition.defaultSize.width / 2,
        y: center.y - definition.defaultSize.height / 2,
        width: definition.defaultSize.width,
        height: definition.defaultSize.height,
        angle: 0,
        style: structuredClone(definition.defaultStyle),
      }],
    }))
    this.dependencies.select?.([id])
    this.dependencies.recordShapeUsage?.(shapeType)
  }

  createShapeAtTopLeft(shapeType: string, topLeft: { x: number; y: number }): void {
    const definition = shapeRegistry.get(shapeType)
    this.createShapeAtCenter(shapeType, {
      x: topLeft.x + definition.defaultSize.width / 2,
      y: topLeft.y + definition.defaultSize.height / 2,
    })
  }

  async openHyperlink(cellId: string, modifiers: { ctrlKey: boolean; metaKey: boolean }): Promise<boolean> {
    if (!shouldOpenHyperlink(modifiers)) return false
    const page = this.activePage()
    const link = page?.nodes.find(({ id }) => id === cellId)?.link
      ?? page?.edges.find(({ id }) => id === cellId)?.link
    if (!link) return false
    const error = validateHyperlink(link)
    if (error) {
      this.dependencies.setNotice(error)
      return true
    }
    try {
      await this.dependencies.openExternalLink(link)
    } catch {
      this.dependencies.setNotice('无法打开链接，请检查系统默认应用。')
    }
    return true
  }

  hasHyperlink(cellId: string): boolean {
    const page = this.activePage()
    return Boolean(page?.nodes.find(({ id }) => id === cellId)?.link
      ?? page?.edges.find(({ id }) => id === cellId)?.link)
  }

  private activePage() {
    const id = this.dependencies.getActivePageId()
    return this.dependencies.getDocument().pages.find((page) => page.id === id)
  }
}

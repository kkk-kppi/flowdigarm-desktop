import type {
  ConnectorKind,
  DiagramEdge,
  DiagramNode,
  DiagramPage,
  EdgeStyle,
  NodeStyle,
} from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { ApplyStyleCommand, type StyleTarget } from '@/application/commands/apply-style'
import { EditTextCommand } from '@/application/commands/edit-text'
import { MoveCellsCommand } from '@/application/commands/move-cells'
import { ResizeCellsCommand } from '@/application/commands/resize-cells'
import { RotateCellsCommand } from '@/application/commands/rotate-cells'
import { SetLinkCommand } from '@/application/commands/set-link'
import { SetBusinessDataCommand } from '@/application/commands/set-business-data'
import { TextStyleCommand, type TextStylePatch } from '@/application/commands/text-style-command'
import { UpdateEdgeConnectorCommand } from '@/application/commands/update-edge-connector'
import { validateHyperlink } from '@/application/links/hyperlink-validator'
import { buildTextStyleTargets, pickPatch } from './text-style-targets'
import { parseGeometryInput } from './property-view-model'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'

export type { StyleTarget, TextStylePatch }

export class PropertyController {
  constructor(private readonly execute: (command: EditorCommand) => void) {}

  setBusinessData(pageId: string, node: DiagramNode, after: Record<string, unknown>): void {
    this.execute(new SetBusinessDataCommand({ pageId, nodeId: node.id, before: node.data, after }))
  }

  commitGeometry(
    page: DiagramPage,
    node: DiagramNode,
    field: 'x' | 'y' | 'width' | 'height' | 'angle',
    raw: string | number,
  ): void {
    const numeric = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(numeric)) return
    if (field === 'angle') {
      if (numeric !== node.angle) this.execute(new RotateCellsCommand([{
        pageId: page.id, nodeId: node.id, before: node.angle, after: numeric,
      }]))
      return
    }
    const points = parseGeometryInput(raw, page.unit, field === 'x' || field === 'y' ? 'position' : 'length')
    if (points === null) return
    if (field === 'x' || field === 'y') {
      if (points === node[field]) return
      this.execute(new MoveCellsCommand([{
        pageId: page.id,
        nodeId: node.id,
        before: { x: node.x, y: node.y },
        after: { x: field === 'x' ? points : node.x, y: field === 'y' ? points : node.y },
      }]))
      return
    }
    const minSize = shapeRegistry.get(node.shape).minSize[field]
    const value = Math.max(points, minSize)
    if (value === node[field]) return
    this.execute(new ResizeCellsCommand([{
      pageId: page.id,
      nodeId: node.id,
      before: { x: node.x, y: node.y, width: node.width, height: node.height },
      after: {
        x: node.x,
        y: node.y,
        width: field === 'width' ? value : node.width,
        height: field === 'height' ? value : node.height,
      },
    }]))
  }

  editNodeText(pageId: string, node: DiagramNode, after: string): void {
    const before = node.text?.value ?? ''
    if (before === after) return
    this.execute(new EditTextCommand({
      pageId, target: { kind: 'node', nodeId: node.id }, before, after,
    }))
  }

  editEdgeLabel(page: DiagramPage, edge: DiagramEdge, after: string): void {
    const beforeLabel = edge.labels[0]
    const before = beforeLabel?.text.value ?? ''
    if (before === after) return
    this.execute(new EditTextCommand({
      pageId: page.id,
      target: { kind: 'edgeLabel', edgeId: edge.id, labelIndex: 0 },
      edgeLabelBefore: beforeLabel ? structuredClone(beforeLabel) : null,
      before,
      after,
    }))
  }

  applyNodeStyle(pageId: string, nodes: DiagramNode[], patch: Partial<NodeStyle>): void {
    const targets: StyleTarget[] = nodes.map((node) => ({
      kind: 'node', pageId, cellId: node.id, before: pickPatch(node.style, patch), after: patch,
    }))
    if (targets.length) this.execute(new ApplyStyleCommand(targets))
  }

  applyEdgeStyle(pageId: string, edges: DiagramEdge[], patch: Partial<EdgeStyle>): void {
    const targets: StyleTarget[] = edges.map((edge) => ({
      kind: 'edge', pageId, cellId: edge.id, before: pickPatch(edge.style, patch), after: patch,
    }))
    if (targets.length) this.execute(new ApplyStyleCommand(targets))
  }

  applyShadow(pageId: string, nodes: DiagramNode[], patch: Partial<NonNullable<NodeStyle['shadow']>>): void {
    const fallback = { color: '#000000', opacity: 0.3, offsetX: 2, offsetY: 2, blur: 4 }
    const targets: StyleTarget[] = nodes.map((node) => ({
      kind: 'node', pageId, cellId: node.id,
      before: { shadow: node.style.shadow ? { ...node.style.shadow } : undefined },
      after: { shadow: { ...fallback, ...node.style.shadow, ...patch } },
    }))
    if (targets.length) this.execute(new ApplyStyleCommand(targets))
  }

  applyTextStyle(page: DiagramPage, selectedIds: string[], patch: TextStylePatch): void {
    const targets = buildTextStyleTargets(page, selectedIds, patch)
    if (targets.length) this.execute(new TextStyleCommand({ pageId: page.id, targets }))
  }

  updateConnector(pageId: string, edges: DiagramEdge[], connector: ConnectorKind): void {
    if (!edges.length || edges.every((edge) => edge.connector === connector)) return
    this.execute(new UpdateEdgeConnectorCommand({
      pageId, edgeIds: edges.map(({ id }) => id), before: edges.map((edge) => edge.connector), after: connector,
    }))
  }

  setLink(pageId: string, kind: 'node' | 'edge', cell: DiagramNode | DiagramEdge, raw: string): string | null {
    const before = cell.link ?? ''
    if (raw === before) return null
    const error = validateHyperlink(raw)
    if (error) return error
    this.execute(new SetLinkCommand({
      pageId,
      target: { kind, cellId: cell.id },
      before: cell.link,
      after: raw === '' ? undefined : raw,
    }))
    return null
  }
}

import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { createZOrderCommand, type ZOrderAction } from '@/application/arrangement/z-order'

export interface LayerItem {
  id: string
  kind: 'node' | 'edge'
  name: string
  zIndex: number
}

export interface LayerManagerPort {
  cells(): LayerItem[]
  isSelected(cellId: string): boolean
  locate(cellId: string): void
  move(action: ZOrderAction): void
}

interface Dependencies {
  getDocument(): DiagramDocument
  getActivePageId(): string
  switchPage(pageId: string): void
  getSelectedIds(): string[]
  setSelection(ids: string[]): void
  executeCommand(command: EditorCommand): void
  setNotice(notice: string): void
  canvas: { locateCell(cellId: string): void }
}

export class LayerManagerController implements LayerManagerPort {
  constructor(private readonly dependencies: Dependencies) {}

  cells(): LayerItem[] {
    const page = this.dependencies.getDocument().pages.find(({ id }) => id === this.dependencies.getActivePageId())
    if (!page) return []
    return [
      ...page.nodes.map((node) => ({
        id: node.id,
        kind: 'node' as const,
        name: node.text?.value || node.shape,
        zIndex: node.zIndex,
      })),
      ...page.edges.map((edge) => ({
        id: edge.id,
        kind: 'edge' as const,
        name: edge.labels[0]?.text.value || edge.id,
        zIndex: edge.zIndex,
      })),
    ].sort((a, b) => b.zIndex - a.zIndex)
  }

  isSelected(cellId: string): boolean {
    return this.dependencies.getSelectedIds().includes(cellId)
  }

  locate(cellId: string): void {
    const page = this.dependencies.getDocument().pages.find((candidate) =>
      candidate.nodes.some(({ id }) => id === cellId) || candidate.edges.some(({ id }) => id === cellId),
    )
    if (!page) {
      this.dependencies.setNotice('图元不存在。')
      return
    }
    if (page.id !== this.dependencies.getActivePageId()) this.dependencies.switchPage(page.id)
    this.dependencies.setSelection([cellId])
    this.dependencies.canvas.locateCell(cellId)
  }

  move(action: ZOrderAction): void {
    const page = this.dependencies.getDocument().pages.find(({ id }) => id === this.dependencies.getActivePageId())
    if (!page) return
    const command = createZOrderCommand(page, this.dependencies.getSelectedIds(), action)
    if (command) this.dependencies.executeCommand(command)
    else this.dependencies.setNotice('当前图元已在目标层级。')
  }
}

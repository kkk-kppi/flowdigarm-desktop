import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { createAlignCommand, type AlignMode } from '@/application/arrangement/align-cells'
import { createDistributeCommand, type DistributeMode } from '@/application/arrangement/distribute-cells'
import { createAutoConnectCommand } from '@/application/arrangement/auto-connect'
import { createZOrderCommand, type ZOrderAction } from '@/application/arrangement/z-order'
import { createGroupCommand, createUngroupCommand } from '@/application/commands/group-cells'
import { createRemoveFromContainerCommand } from '@/application/commands/container-membership'

interface DocumentPort {
  document: DiagramDocument
  activePageId: string
  clipboard: unknown | null
  undo(): void
  redo(): void
  cutSelection(): void
  copySelection(): void
  pasteClipboard(): void
  deleteSelection(): void
  executeCommand(command: EditorCommand): void
  setNotice(notice: string): void
  createNodeFromShape(shape: string): void
}

interface SelectionPort {
  selectedIds: string[]
  setSelection(ids: string[]): void
}

interface AppPort {
  toggleRulers(): void
  toggleGrid(): void
  toggleGuides(): void
  togglePageBreaks(): void
  toggleSnap(): void
}

export type MenuCallbacks = Partial<Record<
  'newDocument' | 'open' | 'save' | 'saveAs' | 'recent' | 'export' | 'pageSetup' |
  'zoomIn' | 'zoomOut' | 'fitScreen' | 'fitPage' | 'fitContent' | 'fitSelection' |
  'insertEdge' | 'insertImage' | 'font' | 'alignment' | 'autoAlign' | 'find' | 'layers' |
  'preferences' | 'helpCenter' | 'shortcuts' | 'about' | 'editText' | 'editLabel' |
  'link' | 'lineStyle' | 'formatPaint' | 'addContainer' | 'addMembers',
  () => void
>>

interface Dependencies {
  document: DocumentPort
  selection: SelectionPort
  app: AppPort
  callbacks?: MenuCallbacks
}

const callbackIds: Record<string, keyof MenuCallbacks> = {
  'file-new': 'newDocument', 'file-open': 'open', 'file-save': 'save', 'file-save-as': 'saveAs',
  'file-recent': 'recent', 'file-export': 'export', 'file-page-setup': 'pageSetup',
  'view-zoom-in': 'zoomIn', 'view-zoom-out': 'zoomOut', 'view-fit-screen': 'fitScreen',
  'view-fit-page': 'fitPage', 'view-fit-content': 'fitContent', 'view-fit-selection': 'fitSelection',
  'insert-edge': 'insertEdge', 'insert-image': 'insertImage', 'format-font': 'font',
  'format-alignment': 'alignment', 'tool-auto-align': 'autoAlign', 'tool-find': 'find',
  'tool-layers': 'layers', 'tool-preferences': 'preferences', 'help-center': 'helpCenter',
  'help-shortcuts': 'shortcuts', 'help-about': 'about', 'context-edit-text': 'editText',
  'context-edit-label': 'editLabel', 'context-link': 'link', 'context-line-style': 'lineStyle',
  'context-format-paint': 'formatPaint', 'context-add-container': 'addContainer',
  'context-add-members': 'addMembers',
}

export class MenuCommandController {
  constructor(private readonly dependencies: Dependencies) {}

  execute(id: string): void {
    const { document, selection, app } = this.dependencies
    const direct: Record<string, () => void> = {
      'edit-undo': () => document.undo(), 'edit-redo': () => document.redo(),
      'edit-cut': () => document.cutSelection(), 'edit-copy': () => document.copySelection(),
      'edit-paste': () => document.clipboard ? document.pasteClipboard() : document.setNotice('剪贴板为空。'),
      'edit-duplicate': () => { document.copySelection(); if (document.clipboard) document.pasteClipboard() },
      'edit-delete': () => document.deleteSelection(),
      'edit-select-all': () => {
        const page = document.document.pages.find((item) => item.id === document.activePageId)
        selection.setSelection(page ? [...page.nodes.map((node) => node.id), ...page.edges.map((edge) => edge.id)] : [])
      },
      'view-rulers': () => app.toggleRulers(), 'view-grid': () => app.toggleGrid(),
      'view-guides': () => app.toggleGuides(), 'view-page-breaks': () => app.togglePageBreaks(),
      'view-snap': () => app.toggleSnap(),
      'insert-rect': () => document.createNodeFromShape('rect'),
      'insert-circle': () => document.createNodeFromShape('circle'),
      'insert-diamond': () => document.createNodeFromShape('diamond'),
      'insert-text': () => document.createNodeFromShape('text'),
    }
    if (direct[id]) {
      direct[id]()
      return
    }
    const callback = callbackIds[id]
    if (callback) {
      const handler = this.dependencies.callbacks?.[callback]
      if (handler) handler()
      else document.setNotice('此功能将在后续步骤接入。')
      return
    }
    if (this.executeArrangement(id)) return
    document.setNotice('此命令暂不可用。')
  }

  private executeArrangement(id: string): boolean {
    const { document, selection } = this.dependencies
    const page = document.document.pages.find((item) => item.id === document.activePageId)
    if (!page) return false
    let command: EditorCommand | null = null
    try {
      if (id.startsWith('arrange-align-')) {
        command = createAlignCommand(page, selection.selectedIds, id.slice(14) as AlignMode)
      } else if (id.startsWith('arrange-distribute-')) {
        command = createDistributeCommand(page, selection.selectedIds, id.slice(19) as DistributeMode)
      } else if (id === 'arrange-auto-connect') {
        command = createAutoConnectCommand(page, selection.selectedIds)
      } else if (id === 'arrange-group') {
        command = createGroupCommand(page, selection.selectedIds)
      } else if (id === 'arrange-ungroup') {
        command = createUngroupCommand(page, selection.selectedIds)
        if (!command && page.nodes.some((node) => selection.selectedIds.includes(node.id) && node.parentId !== undefined)) {
          command = createRemoveFromContainerCommand(page, selection.selectedIds)
        }
      } else {
        const zActions: Record<string, ZOrderAction> = {
          'arrange-to-front': 'to-front', 'arrange-to-back': 'to-back',
          'arrange-forward': 'forward', 'arrange-backward': 'backward',
        }
        if (!zActions[id]) return false
        command = createZOrderCommand(page, selection.selectedIds, zActions[id])
      }
      if (command) document.executeCommand(command)
      else document.setNotice('当前选择无法执行此命令。')
    } catch (error) {
      document.setNotice(error instanceof Error ? error.message : '命令执行失败。')
    }
    return true
  }
}

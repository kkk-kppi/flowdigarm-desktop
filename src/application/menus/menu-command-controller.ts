import type { DiagramDocument, DiagramNode, DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { createAlignCommand, type AlignMode } from '@/application/arrangement/align-cells'
import { createDistributeCommand, type DistributeMode } from '@/application/arrangement/distribute-cells'
import { createAutoConnectCommand } from '@/application/arrangement/auto-connect'
import { createZOrderCommand, type ZOrderAction } from '@/application/arrangement/z-order'
import { createGroupCommand, createUngroupCommand } from '@/application/commands/group-cells'
import { createAddToContainerCommand } from '@/application/commands/container-membership'
import {
  isContainerNode,
  validContainerMembers,
  validContainerTargets,
} from '@/application/menus/container-picker-options'

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

interface FormatPaintPort {
  armOnce(): void
}

export interface MenuInvocation {
  trigger?: HTMLElement | null
}

export interface CellInteractionRequest extends MenuInvocation {
  cellId: string
}

export interface InspectorInteractionRequest extends MenuInvocation {
  section: 'link' | 'text' | 'line'
}

export interface ContainerPickerOption {
  id: string
  label: string
}

export interface ContainerPickerRequest extends MenuInvocation {
  mode: 'add-to-container' | 'add-members'
  containers: ContainerPickerOption[]
  members: ContainerPickerOption[]
}

export interface ContainerMembershipSelection {
  containerId: string
  memberIds: string[]
}

type SimpleCallback = (request: MenuInvocation) => void

export interface MenuCallbacks {
  newDocument?: SimpleCallback
  open?: SimpleCallback
  save?: SimpleCallback
  saveAs?: SimpleCallback
  recent?: SimpleCallback
  export?: SimpleCallback
  pageSetup?: SimpleCallback
  zoomIn?: SimpleCallback
  zoomOut?: SimpleCallback
  fitScreen?: SimpleCallback
  fitPage?: SimpleCallback
  fitContent?: SimpleCallback
  fitSelection?: SimpleCallback
  insertEdge?: SimpleCallback
  insertImage?: SimpleCallback
  alignment?: SimpleCallback
  autoAlign?: SimpleCallback
  find?: SimpleCallback
  layers?: SimpleCallback
  preferences?: SimpleCallback
  helpCenter?: SimpleCallback
  shortcuts?: SimpleCallback
  about?: SimpleCallback
  editText?: (request: CellInteractionRequest) => void
  editLabel?: (request: CellInteractionRequest) => void
  focusInspector?: (request: InspectorInteractionRequest) => void
  openContainerPicker?: (request: ContainerPickerRequest) => void
}

interface Dependencies {
  document: DocumentPort
  selection: SelectionPort
  app: AppPort
  formatPaint: FormatPaintPort
  callbacks?: MenuCallbacks
}

const simpleCallbackIds: Record<string, keyof MenuCallbacks> = {
  'file-new': 'newDocument', 'file-open': 'open', 'file-save': 'save', 'file-save-as': 'saveAs',
  'file-recent': 'recent', 'file-export': 'export', 'file-page-setup': 'pageSetup',
  'view-zoom-in': 'zoomIn', 'view-zoom-out': 'zoomOut', 'view-fit-screen': 'fitScreen',
  'view-fit-page': 'fitPage', 'view-fit-content': 'fitContent', 'view-fit-selection': 'fitSelection',
  'insert-edge': 'insertEdge', 'insert-image': 'insertImage', 'format-alignment': 'alignment',
  'tool-auto-align': 'autoAlign', 'tool-find': 'find', 'tool-layers': 'layers',
  'tool-preferences': 'preferences', 'help-center': 'helpCenter', 'help-shortcuts': 'shortcuts',
  'help-about': 'about',
}

function option(node: DiagramNode): ContainerPickerOption {
  return { id: node.id, label: node.text?.value.trim() || node.id }
}

export class MenuCommandController {
  private pendingContainerRequest: ContainerPickerRequest | null = null

  constructor(private readonly dependencies: Dependencies) {}

  execute(id: string, invocation: MenuInvocation = {}): void {
    const { document, selection, app } = this.dependencies
    const reason = this.disabledReason(id)
    if (reason) {
      document.setNotice(reason)
      return
    }
    const direct: Record<string, () => void> = {
      'edit-undo': () => document.undo(), 'edit-redo': () => document.redo(),
      'edit-cut': () => document.cutSelection(), 'edit-copy': () => document.copySelection(),
      'edit-paste': () => document.pasteClipboard(),
      'edit-duplicate': () => { document.copySelection(); if (document.clipboard) document.pasteClipboard() },
      'edit-delete': () => document.deleteSelection(),
      'edit-select-all': () => {
        const page = this.activePage()
        selection.setSelection(page ? [...page.nodes.map((node) => node.id), ...page.edges.map((edge) => edge.id)] : [])
      },
      'view-rulers': () => app.toggleRulers(), 'view-grid': () => app.toggleGrid(),
      'view-guides': () => app.toggleGuides(), 'view-page-breaks': () => app.togglePageBreaks(),
      'view-snap': () => app.toggleSnap(),
      'insert-rect': () => document.createNodeFromShape('rect'),
      'insert-circle': () => document.createNodeFromShape('circle'),
      'insert-diamond': () => document.createNodeFromShape('diamond'),
      'insert-text': () => document.createNodeFromShape('text'),
      'context-format-paint': () => this.dependencies.formatPaint.armOnce(),
    }
    if (direct[id]) {
      direct[id]()
      return
    }
    if (this.executeInteraction(id, invocation)) return
    if (this.executeArrangement(id)) return
    document.setNotice('此命令暂不可用。')
  }

  confirmContainerMembership(selection: ContainerMembershipSelection): void {
    const request = this.pendingContainerRequest
    const { document } = this.dependencies
    if (!request) {
      document.setNotice('请先选择容器成员操作。')
      return
    }
    const validContainers = new Set(request.containers.map(({ id }) => id))
    const validMembers = new Set(request.members.map(({ id }) => id))
    if (!validContainers.has(selection.containerId) || selection.memberIds.length === 0 || selection.memberIds.some((id) => !validMembers.has(id))) {
      document.setNotice('容器或成员选择无效。')
      return
    }
    const page = this.activePage()
    if (!page) return
    try {
      document.executeCommand(createAddToContainerCommand(page, selection.memberIds, selection.containerId))
      this.pendingContainerRequest = null
    } catch (error) {
      document.setNotice(error instanceof Error ? error.message : '命令执行失败。')
    }
  }

  private activePage(): DiagramPage | undefined {
    return this.dependencies.document.document.pages.find((page) => page.id === this.dependencies.document.activePageId)
  }

  private selected(page = this.activePage()): { nodes: DiagramNode[]; edgeIds: string[] } {
    const ids = this.dependencies.selection.selectedIds
    return {
      nodes: page?.nodes.filter((node) => ids.includes(node.id)) ?? [],
      edgeIds: page?.edges.filter((edge) => ids.includes(edge.id)).map((edge) => edge.id) ?? [],
    }
  }

  private disabledReason(id: string): string | undefined {
    const page = this.activePage()
    const selected = this.selected(page)
    const selectedCount = selected.nodes.length + selected.edgeIds.length
    if (id === 'edit-paste' && !this.dependencies.document.clipboard) return '剪贴板为空。'
    if (['edit-cut', 'edit-copy', 'edit-duplicate', 'edit-delete'].includes(id) && selectedCount === 0) return '请先选择图元。'
    if ((id.startsWith('arrange-align-') || id === 'format-alignment' || id === 'tool-auto-align') && selected.nodes.length < 2) return '至少选择两个节点。'
    if (id.startsWith('arrange-distribute-') && selected.nodes.length < 3) return '至少选择三个节点。'
    if ((id === 'arrange-auto-connect' || id === 'arrange-group') && selected.nodes.length < 2) return '至少选择两个节点。'
    if (id === 'arrange-ungroup' && !selected.nodes.some((node) => node.shape === 'group')) return '请先选择组合。'
    if (id === 'context-edit-text' && selected.nodes.length !== 1) return '请选择一个节点。'
    if (id === 'context-edit-label' && selected.edgeIds.length !== 1) return '请选择一条连线。'
    const hasTextSelection = selected.nodes.some((node) => node.text !== undefined) || (page?.edges.some((edge) => selected.edgeIds.includes(edge.id) && edge.labels.length > 0) ?? false)
    if (id === 'context-link' && selectedCount === 0) return '请先选择图元。'
    if (id === 'format-font' && !hasTextSelection) return '所选图元没有可编辑文本。'
    if (id === 'context-line-style' && selected.edgeIds.length === 0) return '请先选择连线。'
    if (id === 'context-format-paint' && selectedCount !== 1) return '格式刷需要恰好一个源图元。'
    if (['arrange-to-front', 'arrange-to-back', 'arrange-forward', 'arrange-backward', 'view-fit-selection'].includes(id) && selectedCount === 0) return '请先选择图元。'
    return undefined
  }

  private executeInteraction(id: string, invocation: MenuInvocation): boolean {
    const callbacks = this.dependencies.callbacks
    const selected = this.selected()
    if (id === 'context-edit-text') {
      callbacks?.editText?.({ ...invocation, cellId: selected.nodes[0].id })
      return this.ensureHandler(callbacks?.editText)
    }
    if (id === 'context-edit-label') {
      callbacks?.editLabel?.({ ...invocation, cellId: selected.edgeIds[0] })
      return this.ensureHandler(callbacks?.editLabel)
    }
    const inspectorSections: Record<string, InspectorInteractionRequest['section']> = {
      'context-link': 'link', 'format-font': 'text', 'context-line-style': 'line',
    }
    if (inspectorSections[id]) {
      callbacks?.focusInspector?.({ ...invocation, section: inspectorSections[id] })
      return this.ensureHandler(callbacks?.focusInspector)
    }
    if (id === 'context-add-container' || id === 'context-add-members') {
      const request = this.createContainerRequest(id, invocation)
      if (!request) return true
      this.pendingContainerRequest = request
      callbacks?.openContainerPicker?.(request)
      return this.ensureHandler(callbacks?.openContainerPicker)
    }
    const callback = simpleCallbackIds[id]
    if (!callback) return false
    const handler = callbacks?.[callback] as SimpleCallback | undefined
    handler?.(invocation)
    return this.ensureHandler(handler)
  }

  private ensureHandler(handler: unknown): true {
    if (!handler) this.dependencies.document.setNotice('此功能未接入。')
    return true
  }

  private createContainerRequest(id: string, invocation: MenuInvocation): ContainerPickerRequest | null {
    const page = this.activePage()
    if (!page) return null
    const selected = this.selected(page).nodes
    if (id === 'context-add-container') {
      const targets = validContainerTargets(page, selected.map(({ id }) => id))
      if (selected.length === 0 || targets.length === 0) {
        this.dependencies.document.setNotice('没有可加入的目标容器。')
        return null
      }
      return { ...invocation, mode: 'add-to-container', containers: targets.map(option), members: selected.map(option) }
    }
    const container = selected.length === 1 && isContainerNode(selected[0]) ? selected[0] : undefined
    const members = container ? validContainerMembers(page, container.id) : []
    if (!container || members.length === 0) {
      this.dependencies.document.setNotice('没有可添加的成员。')
      return null
    }
    return { ...invocation, mode: 'add-members', containers: [option(container)], members: members.map(option) }
  }

  private executeArrangement(id: string): boolean {
    const { document, selection } = this.dependencies
    const page = this.activePage()
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

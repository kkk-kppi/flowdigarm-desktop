// src/stores/document-store.ts
// 文档 store：文档状态、活动页、文件路径与 dirty 跟踪；命令经当前页命令栈执行。
// PageManager 非响应式持有（WeakMap 关联 store 实例）；本文件不出现 pt 换算/SQL/Tauri invoke。
// 应用内剪贴板（clipboard/pasteCount）与本任务新增 action：copy/cut/paste、createNodeFromShape。
// 文档与剪贴板一律 markRaw：领域对象只经命令整体替换（不可变），深层响应式包装会让
// structuredClone 在快照/剪贴板路径抛 DataCloneError（响应式 Proxy 不可克隆）。
import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import {
  createEmptyDocument,
  type DiagramDocument,
  type DiagramNode,
  type DiagramPage,
} from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { CreateCellsCommand } from '@/application/commands/create-cells'
import { createDeleteCellsCommand } from '@/application/commands/delete-cells'
import { PageManager } from '@/application/pages/page-manager'
import { copyCells, createPasteCommand, type ClipboardPayload } from '@/application/clipboard/clipboard-service'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册 14 个内置形状
import {
  InMemoryShapeUsageRepository,
  type ShapeUsageRepository,
} from '@/application/shapes/shape-usage-repository'
import { useSelectionStore } from '@/stores/selection-store'

interface DocumentState {
  document: DiagramDocument
  activePageId: string
  filePath: string | null
  dirty: boolean
  /** 应用内剪贴板（深拷贝 payload，仅内部边）；与系统剪贴板无关。 */
  clipboard: ClipboardPayload | null
  /** 粘贴计数：同一 payload 连续粘贴逐次偏移 12pt×pasteCount。 */
  pasteCount: number
  /** 用户可读通知（toast 机制后续任务接线；UI 读取后调 clearNotice）。 */
  lastNotice: string | null
  /** 常用形状统计版本号：recordShapeUsage 完成后递增（驱动图元库常用区刷新）。 */
  shapeUsageVersion: number
}

// PageManager 含命令栈/视口等可变对象，不走响应式；按 store 实例关联，loadDocument 时重建。
const pageManagers = new WeakMap<object, PageManager>()

// 常用形状仓库：接口注入（默认 InMemory；Task 8 经 setShapeUsageRepository 换 SQLite 实现）。
const shapeUsageRepositories = new WeakMap<object, ShapeUsageRepository>()

function shapeUsageRepositoryOf(store: object): ShapeUsageRepository {
  let repository = shapeUsageRepositories.get(store)
  if (!repository) {
    repository = new InMemoryShapeUsageRepository()
    shapeUsageRepositories.set(store, repository)
  }
  return repository
}

function pageManagerOf(store: object, document: DiagramDocument): PageManager {
  let manager = pageManagers.get(store)
  if (!manager) {
    manager = new PageManager(document)
    pageManagers.set(store, manager)
  }
  return manager
}

export const useDocumentStore = defineStore('document', {
  state: (): DocumentState => {
    const document = markRaw(createEmptyDocument())
    return {
      document,
      activePageId: document.pages[0]?.id ?? '',
      filePath: null,
      dirty: false,
      clipboard: null,
      pasteCount: 0,
      lastNotice: null,
      shapeUsageVersion: 0,
    }
  },
  getters: {
    activePage(state): DiagramPage | undefined {
      return state.document.pages.find((page) => page.id === state.activePageId)
    },
    /** 常用形状仓库（非响应式，接口注入；默认 InMemory，Task 8 换 SQLite）。 */
    shapeUsageRepository(): ShapeUsageRepository {
      return shapeUsageRepositoryOf(this)
    },
    /** 非响应式 PageManager（文档每次替换都会触发本 getter 重算，保证 loadDocument 后返回新实例）。 */
    pageManager(): PageManager {
      void this.document
      return pageManagerOf(this, this.document)
    },
    canUndo(): boolean {
      void this.document // 文档随每条命令替换，驱动本 getter 重算
      return this.pageManager.historyFor(this.activePageId).canUndo
    },
    canRedo(): boolean {
      void this.document
      return this.pageManager.historyFor(this.activePageId).canRedo
    },
    undoLabel(): string | undefined {
      void this.document
      return this.pageManager.historyFor(this.activePageId).undoLabel
    },
    redoLabel(): string | undefined {
      void this.document
      return this.pageManager.historyFor(this.activePageId).redoLabel
    },
  },
  actions: {
    /** 新建空文档（单页 A4）。 */
    newDocument() {
      this.loadDocument(createEmptyDocument())
    },
    /** 载入文档：重建 PageManager、清 dirty；path 缺省视为未关联文件。 */
    loadDocument(document: DiagramDocument, path?: string) {
      pageManagers.set(this, new PageManager(document))
      this.document = markRaw(document)
      this.activePageId = document.pages[0]?.id ?? ''
      this.filePath = path ?? null
      this.dirty = false
    },
    /** 在当前页命令栈执行命令并置 dirty；apply 抛错时文档与栈不变。 */
    executeCommand(command: EditorCommand) {
      const manager = pageManagerOf(this, this.document)
      const history = manager.historyFor(this.activePageId)
      this.document = markRaw(history.execute(command, this.document))
      manager.syncFromDocument(this.document)
      this.activePageId = manager.activePageId
      this.dirty = true
    },
    undo() {
      const manager = pageManagerOf(this, this.document)
      const next = manager.historyFor(this.activePageId).undo(this.document)
      if (next) {
        this.document = markRaw(next)
        manager.syncFromDocument(next)
        this.activePageId = manager.activePageId
        this.dirty = true
      }
    },
    redo() {
      const manager = pageManagerOf(this, this.document)
      const next = manager.historyFor(this.activePageId).redo(this.document)
      if (next) {
        this.document = markRaw(next)
        manager.syncFromDocument(next)
        this.activePageId = manager.activePageId
        this.dirty = true
      }
    },
    /** 切换活动页：视图行为，不产生命令、不进入历史；同时清空选择（选择按页隔离）。 */
    switchPage(pageId: string) {
      pageManagerOf(this, this.document).setActivePage(pageId)
      this.activePageId = pageId
      useSelectionStore().clear()
    },
    /** 保存成功后调用：清 dirty 并记录文件路径。 */
    markSaved(path: string) {
      this.filePath = path
      this.dirty = false
    },
    /** 复制当前页选中图元到应用内剪贴板（仅内部边）；空选/选择失效不动作。 */
    copySelection() {
      const selection = useSelectionStore()
      const page = this.activePage
      if (!page || selection.selectedIds.length === 0) {
        return
      }
      const payload = copyCells(page, selection.selectedIds)
      if (payload.nodes.length === 0 && payload.edges.length === 0) {
        return // 选择失效（如撤销后）：不覆盖既有剪贴板
      }
      this.clipboard = markRaw(payload)
      this.pasteCount = 0 // 新 payload 起新偏移序列
    },
    /** 剪切 = 复制 + 一条「删除图元」命令（删除后清空选择）；空选/选择失效不动作。 */
    cutSelection() {
      const selection = useSelectionStore()
      const page = this.activePage
      if (!page || selection.selectedIds.length === 0) {
        return
      }
      const ids = selection.selectedIds
      const nodeIds = ids.filter((id) => page.nodes.some((n) => n.id === id))
      const edgeIds = ids.filter((id) => page.edges.some((e) => e.id === id))
      if (nodeIds.length === 0 && edgeIds.length === 0) {
        return
      }
      this.clipboard = markRaw(copyCells(page, ids))
      this.pasteCount = 0
      this.executeCommand(createDeleteCellsCommand(page, nodeIds, edgeIds))
      selection.clear()
    },
    /** 删除当前选择（一条「删除图元」命令，Delete/Backspace 入口）；空选/选择失效不动作。 */
    deleteSelection() {
      const selection = useSelectionStore()
      const page = this.activePage
      if (!page || selection.selectedIds.length === 0) {
        return
      }
      const ids = selection.selectedIds
      const nodeIds = ids.filter((id) => page.nodes.some((n) => n.id === id))
      const edgeIds = ids.filter((id) => page.edges.some((e) => e.id === id))
      if (nodeIds.length === 0 && edgeIds.length === 0) {
        return
      }
      this.executeCommand(createDeleteCellsCommand(page, nodeIds, edgeIds))
      selection.clear()
    },
    /** 粘贴：pasteCount 递增并生成粘贴命令（逐次偏移 12pt）；无 payload 不动作。 */
    pasteClipboard() {
      if (!this.clipboard) {
        return
      }
      this.pasteCount += 1
      this.executeCommand(createPasteCommand(this.clipboard, this.activePageId, this.pasteCount))
    },
    /**
     * 从形状创建节点并选中：默认样式/尺寸来自 ShapeDefinition，text 留空待编辑（Task 6b）。
     * centerPt 缺省为当前页页面中心；视口中心换算由 UI（CanvasArea + ViewportTransform）完成。
     */
    createNodeFromShape(shapeType: string, centerPt?: { x: number; y: number }) {
      const page = this.activePage
      if (!page) {
        return
      }
      const def = shapeRegistry.get(shapeType)
      const center = centerPt ?? { x: page.pageSize.width / 2, y: page.pageSize.height / 2 }
      const node: Omit<DiagramNode, 'zIndex'> & { zIndex?: number } = {
        id: crypto.randomUUID(),
        shape: def.type,
        x: center.x - def.defaultSize.width / 2,
        y: center.y - def.defaultSize.height / 2,
        width: def.defaultSize.width,
        height: def.defaultSize.height,
        angle: 0,
        style: structuredClone(def.defaultStyle),
        text: undefined,
        zIndex: undefined,
      }
      this.executeCommand(new CreateCellsCommand({ pageId: page.id, nodes: [node] }))
      useSelectionStore().setSelection([node.id])
      void this.recordShapeUsage(shapeType)
    },
    /** 注入常用形状仓库（Task 8 换 SQLite 实现；测试注入 mock）。 */
    setShapeUsageRepository(repository: ShapeUsageRepository) {
      shapeUsageRepositories.set(this, repository)
    },
    /** 记录一次形状使用（成功后递增版本号驱动常用区刷新；失败静默——统计不影响编辑）。 */
    async recordShapeUsage(shapeType: string) {
      try {
        await shapeUsageRepositoryOf(this).recordUsage(shapeType)
        this.shapeUsageVersion += 1
      } catch {
        // 统计失败不阻断创建流程
      }
    },
    /** 设置用户可读通知（如「剪贴板为空。」）。 */
    setNotice(notice: string) {
      this.lastNotice = notice
    },
    clearNotice() {
      this.lastNotice = null
    },
  },
})

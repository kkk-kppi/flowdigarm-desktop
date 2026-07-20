// src/stores/document-store.ts
// 文档 store：文档状态、活动页、文件路径与 dirty 跟踪；命令经当前页命令栈执行。
// PageManager 非响应式持有（WeakMap 关联 store 实例）；本文件不出现 pt 换算/SQL/Tauri invoke。
import { defineStore } from 'pinia'
import { createEmptyDocument, type DiagramDocument, type DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { PageManager } from '@/application/pages/page-manager'

interface DocumentState {
  document: DiagramDocument
  activePageId: string
  filePath: string | null
  dirty: boolean
}

// PageManager 含命令栈/视口等可变对象，不走响应式；按 store 实例关联，loadDocument 时重建。
const pageManagers = new WeakMap<object, PageManager>()

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
    const document = createEmptyDocument()
    return {
      document,
      activePageId: document.pages[0]?.id ?? '',
      filePath: null,
      dirty: false,
    }
  },
  getters: {
    activePage(state): DiagramPage | undefined {
      return state.document.pages.find((page) => page.id === state.activePageId)
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
      this.document = document
      this.activePageId = document.pages[0]?.id ?? ''
      this.filePath = path ?? null
      this.dirty = false
    },
    /** 在当前页命令栈执行命令并置 dirty；apply 抛错时文档与栈不变。 */
    executeCommand(command: EditorCommand) {
      const manager = pageManagerOf(this, this.document)
      const history = manager.historyFor(this.activePageId)
      this.document = history.execute(command, this.document)
      manager.syncFromDocument(this.document)
      this.activePageId = manager.activePageId
      this.dirty = true
    },
    undo() {
      const manager = pageManagerOf(this, this.document)
      const next = manager.historyFor(this.activePageId).undo(this.document)
      if (next) {
        this.document = next
        manager.syncFromDocument(next)
        this.activePageId = manager.activePageId
        this.dirty = true
      }
    },
    redo() {
      const manager = pageManagerOf(this, this.document)
      const next = manager.historyFor(this.activePageId).redo(this.document)
      if (next) {
        this.document = next
        manager.syncFromDocument(next)
        this.activePageId = manager.activePageId
        this.dirty = true
      }
    },
    /** 切换活动页：视图行为，不产生命令、不进入历史。
     * TODO(后续任务)：接入选择 store 后在此清空选择。 */
    switchPage(pageId: string) {
      pageManagerOf(this, this.document).setActivePage(pageId)
      this.activePageId = pageId
    },
    /** 保存成功后调用：清 dirty 并记录文件路径。 */
    markSaved(path: string) {
      this.filePath = path
      this.dirty = false
    },
  },
})

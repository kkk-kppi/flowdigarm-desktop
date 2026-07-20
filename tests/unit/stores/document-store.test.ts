// tests/unit/stores/document-store.test.ts
// 文档 store：文档状态、每页命令栈调度、dirty 跟踪；视图行为（切换页）不产生命令。
import { createPinia, setActivePinia } from 'pinia'
import { useDocumentStore } from '@/stores/document-store'
import { PageManager } from '@/application/pages/page-manager'
import { RenamePageCommand } from '@/application/commands/rename-page'
import { AddPageCommand } from '@/application/commands/add-page'
import { RemovePageCommand } from '@/application/commands/remove-page'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'

function twoPageDocument(): DiagramDocument {
  return {
    ...createEmptyDocument(),
    id: 'doc-x',
    pages: [
      createEmptyPage({ id: 'page-a', name: '页面 1' }),
      createEmptyPage({ id: 'page-b', name: '页面 2' }),
    ],
  }
}

describe('document-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始为单页空文档：activePageId 指向第一页、dirty=false、filePath=null', () => {
    const store = useDocumentStore()
    expect(store.document.pages).toHaveLength(1)
    expect(store.activePageId).toBe(store.document.pages[0].id)
    expect(store.activePage?.id).toBe(store.activePageId)
    expect(store.dirty).toBe(false)
    expect(store.filePath).toBeNull()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('持有非响应式 PageManager 实例', () => {
    const store = useDocumentStore()
    expect(store.pageManager).toBeInstanceOf(PageManager)
    expect(store.pageManager.activePageId).toBe(store.activePageId)
  })

  it('executeCommand 在当前页栈执行并置 dirty；undo/redo 恢复文档', () => {
    const store = useDocumentStore()
    const pageId = store.activePageId
    const before = store.activePage!.name
    store.executeCommand(new RenamePageCommand({ pageId, before, after: '更名后的页面' }))
    expect(store.activePage?.name).toBe('更名后的页面')
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(true)
    expect(store.undoLabel).toBe('重命名页面')

    store.undo()
    expect(store.activePage?.name).toBe(before)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)
    expect(store.redoLabel).toBe('重命名页面')

    store.redo()
    expect(store.activePage?.name).toBe('更名后的页面')
  })

  it('undo/redo 空栈时文档不变', () => {
    const store = useDocumentStore()
    const snapshot = store.document
    store.undo()
    store.redo()
    expect(store.document).toBe(snapshot)
    expect(store.dirty).toBe(false)
  })

  it('loadDocument 重建 PageManager、清 dirty 并记录路径', () => {
    const store = useDocumentStore()
    const pageId = store.activePageId
    store.executeCommand(
      new RenamePageCommand({ pageId, before: store.activePage!.name, after: '临时名' }),
    )
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(true)

    const managerBefore = store.pageManager
    store.loadDocument(twoPageDocument(), 'D:/docs/示例.flowdiagram')
    expect(store.dirty).toBe(false)
    expect(store.filePath).toBe('D:/docs/示例.flowdiagram')
    expect(store.activePageId).toBe('page-a')
    expect(store.canUndo).toBe(false)
    expect(store.pageManager).not.toBe(managerBefore)
  })

  it('newDocument 重置为单页空文档', () => {
    const store = useDocumentStore()
    store.loadDocument(twoPageDocument())
    store.newDocument()
    expect(store.document.pages).toHaveLength(1)
    expect(store.activePageId).toBe(store.document.pages[0].id)
    expect(store.filePath).toBeNull()
    expect(store.dirty).toBe(false)
  })

  it('switchPage 不产生命令：当前页撤销栈不变、文档不变', () => {
    const store = useDocumentStore()
    store.loadDocument(twoPageDocument())
    store.executeCommand(
      new RenamePageCommand({ pageId: 'page-a', before: '页面 1', after: '首页' }),
    )
    const documentBefore = store.document

    store.switchPage('page-b')
    expect(store.activePageId).toBe('page-b')
    expect(store.document).toBe(documentBefore)
    expect(store.dirty).toBe(true) // 切换页不影响 dirty
    // B 页栈为空；切回 A 页栈记录仍在
    expect(store.canUndo).toBe(false)
    store.switchPage('page-a')
    expect(store.canUndo).toBe(true)
    expect(store.undoLabel).toBe('重命名页面')
  })

  it('switchPage 未知页抛「页面不存在。」', () => {
    const store = useDocumentStore()
    expect(() => store.switchPage('missing')).toThrow('页面不存在。')
  })

  it('删除活动页后 activePageId 回退到第一页', () => {
    const store = useDocumentStore()
    store.loadDocument(twoPageDocument())
    store.switchPage('page-b')
    // 先切到 A 页再删除 B（保持删除命令落在存活页栈中，模拟 UI 行为）
    store.switchPage('page-a')
    store.executeCommand(new RemovePageCommand({ pageId: 'page-b', document: store.document }))
    expect(store.document.pages).toHaveLength(1)
    expect(store.activePageId).toBe('page-a')
    expect(store.undoLabel).toBe('删除页面')
    store.undo()
    expect(store.document.pages).toHaveLength(2)
  })

  it('新增页面命令执行后 PageManager 识别新页（栈/视口可用）', () => {
    const store = useDocumentStore()
    const command = new AddPageCommand({})
    store.executeCommand(command)
    expect(store.document.pages).toHaveLength(2)
    store.switchPage(command.pageId)
    expect(store.activePageId).toBe(command.pageId)
    expect(store.pageManager.controllerFor(command.pageId).state.zoom).toBe(1)
  })

  it('markSaved 清 dirty 并记录路径', () => {
    const store = useDocumentStore()
    store.executeCommand(
      new RenamePageCommand({
        pageId: store.activePageId,
        before: store.activePage!.name,
        after: '任意名',
      }),
    )
    expect(store.dirty).toBe(true)
    store.markSaved('D:/diagrams/流程.flowdiagram')
    expect(store.dirty).toBe(false)
    expect(store.filePath).toBe('D:/diagrams/流程.flowdiagram')
  })
})

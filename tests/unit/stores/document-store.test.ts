// tests/unit/stores/document-store.test.ts
// 文档 store：文档状态、每页命令栈调度、dirty 跟踪；视图行为（切换页）不产生命令。
// 本任务增补：应用内剪贴板（copy/cut/paste）、从形状创建节点、切页清空选择、通知。
import { createPinia, setActivePinia } from 'pinia'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { PageManager } from '@/application/pages/page-manager'
import { RenamePageCommand } from '@/application/commands/rename-page'
import { AddPageCommand } from '@/application/commands/add-page'
import { RemovePageCommand } from '@/application/commands/remove-page'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../helpers/test-document'

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

describe('document-store 剪贴板与创建', () => {
  function 三节点文档(): DiagramDocument {
    return {
      ...createEmptyDocument('测试文档'),
      id: 'doc-1',
      pages: [
        createEmptyPage({
          id: 'page-1',
          name: '流程页',
          nodes: [
            createTestNode({ id: 'node-1', x: 10, y: 20, zIndex: 0 }),
            createTestNode({ id: 'node-2', x: 110, y: 20, zIndex: 1 }),
            createTestNode({ id: 'node-3', x: 210, y: 20, zIndex: 2 }),
          ],
          edges: [
            createTestEdge({
              id: 'edge-1',
              source: { nodeId: 'node-1' },
              target: { nodeId: 'node-2' },
              zIndex: 3,
            }),
            createTestEdge({
              id: 'edge-2',
              source: { nodeId: 'node-2' },
              target: { nodeId: 'node-3' },
              zIndex: 4,
            }),
          ],
        }),
      ],
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useDocumentStore()
    store.loadDocument(三节点文档())
  })

  it('copySelection：空选不动作；选中后生成仅含内部边的 payload', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    store.copySelection()
    expect(store.clipboard).toBeNull()

    selection.setSelection(['node-1', 'node-2'])
    store.copySelection()
    expect(store.clipboard?.nodes.map((n) => n.id)).toEqual(['node-1', 'node-2'])
    // edge-1 两端均在复制集 → 保留；edge-2 触及未复制的 node-3 → 剔除
    expect(store.clipboard?.edges.map((e) => e.id)).toEqual(['edge-1'])
    // 复制不产生命令
    expect(store.canUndo).toBe(false)
    expect(store.dirty).toBe(false)
  })

  it('cutSelection：复制 + 一条「删除图元」记录，undo 一步恢复', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    selection.setSelection(['node-2'])
    store.cutSelection()
    expect(store.clipboard?.nodes.map((n) => n.id)).toEqual(['node-2'])
    expect(store.activePage?.nodes.map((n) => n.id)).toEqual(['node-1', 'node-3'])
    // 两条边均与 node-2 相连 → 连带删除
    expect(store.activePage?.edges).toEqual([])
    expect(store.undoLabel).toBe('删除图元')
    // 剪切后选择被清空（被删图元不可保持选中）
    expect(selection.hasSelection).toBe(false)

    store.undo()
    expect(store.activePage?.nodes.map((n) => n.id)).toEqual(['node-1', 'node-2', 'node-3'])
    expect(store.activePage?.edges.map((e) => e.id)).toEqual(['edge-1', 'edge-2'])
  })

  it('cutSelection 空选不动作', () => {
    const store = useDocumentStore()
    store.cutSelection()
    expect(store.clipboard).toBeNull()
    expect(store.canUndo).toBe(false)
  })

  it('deleteSelection：一条「删除图元」记录并清空选择；不写剪贴板', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    selection.setSelection(['node-1', 'edge-2'])
    store.deleteSelection()
    // node-1 删除连带 edge-1；edge-2 为指定边
    expect(store.activePage?.nodes.map((n) => n.id)).toEqual(['node-2', 'node-3'])
    expect(store.activePage?.edges).toEqual([])
    expect(selection.hasSelection).toBe(false)
    expect(store.clipboard).toBeNull()
    expect(store.undoLabel).toBe('删除图元')
    store.undo()
    expect(store.activePage?.nodes).toHaveLength(3)
    expect(store.activePage?.edges).toHaveLength(2)

    store.deleteSelection()
    expect(store.activePage?.nodes).toHaveLength(3) // 空选不动作
  })

  it('pasteClipboard：无 payload 不动作；有 payload 产生一条「粘贴图元」记录', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    store.pasteClipboard()
    expect(store.activePage?.nodes).toHaveLength(3)
    expect(store.canUndo).toBe(false)
    expect(store.pasteCount).toBe(0)

    selection.setSelection(['node-1'])
    store.copySelection()
    store.pasteClipboard()
    expect(store.pasteCount).toBe(1)
    expect(store.undoLabel).toBe('粘贴图元')
    expect(store.activePage?.nodes).toHaveLength(4)
    const 新节点 = store.activePage!.nodes[3]
    expect(新节点.id).not.toBe('node-1')
    expect(新节点).toMatchObject({ x: 10 + 12, y: 20 + 12 })

    store.undo()
    expect(store.activePage?.nodes).toHaveLength(3)
  })

  it('连续粘贴偏移逐次递增（pasteCount 累计）', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    selection.setSelection(['node-1'])
    store.copySelection()
    store.pasteClipboard()
    store.pasteClipboard()
    expect(store.pasteCount).toBe(2)
    expect(store.activePage!.nodes[3]).toMatchObject({ x: 10 + 12, y: 20 + 12 })
    expect(store.activePage!.nodes[4]).toMatchObject({ x: 10 + 24, y: 20 + 24 })
    // 两次粘贴为两条独立记录
    store.undo()
    expect(store.activePage?.nodes).toHaveLength(4)
    store.undo()
    expect(store.activePage?.nodes).toHaveLength(3)
  })

  it('重新复制后粘贴序号从零起算（新 payload 新偏移序列）', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    selection.setSelection(['node-1'])
    store.copySelection()
    store.pasteClipboard()
    store.pasteClipboard()
    expect(store.pasteCount).toBe(2)

    selection.setSelection(['node-2'])
    store.copySelection()
    expect(store.pasteCount).toBe(0)
    store.pasteClipboard()
    // 新 payload 第一次粘贴：node-2 原位置 +12（而非 +36）
    const 新节点 = store.activePage!.nodes[store.activePage!.nodes.length - 1]
    expect(新节点).toMatchObject({ x: 110 + 12, y: 20 + 12 })
  })

  it('选择失效（如撤销后）时 copy/cut/delete 不动作、不抛错', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    // 创建并选中节点，再撤销创建 → 选择中的 id 已不存在于页面
    store.createNodeFromShape('rect', { x: 400, y: 300 })
    expect(selection.count).toBe(1)
    store.undo()
    expect(store.activePage?.nodes).toHaveLength(3)
    expect(selection.count).toBe(1) // 选择 id 仍保留（已失效）

    expect(() => store.deleteSelection()).not.toThrow()
    expect(store.activePage?.nodes).toHaveLength(3)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true) // 失效删除未产生新命令，redo 分支保留

    const 旧剪贴板 = store.clipboard
    expect(() => store.cutSelection()).not.toThrow()
    expect(store.clipboard).toBe(旧剪贴板) // 失效选择不覆盖剪贴板

    expect(() => store.copySelection()).not.toThrow()
    expect(store.clipboard).toBe(旧剪贴板)
  })

  it('createNodeFromShape：以默认尺寸/样式在指定中心创建并选中新节点', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    store.createNodeFromShape('decision', { x: 300, y: 200 })
    const page = store.activePage!
    expect(page.nodes).toHaveLength(4)
    const 新节点 = page.nodes[3]
    expect(新节点.shape).toBe('decision')
    // 判定默认 140×72，以 (300,200) 为中心
    expect(新节点).toMatchObject({ x: 300 - 70, y: 200 - 36, width: 140, height: 72, angle: 0 })
    expect(新节点.text).toBeUndefined()
    expect(新节点.zIndex).toBe(5) // 页面现有最大 4 + 1
    expect(selection.selectedIds).toEqual([新节点.id])
    expect(store.undoLabel).toBe('创建图元')
    store.undo()
    expect(store.activePage?.nodes).toHaveLength(3)
  })

  it('createNodeFromShape 不传位置时落在页面中心', () => {
    const store = useDocumentStore()
    store.createNodeFromShape('rect')
    const page = store.activePage!
    const 新节点 = page.nodes[3]
    expect(新节点).toMatchObject({
      x: page.pageSize.width / 2 - 60,
      y: page.pageSize.height / 2 - 36,
      width: 120,
      height: 72,
    })
  })

  it('createNodeFromShape 未知形状抛「未知形状类型：」', () => {
    const store = useDocumentStore()
    expect(() => store.createNodeFromShape('不存在的形状')).toThrow('未知形状类型：')
    expect(store.activePage?.nodes).toHaveLength(3)
  })

  it('switchPage 清空选择', () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    store.loadDocument(twoPageDocument())
    selection.setSelection(['任意图元'])
    store.switchPage('page-b')
    expect(selection.selectedIds).toEqual([])
  })

  it('setNotice/clearNotice 管理通知', () => {
    const store = useDocumentStore()
    expect(store.lastNotice).toBeNull()
    store.setNotice('剪贴板为空。')
    expect(store.lastNotice).toBe('剪贴板为空。')
    store.clearNotice()
    expect(store.lastNotice).toBeNull()
  })
})

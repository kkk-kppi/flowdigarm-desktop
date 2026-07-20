import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { RenamePageCommand } from '@/application/commands/rename-page'
import {
  DocumentPersistenceController,
  type DocumentPersistenceStore,
} from '@/application/persistence/document-persistence-controller'
import type {
  DiagramFileRepository,
  RecoveryRepository,
  RecoverySnapshotWrite,
} from '@/application/persistence/persistence-ports'
import { createEmptyDocument } from '@/domain/diagram'
import { serializeDiagramDocument } from '@/domain/document-schema'
import { useDocumentStore } from '@/stores/document-store'

function fileRepository(overrides: Partial<DiagramFileRepository> = {}): DiagramFileRepository {
  return {
    open: async () => null,
    read: async (path) => ({ path, json: serializeDiagramDocument(createEmptyDocument()) }),
    save: async ({ path }) => path ?? 'C:/docs/新文档.flowdiagram',
    ...overrides,
  }
}

function recoveryRepository(writes: RecoverySnapshotWrite[], removed: string[]): RecoveryRepository {
  return {
    latest: async () => null,
    write: async (input) => {
      writes.push(input)
    },
    remove: async (documentId) => {
      removed.push(documentId)
    },
  }
}

function persistenceStore(): DocumentPersistenceStore {
  const store = useDocumentStore()
  return {
    snapshot: () => ({ document: store.document, filePath: store.filePath, dirty: store.dirty }),
    replaceDocument: (document, path) => store.replaceDocument(document, path),
    markSaved: (path) => store.markSaved(path),
    subscribe: (listener) => store.$subscribe(() => listener(), { detached: true }),
  }
}

describe('DocumentPersistenceController', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => vi.useRealTimers())

  it('dirty 编辑调度恢复快照，载入 clean 文档取消，dispose 后解除订阅与 timer', async () => {
    const writes: RecoverySnapshotWrite[] = []
    const store = useDocumentStore()
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository(),
      recoveryRepository(writes, []),
    )
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '待恢复',
    }))
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)

    store.loadDocument(createEmptyDocument('已载入'))
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)

    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '再次编辑',
    }))
    await nextTick()
    controller.dispose()
    expect(vi.getTimerCount()).toBe(0)
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: 'dispose 后编辑',
    }))
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
    expect(writes).toEqual([])
  })

  it('协调保存仅在文件成功后删除恢复快照并标记保存点', async () => {
    const removed: string[] = []
    const store = useDocumentStore()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '待保存',
    }))
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository(),
      recoveryRepository([], removed),
    )

    await expect(controller.save()).resolves.toEqual({ ok: true, path: 'C:/docs/新文档.flowdiagram' })
    expect(removed).toEqual([store.document.id])
    expect(store.filePath).toBe('C:/docs/新文档.flowdiagram')
    expect(store.dirty).toBe(false)
    controller.dispose()
  })

  it('文件保存失败保持 dirty 和路径，且返回稳定中文错误', async () => {
    const removed: string[] = []
    const store = useDocumentStore()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '未保存',
    }))
    const documentBefore = store.document
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository({ save: async () => { throw new Error('disk full') } }),
      recoveryRepository([], removed),
    )

    await expect(controller.save()).resolves.toEqual({ ok: false, error: '无法保存，原文件未被覆盖。' })
    expect(store.document).toBe(documentBefore)
    expect(store.filePath).toBeNull()
    expect(store.dirty).toBe(true)
    expect(removed).toEqual([])
    controller.dispose()
  })

  it('打开并解析失败通过 controller/store 边界证明现有状态不变', async () => {
    const store = useDocumentStore()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '当前未保存文档',
    }))
    const before = {
      document: store.document,
      filePath: store.filePath,
      dirty: store.dirty,
      activePageId: store.activePageId,
    }
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository({
        open: async () => ({ path: 'C:/docs/bad.flowdiagram', json: '{"schemaVersion":0}' }),
      }),
      recoveryRepository([], []),
    )

    await expect(controller.open()).resolves.toMatchObject({ ok: false })
    expect({
      document: store.document,
      filePath: store.filePath,
      dirty: store.dirty,
      activePageId: store.activePageId,
    }).toEqual(before)
    controller.dispose()
  })
})

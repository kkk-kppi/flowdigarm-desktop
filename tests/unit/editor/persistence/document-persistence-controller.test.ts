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

interface RemovedRecovery {
  documentId: string
  versionToken: string
}

function recoveryRepository(
  writes: RecoverySnapshotWrite[],
  removed: RemovedRecovery[],
): RecoveryRepository {
  return {
    latest: async () => null,
    write: async (input) => {
      writes.push(input)
    },
    remove: async (documentId, versionToken) => {
      removed.push({ documentId, versionToken })
    },
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function persistenceStore(): DocumentPersistenceStore {
  const store = useDocumentStore()
  return {
    snapshot: () => ({
      document: store.document,
      filePath: store.filePath,
      dirty: store.dirty,
      revision: store.currentRevision,
      documentEpoch: store.documentEpoch,
    }),
    replaceDocument: (document, path) => store.replaceDocument(document, path),
    markSaved: (path, revision) => store.markSaved(path, revision),
    updateFilePath: (path) => store.updateFilePath(path),
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
    const removed: RemovedRecovery[] = []
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
    expect(removed).toEqual([{
      documentId: store.document.id,
      versionToken: `${store.documentEpoch}:${store.currentRevision}`,
    }])
    expect(store.filePath).toBe('C:/docs/新文档.flowdiagram')
    expect(store.dirty).toBe(false)
    controller.dispose()
  })

  it('saveAs ignores the current path while preserving save coordination', async () => {
    const removed: RemovedRecovery[] = []
    const inputs: Array<{ path?: string; suggestedName: string; json: string }> = []
    const store = useDocumentStore()
    store.loadDocument(createEmptyDocument('另存文档'), 'C:/docs/original.flowdiagram')
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '另存版本',
    }))
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository({
        save: async (input) => {
          inputs.push(input)
          return 'C:/docs/copy.flowdiagram'
        },
      }),
      recoveryRepository([], removed),
    )

    await expect(controller.saveAs()).resolves.toEqual({ ok: true, path: 'C:/docs/copy.flowdiagram' })
    expect(inputs[0].path).toBeUndefined()
    expect(store.filePath).toBe('C:/docs/copy.flowdiagram')
    expect(store.dirty).toBe(false)
    expect(removed).toHaveLength(1)
    controller.dispose()
  })

  it('保存进行中继续编辑时保存捕获的快照，但当前 revision 保持 dirty 并保留最新恢复', async () => {
    const saveResult = deferred<string | null>()
    const writes: RecoverySnapshotWrite[] = []
    const removed: RemovedRecovery[] = []
    let savedJson = ''
    const store = useDocumentStore()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '保存中的版本',
    }))
    const capturedRevision = store.currentRevision
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository({
        save: async (input) => {
          savedJson = input.json
          return saveResult.promise
        },
      }),
      recoveryRepository(writes, removed),
    )

    const saving = controller.save()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: '保存中的版本',
      after: '保存后继续编辑',
    }))
    await nextTick()
    expect(JSON.parse(savedJson).pages[0].name).toBe('保存中的版本')
    expect(store.currentRevision).not.toBe(capturedRevision)

    saveResult.resolve('C:/docs/concurrent.flowdiagram')
    await expect(saving).resolves.toEqual({ ok: true, path: 'C:/docs/concurrent.flowdiagram' })
    expect(store.filePath).toBe('C:/docs/concurrent.flowdiagram')
    expect(store.dirty).toBe(true)
    expect(removed).toEqual([])

    await vi.advanceTimersByTimeAsync(2000)
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0].json).pages[0].name).toBe('保存后继续编辑')
    controller.dispose()
  })

  it('保存进行中替换并编辑文档时不覆盖新文档路径或删除其恢复', async () => {
    const saveResult = deferred<string | null>()
    const writes: RecoverySnapshotWrite[] = []
    const removed: RemovedRecovery[] = []
    const store = useDocumentStore()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '旧文档待保存',
    }))
    const oldDocumentId = store.document.id
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository({ save: async () => saveResult.promise }),
      recoveryRepository(writes, removed),
    )

    const saving = controller.save()
    const replacement = createEmptyDocument('替换文档')
    store.replaceDocument(replacement, 'C:/docs/replacement.flowdiagram')
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '替换文档的新编辑',
    }))
    await nextTick()

    saveResult.resolve('C:/docs/old.flowdiagram')
    await expect(saving).resolves.toEqual({ ok: true, path: 'C:/docs/old.flowdiagram' })
    expect(store.document.id).toBe(replacement.id)
    expect(store.filePath).toBe('C:/docs/replacement.flowdiagram')
    expect(store.dirty).toBe(true)
    expect(removed.map((entry) => entry.documentId)).not.toContain(oldDocumentId)

    await vi.advanceTimersByTimeAsync(2000)
    expect(writes).toHaveLength(1)
    expect(writes[0].documentId).toBe(replacement.id)
    expect(JSON.parse(writes[0].json).pages[0].name).toBe('替换文档的新编辑')
    controller.dispose()
  })

  it('保存期间以相同 ID 和相同 revision 替换文档时不清理替换文档状态', async () => {
    const saveResult = deferred<string | null>()
    const writes: RecoverySnapshotWrite[] = []
    const removed: RemovedRecovery[] = []
    const store = useDocumentStore()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '旧实例 revision 1',
    }))
    const documentId = store.document.id
    const capturedRevision = store.currentRevision
    const capturedEpoch = store.documentEpoch
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository({ save: async () => saveResult.promise }),
      recoveryRepository(writes, removed),
    )

    const saving = controller.save()
    store.replaceDocument({ ...createEmptyDocument('相同 ID 的替换实例'), id: documentId }, 'C:/docs/replacement.flowdiagram')
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '替换实例 revision 1',
    }))
    await nextTick()
    expect(store.currentRevision).toBe(capturedRevision)
    expect(store.documentEpoch).toBeGreaterThan(capturedEpoch)

    saveResult.resolve('C:/docs/old.flowdiagram')
    await expect(saving).resolves.toEqual({ ok: true, path: 'C:/docs/old.flowdiagram' })
    expect(store.filePath).toBe('C:/docs/replacement.flowdiagram')
    expect(store.dirty).toBe(true)
    expect(removed).toEqual([])

    await vi.advanceTimersByTimeAsync(2000)
    expect(writes.at(-1)).toMatchObject({
      documentId,
      versionToken: `${store.documentEpoch}:${store.currentRevision}`,
      sourcePath: 'C:/docs/replacement.flowdiagram',
    })
    controller.dispose()
  })

  it('延迟删除旧 token 时完成的新恢复快照不会被删除', async () => {
    const removeStarted = deferred<void>()
    const allowRemove = deferred<void>()
    const stored = new Map<string, RecoverySnapshotWrite>()
    const removals: RemovedRecovery[] = []
    const recovery: RecoveryRepository = {
      latest: async () => null,
      write: async (input) => {
        stored.set(input.documentId, input)
      },
      remove: async (documentId, versionToken) => {
        removals.push({ documentId, versionToken })
        removeStarted.resolve()
        await allowRemove.promise
        if (stored.get(documentId)?.versionToken === versionToken) stored.delete(documentId)
      },
    }
    const store = useDocumentStore()
    const controller = new DocumentPersistenceController(persistenceStore(), fileRepository(), recovery)
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: 'token A',
    }))
    await nextTick()
    const tokenA = `${store.documentEpoch}:${store.currentRevision}`

    const saving = controller.save()
    await removeStarted.promise
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: 'token A',
      after: 'token B',
    }))
    await nextTick()
    const tokenB = `${store.documentEpoch}:${store.currentRevision}`
    await vi.advanceTimersByTimeAsync(2000)
    expect(stored.get(store.document.id)?.versionToken).toBe(tokenB)

    allowRemove.resolve()
    await saving
    expect(removals).toEqual([{ documentId: store.document.id, versionToken: tokenA }])
    expect(stored.get(store.document.id)?.versionToken).toBe(tokenB)
    controller.dispose()
  })

  it.each(['pending', 'in-flight'] as const)(
    '并发 Save As 后 %s 恢复快照最终使用新 sourcePath 并重新等待 2 秒',
    async (writeState) => {
      const saveResult = deferred<string | null>()
      const firstWrite = deferred<void>()
      const writes: RecoverySnapshotWrite[] = []
      let writeCalls = 0
      const recovery: RecoveryRepository = {
        latest: async () => null,
        write: async (input) => {
          writes.push(input)
          writeCalls += 1
          if (writeState === 'in-flight' && writeCalls === 1) await firstWrite.promise
        },
        remove: async () => {},
      }
      const store = useDocumentStore()
      store.executeCommand(new RenamePageCommand({
        pageId: store.activePageId,
        before: store.activePage!.name,
        after: '保存捕获版本',
      }))
      const controller = new DocumentPersistenceController(
        persistenceStore(),
        fileRepository({ save: async () => saveResult.promise }),
        recovery,
      )

      const saving = controller.save()
      store.executeCommand(new RenamePageCommand({
        pageId: store.activePageId,
        before: '保存捕获版本',
        after: '并发编辑版本',
      }))
      await nextTick()
      if (writeState === 'in-flight') await vi.advanceTimersByTimeAsync(2000)

      saveResult.resolve('C:/docs/save-as.flowdiagram')
      await saving
      expect(store.filePath).toBe('C:/docs/save-as.flowdiagram')
      expect(store.dirty).toBe(true)
      expect(vi.getTimerCount()).toBe(1)
      if (writeState === 'in-flight') firstWrite.resolve()
      await Promise.resolve()

      await vi.advanceTimersByTimeAsync(1999)
      expect(writes.some((write) => write.sourcePath === 'C:/docs/save-as.flowdiagram')).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await Promise.resolve()
      expect(writes.at(-1)).toMatchObject({
        versionToken: `${store.documentEpoch}:${store.currentRevision}`,
        sourcePath: 'C:/docs/save-as.flowdiagram',
      })
      controller.dispose()
    },
  )

  it('恢复快照删除失败不改变文件保存成功和精确保存点', async () => {
    const store = useDocumentStore()
    store.executeCommand(new RenamePageCommand({
      pageId: store.activePageId,
      before: store.activePage!.name,
      after: '已写入图文件',
    }))
    const savedRevision = store.currentRevision
    const controller = new DocumentPersistenceController(
      persistenceStore(),
      fileRepository(),
      {
        latest: async () => null,
        write: async () => {},
        remove: async () => { throw new Error('db unavailable') },
      },
    )

    await expect(controller.save()).resolves.toEqual({ ok: true, path: 'C:/docs/新文档.flowdiagram' })
    expect(store.currentRevision).toBe(savedRevision)
    expect(store.dirty).toBe(false)
    controller.dispose()
  })

  it('文件保存失败保持 dirty 和路径，且返回稳定中文错误', async () => {
    const removed: RemovedRecovery[] = []
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

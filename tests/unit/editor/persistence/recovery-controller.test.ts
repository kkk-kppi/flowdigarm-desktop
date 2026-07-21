import { createEmptyDocument, type DiagramDocument } from '@/domain/diagram'
import { serializeDiagramDocument } from '@/domain/document-schema'
import type { RecoveryRepository, RecoverySnapshot } from '@/application/persistence/persistence-ports'
import {
  RecoveryController,
  type RecoveryStore,
} from '@/application/recovery/recovery-controller'

function snapshot(json = serializeDiagramDocument(createEmptyDocument('恢复文档'))): RecoverySnapshot {
  return {
    documentId: 'doc-recovery',
    versionToken: '4:9',
    name: '恢复文档',
    json,
    sourcePath: 'C:/original.flowdiagram',
    updatedAt: 123,
  }
}

function repository(value: RecoverySnapshot | null): RecoveryRepository & { removed: string[][] } {
  return {
    removed: [],
    latest: async () => value,
    write: async () => {},
    async remove(documentId, token) { this.removed.push([documentId, token]) },
  }
}

describe('RecoveryController', () => {
  it('checks startup once and restores a valid snapshot dirty without deleting it', async () => {
    const recovery = repository(snapshot())
    const loaded: Array<{ document: DiagramDocument; path?: string }> = []
    const store: RecoveryStore = {
      restoreDocument(document, path) { loaded.push({ document, path }) },
    }
    const controller = new RecoveryController(store, recovery, vi.fn())

    await expect(controller.checkStartup()).resolves.toMatchObject({ versionToken: '4:9' })
    await expect(controller.checkStartup()).resolves.toMatchObject({ versionToken: '4:9' })
    expect(controller.restore()).toBe(true)
    expect(loaded[0]).toMatchObject({ path: 'C:/original.flowdiagram' })
    expect(loaded[0].document.name).toBe('恢复文档')
    expect(recovery.removed).toEqual([])
  })

  it('reports and conditionally removes a corrupt startup snapshot', async () => {
    const recovery = repository(snapshot('{"schemaVersion":0}'))
    const showError = vi.fn()
    const controller = new RecoveryController({ restoreDocument: vi.fn() }, recovery, showError)

    await expect(controller.checkStartup()).resolves.toBeNull()
    expect(showError).toHaveBeenCalledWith('恢复数据已损坏，已忽略。')
    expect(recovery.removed).toEqual([['doc-recovery', '4:9']])
  })

  it('discard removes only the displayed version token and clears the decision', async () => {
    const recovery = repository(snapshot())
    const controller = new RecoveryController({ restoreDocument: vi.fn() }, recovery, vi.fn())
    await controller.checkStartup()

    await controller.discard()

    expect(recovery.removed).toEqual([['doc-recovery', '4:9']])
    expect(controller.pending).toBeNull()
  })

  it('does not show recovery when none exists and reports an unavailable repository', async () => {
    const empty = new RecoveryController({ restoreDocument: vi.fn() }, repository(null), vi.fn())
    await expect(empty.checkStartup()).resolves.toBeNull()

    const showError = vi.fn()
    const unavailable = new RecoveryController({ restoreDocument: vi.fn() }, {
      latest: async () => { throw new Error('db') },
      write: async () => {},
      remove: async () => {},
    }, showError)
    await expect(unavailable.checkStartup()).resolves.toBeNull()
    expect(showError).toHaveBeenCalledWith('恢复数据检查失败，已打开编辑器。')
  })
})

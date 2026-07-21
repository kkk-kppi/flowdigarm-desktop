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

  it('uses the production shape context while validating recovery snapshots', async () => {
    const value = createEmptyDocument('恢复端口')
    value.pages[0].nodes = [
      { id: crypto.randomUUID(), shape: 'rect', x: 0, y: 0, width: 80, height: 40, angle: 0, zIndex: 0, style: { fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 1 } },
      { id: crypto.randomUUID(), shape: 'rect', x: 100, y: 0, width: 80, height: 40, angle: 0, zIndex: 1, style: { fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 1 } },
    ]
    value.pages[0].edges = [{
      id: crypto.randomUUID(), source: { nodeId: value.pages[0].nodes[0].id, port: 'ghost' },
      target: { nodeId: value.pages[0].nodes[1].id }, connector: 'orthogonal', vertices: [], labels: [],
      style: { stroke: '#666666', strokeWidth: 1, opacity: 1, dash: 'solid', sourceArrow: 'none', targetArrow: 'arrow' }, zIndex: 2,
    }]
    const recovery = repository(snapshot(serializeDiagramDocument(value)))
    const loaded: DiagramDocument[] = []
    const controller = new RecoveryController(
      { restoreDocument: (document) => loaded.push(document) }, recovery, vi.fn(),
      { hasShape: (shape) => shape === 'rect', portIds: () => ['left', 'right'], isContainerShape: () => false },
    )

    await controller.checkStartup()
    expect(controller.restore()).toBe(true)
    expect(loaded[0].pages[0].edges[0].source.port).toBeUndefined()
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

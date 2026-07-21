import { createEmptyDocument, type DiagramDocument } from '@/domain/diagram'
import { serializeDiagramDocument } from '@/domain/document-schema'
import type {
  DiagramFileRepository,
  RecentDocument,
  RecentDocumentRepository,
} from '@/application/persistence/persistence-ports'
import type { SaveDiagramResult } from '@/application/persistence/document-file-use-cases'
import {
  FileWorkflowController,
  type FileWorkflowStore,
  type FileWorkflowUi,
} from '@/application/persistence/file-workflow-controller'
import { DiagramFileError } from '@/application/persistence/file-errors'

function document(name: string): DiagramDocument {
  return createEmptyDocument(name)
}

function store(dirty = false): FileWorkflowStore & { newCalls: number } {
  return {
    document: document('当前'),
    filePath: null,
    dirty,
    newCalls: 0,
    newDocument() {
      this.document = document('未命名流程图')
      this.filePath = null
      this.dirty = false
      this.newCalls += 1
    },
    loadDocument(next, path) {
      this.document = next
      this.filePath = path ?? null
      this.dirty = false
    },
  }
}

function files(overrides: Partial<DiagramFileRepository> = {}): DiagramFileRepository {
  return {
    open: async () => null,
    read: async (path) => ({ path, json: serializeDiagramDocument(document('最近')) }),
    save: async () => null,
    ...overrides,
  }
}

function recents(rows: RecentDocument[] = []): RecentDocumentRepository & { removed: string[] } {
  return {
    removed: [],
    list: async () => rows,
    async remove(path) { this.removed.push(path) },
  }
}

function ui(decisions: Array<'save' | 'discard' | 'cancel'> = []): FileWorkflowUi & { errors: string[] } {
  return {
    errors: [],
    confirmUnsaved: async () => decisions.shift() ?? 'cancel',
    showError(message) { this.errors.push(message) },
  }
}

function persistence(results: SaveDiagramResult[] = [{ ok: true, path: 'C:/saved.flowdiagram' }]) {
  return {
    save: vi.fn(async (): Promise<SaveDiagramResult> => results.shift() ?? { ok: false, error: '保存失败。' }),
    saveAs: vi.fn(async (): Promise<SaveDiagramResult> => results.shift() ?? { ok: false, error: '保存失败。' }),
  }
}

describe('FileWorkflowController', () => {
  it.each([
    ['discard', true],
    ['cancel', false],
  ] as const)('newDocument dirty %s branch changes document=%s', async (decision, changed) => {
    const target = store(true)
    const controller = new FileWorkflowController(target, persistence(), files(), recents(), ui([decision]))

    await expect(controller.newDocument()).resolves.toBe(changed)
    expect(target.newCalls).toBe(changed ? 1 : 0)
  })

  it('only continues a dirty action after a successful save', async () => {
    const target = store(true)
    const saver = persistence([{ ok: false, error: '无法保存，原文件未被覆盖。' }])
    const feedback = ui(['save'])
    const controller = new FileWorkflowController(target, saver, files(), recents(), feedback)

    await expect(controller.newDocument()).resolves.toBe(false)
    expect(target.newCalls).toBe(0)
    expect(feedback.errors).toEqual(['无法保存，原文件未被覆盖。'])
  })

  it('native open cancellation preserves the current document', async () => {
    const target = store(false)
    const before = target.document
    const controller = new FileWorkflowController(target, persistence(), files(), recents(), ui())

    await expect(controller.openDocument()).resolves.toBe(false)
    expect(target.document).toBe(before)
  })

  it('opens valid files but preserves a real adapter validation rejection without changing documents', async () => {
    const target = store(false)
    const feedback = ui()
    const repository = files({
      open: vi.fn()
        .mockResolvedValueOnce({ path: 'C:/valid.flowdiagram', json: serializeDiagramDocument(document('已打开')) })
        .mockRejectedValueOnce(new DiagramFileError('invalid')),
    })
    const controller = new FileWorkflowController(target, persistence(), repository, recents(), feedback)

    await expect(controller.openDocument()).resolves.toBe(true)
    expect(target.document.name).toBe('已打开')
    const valid = target.document
    await expect(controller.openDocument()).resolves.toBe(false)
    expect(target.document).toBe(valid)
    expect(feedback.errors).toEqual(['文件格式无效，未打开文件。'])
  })

  it('uses the production shape context to migrate invalid ports while opening', async () => {
    const opened = createEmptyDocument('端口迁移')
    opened.pages[0].nodes = [
      { id: crypto.randomUUID(), shape: 'rect', x: 0, y: 0, width: 80, height: 40, angle: 0, zIndex: 0, style: { fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 1 } },
      { id: crypto.randomUUID(), shape: 'rect', x: 100, y: 0, width: 80, height: 40, angle: 0, zIndex: 1, style: { fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 1 } },
    ]
    opened.pages[0].edges = [{
      id: crypto.randomUUID(), source: { nodeId: opened.pages[0].nodes[0].id, port: 'ghost' },
      target: { nodeId: opened.pages[0].nodes[1].id, port: 'left' }, connector: 'orthogonal', vertices: [], labels: [],
      style: { stroke: '#666666', strokeWidth: 1, opacity: 1, dash: 'solid', sourceArrow: 'none', targetArrow: 'arrow' }, zIndex: 2,
    }]
    const target = store()
    const controller = new FileWorkflowController(
      target, persistence(), files({ open: async () => ({ path: 'C:/ports.flowdiagram', json: serializeDiagramDocument(opened) }) }), recents(), ui(),
      { hasShape: (shape) => shape === 'rect', portIds: () => ['left', 'right', 'top', 'bottom'], isContainerShape: () => false },
    )

    await expect(controller.openDocument()).resolves.toBe(true)
    expect(target.document.pages[0].edges[0].source.port).toBeUndefined()
  })

  it('removes only a not-found recent item and keeps the current document', async () => {
    const target = store(false)
    const recentRepository = recents()
    const feedback = ui()
    const controller = new FileWorkflowController(
      target,
      persistence(),
      files({ read: async () => { throw new DiagramFileError('not-found') } }),
      recentRepository,
      feedback,
    )

    await expect(controller.openRecent('C:/missing.flowdiagram')).resolves.toBe(false)
    expect(recentRepository.removed).toEqual(['C:/missing.flowdiagram'])
    expect(feedback.errors).toEqual(['文件不存在或已被移动，已从最近文件中移除。'])
  })

  it.each([
    ['invalid', '文件格式无效，未打开文件。'],
    ['too-large', '文件过大，最大支持 20 MB。'],
    ['permission', '没有权限读取该文件。'],
    ['io', '无法读取文件。'],
  ] as const)('keeps recent entries for %s adapter failures and displays the stable message', async (code, message) => {
    const recentRepository = recents()
    const feedback = ui()
    const controller = new FileWorkflowController(
      store(false),
      persistence(),
      files({ read: async () => { throw new DiagramFileError(code) } }),
      recentRepository,
      feedback,
    )

    await expect(controller.openRecent(`C:/${code}.flowdiagram`)).resolves.toBe(false)
    expect(recentRepository.removed).toEqual([])
    expect(feedback.errors).toEqual([message])
  })

  it('uses save and saveAs independently and treats picker cancellation as non-error', async () => {
    const target = store(true)
    const saver = persistence([
      { ok: true, path: 'C:/saved.flowdiagram' },
      { ok: false, error: '已取消保存。' },
    ])
    const feedback = ui()
    const controller = new FileWorkflowController(target, saver, files(), recents(), feedback)

    await expect(controller.save()).resolves.toBe(true)
    await expect(controller.saveAs()).resolves.toBe(false)
    expect(saver.save).toHaveBeenCalledOnce()
    expect(saver.saveAs).toHaveBeenCalledOnce()
    expect(feedback.errors).toEqual([])
  })

  it('guards close with save/discard/cancel and returns whether destruction may continue', async () => {
    const cancelTarget = store(true)
    const cancel = new FileWorkflowController(cancelTarget, persistence(), files(), recents(), ui(['cancel']))
    await expect(cancel.requestClose()).resolves.toBe(false)

    const discardTarget = store(true)
    const discard = new FileWorkflowController(discardTarget, persistence(), files(), recents(), ui(['discard']))
    await expect(discard.requestClose()).resolves.toBe(true)

    const saveTarget = store(true)
    const save = new FileWorkflowController(saveTarget, persistence(), files(), recents(), ui(['save']))
    await expect(save.requestClose()).resolves.toBe(true)
  })

  it('rejects a concurrent workflow while one is pending and exposes busy state', async () => {
    let resolve!: (value: { path: string; json: string } | null) => void
    const pending = new Promise<{ path: string; json: string } | null>((done) => { resolve = done })
    const target = store(false)
    const controller = new FileWorkflowController(
      target,
      persistence(),
      files({ open: async () => pending }),
      recents(),
      ui(),
    )

    const opening = controller.openDocument()
    expect(controller.busy).toBe(true)
    await expect(controller.openDocument()).resolves.toBe(false)
    resolve(null)
    await opening
    expect(controller.busy).toBe(false)
  })

  it('loads pinned-first recents up to the configured limit and degrades on database failure', async () => {
    const rows: RecentDocument[] = [
      { path: 'pinned', documentId: '1', name: '置顶', lastOpenedAt: 1, pinned: true },
      { path: 'new', documentId: '2', name: '新', lastOpenedAt: 3, pinned: false },
      { path: 'old', documentId: '3', name: '旧', lastOpenedAt: 2, pinned: false },
    ]
    const controller = new FileWorkflowController(store(), persistence(), files(), recents(rows), ui())
    await expect(controller.loadRecent(2)).resolves.toEqual(rows.slice(0, 2))

    const unavailable = new FileWorkflowController(store(), persistence(), files(), {
      list: async () => { throw new Error('db') },
      remove: async () => {},
    }, ui())
    await expect(unavailable.loadRecent(2)).resolves.toEqual([])
  })
})

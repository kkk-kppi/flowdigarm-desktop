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

function document(name: string): DiagramDocument {
  const value = createEmptyDocument(name)
  value.id = `doc-${name}`
  value.pages[0].id = `page-${name}`
  return value
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

  it('opens valid files but reports the specific parse error without changing invalid files', async () => {
    const target = store(false)
    const feedback = ui()
    const repository = files({
      open: vi.fn()
        .mockResolvedValueOnce({ path: 'C:/valid.flowdiagram', json: serializeDiagramDocument(document('已打开')) })
        .mockResolvedValueOnce({ path: 'C:/bad.flowdiagram', json: '{"schemaVersion":0}' }),
    })
    const controller = new FileWorkflowController(target, persistence(), repository, recents(), feedback)

    await expect(controller.openDocument()).resolves.toBe(true)
    expect(target.document.name).toBe('已打开')
    const valid = target.document
    await expect(controller.openDocument()).resolves.toBe(false)
    expect(target.document).toBe(valid)
    expect(feedback.errors).toEqual(['文件格式无效，未打开文件。'])
  })

  it('removes an unavailable recent item and keeps the current document', async () => {
    const target = store(false)
    const recentRepository = recents()
    const feedback = ui()
    const controller = new FileWorkflowController(
      target,
      persistence(),
      files({ read: async () => { throw new Error('missing') } }),
      recentRepository,
      feedback,
    )

    await expect(controller.openRecent('C:/missing.flowdiagram')).resolves.toBe(false)
    expect(recentRepository.removed).toEqual(['C:/missing.flowdiagram'])
    expect(feedback.errors).toEqual(['最近文件不可用，已从列表移除。'])
  })

  it('reports a specific validation error without removing an existing invalid recent file', async () => {
    const target = store(false)
    const recentRepository = recents()
    const feedback = ui()
    const controller = new FileWorkflowController(
      target,
      persistence(),
      files({ read: async (path) => ({ path, json: '{"schemaVersion":0}' }) }),
      recentRepository,
      feedback,
    )

    await expect(controller.openRecent('C:/invalid.flowdiagram')).resolves.toBe(false)
    expect(recentRepository.removed).toEqual([])
    expect(feedback.errors).toEqual(['文件格式无效，未打开文件。'])
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

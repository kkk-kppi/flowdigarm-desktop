import type { DiagramDocument } from '@/domain/diagram'
import { serializeDiagramDocument } from '@/domain/document-schema'
import { AutosaveController } from './autosave-controller'
import {
  openDiagram,
  openRecentDiagram,
  saveDiagramSnapshot,
  type OpenDiagramResult,
  type SaveDiagramResult,
} from './document-file-use-cases'
import type { DiagramFileRepository, RecoveryRepository } from './persistence-ports'

export interface DocumentPersistenceStore {
  snapshot(): {
    document: DiagramDocument
    filePath: string | null
    dirty: boolean
    revision: number
  }
  replaceDocument(document: DiagramDocument, path?: string): void
  markSaved(path: string, revision: number): void
  updateFilePath(path: string): void
  subscribe(listener: () => void): () => void
}

interface CapturedSave {
  documentId: string
  revision: number
  filePath: string | null
}

export class DocumentPersistenceController {
  private readonly autosave: AutosaveController
  private readonly unsubscribe: () => void
  private scheduledDocument: DiagramDocument | null = null
  private disposed = false

  constructor(
    private readonly store: DocumentPersistenceStore,
    private readonly files: DiagramFileRepository,
    private readonly recovery: RecoveryRepository,
    onError: (message: string) => void = () => {},
  ) {
    this.autosave = new AutosaveController(recovery, 2000, onError)
    this.unsubscribe = store.subscribe(() => this.handleStoreChange())
  }

  async open(): Promise<OpenDiagramResult | null> {
    const result = await openDiagram(this.files)
    if (result?.ok) this.store.replaceDocument(result.document, result.path)
    return result
  }

  async openRecent(path: string): Promise<OpenDiagramResult> {
    const result = await openRecentDiagram(this.files, path)
    if (result.ok) this.store.replaceDocument(result.document, result.path)
    return result
  }

  async save(): Promise<SaveDiagramResult> {
    const snapshot = this.store.snapshot()
    let json: string
    try {
      json = serializeDiagramDocument(snapshot.document)
    } catch {
      return { ok: false, error: '无法保存，原文件未被覆盖。' }
    }
    const captured: CapturedSave = {
      documentId: snapshot.document.id,
      revision: snapshot.revision,
      filePath: snapshot.filePath,
    }
    const result = await saveDiagramSnapshot(this.files, {
      name: snapshot.document.name,
      json,
      ...(snapshot.filePath === null ? {} : { path: snapshot.filePath }),
    })
    if (!result.ok) return result

    if (!this.isCurrent(captured)) {
      this.retainCurrentRecovery(captured, result.path)
      return result
    }
    await this.autosave.flush()
    if (!this.isCurrent(captured)) {
      this.retainCurrentRecovery(captured, result.path)
      return result
    }
    try {
      await this.recovery.remove(captured.documentId)
    } catch {
      // The diagram file is authoritative; recovery metadata cleanup is best-effort.
    }
    if (this.isCurrent(captured)) {
      this.store.markSaved(result.path, captured.revision)
    } else {
      this.retainCurrentRecovery(captured, result.path, true)
    }
    return result
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
    this.autosave.dispose()
    this.scheduledDocument = null
  }

  private handleStoreChange(): void {
    if (this.disposed) return
    const snapshot = this.store.snapshot()
    if (!snapshot.dirty) {
      this.autosave.cancel()
      this.scheduledDocument = null
      return
    }
    if (snapshot.document === this.scheduledDocument) return
    this.scheduledDocument = snapshot.document
    this.autosave.schedule(snapshot.document, snapshot.filePath ?? undefined)
  }

  private isCurrent(captured: CapturedSave): boolean {
    const current = this.store.snapshot()
    return current.document.id === captured.documentId && current.revision === captured.revision
  }

  private retainCurrentRecovery(captured: CapturedSave, savedPath: string, force = false): void {
    let current = this.store.snapshot()
    if (current.document.id === captured.documentId && current.filePath === captured.filePath) {
      this.store.updateFilePath(savedPath)
      current = this.store.snapshot()
    }
    if (!current.dirty || (!force && current.document === this.scheduledDocument)) return
    this.scheduledDocument = current.document
    this.autosave.schedule(current.document, current.filePath ?? undefined)
  }
}

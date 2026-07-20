import type { DiagramDocument } from '@/domain/diagram'
import { AutosaveController } from './autosave-controller'
import {
  openDiagram,
  openRecentDiagram,
  saveDiagram,
  type OpenDiagramResult,
  type SaveDiagramResult,
} from './document-file-use-cases'
import type { DiagramFileRepository, RecoveryRepository } from './persistence-ports'

export interface DocumentPersistenceStore {
  snapshot(): { document: DiagramDocument; filePath: string | null; dirty: boolean }
  replaceDocument(document: DiagramDocument, path?: string): void
  markSaved(path: string): void
  subscribe(listener: () => void): () => void
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
    const result = await saveDiagram(
      this.files,
      snapshot.document,
      snapshot.filePath ?? undefined,
    )
    if (!result.ok) return result

    await this.autosave.flush()
    try {
      await this.recovery.remove(snapshot.document.id)
    } catch {
      // The diagram file is authoritative; recovery metadata cleanup is best-effort.
    }
    this.store.markSaved(result.path)
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
}

import type { DiagramDocument } from '@/domain/diagram'
import { parseDiagramDocument, type DocumentValidationContext } from '@/domain/document-schema'
import type { SaveDiagramResult } from './document-file-use-cases'
import type {
  DiagramFileRepository,
  RecentDocument,
  RecentDocumentRepository,
} from './persistence-ports'
import { normalizeDiagramFileError } from './file-errors'

export interface FileWorkflowStore {
  document: DiagramDocument
  filePath: string | null
  dirty: boolean
  newDocument(): void
  loadDocument(document: DiagramDocument, path?: string): void
}

export interface FileWorkflowPersistence {
  save(): Promise<SaveDiagramResult>
  saveAs(): Promise<SaveDiagramResult>
}

export interface FileWorkflowUi {
  confirmUnsaved(action: 'new' | 'open' | 'close'): Promise<'save' | 'discard' | 'cancel'>
  showError(message: string): void
}

export class FileWorkflowController {
  busy = false
  recentDocuments: RecentDocument[] = []

  constructor(
    private readonly store: FileWorkflowStore,
    private readonly persistence: FileWorkflowPersistence,
    private readonly files: DiagramFileRepository,
    private readonly recents: RecentDocumentRepository,
    private readonly ui: FileWorkflowUi,
    private readonly validationContext?: DocumentValidationContext,
  ) {}

  async newDocument(): Promise<boolean> {
    return this.run(async () => {
      if (!await this.canAbandon('new')) return false
      this.store.newDocument()
      return true
    })
  }

  async openDocument(): Promise<boolean> {
    return this.run(async () => {
      if (!await this.canAbandon('open')) return false
      let opened: { path: string; json: string } | null
      try {
        opened = await this.files.open()
      } catch (error) {
        this.ui.showError(normalizeDiagramFileError(error).message)
        return false
      }
      if (!opened) return false
      return this.loadOpened(opened)
    })
  }

  async openRecent(path: string): Promise<boolean> {
    return this.run(async () => {
      if (!await this.canAbandon('open')) return false
      let opened: { path: string; json: string }
      try {
        opened = await this.files.read(path)
      } catch (error) {
        const fileError = normalizeDiagramFileError(error)
        if (fileError.code === 'not-found') {
          try {
            await this.recents.remove(path)
          } catch {
            // A stale recent entry must not block the current document.
          }
          this.recentDocuments = this.recentDocuments.filter((recent) => recent.path !== path)
          this.ui.showError('文件不存在或已被移动，已从最近文件中移除。')
        } else {
          this.ui.showError(fileError.message)
        }
        return false
      }
      const parsed = parseDiagramDocument(opened.json, this.validationContext)
      if (!parsed.ok) {
        this.ui.showError(parsed.error)
        return false
      }
      this.store.loadDocument(parsed.document, opened.path)
      return true
    })
  }

  async save(): Promise<boolean> {
    return this.run(() => this.performSave(false))
  }

  async saveAs(): Promise<boolean> {
    return this.run(() => this.performSave(true))
  }

  async requestClose(): Promise<boolean> {
    return this.run(() => this.canAbandon('close'))
  }

  async loadRecent(limit: number): Promise<RecentDocument[]> {
    if (this.busy) return []
    this.busy = true
    try {
      this.recentDocuments = (await this.recents.list()).slice(0, Math.max(0, limit))
    } catch {
      this.recentDocuments = []
    } finally {
      this.busy = false
    }
    return this.recentDocuments
  }

  private async canAbandon(action: 'new' | 'open' | 'close'): Promise<boolean> {
    if (!this.store.dirty) return true
    const decision = await this.ui.confirmUnsaved(action)
    if (decision === 'cancel') return false
    if (decision === 'discard') return true
    return this.performSave(false)
  }

  private async performSave(saveAs: boolean): Promise<boolean> {
    const result = await (saveAs ? this.persistence.saveAs() : this.persistence.save())
    if (result.ok) return true
    if (result.error !== '已取消保存。') this.ui.showError(result.error)
    return false
  }

  private loadOpened(opened: { path: string; json: string }): boolean {
    const parsed = parseDiagramDocument(opened.json, this.validationContext)
    if (!parsed.ok) {
      this.ui.showError(parsed.error)
      return false
    }
    this.store.loadDocument(parsed.document, opened.path)
    return true
  }

  private async run(operation: () => Promise<boolean>): Promise<boolean> {
    if (this.busy) return false
    this.busy = true
    try {
      return await operation()
    } finally {
      this.busy = false
    }
  }
}

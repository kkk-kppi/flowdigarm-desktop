import type { DiagramDocument } from '@/domain/diagram'
import { parseDiagramDocument } from '@/domain/document-schema'
import type { RecoveryRepository, RecoverySnapshot } from '@/application/persistence/persistence-ports'

export interface RecoveryStore {
  restoreDocument(document: DiagramDocument, path?: string): void
}

export class RecoveryController {
  pending: RecoverySnapshot | null = null
  private parsedDocument: DiagramDocument | null = null
  private checked = false

  constructor(
    private readonly store: RecoveryStore,
    private readonly repository: RecoveryRepository,
    private readonly showError: (message: string) => void,
  ) {}

  async checkStartup(): Promise<RecoverySnapshot | null> {
    if (this.checked) return this.pending
    this.checked = true
    let snapshot: RecoverySnapshot | null
    try {
      snapshot = await this.repository.latest()
    } catch {
      this.showError('恢复数据检查失败，已打开编辑器。')
      return null
    }
    if (!snapshot) return null

    const parsed = parseDiagramDocument(snapshot.json)
    if (!parsed.ok) {
      this.showError('恢复数据已损坏，已忽略。')
      try {
        await this.repository.remove(snapshot.documentId, snapshot.versionToken)
      } catch {
        // Corrupt recovery data is ignored even when metadata cleanup fails.
      }
      return null
    }
    this.pending = snapshot
    this.parsedDocument = parsed.document
    return snapshot
  }

  restore(): boolean {
    if (!this.pending || !this.parsedDocument) return false
    this.store.restoreDocument(this.parsedDocument, this.pending.sourcePath)
    this.pending = null
    this.parsedDocument = null
    return true
  }

  async discard(): Promise<void> {
    const snapshot = this.pending
    if (!snapshot) return
    try {
      await this.repository.remove(snapshot.documentId, snapshot.versionToken)
      this.pending = null
      this.parsedDocument = null
    } catch {
      this.showError('无法丢弃恢复数据，请稍后重试。')
    }
  }
}

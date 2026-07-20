import { serializeDiagramDocument } from '@/domain/document-schema'
import type { DiagramDocument } from '@/domain/diagram'
import type { RecoveryRepository, RecoverySnapshotWrite } from './persistence-ports'

const AUTOSAVE_ERROR = '自动恢复快照保存失败，图文件不受影响。'

export class AutosaveController {
  private timer: ReturnType<typeof setTimeout> | null = null
  private pending: RecoverySnapshotWrite | null = null
  private disposed = false

  constructor(
    private readonly repository: RecoveryRepository,
    private readonly delayMs = 2000,
    private readonly onError: (message: string) => void = () => {},
  ) {}

  schedule(document: DiagramDocument, sourcePath?: string): void {
    if (this.disposed) return
    this.cancelTimer()
    this.pending = {
      documentId: document.id,
      name: document.name,
      json: serializeDiagramDocument(document),
      ...(sourcePath === undefined ? {} : { sourcePath }),
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.writePending()
    }, this.delayMs)
  }

  async flush(): Promise<void> {
    this.cancelTimer()
    await this.writePending()
  }

  cancel(): void {
    this.cancelTimer()
    this.pending = null
  }

  dispose(): void {
    this.cancel()
    this.disposed = true
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async writePending(): Promise<void> {
    const snapshot = this.pending
    this.pending = null
    if (!snapshot) return
    try {
      await this.repository.write(snapshot)
    } catch {
      this.onError(AUTOSAVE_ERROR)
    }
  }
}

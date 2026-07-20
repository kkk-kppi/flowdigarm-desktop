import { serializeDiagramDocument } from '@/domain/document-schema'
import type { DiagramDocument } from '@/domain/diagram'
import type { RecoveryRepository, RecoverySnapshotWrite } from './persistence-ports'

const AUTOSAVE_ERROR = '自动恢复快照保存失败，图文件不受影响。'

export class AutosaveController {
  private timer: ReturnType<typeof setTimeout> | null = null
  private pending: RecoverySnapshotWrite | null = null
  private pendingReady = false
  private running: Promise<void> | null = null
  private disposed = false

  constructor(
    private readonly repository: RecoveryRepository,
    private readonly delayMs = 2000,
    private readonly onError: (message: string) => void = () => {},
  ) {}

  schedule(document: DiagramDocument, versionToken: string, sourcePath?: string): void {
    if (this.disposed) return
    this.cancelTimer()
    this.pending = {
      documentId: document.id,
      versionToken,
      name: document.name,
      json: serializeDiagramDocument(document),
      ...(sourcePath === undefined ? {} : { sourcePath }),
    }
    this.pendingReady = false
    this.timer = setTimeout(() => {
      this.timer = null
      this.pendingReady = true
      void this.startReadyWrite()
    }, this.delayMs)
  }

  async flush(): Promise<void> {
    while (this.pending || this.running) {
      this.cancelTimer()
      if (this.pending) this.pendingReady = true
      if (!this.running) void this.startReadyWrite()
      if (this.running) await this.running
    }
  }

  cancel(): void {
    this.cancelTimer()
    this.pending = null
    this.pendingReady = false
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

  private startReadyWrite(): Promise<void> {
    if (this.running) return this.running
    if (!this.pending || !this.pendingReady) return Promise.resolve()
    const snapshot = this.pending
    this.pending = null
    this.pendingReady = false
    const operation = this.write(snapshot)
    const tracked = operation.finally(() => {
      this.running = null
      if (this.pending && this.pendingReady && !this.disposed) void this.startReadyWrite()
    })
    this.running = tracked
    return tracked
  }

  private async write(snapshot: RecoverySnapshotWrite): Promise<void> {
    try {
      await this.repository.write(snapshot)
    } catch {
      try {
        this.onError(AUTOSAVE_ERROR)
      } catch {
        // Error reporting must not create an unhandled autosave rejection.
      }
    }
  }
}

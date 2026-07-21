import type { DiagramDocument } from '@/domain/diagram'
import type { BrowserE2EArtifact, BrowserE2EFailure } from '@/platform/browser-e2e-platform'

export interface FlowE2EHook {
  injectBenchmark(): void
  injectDocument(document: DiagramDocument, path?: string): void
  injectRecovery(document?: DiagramDocument): Promise<void>
  snapshot(): {
    document: DiagramDocument
    selectedIds: string[]
    revision: number
    canUndo: boolean
    canRedo: boolean
    dirty: boolean
    filePath: string | null
  }
  selectionIds(): string[]
  nodePosition(id: string): { x: number; y: number } | null
  isDirty(): boolean
  fail(operation: BrowserE2EFailure, enabled: boolean): void
  seedFile(path: string, json: string): void
  artifacts(): BrowserE2EArtifact[]
  resources(): { hooks: number; listeners: number; timers: number; controllers: number }
  reset(): void
}

declare global {
  interface Window {
    __FLOW_E2E__?: FlowE2EHook
  }
}

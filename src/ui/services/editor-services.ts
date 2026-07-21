import { ref, type InjectionKey, type Ref } from 'vue'
import type { FileWorkflowUi } from '@/application/persistence/file-workflow-controller'
import type { RecentDocument, RecoverySnapshot } from '@/application/persistence/persistence-ports'
import type { EditorPreferences } from '@/application/settings/settings-controller'
import type { WindowController } from '@/platform/window-controller'
import type { ExportController } from '@/application/export/export-controller'
import type { CanvasInteractionController } from '@/application/canvas/canvas-interaction-controller'

type UnsavedChoice = 'save' | 'discard' | 'cancel'

export interface UnsavedDialogService {
  request: Ref<{ action: 'new' | 'open' | 'close' } | null>
  choose(choice: UnsavedChoice): void
}

export interface EditorServices {
  file: {
    busy: boolean
    recentDocuments: RecentDocument[]
    newDocument(): Promise<boolean>
    openDocument(): Promise<boolean>
    openRecent(path: string): Promise<boolean>
    save(): Promise<boolean>
    saveAs(): Promise<boolean>
    requestClose(): Promise<boolean>
    loadRecent(limit: number): Promise<RecentDocument[]>
  }
  recovery: {
    pending: RecoverySnapshot | null
    checkStartup(): Promise<RecoverySnapshot | null>
    restore(): boolean
    discard(): Promise<void>
  }
  settings: {
    load(): Promise<EditorPreferences>
    apply(settings: EditorPreferences): Promise<void>
  }
  imageImport(): Promise<boolean>
  export: Pick<ExportController, 'chooseDestination' | 'export'>
  window: WindowController
  unsaved: UnsavedDialogService
  canvas?: Pick<CanvasInteractionController, 'moveNode' | 'createEdge' | 'reconnectEdge' | 'updateVertices' | 'resizeNode' | 'rotateNode' | 'createShapeAtCenter' | 'createShapeAtTopLeft' | 'openHyperlink' | 'hasHyperlink'>
}

export const editorServicesKey: InjectionKey<EditorServices> = Symbol('editor-services')

export function createUnsavedDialogService(showError: (message: string) => void): {
  unsaved: UnsavedDialogService
  ui: FileWorkflowUi
} {
  const request = ref<{ action: 'new' | 'open' | 'close' } | null>(null)
  let resolveDecision: ((choice: UnsavedChoice) => void) | null = null
  const unsaved: UnsavedDialogService = {
    request,
    choose(choice) {
      const resolve = resolveDecision
      resolveDecision = null
      request.value = null
      resolve?.(choice)
    },
  }
  return {
    unsaved,
    ui: {
      confirmUnsaved(action) {
        if (resolveDecision) resolveDecision('cancel')
        request.value = { action }
        return new Promise((resolve) => { resolveDecision = resolve })
      },
      showError,
    },
  }
}

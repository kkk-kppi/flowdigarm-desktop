import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { DocumentPersistenceController } from '@/application/persistence/document-persistence-controller'
import { FileWorkflowController } from '@/application/persistence/file-workflow-controller'
import { RecoveryController } from '@/application/recovery/recovery-controller'
import { SettingsController } from '@/application/settings/settings-controller'
import { importImage } from '@/application/images/image-import'
import { ExportController } from '@/application/export/export-controller'
import { InMemoryShapeUsageRepository, type ShapeUsageRepository } from '@/application/shapes/shape-usage-repository'
import type { DiagramFileRepository, RecentDocumentRepository, RecoveryRepository, SettingsRepository } from '@/application/persistence/persistence-ports'
import type { ImageRepository } from '@/application/images/image-import'
import type { DiagramExporter } from '@/application/export/export-ports'
import type { DesktopPlatform } from '@/platform/desktop-platform'
import type { WindowController } from '@/platform/window-controller'
import type { BrowserE2EPlatform } from '@/platform/browser-e2e-platform'
import { platformKey } from '@/platform/platform-provider'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useAppStore } from '@/stores/app-store'
import { SystemClipboard } from '@/infrastructure/clipboard/system-clipboard'
import { shapeDocumentValidationContext } from '@/application/shapes/document-validation-context'
import { CanvasInteractionController } from '@/application/canvas/canvas-interaction-controller'
import { createUnsavedDialogService, editorServicesKey, type EditorServices } from '@/ui/services/editor-services'
import type { ApplicationResourceTracker, ApplicationResources } from '@/e2e/resource-tracker'
import './styles/tokens.css'

interface ApplicationRuntime {
  files: DiagramFileRepository
  recovery: RecoveryRepository
  recents: RecentDocumentRepository
  settings: SettingsRepository
  images: ImageRepository
  exporter: DiagramExporter
  desktop: DesktopPlatform
  shapeUsage: ShapeUsageRepository
  createWindowController(canClose: () => Promise<boolean>): WindowController
  e2e?: BrowserE2EPlatform
}

async function createApplicationRuntime(): Promise<ApplicationRuntime> {
  const [{ invoke, isTauri }, platform, shapeUsage, window] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@/platform/tauri-desktop-platform'),
    import('@/infrastructure/persistence/tauri-shape-usage-repository'),
    import('@/platform/tauri-window-controller'),
  ])
  if (import.meta.env.VITE_E2E === '1' || !isTauri()) {
    const { createBrowserE2EPlatform } = await import('@/platform/browser-e2e-platform')
    const browser = createBrowserE2EPlatform()
    return {
      files: browser.files,
      recovery: browser.recovery,
      recents: browser.recents,
      settings: browser.settings,
      images: browser.images,
      exporter: browser.exporter,
      desktop: browser.desktop,
      shapeUsage: new InMemoryShapeUsageRepository(),
      createWindowController: () => browser.window,
      e2e: browser,
    }
  }
  return {
    files: platform.tauriDiagramFileRepository,
    recovery: platform.tauriRecoveryRepository,
    recents: platform.tauriRecentDocumentRepository,
    settings: platform.tauriSettingsRepository,
    images: platform.tauriImageRepository,
    exporter: platform.tauriDiagramExporter,
    desktop: platform.tauriDesktopPlatform,
    shapeUsage: new shapeUsage.TauriShapeUsageRepository(invoke),
    createWindowController: window.createTauriWindowController,
  }
}

async function bootstrap(): Promise<void> {
const resourceTracker: ApplicationResourceTracker | undefined = import.meta.env.VITE_E2E === '1'
  ? (await import('@/e2e/resource-tracker')).installApplicationResourceTracker(window)
  : undefined
const runtime = await createApplicationRuntime()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.provide(platformKey, runtime.desktop)
const documentStore = useDocumentStore(pinia)
const selectionStore = useSelectionStore(pinia)
const appStore = useAppStore(pinia)
documentStore.setShapeUsageRepository(runtime.shapeUsage)
documentStore.setSystemClipboard(new SystemClipboard(
  !runtime.e2e && typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
  (message) => documentStore.setNotice(message),
))
const persistenceController = new DocumentPersistenceController(
  {
    snapshot: () => ({
      document: documentStore.document,
      filePath: documentStore.filePath,
      dirty: documentStore.dirty,
      revision: documentStore.currentRevision,
      documentEpoch: documentStore.documentEpoch,
    }),
    replaceDocument: (document, path) => documentStore.replaceDocument(document, path),
    markSaved: (path, revision) => documentStore.markSaved(path, revision),
    updateFilePath: (path) => documentStore.updateFilePath(path),
    subscribe: (listener) => documentStore.$subscribe(() => listener(), { detached: true }),
  },
  runtime.files,
  runtime.recovery,
  (message) => documentStore.setNotice(message),
  shapeDocumentValidationContext,
)
const { unsaved, ui: fileWorkflowUi } = createUnsavedDialogService(
  (message) => documentStore.setNotice(message),
)
const fileWorkflowController = new FileWorkflowController(
  documentStore,
  persistenceController,
  runtime.files,
  runtime.recents,
  fileWorkflowUi,
  shapeDocumentValidationContext,
)
const recoveryController = new RecoveryController(
  documentStore,
  runtime.recovery,
  (message) => documentStore.setNotice(message),
  shapeDocumentValidationContext,
)
const settingsController = new SettingsController(
  {
    applyPreferences: (settings) => {
      appStore.applyPreferences(settings)
      documentStore.configureDefaults(settings)
    },
    setNotice: (message) => documentStore.setNotice(message),
  },
  runtime.settings,
)
resourceTracker?.trackController(persistenceController)
resourceTracker?.trackController(settingsController)
const windowController = runtime.createWindowController(() => fileWorkflowController.requestClose())
const exportController = new ExportController({
  snapshot: () => ({ document: documentStore.document, activePageId: documentStore.activePageId }),
}, runtime.exporter, shapeDocumentValidationContext)
const canvasInteractionController = new CanvasInteractionController({
  getDocument: () => documentStore.document,
  getActivePageId: () => documentStore.activePageId,
  executeCommand: (command) => documentStore.executeCommand(command),
  setNotice: (message) => documentStore.setNotice(message),
  openExternalLink: (url) => runtime.desktop.openExternalLink(url),
  select: (ids) => selectionStore.setSelection(ids),
  recordShapeUsage: (shape) => { void documentStore.recordShapeUsage(shape) },
})
const services: EditorServices = {
  file: fileWorkflowController,
  recovery: recoveryController,
  settings: settingsController,
  imageImport: () => importImage(runtime.images, {
    get activePage() { return documentStore.activePage },
    executeCommand: (command) => documentStore.executeCommand(command),
    select: (ids) => selectionStore.setSelection(ids),
    setNotice: (message) => documentStore.setNotice(message),
  }),
  export: exportController,
  window: windowController,
  unsaved,
  canvas: canvasInteractionController,
}
app.provide(editorServicesKey, services)

let closeDisposed = false
let closeUnlisten: (() => void) | undefined
void windowController.onCloseRequested().then((unlisten) => {
  if (closeDisposed) unlisten()
  else closeUnlisten = unlisten
}).catch(() => {})
const disposeCloseListener = () => {
  if (closeDisposed) return
  closeDisposed = true
  closeUnlisten?.()
  closeUnlisten = undefined
}
let disposeE2EHook = () => {}
let lifecycleDisposed = false
let applicationUnmounted = false
const disposeLifecycle = () => {
  if (lifecycleDisposed) return
  lifecycleDisposed = true
  persistenceController.dispose()
  settingsController.dispose()
  disposeCloseListener()
  disposeE2EHook()
  window.removeEventListener('beforeunload', disposeApplication)
}
const disposeApplication = (): ApplicationResources => {
  if (!applicationUnmounted) {
    applicationUnmounted = true
    app.unmount()
  }
  disposeLifecycle()
  const resources = resourceTracker?.resources() ?? { listeners: 0, timers: 0, controllers: 0 }
  resourceTracker?.restore()
  return resources
}
if (import.meta.env.VITE_E2E === '1' && runtime.e2e) {
  disposeE2EHook = (await import('@/e2e/e2e-hook')).installE2EHook(window, {
    documentStore,
    selectionStore,
    runtime: runtime.e2e,
    disposeApplication,
    resourceDiagnostics: () => resourceTracker?.diagnostics() ?? { listeners: [], timers: [] },
  })
}
window.addEventListener('beforeunload', disposeApplication)
app.onUnmount(disposeLifecycle)
app.mount('#app')
}

void bootstrap().catch((err) => {
  console.error(err)
  document.body.textContent = '应用启动失败，请重新启动。'
})

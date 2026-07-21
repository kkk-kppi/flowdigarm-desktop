import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { invoke } from '@tauri-apps/api/core'
import { TauriShapeUsageRepository } from '@/infrastructure/persistence/tauri-shape-usage-repository'
import { DocumentPersistenceController } from '@/application/persistence/document-persistence-controller'
import { FileWorkflowController } from '@/application/persistence/file-workflow-controller'
import { RecoveryController } from '@/application/recovery/recovery-controller'
import { SettingsController } from '@/application/settings/settings-controller'
import { importImage } from '@/application/images/image-import'
import {
  tauriDiagramFileRepository,
  tauriImageRepository,
  tauriRecentDocumentRepository,
  tauriRecoveryRepository,
  tauriSettingsRepository,
} from '@/platform/tauri-desktop-platform'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useAppStore } from '@/stores/app-store'
import { SystemClipboard } from '@/infrastructure/clipboard/system-clipboard'
import { createTauriWindowController } from '@/platform/tauri-window-controller'
import {
  createUnsavedDialogService,
  editorServicesKey,
  type EditorServices,
} from '@/ui/services/editor-services'
import './styles/tokens.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const documentStore = useDocumentStore(pinia)
const selectionStore = useSelectionStore(pinia)
const appStore = useAppStore(pinia)
documentStore.setShapeUsageRepository(new TauriShapeUsageRepository(invoke))
documentStore.setSystemClipboard(new SystemClipboard(
  typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
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
  tauriDiagramFileRepository,
  tauriRecoveryRepository,
  (message) => documentStore.setNotice(message),
)
const { unsaved, ui: fileWorkflowUi } = createUnsavedDialogService(
  (message) => documentStore.setNotice(message),
)
const fileWorkflowController = new FileWorkflowController(
  documentStore,
  persistenceController,
  tauriDiagramFileRepository,
  tauriRecentDocumentRepository,
  fileWorkflowUi,
)
const recoveryController = new RecoveryController(
  documentStore,
  tauriRecoveryRepository,
  (message) => documentStore.setNotice(message),
)
const settingsController = new SettingsController(
  {
    applyPreferences: (settings) => {
      appStore.applyPreferences(settings)
      documentStore.configureDefaults(settings)
    },
    setNotice: (message) => documentStore.setNotice(message),
  },
  tauriSettingsRepository,
)
const windowController = createTauriWindowController(() => fileWorkflowController.requestClose())
const services: EditorServices = {
  file: fileWorkflowController,
  recovery: recoveryController,
  settings: settingsController,
  imageImport: () => importImage(tauriImageRepository, {
    get activePage() { return documentStore.activePage },
    executeCommand: (command) => documentStore.executeCommand(command),
    select: (ids) => selectionStore.setSelection(ids),
    setNotice: (message) => documentStore.setNotice(message),
  }),
  window: windowController,
  unsaved,
}
app.provide(editorServicesKey, services)
let removeCloseListener: (() => void) | undefined
void windowController.onCloseRequested().then((remove) => {
  removeCloseListener = remove
})
let disposed = false
const disposePersistence = () => {
  if (disposed) return
  disposed = true
  persistenceController.dispose()
  settingsController.dispose()
  removeCloseListener?.()
  window.removeEventListener('beforeunload', disposePersistence)
}
window.addEventListener('beforeunload', disposePersistence)
app.onUnmount(disposePersistence)
app.mount('#app')

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { invoke } from '@tauri-apps/api/core'
import { TauriShapeUsageRepository } from '@/infrastructure/persistence/tauri-shape-usage-repository'
import { DocumentPersistenceController } from '@/application/persistence/document-persistence-controller'
import {
  tauriDiagramFileRepository,
  tauriRecoveryRepository,
} from '@/platform/tauri-desktop-platform'
import { useDocumentStore } from '@/stores/document-store'
import './styles/tokens.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const documentStore = useDocumentStore(pinia)
documentStore.setShapeUsageRepository(new TauriShapeUsageRepository(invoke))
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
let disposed = false
const disposePersistence = () => {
  if (disposed) return
  disposed = true
  persistenceController.dispose()
  window.removeEventListener('beforeunload', disposePersistence)
}
window.addEventListener('beforeunload', disposePersistence)
app.onUnmount(disposePersistence)
app.mount('#app')

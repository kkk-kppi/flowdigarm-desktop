import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { invoke } from '@tauri-apps/api/core'
import { TauriShapeUsageRepository } from '@/infrastructure/persistence/tauri-shape-usage-repository'
import { useDocumentStore } from '@/stores/document-store'
import './styles/tokens.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
useDocumentStore(pinia).setShapeUsageRepository(new TauriShapeUsageRepository(invoke))
app.mount('#app')

import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import type {
  DiagramFileRepository,
  RecentDocumentRepository,
  RecoveryRepository,
  SettingsRepository,
} from '@/application/persistence/persistence-ports'
import type { ImageReadResult, ImageRepository } from '@/application/images/image-import'
import type { DesktopPlatform } from './desktop-platform'

const diagramFilter = [{ name: '流程图文件 (*.flowdiagram)', extensions: ['flowdiagram'] }]
const imageFilter = [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]

export function normalizeDiagramSavePath(path: string): string {
  const fileName = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const extensionIndex = fileName.lastIndexOf('.')
  if (extensionIndex <= 0) return `${path}.flowdiagram`
  if (fileName.slice(extensionIndex).toLowerCase() === '.flowdiagram') return path
  throw new Error('只能保存为 .flowdiagram 文件。')
}

export const tauriDiagramFileRepository: DiagramFileRepository = {
  async open() {
    const path = await open({ multiple: false, directory: false, filters: diagramFilter })
    if (!path) return null
    return { path, json: await invoke<string>('read_diagram', { path }) }
  },
  async read(path) {
    return { path, json: await invoke<string>('read_diagram', { path }) }
  },
  async save(input) {
    let path = input.path
    if (!path) {
      path = await save({ defaultPath: input.suggestedName, filters: diagramFilter }) ?? undefined
    }
    if (!path) return null
    path = normalizeDiagramSavePath(path)
    return invoke<string>('save_diagram', { path, documentJson: input.json })
  },
}

export const tauriRecoveryRepository: RecoveryRepository = {
  latest: () => invoke('read_recovery_snapshot'),
  write: (input) => invoke<void>('write_recovery_snapshot', { ...input }),
  remove: (documentId, versionToken) => invoke<void>('delete_recovery_snapshot', {
    documentId,
    versionToken,
  }),
}

export const tauriRecentDocumentRepository: RecentDocumentRepository = {
  list: () => invoke('list_recent_documents'),
  remove: (path) => invoke<void>('remove_recent_document', { path }),
}

export const tauriSettingsRepository: SettingsRepository = {
  all: () => invoke('get_settings'),
  set: (key, value) => invoke<void>('set_setting', { key, valueJson: JSON.stringify(value) }),
}

export const tauriImageRepository: ImageRepository = {
  async pickAndRead() {
    const path = await open({ multiple: false, directory: false, filters: imageFilter })
    if (!path || typeof path !== 'string') return null
    return invoke<ImageReadResult>('read_image', { path })
  },
}

export const tauriDesktopPlatform: DesktopPlatform = {
  async openDiagram() {
    const opened = await tauriDiagramFileRepository.open()
    return opened ? { path: opened.path, document: opened.json } : null
  },
  saveDiagram: (input) => tauriDiagramFileRepository.save({
    path: input.path,
    suggestedName: '未命名流程图.flowdiagram',
    json: JSON.stringify(input.document),
  }),
  exportDiagram: (input) => invoke<string | null>('export_diagram', { input }),
  openExternalLink: (url) => invoke<void>('open_external_link', { url }),
  readRecoverySnapshot: () => tauriRecoveryRepository.latest(),
  writeRecoverySnapshot: async (document) => {
    if (!isRecoveryWrite(document)) throw new Error('自动恢复快照数据无效。')
    await tauriRecoveryRepository.write(document)
  },
}

function isRecoveryWrite(value: unknown): value is Parameters<RecoveryRepository['write']>[0] {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.documentId === 'string'
    && typeof candidate.versionToken === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.json === 'string'
}

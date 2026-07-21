import type { ImageRepository } from '@/application/images/image-import'
import type { DiagramExporter, NativeExportRequest } from '@/application/export/export-ports'
import type {
  DiagramFileRepository,
  RecentDocument,
  RecentDocumentRepository,
  RecoveryRepository,
  RecoverySnapshot,
  SettingsRepository,
} from '@/application/persistence/persistence-ports'
import type { DesktopPlatform } from './desktop-platform'
import type { WindowController } from './window-controller'

const STORAGE_KEY = 'flowdiagram:e2e-platform:v1'

export type BrowserE2EFailure = 'open' | 'save' | 'export' | 'recovery' | 'settings' | 'recents' | 'database'

export interface BrowserE2EArtifact {
  path: string
  format: NativeExportRequest['format']
  content: string
  width?: number
  height?: number
  dpi?: number
}

interface PersistedState {
  files: Record<string, string>
  recents: RecentDocument[]
  recovery: RecoverySnapshot | null
  settings: Record<string, unknown>
  failures: BrowserE2EFailure[]
}

export interface BrowserE2EPlatform {
  files: DiagramFileRepository
  recents: RecentDocumentRepository
  recovery: RecoveryRepository
  settings: SettingsRepository
  images: ImageRepository
  exporter: DiagramExporter
  desktop: DesktopPlatform
  window: WindowController
  control: {
    fail(operation: BrowserE2EFailure, enabled: boolean): void
    failures(): BrowserE2EFailure[]
    seedFile(path: string, json: string): void
    artifacts(): BrowserE2EArtifact[]
    resources(): { hooks: number; listeners: number; timers: number; controllers: number }
    mountHook(): () => void
    dispose(): void
    reset(): void
  }
}

function emptyState(): PersistedState {
  return { files: {}, recents: [], recovery: null, settings: {}, failures: [] }
}

function readState(storage: Storage): PersistedState {
  try {
    const value = storage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) as PersistedState : emptyState()
  } catch {
    return emptyState()
  }
}

function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path
}

export function createBrowserE2EPlatform(storage: Storage = localStorage): BrowserE2EPlatform {
  let state = readState(storage)
  let artifacts: BrowserE2EArtifact[] = []
  const failures = new Set<BrowserE2EFailure>(state.failures ?? [])
  let hookCount = 0
  let controllerCount = 1
  const persist = () => storage.setItem(STORAGE_KEY, JSON.stringify(state))
  const rejectIfFailed = (operation: BrowserE2EFailure, message: string) => {
    if (failures.has(operation) || failures.has('database') && operation !== 'save') throw new Error(message)
  }

  const recents: RecentDocumentRepository = {
    async list() {
      rejectIfFailed('recents', '最近文件数据库不可用（E2E 模拟）。')
      return structuredClone(state.recents)
    },
    async remove(path) {
      rejectIfFailed('recents', '最近文件数据库不可用（E2E 模拟）。')
      state.recents = state.recents.filter((item) => item.path !== path)
      persist()
    },
  }
  const files: DiagramFileRepository = {
    async open() {
      rejectIfFailed('open', '打开失败（E2E 模拟）。')
      const path = state.recents[0]?.path ?? Object.keys(state.files)[0]
      return path ? { path, json: state.files[path] } : null
    },
    async read(path) {
      rejectIfFailed('open', '打开失败（E2E 模拟）。')
      const json = state.files[path]
      if (json === undefined) throw new Error('文件不存在（E2E 模拟）。')
      return { path, json }
    },
    async save(input) {
      rejectIfFailed('save', '保存失败（E2E 模拟）。')
      const path = input.path ?? `/e2e/${input.suggestedName}`
      state.files[path] = input.json
      let documentId = 'e2e-document'
      let name = fileName(path).replace(/\.flowdiagram$/i, '')
      try {
        const parsed = JSON.parse(input.json) as { id?: string; name?: string }
        documentId = parsed.id ?? documentId
        name = parsed.name ?? name
      } catch {
        // Invalid fixture bytes remain readable so opening can exercise validation errors.
      }
      state.recents = [{ path, documentId, name, lastOpenedAt: Date.now(), pinned: false }, ...state.recents.filter((item) => item.path !== path)]
      persist()
      return path
    },
  }
  const recovery: RecoveryRepository = {
    async latest() {
      rejectIfFailed('recovery', '恢复数据库不可用（E2E 模拟）。')
      return structuredClone(state.recovery)
    },
    async write(input) {
      rejectIfFailed('recovery', '恢复数据库不可用（E2E 模拟）。')
      state.recovery = { ...structuredClone(input), updatedAt: Date.now() }
      persist()
    },
    async remove(documentId, versionToken) {
      rejectIfFailed('recovery', '恢复数据库不可用（E2E 模拟）。')
      if (state.recovery?.documentId === documentId && state.recovery.versionToken === versionToken) state.recovery = null
      persist()
    },
  }
  const settings: SettingsRepository = {
    async all() {
      rejectIfFailed('settings', '设置数据库不可用（E2E 模拟）。')
      return structuredClone(state.settings)
    },
    async set(key, value) {
      rejectIfFailed('settings', '设置数据库不可用（E2E 模拟）。')
      state.settings[key] = structuredClone(value)
      persist()
    },
  }
  const exporter: DiagramExporter = {
    async chooseDestination({ suggestedName }) {
      return `/e2e/${suggestedName}`
    },
    async export(input) {
      rejectIfFailed('export', '导出失败（E2E 模拟）。')
      const next: BrowserE2EArtifact[] = []
      if (input.format === 'json') {
        next.push({ path: input.path, format: 'json', content: input.documentJson ?? '' })
      } else if (input.format === 'pdf') {
        const uris = input.pages.flatMap((page) => page.links.map(({ url }) => `/URI (${url})`)).join('\n')
        next.push({ path: input.path, format: 'pdf', content: `%PDF-1.7\n${uris}` })
      } else {
        input.pages.forEach((page, index) => {
          const path = input.pages.length === 1 ? input.path : input.path.replace(/(\.[^.]+)$/, `-${index + 1}$1`)
          next.push(input.format === 'svg'
            ? { path, format: 'svg', content: page.svg }
            : {
                path,
                format: 'png',
                content: `PNG ${input.dpi}`,
                dpi: input.dpi,
                width: Math.round(page.widthPt * (input.dpi ?? 0) / 72),
                height: Math.round(page.heightPt * (input.dpi ?? 0) / 72),
              })
        })
      }
      const replacedPaths = new Set(next.map(({ path }) => path))
      artifacts = [...artifacts.filter(({ path }) => !replacedPaths.has(path)), ...next]
      return next.map(({ path }) => path)
    },
  }
  const desktop: DesktopPlatform = {
    async openDiagram() {
      const opened = await files.open()
      return opened ? { path: opened.path, document: opened.json } : null
    },
    saveDiagram: ({ path, document }) => files.save({ path, suggestedName: '未命名流程图.flowdiagram', json: JSON.stringify(document) }),
    exportDiagram: async () => null,
    openExternalLink: async () => {},
    readRecoverySnapshot: () => recovery.latest(),
    writeRecoverySnapshot: async (document) => recovery.write(document as Parameters<RecoveryRepository['write']>[0]),
  }
  const windowController: WindowController = {
    minimize: async () => {},
    toggleMaximize: async () => {},
    requestClose: async () => {},
    onCloseRequested: async () => () => {},
  }

  return {
    files,
    recents,
    recovery,
    settings,
    exporter,
    desktop,
    window: windowController,
    images: { pickAndRead: async () => null },
    control: {
      fail(operation, enabled) {
        enabled ? failures.add(operation) : failures.delete(operation)
        state.failures = [...failures]
        persist()
      },
      failures: () => [...failures],
      seedFile(path, json) {
        state.files[path] = json
        state.recents = [{ path, documentId: 'seeded-invalid', name: fileName(path).replace(/\.flowdiagram$/i, ''), lastOpenedAt: Date.now(), pinned: false }]
        persist()
      },
      artifacts: () => structuredClone(artifacts),
      resources: () => ({ hooks: hookCount, listeners: hookCount, timers: 0, controllers: controllerCount }),
      mountHook() {
        hookCount += 1
        let mounted = true
        return () => {
          if (!mounted) return
          mounted = false
          hookCount -= 1
        }
      },
      dispose() {
        hookCount = 0
        controllerCount = 0
      },
      reset() {
        state = emptyState()
        artifacts = []
        failures.clear()
        controllerCount = 1
        persist()
      },
    },
  }
}

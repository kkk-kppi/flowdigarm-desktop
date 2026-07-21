import type { ConnectorKind, PageUnit } from '@/domain/diagram'
import type { SettingsRepository } from '@/application/persistence/persistence-ports'

export interface EditorPreferences {
  theme: 'system' | 'light' | 'dark'
  showRulers: boolean
  showGrid: boolean
  showGuides: boolean
  showPageBreaks: boolean
  snapToGrid: boolean
  defaultZoom: number
  defaultPageUnit: PageUnit
  defaultConnector: ConnectorKind
  recentLimit: number
  pngDpi: number
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  theme: 'system',
  showRulers: true,
  showGrid: false,
  showGuides: true,
  showPageBreaks: false,
  snapToGrid: true,
  defaultZoom: 1,
  defaultPageUnit: 'mm',
  defaultConnector: 'orthogonal',
  recentLimit: 50,
  pngDpi: 150,
}

export interface SettingsStore {
  applyPreferences(settings: EditorPreferences): void
  setNotice(message: string): void
}

interface MediaQueryPort {
  matches: boolean
  addEventListener?(event: 'change', listener: () => void): void
  removeEventListener?(event: 'change', listener: () => void): void
}

export interface SettingsEnvironment {
  root: { setAttribute(name: string, value: string): void }
  matchMedia(query: string): MediaQueryPort
}

const settingKeys: Array<[keyof EditorPreferences, string]> = [
  ['theme', 'theme.mode'],
  ['showRulers', 'editor.showRulers'],
  ['showGrid', 'editor.showGrid'],
  ['showGuides', 'editor.showGuides'],
  ['showPageBreaks', 'editor.showPageBreaks'],
  ['snapToGrid', 'editor.snapToGrid'],
  ['defaultZoom', 'editor.defaultZoom'],
  ['defaultPageUnit', 'editor.defaultPageUnit'],
  ['defaultConnector', 'editor.defaultConnector'],
  ['recentLimit', 'editor.recentLimit'],
  ['pngDpi', 'export.pngDpi'],
]

export class SettingsController {
  private current = { ...DEFAULT_EDITOR_PREFERENCES }
  private mediaQueries: MediaQueryPort[] = []
  private disposed = false
  private generation = 0
  private readonly onMediaChange = () => this.applyMedia()

  constructor(
    private readonly store: SettingsStore,
    private readonly repository: SettingsRepository,
    private readonly environment: SettingsEnvironment = browserEnvironment(),
  ) {}

  async load(): Promise<EditorPreferences> {
    const generation = ++this.generation
    let stored: Record<string, unknown> = {}
    try {
      stored = await this.repository.all()
    } catch {
      // Local settings are optional; defaults keep the editor usable.
    }
    const settings = validateSettings(stored)
    if (!this.disposed && generation === this.generation) this.applyRuntime(settings)
    return settings
  }

  async apply(settings: EditorPreferences): Promise<void> {
    ++this.generation
    const validated = validateSettings(Object.fromEntries(
      settingKeys.map(([property, key]) => [key, settings[property]]),
    ))
    if (!this.disposed) this.applyRuntime(validated)
    const writes = await Promise.allSettled(
      settingKeys.map(([property, key]) => this.repository.set(key, validated[property])),
    )
    if (writes.some((result) => result.status === 'rejected')) {
      this.store.setNotice('设置保存失败，本次运行仍会生效。')
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    ++this.generation
    for (const query of this.mediaQueries) query.removeEventListener?.('change', this.onMediaChange)
    this.mediaQueries = []
  }

  private applyRuntime(settings: EditorPreferences): void {
    this.current = { ...settings }
    this.store.applyPreferences(settings)
    if (this.mediaQueries.length === 0) {
      this.mediaQueries = [
        this.environment.matchMedia('(prefers-color-scheme: dark)'),
        this.environment.matchMedia('(prefers-contrast: more)'),
        this.environment.matchMedia('(prefers-reduced-motion: reduce)'),
      ]
      for (const query of this.mediaQueries) query.addEventListener?.('change', this.onMediaChange)
    }
    this.applyMedia()
  }

  private applyMedia(): void {
    const [colorScheme, contrast, reducedMotion] = this.mediaQueries
    const dark = this.current.theme === 'dark'
      || (this.current.theme === 'system' && colorScheme?.matches)
    this.environment.root.setAttribute('data-theme', dark ? 'dark' : 'light')
    this.environment.root.setAttribute(
      'data-contrast',
      contrast?.matches ? 'more' : 'normal',
    )
    this.environment.root.setAttribute(
      'data-reduced-motion',
      reducedMotion?.matches ? 'reduce' : 'no-preference',
    )
  }
}

function validateSettings(values: Record<string, unknown>): EditorPreferences {
  return {
    theme: oneOf(values['theme.mode'], ['system', 'light', 'dark']) ?? DEFAULT_EDITOR_PREFERENCES.theme,
    showRulers: booleanOr(values['editor.showRulers'], DEFAULT_EDITOR_PREFERENCES.showRulers),
    showGrid: booleanOr(values['editor.showGrid'], DEFAULT_EDITOR_PREFERENCES.showGrid),
    showGuides: booleanOr(values['editor.showGuides'], DEFAULT_EDITOR_PREFERENCES.showGuides),
    showPageBreaks: booleanOr(values['editor.showPageBreaks'], DEFAULT_EDITOR_PREFERENCES.showPageBreaks),
    snapToGrid: booleanOr(values['editor.snapToGrid'], DEFAULT_EDITOR_PREFERENCES.snapToGrid),
    defaultZoom: numberOr(values['editor.defaultZoom'], 0.1, 8, DEFAULT_EDITOR_PREFERENCES.defaultZoom),
    defaultPageUnit: oneOf(values['editor.defaultPageUnit'], ['mm', 'cm', 'in', 'pt', 'px'])
      ?? DEFAULT_EDITOR_PREFERENCES.defaultPageUnit,
    defaultConnector: oneOf(values['editor.defaultConnector'], ['straight', 'orthogonal', 'curved'])
      ?? DEFAULT_EDITOR_PREFERENCES.defaultConnector,
    recentLimit: integerOr(values['editor.recentLimit'], 1, 100, DEFAULT_EDITOR_PREFERENCES.recentLimit),
    pngDpi: integerOr(values['export.pngDpi'], 72, 600, DEFAULT_EDITOR_PREFERENCES.pngDpi),
  }
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberOr(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback
}

function integerOr(value: unknown, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) ? numberOr(value, min, max, fallback) : fallback
}

function oneOf<const T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return typeof value === 'string' && options.includes(value as T) ? value as T : undefined
}

function browserEnvironment(): SettingsEnvironment {
  return {
    root: document.documentElement,
    matchMedia: (query) => window.matchMedia(query),
  }
}

import type { SettingsRepository } from '@/application/persistence/persistence-ports'
import {
  DEFAULT_EDITOR_PREFERENCES,
  SettingsController,
  type EditorPreferences,
  type SettingsStore,
} from '@/application/settings/settings-controller'
import { readFileSync } from 'node:fs'

function repository(values: Record<string, unknown> = {}): SettingsRepository & { writes: Array<[string, unknown]> } {
  return {
    writes: [],
    all: async () => values,
    async set(key, value) { this.writes.push([key, value]) },
  }
}

function store(): SettingsStore & { settings: EditorPreferences; notices: string[] } {
  return {
    settings: { ...DEFAULT_EDITOR_PREFERENCES },
    notices: [],
    applyPreferences(value) { this.settings = { ...value } },
    setNotice(message) { this.notices.push(message) },
  }
}

function environment(dark = false, contrast = false, reducedMotion = false) {
  const attributes: Record<string, string> = {}
  const media = new Map<string, { matches: boolean; listeners: Set<() => void>; addEventListener: (_event: string, listener: () => void) => void; removeEventListener: (_event: string, listener: () => void) => void }>([
    ['(prefers-color-scheme: dark)', { matches: dark, listeners: new Set(), addEventListener(_event, listener) { this.listeners.add(listener) }, removeEventListener(_event, listener) { this.listeners.delete(listener) } }],
    ['(prefers-contrast: more)', { matches: contrast, listeners: new Set(), addEventListener(_event, listener) { this.listeners.add(listener) }, removeEventListener(_event, listener) { this.listeners.delete(listener) } }],
    ['(prefers-reduced-motion: reduce)', { matches: reducedMotion, listeners: new Set(), addEventListener(_event, listener) { this.listeners.add(listener) }, removeEventListener(_event, listener) { this.listeners.delete(listener) } }],
  ])
  return {
    attributes,
    root: { setAttribute: (key: string, value: string) => { attributes[key] = value } },
    matchMedia: (query: string) => media.get(query)!,
    set(query: string, matches: boolean) {
      const value = media.get(query)!
      value.matches = matches
      value.listeners.forEach((listener) => listener())
    },
    listenerCount: () => [...media.values()].reduce((count, value) => count + value.listeners.size, 0),
  }
}

describe('SettingsController', () => {
  it('ships CSS hooks for dark theme, increased contrast, and reduced motion', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    expect(css).toContain("[data-theme='dark']")
    expect(css).toContain("[data-contrast='more']")
    expect(css).toContain("[data-reduced-motion='reduce']")
  })

  it('loads all ten valid persisted settings into runtime state', async () => {
    const target = store()
    const values = {
      'theme.mode': 'dark',
      'editor.showRulers': false,
      'editor.showGrid': true,
      'editor.showGuides': false,
      'editor.showPageBreaks': true,
      'editor.defaultZoom': 1.5,
      'editor.defaultPageUnit': 'cm',
      'editor.defaultConnector': 'curved',
      'editor.recentLimit': 12,
      'export.pngDpi': 300,
    }
    const controller = new SettingsController(target, repository(values), environment())

    await controller.load()

    expect(target.settings).toEqual({
      theme: 'dark', showRulers: false, showGrid: true, showGuides: false,
      showPageBreaks: true, defaultZoom: 1.5, defaultPageUnit: 'cm',
      defaultConnector: 'curved', recentLimit: 12, pngDpi: 300,
    })
  })

  it('falls back per field for missing or invalid persisted values', async () => {
    const target = store()
    const controller = new SettingsController(target, repository({
      'theme.mode': 'neon',
      'editor.showRulers': 'yes',
      'editor.defaultZoom': Number.NaN,
      'editor.defaultPageUnit': 'meter',
      'editor.defaultConnector': 'zigzag',
      'editor.recentLimit': 0,
      'export.pngDpi': 9999,
    }), environment())

    await controller.load()

    expect(target.settings).toEqual(DEFAULT_EDITOR_PREFERENCES)
  })

  it('uses defaults when settings storage is unavailable', async () => {
    const target = store()
    const controller = new SettingsController(target, {
      all: async () => { throw new Error('db') },
      set: async () => {},
    }, environment())

    await controller.load()

    expect(target.settings).toEqual(DEFAULT_EDITOR_PREFERENCES)
  })

  it('applies runtime settings before persistence and reports degraded writes once', async () => {
    const target = store()
    const persisted = repository()
    persisted.set = async function (key, value) {
      this.writes.push([key, value])
      if (key === 'editor.showGrid') throw new Error('db')
    }
    const controller = new SettingsController(target, persisted, environment())
    const next: EditorPreferences = { ...DEFAULT_EDITOR_PREFERENCES, theme: 'dark', showGrid: true, pngDpi: 600 }

    await controller.apply(next)

    expect(target.settings).toEqual(next)
    expect(persisted.writes).toHaveLength(10)
    expect(target.notices).toEqual(['设置保存失败，本次运行仍会生效。'])
  })

  it('maps system theme, increased contrast, and reduced motion to root data attributes', async () => {
    const target = store()
    const media = environment(true, true, true)
    const controller = new SettingsController(target, repository(), media)

    await controller.load()

    expect(media.attributes).toEqual({
      'data-theme': 'dark',
      'data-contrast': 'more',
      'data-reduced-motion': 'reduce',
    })
  })

  it('reacts to OS media changes and removes listeners on dispose', async () => {
    const target = store()
    const media = environment(false, false, false)
    const controller = new SettingsController(target, repository(), media)
    await controller.load()
    expect(media.listenerCount()).toBe(3)

    media.set('(prefers-color-scheme: dark)', true)
    media.set('(prefers-contrast: more)', true)
    media.set('(prefers-reduced-motion: reduce)', true)
    expect(media.attributes).toMatchObject({
      'data-theme': 'dark', 'data-contrast': 'more', 'data-reduced-motion': 'reduce',
    })

    controller.dispose()
    expect(media.listenerCount()).toBe(0)
  })

  it('does not register media listeners when a deferred load resolves after disposal', async () => {
    let resolveAll!: (values: Record<string, unknown>) => void
    const media = environment()
    const controller = new SettingsController(store(), {
      all: () => new Promise((resolve) => { resolveAll = resolve }),
      set: async () => {},
    }, media)

    const loading = controller.load()
    controller.dispose()
    resolveAll({ 'theme.mode': 'dark' })
    await loading

    expect(media.listenerCount()).toBe(0)
  })

  it('ignores an older deferred load that resolves after a newer load', async () => {
    const resolvers: Array<(values: Record<string, unknown>) => void> = []
    const target = store()
    const media = environment()
    const controller = new SettingsController(target, {
      all: () => new Promise((resolve) => { resolvers.push(resolve) }),
      set: async () => {},
    }, media)

    const older = controller.load()
    const newer = controller.load()
    resolvers[1]({ 'theme.mode': 'dark' })
    await newer
    resolvers[0]({ 'theme.mode': 'light' })
    await older

    expect(target.settings.theme).toBe('dark')
    expect(media.listenerCount()).toBe(3)
  })
})

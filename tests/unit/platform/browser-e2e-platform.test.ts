import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain/diagram'
import { serializeDiagramDocument } from '@/domain/document-schema'
import { createBrowserE2EPlatform } from '@/platform/browser-e2e-platform'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('BrowserE2EPlatform', () => {
  it('publishes deterministic maximize state to browser shell watchers', async () => {
    const runtime = createBrowserE2EPlatform(memoryStorage())
    const values: boolean[] = []
    const stop = await runtime.window.watchMaximized((value) => values.push(value))
    expect(values).toEqual([false])
    await runtime.window.toggleMaximize()
    expect(values).toEqual([false, true])
    stop()
    await runtime.window.toggleMaximize()
    expect(values).toEqual([false, true])
  })

  it('persists save, recent, settings, and recovery data without network or native APIs', async () => {
    const storage = memoryStorage()
    const runtime = createBrowserE2EPlatform(storage)
    const document = createEmptyDocument('浏览器测试')
    const json = serializeDiagramDocument(document)

    const path = await runtime.files.save({ suggestedName: '浏览器测试.flowdiagram', json })
    expect(path).toBe('/e2e/浏览器测试.flowdiagram')
    await runtime.recovery.write({
      documentId: document.id,
      versionToken: '0:1',
      name: document.name,
      json,
    })
    await runtime.settings.set('theme', 'dark')

    const reloaded = createBrowserE2EPlatform(storage)
    expect(await reloaded.files.read(path!)).toEqual({ path, json })
    expect(await reloaded.recents.list()).toHaveLength(1)
    expect(await reloaded.settings.all()).toMatchObject({ theme: 'dark' })
    expect(await reloaded.recovery.latest()).toMatchObject({ documentId: document.id, json })
  })

  it('preserves old files and artifacts when a requested operation fails', async () => {
    const runtime = createBrowserE2EPlatform(memoryStorage())
    await runtime.files.save({ path: '/e2e/existing.flowdiagram', suggestedName: 'existing.flowdiagram', json: '{"old":true}' })
    runtime.control.fail('save', true)
    await expect(runtime.files.save({ path: '/e2e/existing.flowdiagram', suggestedName: 'existing.flowdiagram', json: '{"new":true}' })).rejects.toThrow('保存失败')
    runtime.control.fail('save', false)
    expect((await runtime.files.read('/e2e/existing.flowdiagram')).json).toBe('{"old":true}')

    await runtime.exporter.export({
      format: 'svg', scope: 'currentPage', fileName: 'existing', path: '/e2e/existing.svg',
      pages: [{ name: '页面', widthPt: 72, heightPt: 36, svg: '<svg>old</svg>', links: [] }],
    })
    const before = runtime.control.artifacts()
    runtime.control.fail('export', true)
    await expect(runtime.exporter.export({
      format: 'svg', scope: 'currentPage', fileName: 'existing', path: '/e2e/existing.svg',
      pages: [{ name: '页面', widthPt: 72, heightPt: 36, svg: '<svg>new</svg>', links: [] }],
    })).rejects.toThrow('导出失败')
    expect(runtime.control.artifacts()).toEqual(before)
    expect(runtime.control.artifactBytes('/e2e/existing.flowdiagram')).toBe('{"old":true}')
    expect(runtime.control.artifactBytes('/e2e/existing.svg')).toBe('<svg>old</svg>')
  })

  it('records exact PNG dimensions and PDF URI evidence for assertions', async () => {
    const runtime = createBrowserE2EPlatform(memoryStorage())
    for (const dpi of [96, 150, 300] as const) {
      await runtime.exporter.export({
        format: 'png', scope: 'currentPage', fileName: `dpi-${dpi}`, path: `/e2e/dpi-${dpi}.png`, dpi,
        pages: [{ name: '页面', widthPt: 72, heightPt: 36, svg: '<svg/>', links: [] }],
      })
    }
    await runtime.exporter.export({
      format: 'pdf', scope: 'currentPage', fileName: 'links', path: '/e2e/links.pdf',
      pages: [{ name: '页面', widthPt: 72, heightPt: 36, svg: '<svg/>', links: [{ url: 'https://example.com', xPt: 0, yPt: 0, widthPt: 1, heightPt: 1 }] }],
    })

    expect(runtime.control.artifacts().filter(({ format }) => format === 'png').map(({ width, height }) => [width, height]))
      .toEqual([[96, 48], [150, 75], [300, 150]])
    expect(runtime.control.artifacts().find(({ format }) => format === 'pdf')?.content).toContain('/URI (https://example.com)')
  })

  it('persists startup failures and seeds invalid files for browser-only error paths', async () => {
    const storage = memoryStorage()
    const runtime = createBrowserE2EPlatform(storage)
    runtime.control.fail('settings', true)
    runtime.control.seedFile('/e2e/invalid.flowdiagram', '{"schemaVersion":999}')

    const reloaded = createBrowserE2EPlatform(storage)
    expect(reloaded.control.failures()).toContain('settings')
    expect((await reloaded.files.open())?.json).toBe('{"schemaVersion":999}')
  })

})

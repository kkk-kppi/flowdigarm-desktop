import { describe, expect, it, vi } from 'vitest'
import { loadApplicationRuntime } from '@/platform/runtime-selector'

describe('application runtime selection', () => {
  it('loads browser support only for VITE_E2E=1', async () => {
    const browser = vi.fn(async () => 'browser')
    const tauri = vi.fn(async () => 'tauri')

    await expect(loadApplicationRuntime('1', { browser, tauri })).resolves.toBe('browser')
    expect(browser).toHaveBeenCalledOnce()
    expect(tauri).not.toHaveBeenCalled()
  })

  it('loads Tauri for absent or non-exact E2E flags', async () => {
    const browser = vi.fn(async () => 'browser')
    const tauri = vi.fn(async () => 'tauri')

    await expect(loadApplicationRuntime(undefined, { browser, tauri })).resolves.toBe('tauri')
    await expect(loadApplicationRuntime('true', { browser, tauri })).resolves.toBe('tauri')
    expect(browser).not.toHaveBeenCalled()
    expect(tauri).toHaveBeenCalledTimes(2)
  })
})

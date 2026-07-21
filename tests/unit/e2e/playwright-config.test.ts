import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import config from '../../../playwright.config'

describe('Playwright release gate configuration', () => {
  it('uses Chromium, cross-platform E2E startup, retries, and evidence reporters', () => {
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer
    expect(server?.command).toBe('cross-env VITE_E2E=1 pnpm dev --host 127.0.0.1')
    expect(server?.url).toBe('http://127.0.0.1:1420')
    expect(config.projects).toEqual([expect.objectContaining({ name: 'chromium' })])
    expect(config.reporter).toEqual(expect.arrayContaining([
      ['html', expect.any(Object)],
      ['json', expect.objectContaining({ outputFile: 'test-results/results.json' })],
    ]))
    expect(config.use).toMatchObject({
      baseURL: 'http://127.0.0.1:1420',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    })
  })

  it('declares cross-env without changing normal dev or build scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(pkg.devDependencies['cross-env']).toBeDefined()
    expect(pkg.scripts.dev).toBe('vite')
    expect(pkg.scripts.build).toBe('vue-tsc --noEmit && vite build')
  })
})

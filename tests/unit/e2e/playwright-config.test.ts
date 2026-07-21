import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import config from '../../../playwright.config'

describe('Playwright release gate configuration', () => {
  it('uses Chromium, cross-platform E2E startup, retries, and evidence reporters', () => {
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer
    expect(server?.command).toBe('cross-env VITE_E2E=1 pnpm dev --host 127.0.0.1')
    expect(server?.url).toBe('http://127.0.0.1:1420')
    expect(config.projects).toEqual([expect.objectContaining({ name: 'chromium' })])
    expect(config.workers).toBe(1)
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

  it('uses supported Windows/macOS runners and locks every Cargo invocation', () => {
    const workflow = readFileSync('.github/workflows/release-gate.yml', 'utf8')
    expect(workflow).toContain('os: windows-latest')
    expect(workflow).toContain('os: macos-15-intel')
    expect(workflow).toContain('os: macos-15')
    expect(workflow).not.toMatch(/os: (?:ubuntu|macos-13|macos-14)/)
    expect(workflow).toContain('cargo test --locked --manifest-path src-tauri/Cargo.toml')

    const tauriCommands = workflow.split('\n').filter((line) => line.includes('pnpm tauri build'))
    expect(tauriCommands).toHaveLength(5)
    expect(tauriCommands.every((line) => line.trimEnd().endsWith('-- -- --locked'))).toBe(true)
  })
})

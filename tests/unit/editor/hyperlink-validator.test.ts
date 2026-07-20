// tests/unit/editor/hyperlink-validator.test.ts
// 超链接校验：仅 http/https/mailto 合法；空串合法（表示清除链接）；
// 普通点击=选择（不打开），Ctrl/Cmd+点击才打开；openCellHyperlink 非法返回错误串。
import { describe, expect, it, vi } from 'vitest'
import { validateHyperlink } from '@/application/links/hyperlink-validator'
import { openCellHyperlink, shouldOpenHyperlink } from '@/application/links/open-hyperlink'
import type { DesktopPlatform } from '@/platform/desktop-platform'

describe('validateHyperlink', () => {
  it('http/https/mailto 合法（返回 null）', () => {
    expect(validateHyperlink('http://example.com')).toBeNull()
    expect(validateHyperlink('https://example.com/path?q=1')).toBeNull()
    expect(validateHyperlink('mailto:a@b.c')).toBeNull()
    expect(validateHyperlink('HTTPS://EXAMPLE.COM')).toBeNull()
  })

  it('空串合法（表示清除链接）', () => {
    expect(validateHyperlink('')).toBeNull()
  })

  it('javascript/file/data/相对路径/非法串拒绝（中文错误）', () => {
    for (const url of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,<script></script>',
      'ftp://example.com',
      '/relative/path',
      'not a url',
    ]) {
      expect(validateHyperlink(url)).toBe('仅支持 http、https、mailto 链接。')
    }
  })
})

describe('shouldOpenHyperlink', () => {
  it('Ctrl 或 Cmd（meta）按下才打开；普通点击不打开', () => {
    expect(shouldOpenHyperlink({ ctrlKey: true, metaKey: false })).toBe(true)
    expect(shouldOpenHyperlink({ ctrlKey: false, metaKey: true })).toBe(true)
    expect(shouldOpenHyperlink({ ctrlKey: true, metaKey: true })).toBe(true)
    expect(shouldOpenHyperlink({ ctrlKey: false, metaKey: false })).toBe(false)
  })
})

describe('openCellHyperlink', () => {
  function platformMock() {
    return {
      openDiagram: vi.fn(),
      saveDiagram: vi.fn(),
      exportDiagram: vi.fn(),
      openExternalLink: vi.fn().mockResolvedValue(undefined),
      readRecoverySnapshot: vi.fn(),
      writeRecoverySnapshot: vi.fn(),
    } satisfies DesktopPlatform
  }

  it('合法链接调 platform.openExternalLink 并返回 null', async () => {
    const platform = platformMock()
    const result = await openCellHyperlink(platform, 'https://example.com')
    expect(result).toBeNull()
    expect(platform.openExternalLink).toHaveBeenCalledWith('https://example.com')
  })

  it('非法链接返回中文错误串且不调平台', async () => {
    const platform = platformMock()
    const result = await openCellHyperlink(platform, 'javascript:alert(1)')
    expect(result).toBe('仅支持 http、https、mailto 链接。')
    expect(platform.openExternalLink).not.toHaveBeenCalled()
  })

  it('空链接不打开（无错误、无平台调用）', async () => {
    const platform = platformMock()
    const result = await openCellHyperlink(platform, '')
    expect(result).toBeNull()
    expect(platform.openExternalLink).not.toHaveBeenCalled()
  })
})

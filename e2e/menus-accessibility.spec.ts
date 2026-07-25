import { expect, openCleanEditor, test } from './fixtures'

async function expectIconControlsAccessible(page: Parameters<typeof openCleanEditor>[0]): Promise<void> {
  const violations = await page.locator('button:visible').evaluateAll((buttons) => buttons.flatMap((button) => {
    const text = (button.textContent ?? '').replace(/\s/g, '')
    const iconOnly = Boolean(button.querySelector('svg, img, [aria-hidden="true"]'))
      || text.length <= 3 && (!/[\u3400-\u9fff]/u.test(text) || /^[?×−□«»+]+$/u.test(text))
    if (!iconOnly) return []
    const ariaLabel = button.getAttribute('aria-label') ?? ''
    const title = button.getAttribute('title') ?? ''
    return /[\u3400-\u9fff]/u.test(ariaLabel) && title.trim() ? [] : [{ text, ariaLabel, title }]
  }))
  expect(violations, 'icon-only controls require a Chinese aria-label and title tooltip').toEqual([])
}

test('supports seven-menu keyboard navigation, submenus, Escape, and focus return', async ({ page }) => {
  await openCleanEditor(page)
  const roots = page.getByTestId('menubar').getByRole('menuitem')
  await expect(roots).toHaveCount(7)
  await roots.nth(0).focus()
  await page.keyboard.press('ArrowRight')
  await expect(roots.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(roots.nth(0)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menu', { name: '文件菜单' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Escape')
  await expect(roots.nth(0)).toBeFocused()

  await page.getByRole('menuitem', { name: '插入' }).click()
  await page.getByRole('menuitem', { name: '矩形' }).click()
  await page.getByRole('menuitem', { name: '插入' }).click()
  await page.getByRole('menuitem', { name: '圆形' }).click()
  await page.getByRole('menuitem', { name: '编辑' }).click()
  await page.getByRole('menuitem', { name: '全选' }).click()
  await roots.nth(5).focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.submenu')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu', { name: '工具菜单' })).toBeHidden()
})

test('exposes icon labels/tooltips, contextual help, and trapped dialog focus', async ({ page }) => {
  await openCleanEditor(page)
  await expectIconControlsAccessible(page)

  const helpTrigger = page.getByRole('button', { name: '图元库帮助' })
  await helpTrigger.click()
  await expect(page.getByRole('complementary', { name: '图元库帮助' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary', { name: '图元库帮助' })).toBeHidden()
  await expect(helpTrigger).toBeFocused()

  await page.getByRole('menuitem', { name: '工具' }).click()
  await page.getByRole('menuitem', { name: '首选项' }).click()
  await expect(page.getByRole('dialog', { name: '首选项' })).toBeVisible()
  await expectIconControlsAccessible(page)
  await page.keyboard.press('Escape')

  await page.getByRole('menuitem', { name: '文件' }).click()
  await page.getByRole('menuitem', { name: '导出' }).click()
  const dialog = page.getByRole('dialog', { name: '导出' })
  await expect(dialog).toBeVisible()
  await expectIconControlsAccessible(page)
  const first = dialog.getByTestId('export-help')
  const last = dialog.getByTestId('export-submit')
  await last.focus()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(last).toBeFocused()
  await first.click()
  await expect(page.getByRole('complementary', { name: '导出帮助' })).toBeVisible()
  await expectIconControlsAccessible(page)
  await page.keyboard.press('Escape')
})

test('keeps narrow layouts usable and exposes non-color state', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 })
  await openCleanEditor(page)
  await expect(page.getByTestId('right-panel')).toHaveClass(/floating/)
  await page.getByTestId('rp-close').click()
  await page.getByRole('button', { name: '折叠图元库' }).click()
  await expect(page.getByTestId('right-panel')).toBeHidden()
  await expect(page.getByRole('button', { name: '展开图元库' })).toBeVisible()
  const canvas = await page.getByTestId('x6-canvas').boundingBox()
  expect(canvas?.width).toBeGreaterThan(250)
  await expect(page.getByTestId('status-grid')).toHaveAttribute('aria-pressed', /true|false/)
  await expect(page.getByTestId('status-grid')).toContainText(/开|关/)
})

test('keeps every compact toolbar control visible at 960px', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 700 })
  await openCleanEditor(page)

  const layout = await page.getByTestId('compact-toolbar').evaluate((toolbar) => {
    const bounds = toolbar.getBoundingClientRect()
    const outsideControls = [...toolbar.querySelectorAll<HTMLElement>('button, select, input')]
      .filter((control) => control.getClientRects().length > 0)
      .filter((control) => {
        const controlBounds = control.getBoundingClientRect()
        return controlBounds.left < bounds.left
          || controlBounds.right > bounds.right
          || controlBounds.top < bounds.top
          || controlBounds.bottom > bounds.bottom
      })
      .map((control) => control.dataset.testid ?? control.getAttribute('aria-label') ?? control.tagName)

    return {
      height: bounds.height,
      clientWidth: toolbar.clientWidth,
      scrollWidth: toolbar.scrollWidth,
      outsideControls,
    }
  })

  expect({
    height: layout.height,
    fitsWithoutScrolling: layout.scrollWidth <= layout.clientWidth,
    clientWidth: layout.clientWidth,
    scrollWidth: layout.scrollWidth,
    outsideControls: layout.outsideControls,
  }).toEqual({
    height: 48,
    fitsWithoutScrolling: true,
    clientWidth: layout.clientWidth,
    scrollWidth: layout.clientWidth,
    outsideControls: [],
  })
})

test('disposes real application timers, listeners, and controllers after interactive overlays', async ({ page }) => {
  await openCleanEditor(page)
  await page.getByRole('menuitem', { name: '文件' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('menuitem', { name: '工具' }).click()
  await page.getByRole('menuitem', { name: '首选项' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '图元库帮助' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('menuitem', { name: '文件' }).click()
  await page.getByRole('menuitem', { name: '导出' }).click()
  await page.getByTestId('export-help').click()
  await page.keyboard.press('Escape')

  const { resources, diagnostics } = await page.evaluate(() => {
    const hook = window.__FLOW_E2E__!
    const resources = hook.disposeApplication()
    return { resources, diagnostics: hook.resourceDiagnostics() }
  })
  expect(resources, JSON.stringify(diagnostics, null, 2)).toEqual({ listeners: 0, timers: 0, controllers: 0 })
  await expect(page.locator('#app')).toBeEmpty()
})

test('applies dark, forced-color, and reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce', forcedColors: 'active' })
  await openCleanEditor(page)
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe('reduce')
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
  const maximumMotionSeconds = await page.getByTestId('editor-shell').evaluate((shell) => {
    const seconds = (value: string) => value.split(',').map((part) => {
      const duration = part.trim()
      return duration.endsWith('ms') ? Number.parseFloat(duration) / 1000 : Number.parseFloat(duration) || 0
    })
    return Math.max(0, ...[shell, ...shell.querySelectorAll('*')].flatMap((element) => {
      const style = getComputedStyle(element)
      return [...seconds(style.transitionDuration), ...seconds(style.animationDuration)]
    }))
  })
  expect(maximumMotionSeconds).toBeLessThanOrEqual(0.001)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim())).toBe('CanvasText')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim())).toBe('Highlight')
  const focusTarget = page.getByTestId('status-grid')
  await focusTarget.focus()
  const focusStyle = await focusTarget.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, borderColor: style.borderColor }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2)
  expect(focusStyle.outlineColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(focusStyle.borderColor).not.toBe('rgba(0, 0, 0, 0)')
})

import { expect, openCleanEditor, test } from './fixtures'

async function expectIconControlsAccessible(page: Parameters<typeof openCleanEditor>[0]): Promise<void> {
  const violations = await page.locator('button:visible').evaluateAll((buttons) => buttons.flatMap((button) => {
    const text = (button.textContent ?? '').replace(/\s/g, '')
    const iconOnly = Boolean(button.querySelector('svg, img, [data-icon]')) && text.length === 0
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

  const maximizeButton = page.getByTestId('title-maximize')
  for (const action of ['minimize', 'maximize', 'close']) {
    const centers = await page.getByTestId(`title-${action}`).evaluate((button) => {
      const icon = button.querySelector<HTMLElement>('[data-icon]')
      if (!icon) throw new Error(`Missing ${action} icon`)
      const buttonRect = button.getBoundingClientRect()
      const iconRect = icon.getBoundingClientRect()
      return {
        button: { x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + buttonRect.height / 2 },
        icon: { x: iconRect.x + iconRect.width / 2, y: iconRect.y + iconRect.height / 2 },
      }
    })
    expect(centers.icon.x).toBeCloseTo(centers.button.x, 5)
    expect(centers.icon.y).toBeCloseTo(centers.button.y, 5)
  }
  await expect(maximizeButton).toHaveAccessibleName('最大化窗口')
  await expect(maximizeButton.locator('[data-icon]')).toHaveAttribute('data-icon', 'maximize')
  await maximizeButton.click()
  await expect(maximizeButton).toHaveAccessibleName('还原窗口')
  await expect(maximizeButton.locator('[data-icon]')).toHaveAttribute('data-icon', 'restore')
  await maximizeButton.click()
  await expect(maximizeButton).toHaveAccessibleName('最大化窗口')
  await expect(maximizeButton.locator('[data-icon]')).toHaveAttribute('data-icon', 'maximize')

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
  const collapsedLibrary = page.getByTestId('element-library')
  const expandLibrary = page.getByRole('button', { name: '展开图元库' })
  await expect(collapsedLibrary.locator('.library-heading')).toHaveCount(0)
  await expect(expandLibrary).toBeVisible()
  const [libraryBox, toggleBox] = await Promise.all([
    collapsedLibrary.boundingBox(),
    expandLibrary.boundingBox(),
  ])
  expect(libraryBox).not.toBeNull()
  expect(toggleBox).not.toBeNull()
  expect(toggleBox!.x).toBeGreaterThanOrEqual(libraryBox!.x)
  expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(libraryBox!.x + libraryBox!.width)
  await expandLibrary.click()
  await expect(page.getByRole('button', { name: '折叠图元库' })).toBeVisible()
  await expect(collapsedLibrary.locator('.library-heading')).toContainText('图元')
  await expect(page.getByTestId('right-panel')).toBeHidden()
  const canvas = await page.getByTestId('x6-canvas').boundingBox()
  expect(canvas?.width).toBeGreaterThan(250)
  await expect(page.getByTestId('status-grid')).toHaveAttribute('aria-pressed', /true|false/)
  await expect(page.getByTestId('status-grid')).toContainText(/开|关/)
})

for (const width of [960, 1024, 1280, 1440]) {
  test(`keeps every toolbar control visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await openCleanEditor(page)
    const toolbar = page.getByTestId('compact-toolbar')
    await expect(toolbar).toHaveCSS('height', '48px')
    const layout = await toolbar.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      height: element.getBoundingClientRect().height,
      flexWrap: getComputedStyle(element).flexWrap,
      clipped: [...element.querySelectorAll('button, input, select')].filter((control) => {
        const controlBox = control.getBoundingClientRect()
        const toolbarBox = element.getBoundingClientRect()
        return controlBox.left < toolbarBox.left
          || controlBox.right > toolbarBox.right
          || controlBox.top < toolbarBox.top
          || controlBox.bottom > toolbarBox.bottom
      }).length,
    }))
    expect(layout).toMatchObject({ height: 48, flexWrap: 'nowrap', clipped: 0 })
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight)
  })
}

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
  const invalidIcons = await page.locator('[data-icon]:visible').evaluateAll((icons) => icons.flatMap((icon) => {
    const style = getComputedStyle(icon)
    const box = icon.getBoundingClientRect()
    const maskImage = style.maskImage !== 'none'
      ? style.maskImage
      : style.getPropertyValue('-webkit-mask-image')
    const maskUrl = maskImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1] ?? ''
    let bundledSvgMask = maskUrl.startsWith('data:image/svg+xml')
    if (maskUrl && !bundledSvgMask) {
      const url = new URL(maskUrl, window.location.href)
      bundledSvgMask = url.origin === window.location.origin && url.pathname.endsWith('.svg')
    }
    return box.width > 0
      && box.height > 0
      && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      && maskImage !== 'none'
      && bundledSvgMask
      ? []
      : [{ icon: icon.getAttribute('data-icon'), maskImage, backgroundColor: style.backgroundColor }]
  }))
  expect(invalidIcons).toEqual([])

  const systemColors = await page.evaluate(() => {
    const resolveBackground = (color: string) => {
      const reference = document.createElement('span')
      reference.style.cssText = `position:fixed;left:-9999px;background-color:${color};forced-color-adjust:none`
      document.body.append(reference)
      const computed = getComputedStyle(reference).backgroundColor
      reference.remove()
      return computed
    }
    return { grayText: resolveBackground('GrayText'), highlight: resolveBackground('Highlight') }
  })
  const disabledFontControl = page.getByTestId('tb-font-family')
  await expect(disabledFontControl).toBeDisabled()
  const disabledFontWrapper = disabledFontControl.locator('..')
  await expect(disabledFontWrapper).toHaveAttribute('aria-disabled', 'true')
  expect(await disabledFontWrapper.locator('[data-icon="font"]').evaluate(
    (icon) => getComputedStyle(icon).backgroundColor,
  )).toBe(systemColors.grayText)

  await expectIconControlsAccessible(page)
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

  if (await focusTarget.getAttribute('aria-pressed') === 'true') {
    await focusTarget.click()
    await expect(focusTarget).toHaveAttribute('aria-pressed', 'false')
  }
  await focusTarget.click()
  await expect(focusTarget).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => focusTarget.locator('[data-icon]').evaluate(
    (icon) => getComputedStyle(icon).backgroundColor,
  )).toBe(systemColors.highlight)
})

import { expect, openCleanEditor, snapshot, test } from './fixtures'

async function menu(page: Parameters<typeof openCleanEditor>[0], root: string, item: string | RegExp) {
  await page.getByRole('menuitem', { name: root }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('rejects invalid schema, geometry, and URLs without replacing the document', async ({ page }) => {
  await openCleanEditor(page)
  await page.getByRole('button', { name: '矩形', exact: true }).first().dblclick()
  const baseline = (await snapshot(page)).document
  const invalidGeometry = structuredClone(baseline)
  invalidGeometry.pages[0].nodes[0].x = 1e12
  const invalidUrl = structuredClone(baseline)
  invalidUrl.pages[0].nodes[0].link = 'javascript:alert(1)'
  const cases = [
    ['schema', '{"schemaVersion":999}'],
    ['geometry', JSON.stringify(invalidGeometry)],
    ['url', JSON.stringify(invalidUrl)],
  ]
  for (const [name, json] of cases) {
    await page.evaluate(({ path, json }) => window.__FLOW_E2E__!.seedFile(path, json), { path: `/e2e/${name}.flowdiagram`, json })
    await menu(page, '文件', /^打开/)
    const unsaved = page.getByRole('dialog', { name: /未保存/ })
    if (await unsaved.isVisible()) await page.getByTestId('unsaved-discard').click()
    const notice = page.locator('button.app-notice')
    await expect(notice).toBeVisible()
    await expect(notice).not.toHaveText('')
    expect((await snapshot(page)).document).toEqual(baseline)
    await notice.click()
  }
})

test('keeps saved/exported results on failures and reports clipboard fallback', async ({ page }) => {
  await openCleanEditor(page)
  await page.getByRole('button', { name: '矩形', exact: true }).first().dblclick()
  await menu(page, '文件', /^保存/)
  await expect.poll(async () => (await snapshot(page)).dirty).toBe(false)
  const savedPath = (await snapshot(page)).filePath

  await page.getByTestId('rp-tab-page').click()
  await page.getByTestId('page-unit').selectOption('cm')
  await page.getByTestId('apply-settings').click()
  await page.evaluate(() => window.__FLOW_E2E__!.fail('save', true))
  await menu(page, '文件', /^保存/)
  await expect(page.locator('button.app-notice')).toContainText(/无法保存|保存失败/)
  expect((await snapshot(page)).filePath).toBe(savedPath)
  expect((await snapshot(page)).dirty).toBe(true)
  await page.evaluate(() => window.__FLOW_E2E__!.fail('save', false))
  await page.locator('button.app-notice').click()

  await menu(page, '文件', '导出')
  await page.getByTestId('export-submit').click()
  await expect(page.getByRole('dialog', { name: '导出' }).getByRole('status')).toBeVisible()
  await page.getByRole('button', { name: '关闭导出' }).click()
  const artifacts = await page.evaluate(() => window.__FLOW_E2E__!.artifacts())
  await page.evaluate(() => window.__FLOW_E2E__!.fail('export', true))
  await menu(page, '文件', '导出')
  await page.getByTestId('export-submit').click()
  await expect(page.getByRole('alert')).toContainText('导出失败')
  expect(await page.evaluate(() => window.__FLOW_E2E__!.artifacts())).toEqual(artifacts)
  await page.getByRole('button', { name: '关闭导出' }).click()

  await page.getByRole('menuitem', { name: '编辑' }).click()
  await page.getByRole('menuitem', { name: '全选' }).click()
  await page.getByTestId('tb-copy').click()
  await expect(page.locator('button.app-notice')).toContainText('系统剪贴板不可用')
})

test('saves files with database unavailable and never white-screens on startup failures', async ({ page }) => {
  await openCleanEditor(page)
  await page.getByRole('button', { name: '矩形', exact: true }).first().dblclick()
  await page.evaluate(() => window.__FLOW_E2E__!.fail('database', true))
  await menu(page, '文件', /^保存/)
  await expect.poll(async () => (await snapshot(page)).dirty).toBe(false)
  expect((await snapshot(page)).filePath).toMatch(/\.flowdiagram$/)

  await page.evaluate(() => {
    window.__FLOW_E2E__!.fail('database', false)
    window.__FLOW_E2E__!.fail('settings', true)
    window.__FLOW_E2E__!.fail('recovery', true)
  })
  await page.reload()
  await expect(page.getByTestId('x6-canvas')).toBeVisible()
  await expect(page.locator('button.app-notice')).toBeVisible()
  await page.evaluate(() => window.__FLOW_E2E__!.reset())
})

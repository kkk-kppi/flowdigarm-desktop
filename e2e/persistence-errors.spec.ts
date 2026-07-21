import { expect, openCleanEditor, snapshot, test } from './fixtures'

async function menu(page: Parameters<typeof openCleanEditor>[0], root: string, item: string | RegExp) {
  await page.getByRole('menuitem', { name: root }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

const invalidCases = [
  {
    name: 'schema',
    mutate: () => '{"schemaVersion":999}',
    message: '文件架构无效：不支持的文件版本，请使用兼容版本重新导出。',
  },
  {
    name: 'geometry',
    mutate: (baseline: Awaited<ReturnType<typeof snapshot>>['document']) => {
      const invalid = structuredClone(baseline)
      invalid.pages[0].nodes[0].x = 1e12
      return JSON.stringify(invalid)
    },
    message: '文件几何无效：节点位置超出允许范围，请修正后重试。',
  },
  {
    name: 'url',
    mutate: (baseline: Awaited<ReturnType<typeof snapshot>>['document']) => {
      const invalid = structuredClone(baseline)
      invalid.pages[0].nodes[0].link = 'javascript:alert(1)'
      return JSON.stringify(invalid)
    },
    message: '文件链接无效：仅支持 http、https 或 mailto 链接，请修正后重试。',
  },
] as const

for (const invalidCase of invalidCases) test(`rejects invalid ${invalidCase.name} with an exact category and unchanged document`, async ({ page }) => {
  await openCleanEditor(page)
  await page.getByRole('button', { name: '矩形', exact: true }).first().dblclick()
  const baseline = (await snapshot(page)).document
  const json = invalidCase.mutate(baseline)
  await page.evaluate(({ path, json }) => window.__FLOW_E2E__!.seedFile(path, json), { path: `/e2e/${invalidCase.name}.flowdiagram`, json })
  await menu(page, '文件', /^打开/)
  const unsaved = page.getByRole('dialog', { name: /未保存/ })
  if (await unsaved.isVisible()) await page.getByTestId('unsaved-discard').click()
  await expect(page.locator('button.app-notice')).toHaveText(invalidCase.message)
  expect((await snapshot(page)).document).toEqual(baseline)
})

test('keeps saved/exported results on failures and reports clipboard fallback', async ({ page }) => {
  await openCleanEditor(page)
  await page.getByRole('button', { name: '矩形', exact: true }).first().dblclick()
  const seeded = await snapshot(page)
  const savedPath = '/e2e/existing.flowdiagram'
  const originalBytes = JSON.stringify(seeded.document)
  await page.evaluate(({ path, json, document }) => {
    window.__FLOW_E2E__!.seedFile(path, json)
    window.__FLOW_E2E__!.injectDocument(document, path)
  }, { path: savedPath, json: originalBytes, document: seeded.document })

  await page.getByTestId('rp-tab-page').click()
  await page.getByTestId('page-unit').selectOption('cm')
  await page.getByTestId('apply-settings').click()
  await page.evaluate(() => window.__FLOW_E2E__!.fail('save', true))
  await menu(page, '文件', /^保存/)
  await expect(page.locator('button.app-notice')).toContainText(/无法保存|保存失败/)
  expect((await snapshot(page)).filePath).toBe(savedPath)
  expect((await snapshot(page)).dirty).toBe(true)
  expect(await page.evaluate((path) => window.__FLOW_E2E__!.artifactBytes(path), savedPath)).toBe(originalBytes)
  await page.evaluate(() => window.__FLOW_E2E__!.fail('save', false))
  await page.locator('button.app-notice').click()

  await menu(page, '文件', '导出')
  await page.getByTestId('export-submit').click()
  await expect(page.getByRole('dialog', { name: '导出' }).getByRole('status')).toBeVisible()
  await page.getByRole('button', { name: '关闭导出' }).click()
  const artifacts = await page.evaluate(() => window.__FLOW_E2E__!.artifacts())
  const exportedPath = artifacts[0].path
  const exportedBytes = await page.evaluate((path) => window.__FLOW_E2E__!.artifactBytes(path), exportedPath)
  await page.evaluate(() => window.__FLOW_E2E__!.fail('export', true))
  await menu(page, '文件', '导出')
  await page.getByTestId('export-submit').click()
  await expect(page.getByRole('alert')).toContainText('导出失败')
  expect(await page.evaluate(() => window.__FLOW_E2E__!.artifacts())).toEqual(artifacts)
  expect(await page.evaluate((path) => window.__FLOW_E2E__!.artifactBytes(path), exportedPath)).toBe(exportedBytes)
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

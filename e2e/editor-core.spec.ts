import { expect, openCleanEditor, snapshot, test, x6Cell } from './fixtures'

test.beforeEach(async ({ page }) => openCleanEditor(page))

test('creates, edits, formats, persists, recovers, and exports through real UI paths', async ({ page }) => {
  test.setTimeout(120_000)
  const initialDocumentId = (await snapshot(page)).document.id
  await page.getByRole('menuitem', { name: '文件' }).click()
  await page.getByRole('menuitem', { name: '新建' }).click()
  await expect.poll(async () => (await snapshot(page)).document.id).not.toBe(initialDocumentId)

  const rectangles = page.getByRole('button', { name: '矩形', exact: true })
  await rectangles.first().dblclick()
  await expect.poll(async () => (await snapshot(page)).canUndo).toBe(true)
  let state = await snapshot(page)
  const firstId = state.document.pages[0].nodes[0].id
  const firstBox = await x6Cell(page, firstId).boundingBox()
  expect(firstBox).not.toBeNull()
  await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(firstBox!.x + firstBox!.width / 2 - 160, firstBox!.y + firstBox!.height / 2, { steps: 5 })
  await page.mouse.up()
  await rectangles.first().dblclick()
  await expect.poll(async () => (await snapshot(page)).document.pages[0].nodes.length).toBe(2)

  state = await snapshot(page)
  const secondId = state.document.pages[0].nodes.find(({ id }) => id !== firstId)!.id
  await x6Cell(page, firstId).click({ force: true })
  await x6Cell(page, secondId).click({ force: true, modifiers: ['Shift'] })
  await expect.poll(async () => (await snapshot(page)).selectedIds).toEqual([firstId, secondId])
  await page.getByRole('menuitem', { name: '工具' }).click()
  await page.getByRole('menuitem', { name: '自动连线' }).click()
  await expect.poll(async () => (await snapshot(page)).document.pages[0].edges.length).toBe(1)
  const connected = (await snapshot(page)).document.pages[0].edges[0]
  expect(connected.source.nodeId).toBe(firstId)
  expect(connected.target.nodeId).toBe(secondId)
  expect(connected.source.port).toBeTruthy()
  expect(connected.target.port).toBeTruthy()

  await x6Cell(page, firstId).click({ force: true })
  await page.keyboard.press('F2')
  await page.getByTestId('text-editor-textarea').fill('中文流程节点')
  await page.getByTestId('text-editor-textarea').press('Control+Enter')
  state = await snapshot(page)
  expect(state.document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('中文流程节点')
  await page.getByTestId('tb-undo').click()
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('')
  await page.getByTestId('tb-redo').click()
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('中文流程节点')

  await page.getByRole('button', { name: '加粗' }).click()
  await x6Cell(page, secondId).click({ force: true, modifiers: ['Shift'] })
  await expect(page.getByRole('button', { name: '加粗' })).toHaveClass(/indeterminate/)
  await page.getByRole('button', { name: '加粗' }).click()
  state = await snapshot(page)
  expect(state.document.pages[0].nodes.every((node) => node.text?.style.bold)).toBe(true)
  await page.getByTestId('tb-undo').click()
  expect((await snapshot(page)).document.pages[0].nodes.map((node) => node.text?.style.bold)).toEqual([true, false])
  await page.getByTestId('tb-redo').click()
  expect((await snapshot(page)).document.pages[0].nodes.every((node) => node.text?.style.bold)).toBe(true)

  await x6Cell(page, firstId).click({ force: true })
  await page.getByRole('button', { name: '斜体' }).click()
  await page.getByTestId('tb-format-painter').click()
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'true')
  await x6Cell(page, secondId).click({ force: true })
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === secondId)?.text?.style.italic).toBe(true)
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'false')

  await x6Cell(page, firstId).click({ force: true })
  await page.getByRole('button', { name: '下划线' }).click()
  await page.getByTestId('tb-format-painter').dblclick()
  await x6Cell(page, secondId).click({ force: true })
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'true')
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === secondId)?.text?.style.underline).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('menuitem', { name: '工具' }).click()
  await page.getByRole('menuitem', { name: '查找替换' }).click()
  await page.getByTestId('find-query').fill('中文')
  await page.getByTestId('find-replacement').fill('已替换')
  await page.getByTestId('replace-all').click()
  await page.getByTestId('confirm-replace-all').click()
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('已替换流程节点')
  await page.getByTestId('tb-undo').click()
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('中文流程节点')
  await page.getByTestId('find-back').click()

  await x6Cell(page, firstId).click({ force: true })
  const geometryBefore = (await snapshot(page)).document.pages[0].nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
  const displayedMm = Number(await page.getByTestId('geo-x').inputValue())
  await page.getByTestId('rp-tab-page').click()
  await page.getByTestId('page-unit').selectOption('cm')
  await page.getByTestId('apply-settings').click()
  expect((await snapshot(page)).document.pages[0].nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))).toEqual(geometryBefore)
  await page.getByTestId('rp-tab-property').click()
  await expect(page.getByText('X（cm）')).toBeVisible()
  expect(Number(await page.getByTestId('geo-x').inputValue())).toBeCloseTo(displayedMm / 10, 1)

  await page.getByTestId('node-link').fill('https://example.com/流程')
  await page.getByTestId('geo-x').click()
  await page.getByRole('menuitem', { name: '文件' }).click()
  await page.getByRole('menuitem', { name: /^保存/ }).click()
  await expect.poll(async () => (await snapshot(page)).dirty).toBe(false)
  expect((await snapshot(page)).filePath).toMatch(/\.flowdiagram$/)

  const exportCases = [
    { format: 'svg', name: 'core-svg' },
    { format: 'png', dpi: 96, name: 'core-png-96' },
    { format: 'png', dpi: 150, name: 'core-png-150' },
    { format: 'png', dpi: 300, name: 'core-png-300' },
    { format: 'pdf', name: 'core-pdf' },
    { format: 'json', name: 'core-json' },
  ] as const
  for (const entry of exportCases) {
    await page.getByRole('menuitem', { name: '文件' }).click()
    await page.getByRole('menuitem', { name: '导出' }).click()
    await page.getByTestId(`export-format-${entry.format}`).check()
    await page.getByTestId('export-file-name').fill(entry.name)
    if ('dpi' in entry) await page.getByTestId('export-dpi').selectOption(String(entry.dpi))
    await page.getByTestId('export-submit').click()
    await expect(page.getByRole('dialog', { name: '导出' }).getByRole('status')).toContainText('已导出到')
    await page.getByRole('button', { name: '关闭导出' }).click()
  }
  const artifacts = await page.evaluate(() => window.__FLOW_E2E__!.artifacts())
  expect(artifacts).toHaveLength(6)
  const pageSize = (await snapshot(page)).document.pages[0].pageSize
  for (const dpi of [96, 150, 300]) {
    const png = artifacts.find((artifact) => artifact.format === 'png' && artifact.dpi === dpi)
    expect(png).toMatchObject({
      width: Math.round(pageSize.width * dpi / 72),
      height: Math.round(pageSize.height * dpi / 72),
    })
  }
  expect(artifacts.find(({ format }) => format === 'svg')?.content).toContain('<svg')
  expect(artifacts.find(({ format }) => format === 'pdf')?.content).toContain('/URI (https://example.com/')
  expect(() => JSON.parse(artifacts.find(({ format }) => format === 'json')?.content ?? '')).not.toThrow()

  await page.evaluate(() => window.__FLOW_E2E__!.injectRecovery())
  await page.reload()
  await expect(page.getByRole('dialog', { name: '发现未完成的编辑' })).toBeVisible()
  await page.getByTestId('recovery-restore').click()
  await expect.poll(async () => (await snapshot(page)).dirty).toBe(true)
})

import { mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Locator } from '@playwright/test'
import {
  captureX6CellBeforeRebuild,
  expect,
  openCleanEditor,
  snapshot,
  test,
  waitForCreatedX6Cell,
  waitForRebuiltX6Cell,
  x6Cell,
} from './fixtures'

test.beforeEach(async ({ page }) => openCleanEditor(page))

async function layoutBox(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`Expected a non-null layout box for ${locator}`)
  }
  return box
}

test('matches the confirmed prototype shell and panel layout', async ({ page }) => {
  const library = page.getByTestId('element-library')
  const canvasColumn = page.getByTestId('canvas-column')
  const pageTabs = page.getByTestId('page-tabs')
  const rightPanel = page.getByTestId('right-panel')

  const [libraryBox, columnBox, tabsBox, panelBox] = await Promise.all([
    layoutBox(library),
    layoutBox(canvasColumn),
    layoutBox(pageTabs),
    layoutBox(rightPanel),
  ])
  expect(Math.abs(tabsBox.x - columnBox.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(tabsBox.width - columnBox.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(libraryBox.y - tabsBox.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(panelBox.y - tabsBox.y)).toBeLessThanOrEqual(1)
  await expect(page.getByTestId('zoom-slider')).toHaveCount(0)
  await expect(page.getByTestId('status-zoom')).toBeVisible()

  const category = page.getByTestId('category-basic-header')
  const categoryBox = await layoutBox(category)
  expect(Math.abs(categoryBox.x - libraryBox.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(categoryBox.width - libraryBox.width)).toBeLessThanOrEqual(2)
  expect(await category.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(235, 235, 235)')

  await page.getByRole('button', { name: '矩形', exact: true }).first().dblclick()
  const state = await snapshot(page)
  await x6Cell(page, state.document.pages[0].nodes[0].id).click({ force: true })
  const section = page.getByTestId('section-geometry')
  expect(await section.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('0px')

  const [xBox, yBox, widthBox, heightBox] = await Promise.all([
    layoutBox(page.getByTestId('geo-x')),
    layoutBox(page.getByTestId('geo-y')),
    layoutBox(page.getByTestId('geo-width')),
    layoutBox(page.getByTestId('geo-height')),
  ])
  expect(Math.abs(xBox.y - yBox.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(widthBox.y - heightBox.y)).toBeLessThanOrEqual(1)
  expect(widthBox.y).toBeGreaterThan(xBox.y)
})

test('positions delete confirmation beneath the clicked page tab', async ({ page }) => {
  const addPage = page.getByRole('button', { name: '新建页面' })
  await addPage.click()
  await addPage.click()

  const secondTab = page.getByTestId('page-tab').nth(1)
  const secondTabBox = await layoutBox(secondTab)
  await secondTab.getByTestId('close-tab').click()
  const confirmBox = await layoutBox(page.getByTestId('delete-confirm'))

  expect(Math.abs(confirmBox.x - secondTabBox.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(confirmBox.y - (secondTabBox.y + secondTabBox.height + 4))).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 1200, height: 720 })
  await expect(page.getByTestId('delete-confirm')).toHaveCount(0)
})

test('keeps overflowing page tabs scrollable and the add-page button reachable', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 720 })
  const state = await snapshot(page)
  state.document.pages = Array.from({ length: 12 }, (_, index) => ({
    ...state.document.pages[0],
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `页面 ${index + 1}`,
    nodes: [],
    edges: [],
  }))
  await page.evaluate((document) => window.__FLOW_E2E__!.injectDocument(document), state.document)

  const pageTabs = page.getByTestId('page-tabs')
  const tabList = page.getByTestId('page-tab-list')
  const addPage = page.getByRole('button', { name: '新建页面' })
  await expect(page.getByTestId('page-tab')).toHaveCount(12)
  expect(await tabList.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
    await tabList.evaluate((element) => element.clientWidth),
  )

  const [pageTabsBox, addPageBox] = await Promise.all([layoutBox(pageTabs), layoutBox(addPage)])
  expect(addPageBox.x + addPageBox.width).toBeLessThanOrEqual(pageTabsBox.x + pageTabsBox.width)

  await page.getByTestId('close-tab').first().click()
  await expect(page.getByTestId('delete-confirm')).toHaveCount(1)
  await expect(page.getByTestId('confirm-delete')).toHaveCount(1)
  await expect(page.getByTestId('cancel-delete')).toHaveCount(1)
  expect(await tabList.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto')
  expect(await tabList.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
    await tabList.evaluate((element) => element.clientWidth),
  )
  await expect(addPage).toBeVisible()
  await addPage.click()
  await expect(page.getByTestId('page-tab')).toHaveCount(13)
  await page.getByTestId('cancel-delete').click()
  await expect(page.getByTestId('delete-confirm')).toHaveCount(0)

  const lastTab = page.getByTestId('page-tab').last()
  await lastTab.scrollIntoViewIfNeeded()
  const clickedLastTabBox = await layoutBox(lastTab)
  await lastTab.getByTestId('close-tab').click()
  const [confirmBox, currentTabsBox] = await Promise.all([
    layoutBox(page.getByTestId('delete-confirm')),
    layoutBox(pageTabs),
  ])
  expect(clickedLastTabBox.x + confirmBox.width).toBeGreaterThan(
    currentTabsBox.x + currentTabsBox.width - 4,
  )
  expect(confirmBox.x).toBeGreaterThanOrEqual(currentTabsBox.x + 4)
  expect(Math.abs(
    confirmBox.x + confirmBox.width - (currentTabsBox.x + currentTabsBox.width - 4),
  )).toBeLessThanOrEqual(1)
  await tabList.evaluate((element) => { element.scrollLeft = 0 })
  await expect(page.getByTestId('delete-confirm')).toHaveCount(0)

  await page.getByTestId('close-tab').first().click()
  const leftConfirmBox = await layoutBox(page.getByTestId('delete-confirm'))
  expect(Math.abs(leftConfirmBox.x - (currentTabsBox.x + 4))).toBeLessThanOrEqual(1)
  await page.getByTestId('confirm-delete').click()
  await expect(page.getByTestId('page-tab')).toHaveCount(12)
  expect((await snapshot(page)).document.pages.some(({ id }) => id.endsWith('000000000001'))).toBe(false)

  await tabList.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  const [tabListBox, lastTabBox] = await Promise.all([
    layoutBox(tabList),
    layoutBox(page.getByTestId('page-tab').last()),
  ])
  expect(lastTabBox.x + lastTabBox.width).toBeLessThanOrEqual(tabListBox.x + tabListBox.width + 1)
})

test('creates, edits, formats, persists, recovers, and exports through real UI paths', async ({ page }) => {
  test.setTimeout(120_000)
  const initialDocumentId = (await snapshot(page)).document.id
  await page.getByRole('menuitem', { name: '文件' }).click()
  await page.getByRole('menuitem', { name: '新建' }).click()
  await expect.poll(async () => (await snapshot(page)).document.id).not.toBe(initialDocumentId)

  const rectangles = page.getByRole('button', { name: '矩形', exact: true })
  const firstCreationRevision = (await snapshot(page)).revision
  await rectangles.first().dblclick()
  await expect.poll(async () => (await snapshot(page)).canUndo).toBe(true)
  let state = await snapshot(page)
  const firstId = state.document.pages[0].nodes[0].id
  const firstBox = await (await waitForCreatedX6Cell(page, firstId, firstCreationRevision)).boundingBox()
  expect(firstBox).not.toBeNull()
  await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(firstBox!.x + firstBox!.width / 2 - 160, firstBox!.y + firstBox!.height / 2, { steps: 5 })
  await page.mouse.up()
  const secondCreationRevision = (await snapshot(page)).revision
  await rectangles.first().dblclick()
  await expect.poll(async () => (await snapshot(page)).document.pages[0].nodes.length).toBe(2)

  state = await snapshot(page)
  const secondId = state.document.pages[0].nodes.find(({ id }) => id !== firstId)!.id
  await waitForCreatedX6Cell(page, secondId, secondCreationRevision)
  await x6Cell(page, firstId).click({ force: true })
  await x6Cell(page, secondId).click({ force: true, modifiers: ['Shift'] })
  await expect.poll(async () => (await snapshot(page)).selectedIds).toEqual([firstId, secondId])
  const connectCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByRole('menuitem', { name: '工具' }).click()
  await page.getByRole('menuitem', { name: '自动连线' }).click()
  await waitForRebuiltX6Cell(page, firstId, connectCell)
  await expect.poll(async () => (await snapshot(page)).document.pages[0].edges.length).toBe(1)
  state = await snapshot(page)
  const connected = state.document.pages[0].edges[0]
  await waitForCreatedX6Cell(page, connected.id, connectCell.revision)
  expect(connected.source.nodeId).toBe(firstId)
  expect(connected.target.nodeId).toBe(secondId)
  expect(connected.source.port).toBeTruthy()
  expect(connected.target.port).toBeTruthy()

  await x6Cell(page, firstId).click({ force: true })
  await page.keyboard.press('F2')
  await page.getByTestId('text-editor-textarea').fill('中文流程节点')
  const editTextCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('text-editor-textarea').press('Control+Enter')
  await waitForRebuiltX6Cell(page, firstId, editTextCell)
  state = await snapshot(page)
  expect(state.document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('中文流程节点')
  const undoTextCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-undo').click()
  await waitForRebuiltX6Cell(page, firstId, undoTextCell)
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('')
  const redoTextCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-redo').click()
  await waitForRebuiltX6Cell(page, firstId, redoTextCell)
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('中文流程节点')

  const boldCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-bold').click()
  await waitForRebuiltX6Cell(page, firstId, boldCell)
  state = await snapshot(page)
  await x6Cell(page, secondId).click({ force: true, modifiers: ['Shift'] })
  await expect(page.getByTestId('tb-bold')).toHaveClass(/indeterminate/)
  const batchBoldCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-bold').click()
  await waitForRebuiltX6Cell(page, firstId, batchBoldCell)
  state = await snapshot(page)
  expect(state.document.pages[0].nodes.every((node) => node.text?.style.bold)).toBe(true)
  const undoBoldCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-undo').click()
  await waitForRebuiltX6Cell(page, firstId, undoBoldCell)
  expect((await snapshot(page)).document.pages[0].nodes.map((node) => node.text?.style.bold)).toEqual([true, false])
  const redoBoldCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-redo').click()
  await waitForRebuiltX6Cell(page, firstId, redoBoldCell)
  state = await snapshot(page)
  expect(state.document.pages[0].nodes.every((node) => node.text?.style.bold)).toBe(true)

  await x6Cell(page, firstId).click({ force: true })
  const italicCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-italic').click()
  await waitForRebuiltX6Cell(page, firstId, italicCell)
  state = await snapshot(page)
  await page.getByTestId('tb-format-painter').click()
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'true')
  const paintItalicCell = await captureX6CellBeforeRebuild(page, secondId)
  await x6Cell(page, secondId).click({ force: true })
  await waitForRebuiltX6Cell(page, secondId, paintItalicCell)
  state = await snapshot(page)
  expect(state.document.pages[0].nodes.find(({ id }) => id === secondId)?.text?.style.italic).toBe(true)
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'false')

  await x6Cell(page, firstId).click({ force: true })
  const underlineCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-underline').click()
  await waitForRebuiltX6Cell(page, firstId, underlineCell)
  state = await snapshot(page)
  await page.getByTestId('tb-format-painter').dblclick()
  const paintUnderlineCell = await captureX6CellBeforeRebuild(page, secondId)
  await x6Cell(page, secondId).click({ force: true })
  await waitForRebuiltX6Cell(page, secondId, paintUnderlineCell)
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'true')
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === secondId)?.text?.style.underline).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tb-format-painter')).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('menuitem', { name: '工具' }).click()
  await page.getByRole('menuitem', { name: '查找替换' }).click()
  await page.getByTestId('find-query').fill('中文')
  await page.getByTestId('find-replacement').fill('已替换')
  await page.getByTestId('replace-all').click()
  const replaceCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('confirm-replace-all').click()
  await waitForRebuiltX6Cell(page, firstId, replaceCell)
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('已替换流程节点')
  const undoReplaceCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('tb-undo').click()
  await waitForRebuiltX6Cell(page, firstId, undoReplaceCell)
  state = await snapshot(page)
  expect(state.document.pages[0].nodes.find(({ id }) => id === firstId)?.text?.value).toBe('中文流程节点')
  await page.getByTestId('find-back').click()

  await x6Cell(page, firstId).click({ force: true })
  const geometryBefore = (await snapshot(page)).document.pages[0].nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
  const displayedMm = Number(await page.getByTestId('geo-x').inputValue())
  await page.getByTestId('rp-tab-page').click()
  await page.getByTestId('page-unit').selectOption('cm')
  const pageSettingsCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('apply-settings').click()
  await waitForRebuiltX6Cell(page, firstId, pageSettingsCell)
  expect((await snapshot(page)).document.pages[0].nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))).toEqual(geometryBefore)
  await page.getByTestId('rp-tab-property').click()
  await expect(page.getByText('X（cm）')).toBeVisible()
  expect(Number(await page.getByTestId('geo-x').inputValue())).toBeCloseTo(displayedMm / 10, 1)

  await page.getByTestId('node-link').fill('https://example.com/流程')
  const linkCell = await captureX6CellBeforeRebuild(page, firstId)
  await page.getByTestId('geo-x').click()
  await waitForRebuiltX6Cell(page, firstId, linkCell)
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

  const screenshotDirectory = resolve('test-results/screenshots')
  await mkdir(screenshotDirectory, { recursive: true })
  const screenshotPath = resolve(screenshotDirectory, 'editor-core-complete.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  expect((await stat(screenshotPath)).size).toBeGreaterThan(0)
})

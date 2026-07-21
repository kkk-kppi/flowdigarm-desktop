import { mkdir, writeFile } from 'node:fs/promises'
import { expect, openCleanEditor, snapshot, test, x6Cell } from './fixtures'

async function now(page: Parameters<typeof openCleanEditor>[0]): Promise<number> {
  return page.evaluate(() => performance.now())
}

test('500 nodes and 800 edges remain selectable, draggable, zoomable, and saveable', async ({ page }) => {
  test.setTimeout(120_000)
  await openCleanEditor(page)
  await page.evaluate(() => window.__FLOW_E2E__!.injectBenchmark())
  await expect(page.locator('.x6-node')).toHaveCount(500, { timeout: 30_000 })
  await expect(page.locator('.x6-edge')).toHaveCount(800, { timeout: 30_000 })
  await page.getByTestId('status-zoom').selectOption('1')
  await expect(page.getByTestId('status-zoom')).toHaveValue('1')
  const state = await snapshot(page)
  expect(state.document.pages[0].nodes[0].text?.value).toContain('性能节点')
  const ids = state.document.pages[0].nodes.slice(0, 2).map(({ id }) => id)
  const selection: number[] = []
  const zoom: number[] = []
  const drag: number[] = []
  const save: number[] = []

  for (let index = 0; index < 5; index += 1) {
    const selectedId = ids[index % 2]
    const selectionBox = await x6Cell(page, selectedId).boundingBox()
    expect(selectionBox).not.toBeNull()
    let started = await now(page)
    await page.mouse.click(selectionBox!.x + selectionBox!.width / 2, selectionBox!.y + selectionBox!.height / 2)
    await expect.poll(() => page.evaluate(() => window.__FLOW_E2E__!.selectionIds())).toEqual([selectedId])
    selection.push(await now(page) - started)

    const targetZoom = index % 2 === 0 ? '1' : '1.25'
    started = await now(page)
    await page.getByTestId('status-zoom').selectOption(targetZoom)
    await expect(page.getByTestId('status-zoom')).toHaveValue(targetZoom)
    zoom.push(await now(page) - started)

    const box = await x6Cell(page, selectedId).boundingBox()
    expect(box).not.toBeNull()
    const nodeBefore = await page.evaluate((id) => window.__FLOW_E2E__!.nodePosition(id), selectedId)
    expect(nodeBefore).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 20, box!.y + box!.height / 2 + 12, { steps: 4 })
    started = await now(page)
    await page.mouse.up()
    await expect.poll(async () => {
      const node = await page.evaluate((id) => window.__FLOW_E2E__!.nodePosition(id), selectedId)
      return node ? `${node.x}:${node.y}` : ''
    }).not.toBe(`${nodeBefore!.x}:${nodeBefore!.y}`)
    drag.push(await now(page) - started)

    started = await now(page)
    await page.getByRole('menuitem', { name: '文件' }).click()
    await page.getByRole('menuitem', { name: /^保存/ }).click()
    await expect.poll(() => page.evaluate(() => window.__FLOW_E2E__!.isDirty())).toBe(false)
    save.push(await now(page) - started)
  }

  const measured = {
    selectionMs: selection.slice(1),
    zoomMs: zoom.slice(1),
    dragMs: drag.slice(1),
    saveMs: save.slice(1),
  }
  const multiplier = process.env.CI ? 2 : 1
  const evidence = { fixture: { nodes: 500, edges: 800 }, warmupRuns: 1, measuredRuns: 4, multiplier, ...measured }
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/performance.json', `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  await test.info().attach('performance.json', { body: Buffer.from(JSON.stringify(evidence)), contentType: 'application/json' })
  expect(Math.max(...measured.selectionMs)).toBeLessThan(150 * multiplier)
  expect(Math.max(...measured.zoomMs)).toBeLessThan(300 * multiplier)
  expect(Math.max(...measured.dragMs)).toBeLessThan(300 * multiplier)
  expect(Math.max(...measured.saveMs)).toBeLessThan(2000 * multiplier)
})

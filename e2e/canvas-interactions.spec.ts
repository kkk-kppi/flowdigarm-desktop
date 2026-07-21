import { mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  captureX6CellBeforeRebuild,
  createCanvasFixture,
  createLineJumpFixture,
  expect,
  openCleanEditor,
  snapshot,
  test,
  waitForCreatedX6Cell,
  waitForRebuiltX6Cell,
  x6Cell,
} from './fixtures'

const screenshotDirectory = resolve('test-results/screenshots')

const ids = {
  group: '00000000-0000-4000-8000-000000000001',
  first: '00000000-0000-4000-8000-000000000002',
  second: '00000000-0000-4000-8000-000000000003',
  third: '00000000-0000-4000-8000-000000000004',
  orthogonal: '00000000-0000-4000-8000-000000000011',
  curved: '00000000-0000-4000-8000-000000000012',
}

test.beforeEach(async ({ page }) => {
  await openCleanEditor(page)
  await page.evaluate((document) => window.__FLOW_E2E__!.injectDocument(document), createCanvasFixture())
  await expect(page.locator('.x6-node')).toHaveCount(4)
  await expect(page.locator('.x6-edge')).toHaveCount(2)
})

test('selects singly, with Shift, and by rubberband; shows transform handles', async ({ page }) => {
  await x6Cell(page, ids.first).click({ force: true })
  await expect.poll(async () => (await snapshot(page)).selectedIds).toEqual([ids.first])
  await x6Cell(page, ids.second).click({ force: true, modifiers: ['Shift'] })
  await expect.poll(async () => (await snapshot(page)).selectedIds).toEqual([ids.first, ids.second])

  await page.getByTestId('x6-canvas').click({ position: { x: 5, y: 5 }, force: true })
  const first = await x6Cell(page, ids.first).boundingBox()
  const second = await x6Cell(page, ids.second).boundingBox()
  expect(first && second).toBeTruthy()
  await page.mouse.move(Math.min(first!.x, second!.x) - 8, Math.min(first!.y, second!.y) - 8)
  await page.mouse.down()
  await page.mouse.move(Math.max(first!.x + first!.width, second!.x + second!.width) + 8, Math.max(first!.y + first!.height, second!.y + second!.height) + 8, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await snapshot(page)).selectedIds).toEqual(expect.arrayContaining([ids.first, ids.second]))

  await x6Cell(page, ids.third).click({ force: true })
  await expect(page.locator('.x6-widget-transform-resize')).toHaveCount(8)
  await expect(page.locator('.x6-widget-transform-rotate')).toBeVisible()
})

test('commits one drag history when pointerup occurs outside the node', async ({ page }) => {
  const before = await snapshot(page)
  const nodeBefore = before.document.pages[0].nodes.find(({ id }) => id === ids.third)!
  const box = await x6Cell(page, ids.third).boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 2, box!.y + box!.height / 2 + 2)
  await page.mouse.up()
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === ids.third)).toMatchObject({ x: nodeBefore.x, y: nodeBefore.y })

  const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  const outside = { x: box!.x + box!.width + 140, y: box!.y + box!.height + 90 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(outside.x, outside.y, { steps: 5 })
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, buttons: 0, clientX: x, clientY: y }))
  }, outside)
  await expect.poll(async () => (await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === ids.third)?.x).not.toBe(nodeBefore.x)
  const moved = await snapshot(page)
  expect(moved.revision).toBe(before.revision + 1)
  expect(moved.undoLabel).toBe('移动图元')
  const undoMoveCell = await captureX6CellBeforeRebuild(page, ids.third)
  await page.getByTestId('tb-undo').click()
  await waitForRebuiltX6Cell(page, ids.third, undoMoveCell)
  expect((await snapshot(page)).document.pages[0].nodes.find(({ id }) => id === ids.third)).toMatchObject({ x: nodeBefore.x, y: nodeBefore.y })
})

test('keeps ElementLibrary threshold DnD and double-click creation independent', async ({ page }) => {
  const shape = page.getByRole('button', { name: '矩形', exact: true }).first()
  const shapeBox = await shape.boundingBox()
  const canvasBox = await page.getByTestId('x6-canvas').boundingBox()
  expect(shapeBox && canvasBox).toBeTruthy()
  const start = { x: shapeBox!.x + shapeBox!.width / 2, y: shapeBox!.y + shapeBox!.height / 2 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 2, start.y + 2)
  await page.mouse.up()
  expect((await snapshot(page)).document.pages[0].nodes).toHaveLength(4)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 5, start.y)
  await page.mouse.move(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2, { steps: 5 })
  const dropRevision = (await snapshot(page)).revision
  await page.mouse.up()
  await expect.poll(async () => (await snapshot(page)).document.pages[0].nodes.length).toBe(5)
  let state = await snapshot(page)
  const droppedId = state.document.pages[0].nodes.find(({ id }) => !Object.values(ids).includes(id))!.id
  await waitForCreatedX6Cell(page, droppedId, dropRevision)

  const doubleClickRevision = state.revision
  await shape.dblclick()
  await expect.poll(async () => (await snapshot(page)).document.pages[0].nodes.length).toBe(6)
  state = await snapshot(page)
  const doubleClickedId = state.document.pages[0].nodes.find(({ id }) => !Object.values(ids).includes(id) && id !== droppedId)!.id
  await waitForCreatedX6Cell(page, doubleClickedId, doubleClickRevision)
})

test('renders ports, edge endpoints/vertices, connector visuals, and group/container commands', async ({ page }) => {
  await expect(x6Cell(page, ids.first).locator('[port]')).toHaveCount(4)
  await x6Cell(page, ids.group).click({ force: true })
  const ungroupCell = await captureX6CellBeforeRebuild(page, ids.first)
  await page.getByRole('menuitem', { name: '格式' }).click()
  await page.getByRole('menuitem', { name: '取消组合' }).click()
  await waitForRebuiltX6Cell(page, ids.first, ungroupCell)
  await expect.poll(async () => (await snapshot(page)).document.pages[0].nodes.some(({ id }) => id === ids.group)).toBe(false)

  await expect(async () => {
    await x6Cell(page, ids.orthogonal).locator('path').first().click({ force: true })
    expect(await page.evaluate(() => window.__FLOW_E2E__!.selectionIds())).toEqual([ids.orthogonal])
  }).toPass({ timeout: 10_000 })
  await expect(page.locator('.x6-cell-tools')).not.toHaveCount(0)
  await expect(page.locator('.x6-edge-tool-vertex')).not.toHaveCount(0)
  const verticesBefore = (await snapshot(page)).document.pages[0].edges.find(({ id }) => id === ids.orthogonal)!.vertices
  const vertexCell = await captureX6CellBeforeRebuild(page, ids.orthogonal)
  const vertexHandle = await page.locator('.x6-edge-tool-vertex').first().boundingBox()
  expect(vertexHandle).not.toBeNull()
  await page.mouse.move(vertexHandle!.x + vertexHandle!.width / 2, vertexHandle!.y + vertexHandle!.height / 2)
  await page.mouse.down()
  await page.mouse.move(vertexHandle!.x + vertexHandle!.width / 2 + 35, vertexHandle!.y + vertexHandle!.height / 2 + 24, { steps: 5 })
  await page.mouse.up()
  const rebuiltOrthogonal = await waitForRebuiltX6Cell(page, ids.orthogonal, vertexCell)
  await expect.poll(async () => (await snapshot(page)).document.pages[0].edges.find(({ id }) => id === ids.orthogonal)!.vertices).not.toEqual(verticesBefore)
  const vertexState = await snapshot(page)
  expect(vertexState.revision).toBe(vertexCell.revision + 1)
  expect(vertexState.undoLabel).toBe('编辑拐点')
  const orthPath = await rebuiltOrthogonal.$eval('path', (path) => path.getAttribute('d'))
  const curvePath = await x6Cell(page, ids.curved).locator('path').first().getAttribute('d')
  expect(orthPath).not.toBe(curvePath)
  await x6Cell(page, ids.first).hover({ force: true })
  await expect(x6Cell(page, ids.first).locator('[port="right"]')).toBeVisible()

  const targetHandle = await page.locator('.x6-edge-tool-target-arrowhead').boundingBox()
  const reconnectPort = await x6Cell(page, ids.third).locator('[port="left"]').boundingBox()
  expect(targetHandle && reconnectPort).toBeTruthy()
  const reconnectCell = await captureX6CellBeforeRebuild(page, ids.first)
  await page.mouse.move(targetHandle!.x + targetHandle!.width / 2, targetHandle!.y + targetHandle!.height / 2)
  await page.mouse.down()
  await page.mouse.move(reconnectPort!.x + reconnectPort!.width / 2, reconnectPort!.y + reconnectPort!.height / 2, { steps: 5 })
  await page.mouse.up()
  await waitForRebuiltX6Cell(page, ids.first, reconnectCell)
  await expect.poll(async () => (await snapshot(page)).document.pages[0].edges.find(({ id }) => id === ids.orthogonal)?.target.nodeId).toBe(ids.third)

  await x6Cell(page, ids.first).click({ force: true })
  await x6Cell(page, ids.second).click({ force: true, modifiers: ['Shift'] })
  const groupCell = await captureX6CellBeforeRebuild(page, ids.first)
  await page.getByRole('menuitem', { name: '格式' }).click()
  await page.getByRole('menuitem', { name: '组合', exact: true }).click()
  await waitForRebuiltX6Cell(page, ids.first, groupCell)
  const grouped = await snapshot(page)
  expect(grouped.document.pages[0].nodes.filter(({ shape }) => shape === 'group')).toHaveLength(1)
  expect(grouped.document.pages[0].nodes.filter(({ id }) => [ids.first, ids.second].includes(id)).every(({ parentId }) => Boolean(parentId))).toBe(true)
})

test('renders a real jump arc only when unrelated orthogonal edges enable line jumps', async ({ page }) => {
  const edgeIds = [
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000012',
  ]
  const fixtureWithoutJumps = createLineJumpFixture(false)
  const fixtureWithJumps = createLineJumpFixture(true)
  const topology = (document: ReturnType<typeof createLineJumpFixture>) =>
    document.pages[0].edges.map(({ source, target, vertices }) => ({ source, target, vertices }))
  const pathData = () => Promise.all(
    edgeIds.map((id) => x6Cell(page, id).locator('path').evaluateAll((paths) =>
      [...new Set(paths.map((path) => path.getAttribute('d')).filter((path): path is string => path !== null))],
    )),
  )

  expect(new Set(fixtureWithJumps.pages[0].edges.flatMap((edge) => [edge.source.nodeId, edge.target.nodeId])).size).toBe(4)
  expect(topology(fixtureWithJumps)).toEqual(topology(fixtureWithoutJumps))

  await page.evaluate((document) => window.__FLOW_E2E__!.injectDocument(document), fixtureWithoutJumps)
  await expect(page.locator('.x6-edge')).toHaveCount(2)
  const pathsWithoutJumps = await pathData()
  expect(pathsWithoutJumps.flat().every((path) => !path.includes('C'))).toBe(true)

  await page.evaluate((document) => window.__FLOW_E2E__!.injectDocument(document), fixtureWithJumps)
  await expect(page.locator('.x6-edge')).toHaveCount(2)
  await expect.poll(async () => (await pathData()).flat().some((path) => path.includes('C'))).toBe(true)
  const pathsWithJumps = await pathData()
  expect(pathsWithJumps).not.toEqual(pathsWithoutJumps)
  const jumpArcPath = pathsWithJumps.flat().find((path) => path.includes('C'))
  expect(jumpArcPath?.match(/C/g)).toHaveLength(2)

  await mkdir(screenshotDirectory, { recursive: true })
  const screenshotPath = resolve(screenshotDirectory, 'line-jump.png')
  await page.getByTestId('x6-canvas').screenshot({ path: screenshotPath })
  expect((await stat(screenshotPath)).size).toBeGreaterThan(0)
})

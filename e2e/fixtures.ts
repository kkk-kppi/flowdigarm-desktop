import { expect, test as base, type ConsoleMessage, type ElementHandle, type Page } from '@playwright/test'
import {
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createDefaultTextContent,
  createEmptyDocument,
  type DiagramDocument,
} from '../src/domain/diagram'

type ErrorGate = { messages: string[] }

export const test = base.extend<{ errorGate: ErrorGate }>({
  errorGate: [async ({ page }, use) => {
    const messages: string[] = []
    let aborting = false
    const abort = (message: string) => {
      messages.push(message)
      if (aborting) return
      aborting = true
      void page.close({ runBeforeUnload: false })
    }
    const onConsole = (message: ConsoleMessage) => {
      if (message.type() === 'error') abort(`console.error: ${message.text()}`)
    }
    page.on('console', onConsole)
    page.on('pageerror', (error) => abort(`pageerror: ${error.message}`))
    await page.addInitScript(() => {
      window.addEventListener('unhandledrejection', (event) => {
        console.error('__UNHANDLED_REJECTION__', event.reason)
      })
    })
    await use({ messages })
    expect(messages, 'unexpected browser errors').toEqual([])
  }, { auto: true }],
})

export { expect }

export async function openCleanEditor(page: Page): Promise<void> {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => Boolean(window.__FLOW_E2E__))).toBe(true)
  await page.evaluate(() => window.__FLOW_E2E__!.reset())
  await expect(page.getByTestId('editor-shell')).toBeVisible()
}

export async function snapshot(page: Page) {
  return page.evaluate(() => window.__FLOW_E2E__!.snapshot())
}

export function x6Cell(page: Page, id: string) {
  return page.locator(`.x6-cell[data-cell-id="${id}"]`)
}

export type CapturedX6Cell = {
  revision: number
  handle: ElementHandle<SVGElement>
}

export async function captureX6CellBeforeRebuild(page: Page, id: string): Promise<CapturedX6Cell> {
  const handle = await page.$<SVGElement>(`.x6-cell[data-cell-id="${id}"]`)
  if (!handle) throw new Error(`Cannot capture X6 cell ${id} before rebuild`)
  return { revision: (await snapshot(page)).revision, handle }
}

export async function waitForRebuiltX6Cell(page: Page, id: string, captured: CapturedX6Cell) {
  try {
    await expect.poll(() => page.evaluate(({ id, revision, oldCell }) => {
      const state = window.__FLOW_E2E__?.snapshot()
      const documentHasCell = state?.document.pages.some((diagramPage) =>
        diagramPage.nodes.some((node) => node.id === id)
          || diagramPage.edges.some((edge) => edge.id === id),
      ) ?? false
      const cells = [...document.querySelectorAll<SVGElement>('.x6-cell[data-cell-id]')]
        .filter((candidate) => candidate.dataset.cellId === id)
      const cell = cells[0]
      const box = cell?.getBoundingClientRect()
      return {
        revisionAdvanced: (state?.revision ?? revision) !== revision,
        documentHasCell,
        cellCount: cells.length,
        oldDetached: oldCell.isConnected === false,
        newAttached: cell?.isConnected === true,
        identityChanged: cell !== null && cell !== oldCell,
        hasCompleteBox: box ? box.width > 0 && box.height > 0 : false,
      }
    }, { id, revision: captured.revision, oldCell: captured.handle })).toEqual({
      revisionAdvanced: true,
      documentHasCell: true,
      cellCount: 1,
      oldDetached: true,
      newAttached: true,
      identityChanged: true,
      hasCompleteBox: true,
    })
  } finally {
    await captured.handle.dispose()
  }

  const handle = await page.$<SVGElement>(`.x6-cell[data-cell-id="${id}"]`)
  if (!handle) throw new Error(`Cannot capture rebuilt X6 cell ${id}`)
  return handle
}

export async function waitForCreatedX6Cell(page: Page, id: string, revision: number) {
  await expect.poll(() => page.evaluate(({ id, revision }) => {
    const state = window.__FLOW_E2E__?.snapshot()
    const documentHasCell = state?.document.pages.some((diagramPage) =>
      diagramPage.nodes.some((node) => node.id === id)
        || diagramPage.edges.some((edge) => edge.id === id),
    ) ?? false
    const cells = [...document.querySelectorAll<SVGElement>('.x6-cell[data-cell-id]')]
      .filter((candidate) => candidate.dataset.cellId === id)
    const cell = cells[0]
    const box = cell?.getBoundingClientRect()
    return {
      revisionAdvanced: (state?.revision ?? revision) > revision,
      documentHasCell,
      cellCount: cells.length,
      attached: cell?.isConnected === true,
      hasCompleteBox: box ? box.width > 0 && box.height > 0 : false,
    }
  }, { id, revision })).toEqual({
    revisionAdvanced: true,
    documentHasCell: true,
    cellCount: 1,
    attached: true,
    hasCompleteBox: true,
  })

  const handle = await page.$<SVGElement>(`.x6-cell[data-cell-id="${id}"]`)
  if (!handle) throw new Error(`Cannot capture created X6 cell ${id}`)
  return handle
}

export function createCanvasFixture(): DiagramDocument {
  const document = createEmptyDocument('画布交互夹具')
  const page = document.pages[0]
  const ids = {
    group: '00000000-0000-4000-8000-000000000001',
    first: '00000000-0000-4000-8000-000000000002',
    second: '00000000-0000-4000-8000-000000000003',
    third: '00000000-0000-4000-8000-000000000004',
  }
  page.pageSize = { preset: 'custom', width: 720, height: 520 }
  page.nodes = [
    { id: ids.group, shape: 'group', x: 40, y: 40, width: 560, height: 360, angle: 0, zIndex: 0, style: { ...createDefaultNodeStyle(), fillOpacity: 0, strokeDash: 'dash' }, isContainer: true },
    { id: ids.first, shape: 'rect', x: 90, y: 100, width: 100, height: 60, angle: 0, zIndex: 1, text: createDefaultTextContent('中文节点一'), style: createDefaultNodeStyle(), parentId: ids.group },
    { id: ids.second, shape: 'ellipse', x: 310, y: 100, width: 100, height: 60, angle: 0, zIndex: 2, text: createDefaultTextContent('中文节点二'), style: createDefaultNodeStyle(), parentId: ids.group },
    { id: ids.third, shape: 'diamond', x: 210, y: 270, width: 100, height: 70, angle: 0, zIndex: 3, text: createDefaultTextContent('中文节点三'), style: createDefaultNodeStyle() },
  ]
  page.edges = [
    { id: '00000000-0000-4000-8000-000000000011', source: { nodeId: ids.first, port: 'right' }, target: { nodeId: ids.second, port: 'left' }, connector: 'orthogonal', vertices: [{ x: 250, y: 130 }], labels: [], style: createDefaultEdgeStyle(), zIndex: 10 },
    { id: '00000000-0000-4000-8000-000000000012', source: { nodeId: ids.second, port: 'bottom' }, target: { nodeId: ids.third, port: 'top' }, connector: 'curved', vertices: [], labels: [], style: createDefaultEdgeStyle(), zIndex: 11 },
  ]
  return document
}

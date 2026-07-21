import { CanvasInteractionController } from '@/application/canvas/canvas-interaction-controller'
import { createTestDocument } from '../../helpers/test-document'

it('opens node and edge links through the same validated injected port', async () => {
  const document = createTestDocument()
  document.pages[0].nodes[0].link = 'https://example.com/node'
  document.pages[0].edges[0].link = 'https://example.com/edge'
  const openExternalLink = vi.fn(async () => {})
  const notices: string[] = []
  const controller = new CanvasInteractionController({
    getDocument: () => document,
    getActivePageId: () => 'page-1',
    executeCommand: vi.fn(),
    setNotice: (message) => notices.push(message),
    openExternalLink,
  })

  await controller.openHyperlink('node-1', { ctrlKey: true, metaKey: false })
  await controller.openHyperlink('edge-1', { ctrlKey: false, metaKey: true })
  expect(openExternalLink).toHaveBeenCalledTimes(2)
  expect(notices).toEqual([])

  document.pages[0].edges[0].link = 'javascript:alert(1)'
  await controller.openHyperlink('edge-1', { ctrlKey: true, metaKey: false })
  expect(openExternalLink).toHaveBeenCalledTimes(2)
  expect(notices.at(-1)).toBe('仅支持 http、https、mailto 链接。')
})

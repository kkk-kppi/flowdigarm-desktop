import { createDefaultTextContent, type DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { FindController } from '@/application/search/find-controller'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

describe('FindController', () => {
  it('cycles matches across pages and activates each match', () => {
    let document = createTestDocument()
    document.pages[0].nodes = [createTestNode({ id: 'n1', text: createDefaultTextContent('目标') })]
    document = {
      ...document,
      pages: [
        document.pages[0],
        { ...document.pages[0], id: 'page-2', nodes: [createTestNode({ id: 'n2', text: createDefaultTextContent('目标') })] },
      ],
    }
    const activated: string[] = []
    const controller = new FindController({
      getDocument: () => document,
      executeCommand: (command) => { document = command.apply(document) },
      activateMatch: (match) => activated.push(`${match.pageId}:${match.cellId}`),
    })
    controller.search({ query: '目标', scope: 'allPages', caseSensitive: false, wholeWord: false })

    expect(controller.next()?.cellId).toBe('n1')
    expect(controller.next()?.cellId).toBe('n2')
    expect(controller.next()?.cellId).toBe('n1')
    expect(activated).toEqual(['page-1:n1', 'page-2:n2', 'page-1:n1'])
  })

  it('replaces the current match with EditTextCommand', () => {
    let document = createTestDocument()
    document.pages[0].nodes = [createTestNode({ id: 'n1', text: createDefaultTextContent('目标目标') })]
    const labels: string[] = []
    const execute = (command: EditorCommand) => {
      labels.push(command.label)
      document = command.apply(document)
    }
    const controller = new FindController({ getDocument: () => document, executeCommand: execute, activateMatch: () => {} })
    controller.search({ query: '目标', scope: 'allPages', caseSensitive: false, wholeWord: false })
    controller.next()

    expect(controller.replaceCurrent('结果')).toBe(true)
    expect(labels).toEqual(['编辑文本'])
    expect(document.pages[0].nodes[0].text?.value).toBe('结果目标')
  })

  it('previews replace-all and executes only after confirmation', () => {
    let document: DiagramDocument = createTestDocument()
    document.pages[0].nodes = [createTestNode({ id: 'n1', text: createDefaultTextContent('目标目标') })]
    const labels: string[] = []
    const controller = new FindController({
      getDocument: () => document,
      executeCommand: (command) => {
        labels.push(command.label)
        document = command.apply(document)
      },
      activateMatch: () => {},
    })
    controller.search({ query: '目标', scope: 'allPages', caseSensitive: false, wholeWord: false })

    const preview = controller.replaceAll('结果')
    expect(preview.count).toBe(2)
    expect(labels).toEqual([])
    expect(document.pages[0].nodes[0].text?.value).toBe('目标目标')
    expect(controller.confirmReplaceAll()).toBe(2)
    expect(labels).toEqual(['全部替换'])
    expect(document.pages[0].nodes[0].text?.value).toBe('结果结果')
  })
})

import { createDefaultTextContent } from '@/domain/diagram'
import { MAX_TEXT_LENGTH } from '@/domain/limits'
import { createReplaceAllTextCommand } from '@/application/commands/replace-all-text'
import { CommandHistory } from '@/application/commands/command-history'
import { createTestDocument, createTestEdge, createTestNode } from '../../../helpers/test-document'

const request = {
  query: '项', scope: 'allPages' as const, caseSensitive: false, wholeWord: false,
}

describe('createReplaceAllTextCommand', () => {
  it('replaces ten matches in one command and one undo restores every original value', () => {
    const document = createTestDocument()
    document.pages[0].nodes = [
      createTestNode({ id: 'n1', text: createDefaultTextContent('项项项项项') }),
      createTestNode({ id: 'n2', text: createDefaultTextContent('项项') }),
    ]
    document.pages[0].edges = [createTestEdge({
      id: 'e1',
      labels: [{ text: createDefaultTextContent('项项项'), position: 0.5 }],
    })]
    const command = createReplaceAllTextCommand(document, request, '目')
    expect(command?.label).toBe('全部替换')
    expect(command?.count).toBe(10)

    const history = new CommandHistory()
    const changed = history.execute(command!, document)
    expect(changed.pages[0].nodes.map((node) => node.text?.value)).toEqual(['目目目目目', '目目'])
    expect(changed.pages[0].edges[0].labels[0].text.value).toBe('目目目')
    expect(history.undo(changed)).toEqual(document)
    expect(history.canUndo).toBe(false)
  })

  it('honors case and whole-word options and returns null without matches', () => {
    const document = createTestDocument()
    document.pages[0].nodes = [createTestNode({
      id: 'n1', text: createDefaultTextContent('Flow flow workflow'),
    })]
    const command = createReplaceAllTextCommand(document, {
      query: 'flow', scope: 'allPages', caseSensitive: true, wholeWord: true,
    }, 'step')
    expect(command?.apply(document).pages[0].nodes[0].text?.value).toBe('Flow step workflow')
    expect(createReplaceAllTextCommand(document, { ...request, query: 'missing' }, 'x')).toBeNull()
  })

  it('rejects replacement output beyond the text limit', () => {
    const document = createTestDocument()
    document.pages[0].nodes = [createTestNode({ id: 'n1', text: createDefaultTextContent('项') })]
    expect(() => createReplaceAllTextCommand(document, request, 'x'.repeat(MAX_TEXT_LENGTH + 1)))
      .toThrow('替换后的文本长度超出限制。')
  })
})

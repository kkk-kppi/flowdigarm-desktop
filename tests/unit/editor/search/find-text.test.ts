import { createDefaultTextContent, createEmptyPage } from '@/domain/diagram'
import { findText } from '@/application/search/find-text'
import { createTestDocument, createTestEdge, createTestNode } from '../../../helpers/test-document'

describe('findText', () => {
  it('searches node text and edge labels in stable document order', () => {
    const document = createTestDocument()
    document.pages[0].nodes = [
      createTestNode({ id: 'n1', text: createDefaultTextContent('测试测试') }),
      createTestNode({ id: 'n2', text: createDefaultTextContent('无关'), data: { note: '测试' } }),
    ]
    document.pages[0].edges = [
      createTestEdge({
        id: 'e1',
        labels: [
          { text: createDefaultTextContent('边测试'), position: 0.5 },
          { text: createDefaultTextContent('测试'), position: 0.7 },
        ],
        link: 'https://测试.example',
      }),
    ]

    expect(findText(document, {
      query: '测试', scope: 'allPages', caseSensitive: false, wholeWord: false,
    })).toEqual([
      { pageId: 'page-1', cellId: 'n1', field: 'nodeText', start: 0, end: 2, value: '测试测试' },
      { pageId: 'page-1', cellId: 'n1', field: 'nodeText', start: 2, end: 4, value: '测试测试' },
      { pageId: 'page-1', cellId: 'e1', field: 'edgeLabel', labelIndex: 0, start: 1, end: 3, value: '边测试' },
      { pageId: 'page-1', cellId: 'e1', field: 'edgeLabel', labelIndex: 1, start: 0, end: 2, value: '测试' },
    ])
  })

  it('supports current-page scope and case sensitivity', () => {
    const document = createTestDocument()
    document.pages[0].nodes = [createTestNode({ id: 'n1', text: createDefaultTextContent('Flow flow') })]
    document.pages.push(createEmptyPage({
      id: 'page-2',
      nodes: [createTestNode({ id: 'n2', text: createDefaultTextContent('Flow') })],
    }))

    expect(findText(document, {
      query: 'Flow', scope: 'currentPage', currentPageId: 'page-1', caseSensitive: true, wholeWord: false,
    }).map((match) => match.cellId)).toEqual(['n1'])
    expect(findText(document, {
      query: 'flow', scope: 'allPages', caseSensitive: false, wholeWord: false,
    })).toHaveLength(3)
  })

  it('uses Unicode letter, number, and underscore whole-word boundaries', () => {
    const document = createTestDocument()
    document.pages[0].nodes = [
      createTestNode({ id: 'n1', text: createDefaultTextContent('流程 流程图 _流程 流程2 (流程)') }),
    ]

    const matches = findText(document, {
      query: '流程', scope: 'allPages', caseSensitive: true, wholeWord: true,
    })

    expect(matches.map(({ start }) => start)).toEqual([0, 16])
  })

  it('treats astral Unicode letters as whole-word characters', () => {
    const document = createTestDocument()
    document.pages[0].nodes = [createTestNode({
      id: 'n1', text: createDefaultTextContent('𐐀cat cat𐐀 (cat)'),
    })]
    const matches = findText(document, {
      query: 'cat', scope: 'allPages', caseSensitive: false, wholeWord: true,
    })
    expect(matches.map((match) => match.start)).toEqual([13])
  })

  it('returns no matches for an empty query or a missing current page', () => {
    const document = createTestDocument()
    expect(findText(document, {
      query: '', scope: 'allPages', caseSensitive: false, wholeWord: false,
    })).toEqual([])
    expect(findText(document, {
      query: '开始', scope: 'currentPage', currentPageId: 'missing', caseSensitive: false, wholeWord: false,
    })).toEqual([])
  })
})

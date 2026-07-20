import type { DiagramDocument } from '@/domain/diagram'

export interface FindTextRequest {
  query: string
  scope: 'currentPage' | 'allPages'
  currentPageId?: string
  caseSensitive: boolean
  wholeWord: boolean
}

export interface FindMatch {
  pageId: string
  cellId: string
  field: 'nodeText' | 'edgeLabel'
  labelIndex?: number
  start: number
  end: number
  value: string
}

const WORD_CHARACTER = /[\p{L}\p{N}_]/u

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && WORD_CHARACTER.test(value)
}

function codePointBefore(value: string, index: number): string | undefined {
  if (index <= 0) return undefined
  let start = index - 1
  const last = value.charCodeAt(start)
  if (last >= 0xdc00 && last <= 0xdfff && start > 0) start -= 1
  const point = value.codePointAt(start)
  return point === undefined ? undefined : String.fromCodePoint(point)
}

function codePointAt(value: string, index: number): string | undefined {
  const point = value.codePointAt(index)
  return point === undefined ? undefined : String.fromCodePoint(point)
}

function positions(value: string, request: FindTextRequest): Array<{ start: number; end: number }> {
  const query = request.caseSensitive ? request.query : request.query.toLocaleLowerCase()
  const source = request.caseSensitive ? value : value.toLocaleLowerCase()
  const results: Array<{ start: number; end: number }> = []
  let from = 0
  while (from <= source.length - query.length) {
    const start = source.indexOf(query, from)
    if (start === -1) break
    const end = start + query.length
    if (
      !request.wholeWord ||
      (!isWordCharacter(codePointBefore(value, start)) && !isWordCharacter(codePointAt(value, end)))
    ) {
      results.push({ start, end })
    }
    from = start + Math.max(query.length, 1)
  }
  return results
}

export function findText(document: DiagramDocument, request: FindTextRequest): FindMatch[] {
  if (request.query.length === 0) return []
  const pages = request.scope === 'allPages'
    ? document.pages
    : document.pages.filter((page) => page.id === request.currentPageId)
  const matches: FindMatch[] = []
  for (const page of pages) {
    for (const node of page.nodes) {
      if (!node.text) continue
      for (const position of positions(node.text.value, request)) {
        matches.push({
          pageId: page.id,
          cellId: node.id,
          field: 'nodeText',
          ...position,
          value: node.text.value,
        })
      }
    }
    for (const edge of page.edges) {
      edge.labels.forEach((label, labelIndex) => {
        for (const position of positions(label.text.value, request)) {
          matches.push({
            pageId: page.id,
            cellId: edge.id,
            field: 'edgeLabel',
            labelIndex,
            ...position,
            value: label.text.value,
          })
        }
      })
    }
  }
  return matches
}

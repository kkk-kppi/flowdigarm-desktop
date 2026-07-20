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
  // Case-insensitive matching uses locale lowercasing without Unicode normalization:
  // accents remain significant. Compare original substrings so case-fold expansion
  // (for example, İ -> i + combining dot) never corrupts UTF-16 offsets.
  const query = request.caseSensitive ? request.query : request.query.toLocaleLowerCase()
  const results: Array<{ start: number; end: number }> = []
  const boundaries = [0]
  for (let index = 0; index < value.length;) {
    index += value.codePointAt(index)! > 0xffff ? 2 : 1
    boundaries.push(index)
  }
  let from = 0
  for (let startIndex = 0; startIndex < boundaries.length - 1;) {
    const start = boundaries[startIndex]
    if (start < from) {
      startIndex += 1
      continue
    }
    let matchedEnd: number | undefined
    for (let endIndex = startIndex + 1; endIndex < boundaries.length; endIndex += 1) {
      const end = boundaries[endIndex]
      const candidate = value.slice(start, end)
      const comparable = request.caseSensitive ? candidate : candidate.toLocaleLowerCase()
      if (comparable === query) {
        matchedEnd = end
        break
      }
      if (comparable.length >= query.length) break
    }
    if (matchedEnd !== undefined) {
      if (
        !request.wholeWord ||
        (!isWordCharacter(codePointBefore(value, start)) && !isWordCharacter(codePointAt(value, matchedEnd)))
      ) {
        results.push({ start, end: matchedEnd })
      }
      from = matchedEnd
    } else {
      from = boundaries[startIndex + 1]
    }
    startIndex += 1
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

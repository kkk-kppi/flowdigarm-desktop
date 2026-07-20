import type { DiagramDocument } from '@/domain/diagram'
import { MAX_TEXT_LENGTH } from '@/domain/limits'
import { findText, type FindMatch, type FindTextRequest } from '@/application/search/find-text'
import type { EditorCommand } from './editor-command'

interface TextSnapshot {
  pageId: string
  cellId: string
  field: FindMatch['field']
  labelIndex?: number
  before: string
  after: string
}

export class ReplaceAllTextCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '全部替换'
  readonly count: number

  constructor(private readonly snapshots: readonly TextSnapshot[], count: number) {
    this.snapshots = structuredClone(snapshots)
    this.count = count
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.write(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.write(document, 'before')
  }

  private write(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
    const byTarget = new Map(this.snapshots.map((snapshot) => [
      `${snapshot.pageId}:${snapshot.field}:${snapshot.cellId}:${snapshot.labelIndex ?? ''}`,
      snapshot,
    ]))
    return {
      ...document,
      pages: document.pages.map((page) => ({
        ...page,
        nodes: page.nodes.map((node) => {
          const snapshot = byTarget.get(`${page.id}:nodeText:${node.id}:`)
          if (!snapshot || !node.text) return node
          return { ...node, text: { ...node.text, value: snapshot[key] } }
        }),
        edges: page.edges.map((edge) => ({
          ...edge,
          labels: edge.labels.map((label, labelIndex) => {
            const snapshot = byTarget.get(`${page.id}:edgeLabel:${edge.id}:${labelIndex}`)
            return snapshot ? { ...label, text: { ...label.text, value: snapshot[key] } } : label
          }),
        })),
      })),
    }
  }
}

export function createReplaceAllTextCommand(
  document: DiagramDocument,
  request: FindTextRequest,
  replacement: string,
): ReplaceAllTextCommand | null {
  const matches = findText(document, request)
  if (matches.length === 0) return null
  const grouped = new Map<string, FindMatch[]>()
  for (const match of matches) {
    const key = `${match.pageId}:${match.field}:${match.cellId}:${match.labelIndex ?? ''}`
    grouped.set(key, [...(grouped.get(key) ?? []), match])
  }
  const snapshots: TextSnapshot[] = []
  for (const targetMatches of grouped.values()) {
    const first = targetMatches[0]
    let after = first.value
    for (const match of [...targetMatches].sort((a, b) => b.start - a.start)) {
      after = `${after.slice(0, match.start)}${replacement}${after.slice(match.end)}`
    }
    if (after.length > MAX_TEXT_LENGTH) {
      throw new Error('替换后的文本长度超出限制。')
    }
    snapshots.push({
      pageId: first.pageId,
      cellId: first.cellId,
      field: first.field,
      labelIndex: first.labelIndex,
      before: first.value,
      after,
    })
  }
  return new ReplaceAllTextCommand(snapshots, matches.length)
}

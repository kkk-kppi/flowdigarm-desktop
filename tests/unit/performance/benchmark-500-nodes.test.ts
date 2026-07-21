import { describe, expect, it } from 'vitest'
import { serializeDiagramDocument, parseDiagramDocument } from '@/domain/document-schema'
import { MoveCellsCommand } from '@/application/commands/move-cells'
import { createBenchmarkDocument } from '../../performance/benchmark-500-nodes'

describe('500 node / 800 edge benchmark fixture', () => {
  it('is deterministic and has exact unique cell counts', () => {
    const first = createBenchmarkDocument()
    const second = createBenchmarkDocument()
    const page = first.pages[0]

    expect(first).toEqual(second)
    expect(page.nodes).toHaveLength(500)
    expect(page.edges).toHaveLength(800)
    expect(new Set([...page.nodes, ...page.edges].map(({ id }) => id)).size).toBe(1300)
    expect(page.nodes.every((node) => node.text?.value.startsWith('性能节点'))).toBe(true)
  })

  it('uses valid endpoints and ports and round-trips through the document schema', () => {
    const document = createBenchmarkDocument()
    const page = document.pages[0]
    const nodeIds = new Set(page.nodes.map(({ id }) => id))
    const ports = ['top', 'right', 'bottom', 'left']

    for (const edge of page.edges) {
      expect(nodeIds.has(edge.source.nodeId)).toBe(true)
      expect(nodeIds.has(edge.target.nodeId)).toBe(true)
      expect(edge.source.nodeId).not.toBe(edge.target.nodeId)
      expect(ports).toContain(edge.source.port)
      expect(ports).toContain(edge.target.port)
    }

    const parsed = parseDiagramDocument(serializeDiagramDocument(document), () => ports)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.document).toEqual(document)
  })

  it('supports a real move command and serializes within the release budget', () => {
    const document = createBenchmarkDocument()
    const node = document.pages[0].nodes[0]
    const command = new MoveCellsCommand([{
      pageId: document.pages[0].id,
      nodeId: node.id,
      before: { x: node.x, y: node.y },
      after: { x: node.x + 3, y: node.y + 3 },
    }])

    const moved = command.apply(document)
    expect(moved.pages[0].nodes[0]).toMatchObject({ x: node.x + 3, y: node.y + 3 })

    const started = performance.now()
    const serialized = serializeDiagramDocument(document)
    expect(performance.now() - started).toBeLessThan(2000)
    expect(serialized).toContain('性能节点 500')
  })
})

import type { ClipboardPayload, ClipboardRepository } from '@/application/clipboard/clipboard-service'
import { MAX_EDGES_PER_PAGE, MAX_NODES_PER_PAGE } from '@/domain/limits'

export const FLOWDIAGRAM_CLIPBOARD_MIME = 'application/x-flowdiagram-cells+json'
const FALLBACK_NOTICE = '系统剪贴板不可用，已使用应用内剪贴板。'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ClipboardTextApi {
  writeText(value: string): Promise<void>
  readText(): Promise<string>
}

export class SystemClipboard implements ClipboardRepository {
  private fallback: ClipboardPayload | null = null

  constructor(
    private readonly api: ClipboardTextApi | undefined,
    private readonly setNotice: (message: string) => void,
  ) {}

  async write(payload: ClipboardPayload): Promise<void> {
    this.fallback = structuredClone(payload)
    try {
      if (!this.api) throw new Error('clipboard unavailable')
      await this.api.writeText(JSON.stringify({
        mime: FLOWDIAGRAM_CLIPBOARD_MIME,
        version: 1,
        payload,
      }))
    } catch {
      this.setNotice(FALLBACK_NOTICE)
    }
  }

  async read(): Promise<ClipboardPayload | null> {
    try {
      if (!this.api) throw new Error('clipboard unavailable')
      const text = await this.api.readText()
      const payload = parsePayload(text)
      this.fallback = structuredClone(payload)
      return payload
    } catch {
      this.setNotice(FALLBACK_NOTICE)
      return this.fallback ? structuredClone(this.fallback) : null
    }
  }
}

function parsePayload(text: string): ClipboardPayload {
  const envelope: unknown = JSON.parse(text)
  if (!isRecord(envelope) || envelope.mime !== FLOWDIAGRAM_CLIPBOARD_MIME || !isRecord(envelope.payload)) {
    throw new Error('invalid clipboard marker')
  }
  const nodes = envelope.payload.nodes
  const edges = envelope.payload.edges
  if (!Array.isArray(nodes) || !Array.isArray(edges)
    || nodes.length > MAX_NODES_PER_PAGE || edges.length > MAX_EDGES_PER_PAGE) {
    throw new Error('invalid clipboard counts')
  }
  const nodeIds = new Set<string>()
  for (const node of nodes) {
    if (!isRecord(node) || !isUuid(node.id) || nodeIds.has(node.id)
      || !finite(node.x) || !finite(node.y) || !positive(node.width) || !positive(node.height)
      || !finite(node.angle) || !finite(node.zIndex)) {
      throw new Error('invalid clipboard node')
    }
    nodeIds.add(node.id)
  }
  const edgeIds = new Set<string>()
  for (const edge of edges) {
    if (!isRecord(edge) || !isUuid(edge.id) || edgeIds.has(edge.id)
      || !isRecord(edge.source) || !isRecord(edge.target)
      || typeof edge.source.nodeId !== 'string' || typeof edge.target.nodeId !== 'string'
      || !nodeIds.has(edge.source.nodeId) || !nodeIds.has(edge.target.nodeId)
      || !finite(edge.zIndex) || !Array.isArray(edge.vertices)
      || edge.vertices.some((vertex) => !isRecord(vertex) || !finite(vertex.x) || !finite(vertex.y))) {
      throw new Error('invalid clipboard edge')
    }
    edgeIds.add(edge.id)
  }
  return structuredClone(envelope.payload) as unknown as ClipboardPayload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0
}

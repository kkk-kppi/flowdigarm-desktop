import type { ClipboardPayload, ClipboardRepository } from '@/application/clipboard/clipboard-service'
import { MAX_EDGES_PER_PAGE, MAX_FILE_BYTES, MAX_NODES_PER_PAGE, MAX_TEXT_LENGTH } from '@/domain/limits'
import {
  isAllowedHyperlinkProtocol,
  isFiniteNumber,
  isUuidV4,
  isValidColor,
  isValidImageHref,
  isValidPtLength,
  isValidPtPosition,
} from '@/domain/validators'

export const FLOWDIAGRAM_CLIPBOARD_MIME = 'application/x-flowdiagram-cells+json'
const FALLBACK_NOTICE = '系统剪贴板不可用，已使用应用内剪贴板。'
const INVALID_NOTICE = '系统剪贴板内容无效，已使用应用内剪贴板。'
const CONNECTORS = ['straight', 'orthogonal', 'curved']
const DASHES = ['solid', 'dash', 'dot', 'dashdot']

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
    let text: string
    try {
      if (!this.api) throw new Error('clipboard unavailable')
      text = await this.api.readText()
    } catch {
      this.setNotice(FALLBACK_NOTICE)
      return this.fallback ? structuredClone(this.fallback) : null
    }
    try {
      const payload = parsePayload(text)
      this.fallback = structuredClone(payload)
      return payload
    } catch {
      this.setNotice(INVALID_NOTICE)
      return this.fallback ? structuredClone(this.fallback) : null
    }
  }
}

function parsePayload(text: string): ClipboardPayload {
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) throw new Error('clipboard payload too large')
  const envelope: unknown = JSON.parse(text)
  if (!isRecord(envelope) || envelope.mime !== FLOWDIAGRAM_CLIPBOARD_MIME
    || envelope.version !== 1 || !isRecord(envelope.payload)) {
    throw new Error('invalid clipboard marker')
  }
  const nodes = envelope.payload.nodes
  const edges = envelope.payload.edges
  if (!Array.isArray(nodes) || !Array.isArray(edges)
    || nodes.length > MAX_NODES_PER_PAGE || edges.length > MAX_EDGES_PER_PAGE) {
    throw new Error('invalid clipboard counts')
  }
  const nodeIds = new Set<string>()
  const nodesById = new Map<string, ClipboardPayload['nodes'][number]>()
  for (const node of nodes) {
    if (!isDiagramNode(node) || nodeIds.has(node.id)) {
      throw new Error('invalid clipboard node')
    }
    nodeIds.add(node.id)
    nodesById.set(node.id, node)
  }
  for (const node of nodes) {
    if (node.parentId === undefined) continue
    const parent = nodesById.get(node.parentId)
    if (!parent || parent.isContainer !== true) throw new Error('invalid clipboard parent')
  }
  const checkedAncestry = new Set<string>()
  for (const node of nodes) {
    if (checkedAncestry.has(node.id)) continue
    const path: string[] = []
    const pathIds = new Set<string>()
    let current: ClipboardPayload['nodes'][number] | undefined = node
    while (current && !checkedAncestry.has(current.id)) {
      if (pathIds.has(current.id)) throw new Error('invalid clipboard parent cycle')
      path.push(current.id)
      pathIds.add(current.id)
      current = current.parentId === undefined ? undefined : nodesById.get(current.parentId)
    }
    for (const id of path) checkedAncestry.add(id)
  }
  const edgeIds = new Set<string>()
  let nestedCount = 0
  for (const edge of edges) {
    if (!isDiagramEdge(edge) || nodeIds.has(edge.id) || edgeIds.has(edge.id)
      || !nodeIds.has(edge.source.nodeId) || !nodeIds.has(edge.target.nodeId)) {
      throw new Error('invalid clipboard edge')
    }
    nestedCount += edge.vertices.length + edge.labels.length
    if (nestedCount > MAX_EDGES_PER_PAGE) throw new Error('invalid clipboard nested counts')
    edgeIds.add(edge.id)
  }
  return structuredClone(envelope.payload) as unknown as ClipboardPayload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDiagramNode(value: unknown): value is ClipboardPayload['nodes'][number] {
  if (!isRecord(value) || !isUuidV4(value.id) || !nonEmptyString(value.shape)
    || !isValidPtPosition(value.x) || !isValidPtPosition(value.y)
    || !isValidPtLength(value.width) || !isValidPtLength(value.height)
    || !isFiniteNumber(value.angle) || value.angle < 0 || value.angle >= 360
    || !isFiniteNumber(value.zIndex) || !isNodeStyle(value.style)) return false
  if (value.text !== undefined && !isTextContent(value.text)) return false
  if (value.link !== undefined && (!nonEmptyString(value.link) || !isAllowedHyperlinkProtocol(value.link))) return false
  if (value.imageHref !== undefined && !isValidImageHref(value.imageHref)) return false
  if (value.data !== undefined && !isRecord(value.data)) return false
  if (value.parentId !== undefined && !isUuidV4(value.parentId)) return false
  return value.isContainer === undefined || typeof value.isContainer === 'boolean'
}

function isNodeStyle(value: unknown): boolean {
  if (!isRecord(value) || !isValidColor(value.fill) || !unitInterval(value.fillOpacity)
    || !isValidColor(value.stroke) || !isValidPtLength(value.strokeWidth)) return false
  if (value.strokeDash !== undefined && !DASHES.includes(value.strokeDash as string)) return false
  if (value.cornerRadius !== undefined && !isValidPtLength(value.cornerRadius)) return false
  if (value.shadow === undefined) return true
  return isRecord(value.shadow) && isValidColor(value.shadow.color) && unitInterval(value.shadow.opacity)
    && isValidPtPosition(value.shadow.offsetX) && isValidPtPosition(value.shadow.offsetY)
    && isValidPtLength(value.shadow.blur)
}

function isDiagramEdge(value: unknown): value is ClipboardPayload['edges'][number] {
  return isRecord(value) && isUuidV4(value.id)
    && isEndpoint(value.source) && isEndpoint(value.target)
    && CONNECTORS.includes(value.connector as string)
    && Array.isArray(value.vertices)
    && value.vertices.every((vertex) => isRecord(vertex) && isValidPtPosition(vertex.x) && isValidPtPosition(vertex.y))
    && Array.isArray(value.labels) && value.labels.every(isEdgeLabel)
    && isEdgeStyle(value.style) && isFiniteNumber(value.zIndex)
    && (value.link === undefined || (nonEmptyString(value.link) && isAllowedHyperlinkProtocol(value.link)))
}

function isEndpoint(value: unknown): value is { nodeId: string; port?: string } {
  return isRecord(value) && isUuidV4(value.nodeId)
    && (value.port === undefined || nonEmptyString(value.port))
}

function isEdgeLabel(value: unknown): boolean {
  return isRecord(value) && isTextContent(value.text)
    && isFiniteNumber(value.position) && value.position >= 0 && value.position <= 1
}

function isEdgeStyle(value: unknown): boolean {
  return isRecord(value) && isValidColor(value.stroke) && isValidPtLength(value.strokeWidth)
    && unitInterval(value.opacity) && DASHES.includes(value.dash as string)
    && ['none', 'arrow'].includes(value.sourceArrow as string)
    && ['none', 'arrow'].includes(value.targetArrow as string)
}

function isTextContent(value: unknown): boolean {
  if (!isRecord(value) || typeof value.value !== 'string' || value.value.length > MAX_TEXT_LENGTH
    || !isRecord(value.style) || !nonEmptyString(value.style.fontFamily)
    || !isValidPtLength(value.style.fontSize)
    || typeof value.style.bold !== 'boolean' || typeof value.style.italic !== 'boolean'
    || typeof value.style.underline !== 'boolean' || typeof value.style.strikethrough !== 'boolean'
    || !isValidColor(value.style.color)
    || (value.style.background !== undefined && !isValidColor(value.style.background))) return false
  if (!isRecord(value.block)
    || !['left', 'center', 'right'].includes(value.block.horizontalAlign as string)
    || !['top', 'middle', 'bottom'].includes(value.block.verticalAlign as string)
    || !['horizontal', 'vertical'].includes(value.block.direction as string)
    || !isValidPtLength(value.block.marginTop) || !isValidPtLength(value.block.marginRight)
    || !isValidPtLength(value.block.marginBottom) || !isValidPtLength(value.block.marginLeft)) return false
  return isRecord(value.paragraph) && isValidPtLength(value.paragraph.before)
    && isValidPtLength(value.paragraph.after) && isFiniteNumber(value.paragraph.lineHeight)
    && value.paragraph.lineHeight > 0
}

function unitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

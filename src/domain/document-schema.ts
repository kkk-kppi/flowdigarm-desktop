import type {
  DiagramDocument,
  DiagramNode,
  EdgeLabel,
  EdgeStyle,
  NodeStyle,
  TextContent,
} from './diagram'
import { CURRENT_SCHEMA_VERSION, createEmptyPage } from './diagram'
import { MAX_EDGES_PER_PAGE, MAX_NODES_PER_PAGE, MAX_TEXT_LENGTH } from './limits'
import {
  collectDuplicateIds,
  findBackgroundPageCycle,
  isAllowedHyperlinkProtocol,
  isFiniteNumber,
  isUuidV4,
  isValidColor,
  isValidImageHref,
  isValidPtLength,
  isValidPtPosition,
} from './validators'

export interface ParseSuccess { ok: true; document: DiagramDocument; warnings: string[] }
export interface ParseFailure { ok: false; error: string }
export type ParseResult = ParseSuccess | ParseFailure

export interface DocumentValidationContext {
  hasShape(shape: string): boolean
  portIds(shape: string): string[]
  isContainerShape(shape: string): boolean
}

const ERR_INVALID_FORMAT = '文件格式无效，未打开文件。'
const ERR_UNSUPPORTED_VERSION = '文件架构无效：不支持的文件版本，请使用兼容版本重新导出。'
const WARNING_LEGACY_MIGRATED = '已从旧版本迁移。'
const PAGE_UNITS = ['mm', 'cm', 'in', 'pt', 'px']
const ORIENTATIONS = ['portrait', 'landscape']
const PAGE_TYPES = ['foreground', 'background']
const CONNECTORS = ['straight', 'orthogonal', 'curved']
const ARROWS = ['none', 'single', 'double']
const DASHES = ['solid', 'dash', 'dot', 'dashdot']
const PAPER_PRESETS = ['a3', 'a4', 'a5', 'letter', 'tabloid', 'legal', 'statement', 'executive', 'b4-jis', 'b5-jis', 'custom']

function failure(reason: string): ParseFailure {
  return { ok: false, error: `文件校验失败：${reason}` }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function unitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

function enumValue(value: unknown, values: readonly string[]): boolean {
  return typeof value === 'string' && values.includes(value)
}

function validationContextOf(
  context?: DocumentValidationContext | ((shape: string) => string[]),
): DocumentValidationContext | undefined {
  if (typeof context !== 'function') return context
  return {
    hasShape: () => true,
    portIds: context,
    isContainerShape: () => false,
  }
}

export function parseDiagramDocument(
  json: string,
  context?: DocumentValidationContext | ((shape: string) => string[]),
): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (!isRecord(raw)) return { ok: false, error: ERR_INVALID_FORMAT }
  const { document, warnings } = migrateDocument(raw)
  return validateDocument(document, warnings, validationContextOf(context), true)
}

/** Strict, non-mutating validation for current in-memory documents before writes. */
export function validateDiagramDocument(
  document: DiagramDocument,
  context?: DocumentValidationContext,
): ParseResult {
  return validateDocument(structuredClone(document) as unknown as Record<string, unknown>, [], context, false)
}

export function serializeDiagramDocument(document: DiagramDocument): string {
  return JSON.stringify(document, null, 2)
}

export function serializeValidatedDiagramDocument(
  document: DiagramDocument,
  context?: DocumentValidationContext,
): { ok: true; json: string } | ParseFailure {
  const validated = validateDiagramDocument(document, context)
  return validated.ok ? { ok: true, json: serializeDiagramDocument(document) } : validated
}

export function migrateDocument(raw: Record<string, unknown>): { document: Record<string, unknown>; warnings: string[] } {
  const isLegacy = raw.schemaVersion === undefined
  if (!isLegacy) return { document: raw, warnings: [] }

  let document: Record<string, unknown>
  if (!Array.isArray(raw.pages) && (Array.isArray(raw.nodes) || Array.isArray(raw.edges))) {
    const { nodes, edges, ...rest } = raw
    document = {
      ...rest,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      pages: [{
        ...createEmptyPage(),
        nodes: Array.isArray(nodes) ? nodes : [],
        edges: Array.isArray(edges) ? edges : [],
      }],
    }
  } else {
    document = { ...raw, schemaVersion: CURRENT_SCHEMA_VERSION }
  }
  return { document: remapLegacyIds(document), warnings: [WARNING_LEGACY_MIGRATED] }
}

function remapLegacyIds(document: Record<string, unknown>): Record<string, unknown> {
  const idMap = new Map<string, string>()
  const mapId = (value: unknown): string => {
    if (isUuidV4(value)) return value
    if (typeof value === 'string' && idMap.has(value)) return idMap.get(value)!
    const id = crypto.randomUUID()
    if (typeof value === 'string') idMap.set(value, id)
    return id
  }
  const pages = Array.isArray(document.pages) ? document.pages : []
  for (const page of pages) {
    if (!isRecord(page)) continue
    page.id = mapId(page.id)
    for (const node of Array.isArray(page.nodes) ? page.nodes : []) {
      if (isRecord(node)) node.id = mapId(node.id)
    }
    for (const edge of Array.isArray(page.edges) ? page.edges : []) {
      if (isRecord(edge)) edge.id = mapId(edge.id)
    }
  }
  document.id = mapId(document.id)
  for (const page of pages) {
    if (!isRecord(page)) continue
    if (page.backgroundPageId !== undefined) page.backgroundPageId = mapId(page.backgroundPageId)
    for (const node of Array.isArray(page.nodes) ? page.nodes : []) {
      if (isRecord(node) && node.parentId !== undefined) node.parentId = mapId(node.parentId)
    }
    for (const edge of Array.isArray(page.edges) ? page.edges : []) {
      if (!isRecord(edge)) continue
      for (const endpoint of [edge.source, edge.target]) {
        if (isRecord(endpoint)) endpoint.nodeId = mapId(endpoint.nodeId)
      }
    }
  }
  return document
}

function validateDocument(
  raw: Record<string, unknown>,
  warnings: string[],
  context: DocumentValidationContext | undefined,
  migratePorts: boolean,
): ParseResult {
  const version = raw.schemaVersion
  if (typeof version === 'number' && Number.isInteger(version) && version > CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: ERR_UNSUPPORTED_VERSION }
  }
  if (version !== CURRENT_SCHEMA_VERSION || !isUuidV4(raw.id) || typeof raw.name !== 'string') {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (!Array.isArray(raw.pages) || raw.pages.length === 0) return { ok: false, error: ERR_INVALID_FORMAT }

  for (const page of raw.pages) {
    const result = validatePage(page, warnings, context, migratePorts)
    if (result) return result
  }
  const document = raw as unknown as DiagramDocument
  if (collectDuplicateIds(document).length > 0) return failure('存在重复的 ID。')
  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  for (const page of document.pages) {
    if (page.backgroundPageId === undefined) continue
    if (!isUuidV4(page.backgroundPageId) || pagesById.get(page.backgroundPageId)?.type !== 'background') {
      return failure('背景页引用无效。')
    }
  }
  if (findBackgroundPageCycle(document)) return failure('背景页引用存在循环。')
  return { ok: true, document, warnings }
}

function validatePage(
  value: unknown,
  warnings: string[],
  context: DocumentValidationContext | undefined,
  migratePorts: boolean,
): ParseFailure | null {
  if (!isRecord(value) || !isUuidV4(value.id) || typeof value.name !== 'string') {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (!enumValue(value.unit, PAGE_UNITS)) return failure('页面单位未知。')
  if (!enumValue(value.type, PAGE_TYPES)
    || !enumValue(value.orientation, ORIENTATIONS) || !enumValue(value.defaultConnector, CONNECTORS)
    || !enumValue(value.defaultArrow, ARROWS)) return failure('页面枚举值无效。')
  if (typeof value.autoConnectLabel !== 'boolean' || typeof value.showLineJumps !== 'boolean') {
    return failure('页面布尔设置无效。')
  }
  if (!isRecord(value.pageSize) || !isValidPtLength(value.pageSize.width) || !isValidPtLength(value.pageSize.height)
    || value.pageSize.width === 0 || value.pageSize.height === 0
    || (value.pageSize.preset !== undefined && !enumValue(value.pageSize.preset, PAPER_PRESETS))) {
    return failure('页面尺寸无效。')
  }
  if (!isRecord(value.canvas) || !isValidPtLength(value.canvas.gridSize) || value.canvas.gridSize === 0
    || !isValidColor(value.canvas.background)) return failure('画布设置无效。')
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return { ok: false, error: ERR_INVALID_FORMAT }
  if (value.nodes.length > MAX_NODES_PER_PAGE) return failure('每页节点数量超出上限。')
  if (value.edges.length > MAX_EDGES_PER_PAGE) return failure('每页边数量超出上限。')

  for (const node of value.nodes) {
    const result = validateNode(node, context)
    if (result) return result
  }
  const nodes = value.nodes as DiagramNode[]
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    if (node.parentId === undefined) continue
    const parent = nodesById.get(node.parentId)
    if (!parent || !(parent.isContainer === true || context?.isContainerShape(parent.shape))) {
      return failure('节点父容器无效。')
    }
  }
  const checked = new Set<string>()
  for (const node of nodes) {
    const path = new Set<string>()
    let current: DiagramNode | undefined = node
    while (current && !checked.has(current.id)) {
      if (path.has(current.id)) return failure('节点父子关系存在循环。')
      path.add(current.id)
      current = current.parentId ? nodesById.get(current.parentId) : undefined
    }
    for (const id of path) checked.add(id)
  }
  for (const edge of value.edges) {
    const result = validateEdge(edge, nodesById, warnings, context, migratePorts)
    if (result) return result
  }
  return null
}

function validateNode(value: unknown, context?: DocumentValidationContext): ParseFailure | null {
  if (!isRecord(value) || !isUuidV4(value.id) || !nonEmptyString(value.shape)) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (context && !context.hasShape(value.shape)) return failure('存在未知形状类型。')
  if (!isValidPtLength(value.width) || !isValidPtLength(value.height)) return failure('节点尺寸无效。')
  if (!isValidPtPosition(value.x) || !isValidPtPosition(value.y)) {
    return { ok: false, error: '文件几何无效：节点位置超出允许范围，请修正后重试。' }
  }
  if (!isFiniteNumber(value.angle) || value.angle < 0 || value.angle >= 360) return failure('节点角度无效。')
  if (isRecord(value.style)
    && (!isValidColor(value.style.fill) || !isValidColor(value.style.stroke))) return failure('颜色值无效。')
  if (!isValidPtPosition(value.zIndex) || !isNodeStyle(value.style)) return failure('节点样式无效。')
  if (isRecord(value.text) && typeof value.text.value === 'string' && value.text.value.length > MAX_TEXT_LENGTH) {
    return failure('文本内容超长。')
  }
  if (value.text !== undefined && !isTextContent(value.text)) return failure('节点文本无效。')
  if (value.link !== undefined && (!nonEmptyString(value.link) || !isAllowedHyperlinkProtocol(value.link))) {
    return { ok: false, error: '文件链接无效：仅支持 http、https 或 mailto 链接，请修正后重试。' }
  }
  if (value.imageHref !== undefined && !isValidImageHref(value.imageHref)) return failure('图片资源超出大小限制或协议不允许。')
  if (value.parentId !== undefined && !isUuidV4(value.parentId)) return failure('节点父容器无效。')
  if (value.isContainer !== undefined && typeof value.isContainer !== 'boolean') return failure('节点容器标记无效。')
  if (value.data !== undefined && (!isRecord(value.data) || !isJsonValue(value.data))) return failure('业务数据无效。')
  return null
}

function isNodeStyle(value: unknown): value is NodeStyle {
  if (!isRecord(value) || !isValidColor(value.fill) || !unitInterval(value.fillOpacity)
    || !isValidColor(value.stroke) || !isValidPtLength(value.strokeWidth)) return false
  if (value.strokeDash !== undefined && !enumValue(value.strokeDash, DASHES)) return false
  if (value.cornerRadius !== undefined && !isValidPtLength(value.cornerRadius)) return false
  if (value.shadow === undefined) return true
  return isRecord(value.shadow) && isValidColor(value.shadow.color) && unitInterval(value.shadow.opacity)
    && isValidPtPosition(value.shadow.offsetX) && isValidPtPosition(value.shadow.offsetY)
    && isValidPtLength(value.shadow.blur)
}

function isTextContent(value: unknown): value is TextContent {
  if (!isRecord(value) || typeof value.value !== 'string' || value.value.length > MAX_TEXT_LENGTH
    || !isRecord(value.style) || !nonEmptyString(value.style.fontFamily)
    || value.style.fontFamily.length > MAX_TEXT_LENGTH || !isValidPtLength(value.style.fontSize)
    || typeof value.style.bold !== 'boolean' || typeof value.style.italic !== 'boolean'
    || typeof value.style.underline !== 'boolean' || typeof value.style.strikethrough !== 'boolean'
    || !isValidColor(value.style.color)
    || (value.style.background !== undefined && !isValidColor(value.style.background))) return false
  if (!isRecord(value.block) || !enumValue(value.block.horizontalAlign, ['left', 'center', 'right'])
    || !enumValue(value.block.verticalAlign, ['top', 'middle', 'bottom'])
    || !enumValue(value.block.direction, ['horizontal', 'vertical'])
    || !isValidPtLength(value.block.marginTop) || !isValidPtLength(value.block.marginRight)
    || !isValidPtLength(value.block.marginBottom) || !isValidPtLength(value.block.marginLeft)) return false
  return isRecord(value.paragraph) && isValidPtLength(value.paragraph.before)
    && isValidPtLength(value.paragraph.after) && isFiniteNumber(value.paragraph.lineHeight)
    && value.paragraph.lineHeight > 0
}

function validateEdge(
  value: unknown,
  nodesById: Map<string, DiagramNode>,
  warnings: string[],
  context: DocumentValidationContext | undefined,
  migratePorts: boolean,
): ParseFailure | null {
  if (!isRecord(value) || !isUuidV4(value.id) || !isEndpoint(value.source) || !isEndpoint(value.target)) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  for (const endpoint of [value.source, value.target]) {
    const node = nodesById.get(endpoint.nodeId)
    if (!node) return failure('边引用了不存在的节点。')
    if (endpoint.port !== undefined && context && !context.portIds(node.shape).includes(endpoint.port)) {
      if (!migratePorts) return failure('边引用了不存在的端口。')
      delete endpoint.port
      warnings.push(`边 ${value.id} 的端口缺失，已锚定到节点中心。`)
    }
  }
  if (!enumValue(value.connector, CONNECTORS) || !Array.isArray(value.vertices)
    || !value.vertices.every((vertex) => isRecord(vertex) && isValidPtPosition(vertex.x) && isValidPtPosition(vertex.y))) {
    return failure('边几何无效。')
  }
  if (!Array.isArray(value.labels) || !value.labels.every(isEdgeLabel)) return failure('边标签无效。')
  if (value.vertices.length + value.labels.length > MAX_EDGES_PER_PAGE) return failure('边嵌套内容数量超出上限。')
  if (!isEdgeStyle(value.style) || !isValidPtPosition(value.zIndex)) return failure('边样式无效。')
  if (value.link !== undefined && (!nonEmptyString(value.link) || !isAllowedHyperlinkProtocol(value.link))) {
    return { ok: false, error: '文件链接无效：仅支持 http、https 或 mailto 链接，请修正后重试。' }
  }
  return null
}

function isEndpoint(value: unknown): value is { nodeId: string; port?: string } {
  return isRecord(value) && isUuidV4(value.nodeId) && (value.port === undefined || nonEmptyString(value.port))
}

function isEdgeLabel(value: unknown): value is EdgeLabel {
  return isRecord(value) && isTextContent(value.text) && unitInterval(value.position)
}

function isEdgeStyle(value: unknown): value is EdgeStyle {
  return isRecord(value) && isValidColor(value.stroke) && isValidPtLength(value.strokeWidth)
    && unitInterval(value.opacity) && enumValue(value.dash, DASHES)
    && enumValue(value.sourceArrow, ['none', 'arrow']) && enumValue(value.targetArrow, ['none', 'arrow'])
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 32) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1))
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item, depth + 1))
}

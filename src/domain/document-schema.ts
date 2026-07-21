// src/domain/document-schema.ts
// .flowdiagram 文档解析、只增迁移与序列化（详细设计 §8.3 校验规则逐条实现）。

import type { DiagramDocument, DiagramEdge, DiagramNode, DiagramPage } from './diagram'
import { CURRENT_SCHEMA_VERSION, createEmptyPage } from './diagram'
import { MAX_EDGES_PER_PAGE, MAX_NODES_PER_PAGE, MAX_TEXT_LENGTH } from './limits'
import {
  collectDuplicateIds,
  findBackgroundPageCycle,
  isAllowedHyperlinkProtocol,
  isFiniteNumber,
  isValidImageHref,
  isValidColor,
  isValidPtLength,
  isValidPtPosition,
} from './validators'

export interface ParseSuccess { ok: true; document: DiagramDocument; warnings: string[] }
export interface ParseFailure { ok: false; error: string } // 中文可读
export type ParseResult = ParseSuccess | ParseFailure

const ERR_INVALID_FORMAT = '文件格式无效，未打开文件。'
const ERR_UNSUPPORTED_VERSION = '文件架构无效：不支持的文件版本，请使用兼容版本重新导出。'
const WARNING_LEGACY_MIGRATED = '已从旧版本迁移。'

const PAGE_UNITS = ['mm', 'cm', 'in', 'pt', 'px']
const ORIENTATIONS = ['portrait', 'landscape']
const PAGE_TYPES = ['foreground', 'background']
const CONNECTOR_KINDS = ['straight', 'orthogonal', 'curved']

function failure(reason: string): ParseFailure {
  return { ok: false, error: `文件校验失败：${reason}` }
}

export function parseDiagramDocument(
  json: string,
  portResolver?: (shape: string) => string[],
): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  const { document: migrated, warnings } = migrateDocument(raw as Record<string, unknown>)
  return validateDocument(migrated, warnings, portResolver)
}

export function migrateDocument(raw: Record<string, unknown>): { document: Record<string, unknown>; warnings: string[] } {
  // 旧文档：无 pages 但有顶层 nodes/edges → 迁移为唯一前景页（名称「页面 1」）
  if (!Array.isArray(raw.pages) && (Array.isArray(raw.nodes) || Array.isArray(raw.edges))) {
    const { nodes, edges, ...rest } = raw
    const page = {
      ...createEmptyPage(),
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
    }
    return {
      document: { ...rest, schemaVersion: CURRENT_SCHEMA_VERSION, pages: [page] },
      warnings: [WARNING_LEGACY_MIGRATED],
    }
  }
  return { document: raw, warnings: [] }
}

export function serializeDiagramDocument(doc: DiagramDocument): string {
  return JSON.stringify(doc, null, 2)
}

function validateDocument(
  raw: Record<string, unknown>,
  warnings: string[],
  portResolver?: (shape: string) => string[],
): ParseResult {
  // 规则 1：schemaVersion 为正整数且 ≤ CURRENT_SCHEMA_VERSION
  const version = raw.schemaVersion
  if (typeof version === 'number' && Number.isInteger(version) && version > CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: ERR_UNSUPPORTED_VERSION }
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  // 规则 2：id/name 存在；pages 非空数组
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (!Array.isArray(raw.pages) || raw.pages.length === 0) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  const doc = raw as unknown as DiagramDocument
  for (const page of doc.pages) {
    const pageFailure = validatePage(page, warnings, portResolver)
    if (pageFailure) return pageFailure
  }
  // 规则 7：全文档 ID 唯一；backgroundPageId 必须指向背景页且无环
  if (collectDuplicateIds(doc).length > 0) {
    return failure('存在重复的 ID。')
  }
  const pagesById = new Map(doc.pages.map((page) => [page.id, page]))
  for (const page of doc.pages) {
    if (page.backgroundPageId !== undefined) {
      const target = pagesById.get(page.backgroundPageId)
      if (!target || target.type !== 'background') {
        return failure('背景页引用无效。')
      }
    }
  }
  if (findBackgroundPageCycle(doc) !== null) {
    return failure('背景页引用存在循环。')
  }
  return { ok: true, document: doc, warnings }
}

function validatePage(
  page: DiagramPage,
  warnings: string[],
  portResolver?: (shape: string) => string[],
): ParseFailure | null {
  if (typeof page !== 'object' || page === null) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (typeof page.id !== 'string' || typeof page.name !== 'string') {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  // 规则 4：页面枚举与尺寸
  if (!PAGE_UNITS.includes(page.unit)) {
    return failure('页面单位未知。')
  }
  if (typeof page.pageSize !== 'object' || page.pageSize === null
    || !isValidPtLength(page.pageSize.width) || !isValidPtLength(page.pageSize.height)) {
    return failure('页面尺寸无效。')
  }
  if (!ORIENTATIONS.includes(page.orientation)) {
    return failure('页面方向未知。')
  }
  if (!PAGE_TYPES.includes(page.type)) {
    return failure('页面类型未知。')
  }
  if (!CONNECTOR_KINDS.includes(page.defaultConnector)) {
    return failure('默认连接线类型未知。')
  }
  if (!Array.isArray(page.nodes) || !Array.isArray(page.edges)) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  // 规则 8：每页节点/边数量上限
  if (page.nodes.length > MAX_NODES_PER_PAGE) {
    return failure('每页节点数量超出上限。')
  }
  if (page.edges.length > MAX_EDGES_PER_PAGE) {
    return failure('每页边数量超出上限。')
  }
  for (const node of page.nodes) {
    const nodeFailure = validateNode(node)
    if (nodeFailure) return nodeFailure
  }
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  for (const edge of page.edges) {
    const edgeFailure = validateEdge(edge, nodesById, warnings, portResolver)
    if (edgeFailure) return edgeFailure
  }
  return null
}

function validateNode(node: DiagramNode): ParseFailure | null {
  if (typeof node !== 'object' || node === null) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (typeof node.id !== 'string' || typeof node.shape !== 'string') {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  // 规则 5：节点尺寸/位置/角度/颜色/文本/链接
  if (!isValidPtLength(node.width) || !isValidPtLength(node.height)) {
    return failure('节点尺寸无效。')
  }
  if (!isValidPtPosition(node.x) || !isValidPtPosition(node.y)) {
    return { ok: false, error: '文件几何无效：节点位置超出允许范围，请修正后重试。' }
  }
  if (!isFiniteNumber(node.angle) || node.angle < 0 || node.angle >= 360) {
    return failure('节点角度无效。')
  }
  if (typeof node.style !== 'object' || node.style === null
    || !isValidColor(node.style.fill) || !isValidColor(node.style.stroke)) {
    return failure('颜色值无效。')
  }
  if (node.text !== undefined) {
    if (typeof node.text !== 'object' || node.text === null || typeof node.text.value !== 'string') {
      return { ok: false, error: ERR_INVALID_FORMAT }
    }
    if (node.text.value.length > MAX_TEXT_LENGTH) {
      return failure('文本内容超长。')
    }
    if (typeof node.text.style === 'object' && node.text.style !== null) {
      if (!isValidColor(node.text.style.color)) {
        return failure('颜色值无效。')
      }
      if (node.text.style.background !== undefined && !isValidColor(node.text.style.background)) {
        return failure('颜色值无效。')
      }
    }
  }
  if (node.link !== undefined && !isAllowedHyperlinkProtocol(node.link)) {
    return { ok: false, error: '文件链接无效：仅支持 http、https 或 mailto 链接，请修正后重试。' }
  }
  // 规则 8：图片节点 imageHref
  if (node.imageHref !== undefined && !isValidImageHref(node.imageHref)) {
    return failure('图片资源超出大小限制或协议不允许。')
  }
  return null
}

function validateEdge(
  edge: DiagramEdge,
  nodesById: Map<string, DiagramNode>,
  warnings: string[],
  portResolver?: (shape: string) => string[],
): ParseFailure | null {
  if (typeof edge !== 'object' || edge === null) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  if (typeof edge.id !== 'string'
    || typeof edge.source !== 'object' || edge.source === null
    || typeof edge.target !== 'object' || edge.target === null) {
    return { ok: false, error: ERR_INVALID_FORMAT }
  }
  // 规则 6：source/target.nodeId 必须存在于同页
  for (const end of [edge.source, edge.target]) {
    if (typeof end.nodeId !== 'string' || !nodesById.has(end.nodeId)) {
      return failure('边引用了不存在的节点。')
    }
  }
  // 规则 6：portResolver 提供时校验端口；缺失端口迁移为无端口（节点中心锚定）
  if (portResolver) {
    let portMissing = false
    for (const end of [edge.source, edge.target]) {
      if (end.port !== undefined) {
        const node = nodesById.get(end.nodeId)
        if (node && !portResolver(node.shape).includes(end.port)) {
          delete end.port
          portMissing = true
        }
      }
    }
    if (portMissing) {
      warnings.push(`边 ${edge.id} 的端口缺失，已锚定到节点中心。`)
    }
  }
  return null
}

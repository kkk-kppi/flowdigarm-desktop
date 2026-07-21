// src/domain/validators.ts
// 纯谓词与只读结构检查，全部导出；不写文件、不依赖形状注册表。

import type { DiagramDocument, DiagramPage } from './diagram'
import { MAX_IMAGE_BYTES, MAX_PT } from './limits'

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 长度（宽高等）：有限且 0..MAX_PT。 */
export function isValidPtLength(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0 && v <= MAX_PT
}

/** 位置（x/y、拐点）：允许为负，仅要求有限且 |v| ≤ MAX_PT。 */
export function isValidPtPosition(v: unknown): v is number {
  return isFiniteNumber(v) && Math.abs(v) <= MAX_PT
}

/** #RRGGBB 或 #RRGGBBAA（大小写不敏感）。 */
export function isValidColor(v: unknown): v is string {
  return typeof v === 'string' && /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)
}

export function isUuidV4(v: unknown): v is string {
  return typeof v === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

/** 仅放行 http: / https: / mailto:（协议小写比较；解析失败 false）。 */
export function isAllowedHyperlinkProtocol(url: string): boolean {
  try {
    const protocol = new URL(url).protocol.toLowerCase()
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:'
  } catch {
    return false
  }
}

/** 图片仅允许受控 data URL 或与普通超链接相同的安全协议。 */
export function isValidImageHref(href: unknown): href is string {
  if (typeof href !== 'string') return false
  if (!href.startsWith('data:')) return isAllowedHyperlinkProtocol(href)
  const match = /^data:image\/(?:png|jpeg|webp);base64,([a-z0-9+/=\s]*)$/i.exec(href)
  if (!match) return false
  const payload = match[1].replace(/\s/g, '')
  return Math.floor((payload.length * 3) / 4) <= MAX_IMAGE_BYTES
}

/** 收集全文档（页/节点/边）中重复出现的 id。 */
export function collectDuplicateIds(doc: DiagramDocument): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  const add = (id: string): void => {
    if (seen.has(id)) {
      duplicates.add(id)
    } else {
      seen.add(id)
    }
  }
  for (const page of doc.pages) {
    add(page.id)
    for (const node of page.nodes) add(node.id)
    for (const edge of page.edges) add(edge.id)
  }
  return [...duplicates]
}

/** 沿 backgroundPageId 链检测环；返回构成环的页 id 列表，无环返回 null。 */
export function findBackgroundPageCycle(doc: DiagramDocument): string[] | null {
  const pagesById = new Map(doc.pages.map((page) => [page.id, page]))
  for (const startPage of doc.pages) {
    const path: string[] = []
    const seen = new Set<string>()
    let current = startPage
    while (current.backgroundPageId !== undefined) {
      if (seen.has(current.id)) {
        return path.slice(path.indexOf(current.id))
      }
      seen.add(current.id)
      path.push(current.id)
      const next = pagesById.get(current.backgroundPageId)
      if (!next) break
      current = next
    }
  }
  return null
}

/**
 * 找出悬空端口引用的边 id：source/target 的 nodeId 不存在，
 * 或 port 不在该节点形状的端口集中（端口集由调用方通过 portResolver 提供）。
 */
export function findDanglingPortReferences(
  page: DiagramPage,
  portResolver: (shape: string) => string[],
): string[] {
  const nodesById = new Map(page.nodes.map((node) => [node.id, node]))
  const dangling: string[] = []
  for (const edge of page.edges) {
    for (const end of [edge.source, edge.target]) {
      const node = nodesById.get(end.nodeId)
      if (!node || (end.port !== undefined && !portResolver(node.shape).includes(end.port))) {
        dangling.push(edge.id)
        break
      }
    }
  }
  return dangling
}

// src/application/commands/fit-page-to-content.ts
// 自动调整页面大小命令：按本页全部图元（节点 bbox + 边顶点）外接矩形 + margin 重设 pageSize，
// 方向重算（宽 > 高 → 横向，否则纵向）。before/after 由工厂在构造前读取当前页算好，
// 命令本身不可变可逆；页面无图元时工厂返回 null（调用方不执行、不入历史）。
import type { DiagramDocument, DiagramPage, Orientation } from '@/domain/diagram'
import { paperSizeFor, type PaperPreset } from '@/domain/paper-presets'
import type { EditorCommand } from './editor-command'

export const DEFAULT_FIT_MARGIN_PT = 36

export interface ContentBBox {
  x: number
  y: number
  width: number
  height: number
}

interface FitPageSnapshot {
  pageSize: DiagramPage['pageSize']
  orientation: Orientation
}

/** 本页全部图元（节点 bbox + 边顶点）的最小外接矩形；无图元返回 null。 */
export function computeContentBBox(page: DiagramPage): ContentBBox | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const node of page.nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  for (const edge of page.edges) {
    for (const vertex of edge.vertices) {
      minX = Math.min(minX, vertex.x)
      minY = Math.min(minY, vertex.y)
      maxX = Math.max(maxX, vertex.x)
      maxY = Math.max(maxY, vertex.y)
    }
  }
  if (!Number.isFinite(minX)) {
    return null
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** 新尺寸仍匹配原预设（正/反向）时保留预设，否则降级为自定义。 */
function presetForSize(width: number, height: number, current?: PaperPreset): PaperPreset {
  if (current && current !== 'custom') {
    const size = paperSizeFor(current)
    const matches =
      (size.width === width && size.height === height) ||
      (size.width === height && size.height === width)
    if (matches) {
      return current
    }
  }
  return 'custom'
}

export class FitPageToContentCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '自动调整页面大小'

  constructor(
    private readonly input: { pageId: string; before: FitPageSnapshot; after: FitPageSnapshot },
  ) {}

  apply(document: DiagramDocument): DiagramDocument {
    return this.write(document, this.input.after)
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.write(document, this.input.before)
  }

  private write(document: DiagramDocument, snapshot: FitPageSnapshot): DiagramDocument {
    if (!document.pages.some((page) => page.id === this.input.pageId)) {
      throw new Error('命令目标不存在。')
    }
    return {
      ...document,
      pages: document.pages.map((page) =>
        page.id === this.input.pageId
          ? { ...page, pageSize: { ...snapshot.pageSize }, orientation: snapshot.orientation }
          : page,
      ),
    }
  }
}

/**
 * 读取当前页计算 before/after 并构造命令；页面无图元时返回 null。
 * margin 默认 36pt（0.5 英寸边距）。
 */
export function createFitPageCommand(
  page: DiagramPage,
  marginPt: number = DEFAULT_FIT_MARGIN_PT,
): FitPageToContentCommand | null {
  const bbox = computeContentBBox(page)
  if (!bbox) {
    return null
  }
  const width = bbox.width + 2 * marginPt
  const height = bbox.height + 2 * marginPt
  const orientation: Orientation = width > height ? 'landscape' : 'portrait'
  return new FitPageToContentCommand({
    pageId: page.id,
    before: {
      pageSize: { ...page.pageSize },
      orientation: page.orientation,
    },
    after: {
      pageSize: {
        preset: presetForSize(width, height, page.pageSize.preset),
        width,
        height,
      },
      orientation,
    },
  })
}

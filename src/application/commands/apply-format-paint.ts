// src/application/commands/apply-format-paint.ts
// 格式刷命令：把源图元的格式（节点样式全键 + 文本 style/block/paragraph；边为 EdgeStyle 全键）
// 复制到目标图元，多目标一次应用一条记录（详细设计 §14.2）。
// 不复制：ID/位置/尺寸/旋转/文本内容/图片/链接/端口/业务数据/形状类型/结构关系——
// 快照仅含样式与文本样式键，命令只写这些键，其余键天然不受影响。
// 类型匹配：节点源→节点目标、边源→边目标；不匹配目标跳过，全部跳过（含无变化）→ null。
import {
  createDefaultTextContent,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  type DiagramPage,
  type EdgeStyle,
  type NodeStyle,
  type TextBlock,
  type TextParagraph,
  type TextStyle,
} from '@/domain/diagram'
import type { EditorCommand } from './editor-command'
import type { TextStylePatch } from './text-style-command'

export interface FormatPaintSnapshot {
  nodeStyle?: Partial<NodeStyle>
  edgeStyle?: Partial<EdgeStyle>
  text?: TextStylePatch
}

export interface FormatPaintTarget {
  cellId: string
  before: FormatPaintSnapshot
  after: FormatPaintSnapshot
}

/** 节点样式全键（详细设计 §14.2：填充/填充透明度/边框/虚线/圆角/阴影）。 */
const NODE_STYLE_KEYS = [
  'fill',
  'fillOpacity',
  'stroke',
  'strokeWidth',
  'strokeDash',
  'cornerRadius',
  'shadow',
] as const satisfies readonly (keyof NodeStyle)[]

const EDGE_STYLE_KEYS = [
  'stroke',
  'strokeWidth',
  'opacity',
  'dash',
  'sourceArrow',
  'targetArrow',
] as const satisfies readonly (keyof EdgeStyle)[]

// 文本三段全键：全键捕获（缺失键显式 undefined），merge 时才能覆盖/清除目标原有值，
// revert 才能精确还原（缺键浅合并会残留 apply 写入的键）。
const TEXT_STYLE_KEYS = [
  'fontFamily',
  'fontSize',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'color',
  'background',
] as const satisfies readonly (keyof TextStyle)[]

const TEXT_BLOCK_KEYS = [
  'horizontalAlign',
  'verticalAlign',
  'direction',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
] as const satisfies readonly (keyof TextBlock)[]

const TEXT_PARAGRAPH_KEYS = ['before', 'after', 'lineHeight'] as const satisfies readonly (
  keyof TextParagraph
)[]

function cloneStyleSection<T extends object>(style: T, keys: readonly (keyof T)[]): Partial<T> {
  const snapshot: Partial<T> = {}
  for (const key of keys) {
    snapshot[key] = structuredClone(style[key]) as T[keyof T] extends never ? never : T[keyof T]
  }
  return snapshot
}

function captureTextPatch(cell: DiagramNode): TextStylePatch | undefined {
  if (!cell.text) {
    return undefined
  }
  return {
    style: cloneStyleSection(cell.text.style, TEXT_STYLE_KEYS),
    block: cloneStyleSection(cell.text.block, TEXT_BLOCK_KEYS),
    paragraph: cloneStyleSection(cell.text.paragraph, TEXT_PARAGRAPH_KEYS),
  }
}

/** 捕获源图元格式快照（深拷贝；仅样式与文本样式键）。 */
export function captureFormatPaintSource(cell: DiagramNode | DiagramEdge): FormatPaintSnapshot {
  if ('shape' in cell) {
    return {
      nodeStyle: cloneStyleSection(cell.style, NODE_STYLE_KEYS),
      text: captureTextPatch(cell),
    }
  }
  return { edgeStyle: cloneStyleSection(cell.style, EDGE_STYLE_KEYS) }
}

/** 目标 before 快照：仅取 after 中出现的段与键（保证 revert 精确还原被覆盖的键）。 */
function captureBefore(
  target: DiagramNode | DiagramEdge,
  after: FormatPaintSnapshot,
): FormatPaintSnapshot {
  const before: FormatPaintSnapshot = {}
  if (after.nodeStyle && 'shape' in target) {
    before.nodeStyle = {}
    for (const key of Object.keys(after.nodeStyle) as (keyof NodeStyle)[]) {
      before.nodeStyle[key] = structuredClone(target.style[key]) as never
    }
  }
  if (after.edgeStyle && !('shape' in target)) {
    before.edgeStyle = {}
    for (const key of Object.keys(after.edgeStyle) as (keyof EdgeStyle)[]) {
      before.edgeStyle[key] = structuredClone(target.style[key]) as never
    }
  }
  if (after.text !== undefined && 'shape' in target) {
    before.text = captureTextPatch(target)
  }
  return before
}

/** 段级深等（undefined 键与缺省键等价）。 */
function sectionEqual(a: object | undefined, b: object | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export class FormatPaintCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '格式刷'
  private readonly pageId: string
  private readonly sourceCellId: string
  private readonly targets: FormatPaintTarget[]

  constructor(input: { pageId: string; sourceCellId: string; targets: FormatPaintTarget[] }) {
    this.pageId = input.pageId
    this.sourceCellId = input.sourceCellId
    this.targets = structuredClone(input.targets)
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.writeAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.writeAll(document, 'before')
  }

  private writeAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
    void this.sourceCellId // 源仅为语义记录，写入只依赖目标快照
    const page = document.pages.find((p) => p.id === this.pageId)
    for (const target of this.targets) {
      const exists =
        page?.nodes.some((n) => n.id === target.cellId) ||
        page?.edges.some((e) => e.id === target.cellId)
      if (!exists) {
        throw new Error('命令目标不存在。')
      }
    }
    const byId = new Map(this.targets.map((t) => [t.cellId, t]))
    return {
      ...document,
      pages: document.pages.map((p) => {
        if (p.id !== this.pageId) return p
        return {
          ...p,
          nodes: p.nodes.map((node): DiagramNode => {
            const target = byId.get(node.id)
            if (!target) return node
            let next = node
            // 段是否在写入范围由 after 决定（before/after 同范围，revert 才能还原被覆盖键）
            if (target.after.nodeStyle) {
              next = { ...next, style: { ...next.style, ...target[key].nodeStyle } }
            }
            if (target.after.text !== undefined) {
              const patch = target[key].text
              if (patch === undefined) {
                next = { ...next, text: undefined }
              } else {
                const content = next.text ?? createDefaultTextContent()
                next = {
                  ...next,
                  text: {
                    ...content,
                    style: { ...content.style, ...patch.style },
                    block: { ...content.block, ...patch.block },
                    paragraph: { ...content.paragraph, ...patch.paragraph },
                  },
                }
              }
            }
            return next
          }),
          edges: p.edges.map((edge): DiagramEdge => {
            const target = byId.get(edge.id)
            if (!target || !target.after.edgeStyle) return edge
            return { ...edge, style: { ...edge.style, ...target[key].edgeStyle } }
          }),
        }
      }),
    }
  }
}

/** 生成一条「格式刷」命令；类型不匹配/无变化目标跳过，无有效目标 → null。 */
export function createFormatPaintCommand(
  page: DiagramPage,
  sourceCellId: string,
  targetIds: string[],
): FormatPaintCommand | null {
  const sourceNode = page.nodes.find((n) => n.id === sourceCellId)
  const sourceEdge = page.edges.find((e) => e.id === sourceCellId)
  const source = sourceNode ?? sourceEdge
  if (!source) {
    return null
  }
  const after = captureFormatPaintSource(source)
  const targets: FormatPaintTarget[] = []
  for (const targetId of targetIds) {
    const targetNode = page.nodes.find((n) => n.id === targetId)
    const targetEdge = page.edges.find((e) => e.id === targetId)
    // 类型匹配：节点源→节点目标；边源→边目标
    const target = sourceNode ? targetNode : targetEdge
    if (!target) {
      continue
    }
    const before = captureBefore(target, after)
    const unchanged =
      sectionEqual(before.nodeStyle, after.nodeStyle) &&
      sectionEqual(before.edgeStyle, after.edgeStyle) &&
      sectionEqual(before.text, after.text)
    if (unchanged) {
      continue
    }
    targets.push({ cellId: targetId, before, after })
  }
  if (targets.length === 0) {
    return null
  }
  return new FormatPaintCommand({ pageId: page.id, sourceCellId, targets })
}

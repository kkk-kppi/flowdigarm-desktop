// src/application/inspector/aggregate-style.ts
// 多选聚合：属性面板与工具栏读取选中图元的聚合值——
// 一致显示值（value）、不一致显示占位（mixed）、无文本禁用（none）。
// 深等用 JSON 序列化：聚合字段均为标量或标量嵌套对象（shadow），键序一致。
import type {
  DiagramNode,
  NodeStyle,
  TextBlock,
  TextContent,
  TextParagraph,
  TextStyle,
} from '@/domain/diagram'

export type Aggregate<T> = { kind: 'value'; value: T } | { kind: 'mixed' } | { kind: 'none' }

/** 全 undefined（含空数组）→ none；全等（深等）→ value；否则 mixed。 */
export function aggregateField<T>(values: (T | undefined)[]): Aggregate<T> {
  if (values.length === 0 || values.every((v) => v === undefined)) {
    return { kind: 'none' }
  }
  const defined = values.filter((v) => v !== undefined)
  if (defined.length < values.length) {
    return { kind: 'mixed' }
  }
  const first = JSON.stringify(defined[0])
  return defined.every((v) => JSON.stringify(v) === first)
    ? { kind: 'value', value: defined[0] as T }
    : { kind: 'mixed' }
}

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

const NODE_STYLE_KEYS = [
  'fill',
  'fillOpacity',
  'stroke',
  'strokeWidth',
  'strokeDash',
  'cornerRadius',
  'shadow',
] as const satisfies readonly (keyof NodeStyle)[]

export interface AggregateTextStyles {
  style: Record<keyof TextStyle, Aggregate<unknown>>
  block: Record<keyof TextBlock, Aggregate<unknown>>
  paragraph: Record<keyof TextParagraph, Aggregate<unknown>>
}

/** 可选字段规范化：未设置（undefined）→ null；无文本（content 缺失）保持 undefined 参与 none/mixed。 */
function fieldOf<K extends keyof TextStyle>(content: TextContent | undefined, key: K): unknown {
  if (content === undefined) return undefined
  return content.style[key] ?? null
}

/** 逐键聚合文本三段样式；contents 元素为 undefined（无文本节点）参与 mixed 判定。 */
export function aggregateTextStyles(contents: (TextContent | undefined)[]): AggregateTextStyles {
  const style = {} as Record<keyof TextStyle, Aggregate<unknown>>
  for (const key of TEXT_STYLE_KEYS) {
    style[key] = aggregateField(contents.map((c) => fieldOf(c, key)))
  }
  const block = {} as Record<keyof TextBlock, Aggregate<unknown>>
  for (const key of TEXT_BLOCK_KEYS) {
    block[key] = aggregateField(contents.map((c) => c?.block[key]))
  }
  const paragraph = {} as Record<keyof TextParagraph, Aggregate<unknown>>
  for (const key of TEXT_PARAGRAPH_KEYS) {
    paragraph[key] = aggregateField(contents.map((c) => c?.paragraph[key]))
  }
  return { style, block, paragraph }
}

/** 逐键聚合节点样式（可选字段未设置规范化为 null；shadow 等嵌套对象经 JSON 深等比较）。 */
export function aggregateNodeStyles(
  nodes: DiagramNode[],
): Record<keyof NodeStyle, Aggregate<unknown>> {
  const result = {} as Record<keyof NodeStyle, Aggregate<unknown>>
  for (const key of NODE_STYLE_KEYS) {
    result[key] = aggregateField(nodes.map((n) => n.style[key] ?? null))
  }
  return result
}

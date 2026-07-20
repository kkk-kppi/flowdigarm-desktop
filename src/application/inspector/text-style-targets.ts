// src/application/inspector/text-style-targets.ts
// 文本样式目标构建：属性面板与紧凑工具栏共用——
// 目标 = 选中节点 + 选中边首标签；before 逐目标取当前真实值（无文本节点取默认值）。
import { createDefaultTextContent, type DiagramPage, type TextContent } from '@/domain/diagram'
import type { TextTarget } from '@/application/commands/edit-text'
import type { TextStylePatch } from '@/application/commands/text-style-command'

export interface TextStyleTargetEntry {
  target: TextTarget
  before: TextStylePatch
  after: TextStylePatch
}

/** before 子补丁：仅取 patch 涉及的键，值取 current 当前真实值（面板样式写入共用）。 */
export function pickPatch<T extends object>(current: T, patch: Partial<T>): Partial<T> {
  const before: Partial<T> = {}
  for (const key of Object.keys(patch) as (keyof T)[]) {
    before[key] = current[key] as never
  }
  return before
}

/** before 补丁：仅含 patch 涉及的三段键，取内容当前真实值。 */
export function beforeTextPatchOf(content: TextContent, patch: TextStylePatch): TextStylePatch {
  return {
    ...(patch.style ? { style: pickPatch(content.style, patch.style) } : {}),
    ...(patch.block ? { block: pickPatch(content.block, patch.block) } : {}),
    ...(patch.paragraph ? { paragraph: pickPatch(content.paragraph, patch.paragraph) } : {}),
  }
}

/** 选中图元的文本内容序列（保选择序）：节点文本 + 有标签边的首标签文本。 */
export function textContentsForSelection(
  page: DiagramPage,
  selectedIds: string[],
): (TextContent | undefined)[] {
  const contents: (TextContent | undefined)[] = []
  for (const id of selectedIds) {
    const node = page.nodes.find((n) => n.id === id)
    if (node) {
      contents.push(node.text)
      continue
    }
    const edge = page.edges.find((e) => e.id === id)
    if (edge && edge.labels.length > 0) {
      contents.push(edge.labels[0].text)
    }
  }
  return contents
}

/** 构建文本样式命令目标：全部选中节点 + 选中边首标签；无文本节点以默认值作 before。 */
export function buildTextStyleTargets(
  page: DiagramPage,
  selectedIds: string[],
  patch: TextStylePatch,
): TextStyleTargetEntry[] {
  const targets: TextStyleTargetEntry[] = []
  for (const id of selectedIds) {
    const node = page.nodes.find((n) => n.id === id)
    if (node) {
      const content = node.text ?? createDefaultTextContent()
      targets.push({
        target: { kind: 'node', nodeId: id },
        before: beforeTextPatchOf(content, patch),
        after: patch,
      })
      continue
    }
    const edge = page.edges.find((e) => e.id === id)
    if (edge && edge.labels.length > 0) {
      targets.push({
        target: { kind: 'edgeLabel', edgeId: id, labelIndex: 0 },
        before: beforeTextPatchOf(edge.labels[0].text, patch),
        after: patch,
      })
    }
  }
  return targets
}

// src/application/commands/text-style-command.ts
// 文本样式命令：一次控件变更的全部目标合并为一条记录（撤销一次全部恢复）。
// style/block/paragraph 三段各自浅合并；node 无 text 时先建默认 TextContent 再合并。
// before 由调用方在执行前从文档读取真实值；构造时深拷贝入参，命令自含快照。
import {
  createDefaultTextContent,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  type TextBlock,
  type TextContent,
  type TextParagraph,
  type TextStyle,
} from '@/domain/diagram'
import type { EditorCommand } from './editor-command'
import type { TextTarget } from './edit-text'

export interface TextStylePatch {
  style?: Partial<TextStyle>
  block?: Partial<TextBlock>
  paragraph?: Partial<TextParagraph>
}

export interface TextStyleCommandInput {
  pageId: string
  targets: { target: TextTarget; before: TextStylePatch; after: TextStylePatch }[]
}

function mergePatch(content: TextContent, patch: TextStylePatch): TextContent {
  return {
    ...content,
    style: { ...content.style, ...patch.style },
    block: { ...content.block, ...patch.block },
    paragraph: { ...content.paragraph, ...patch.paragraph },
  }
}

export class TextStyleCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '文本样式'
  private readonly input: TextStyleCommandInput

  constructor(input: TextStyleCommandInput) {
    this.input = structuredClone(input)
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.patchAll(document, 'after')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.patchAll(document, 'before')
  }

  private patchAll(document: DiagramDocument, key: 'before' | 'after'): DiagramDocument {
    const { pageId, targets } = this.input
    if (targets.length === 0) return document
    const page = document.pages.find((p) => p.id === pageId)
    for (const { target } of targets) {
      const exists =
        target.kind === 'node'
          ? page?.nodes.some((n) => n.id === target.nodeId)
          : page?.edges.some((e) => e.id === target.edgeId && target.labelIndex < e.labels.length)
      if (!exists) {
        throw new Error('命令目标不存在。')
      }
    }
    const nodeTargets = new Map(
      targets
        .filter((t): t is typeof t & { target: Extract<TextTarget, { kind: 'node' }> } =>
          t.target.kind === 'node',
        )
        .map((t) => [t.target.nodeId, t]),
    )
    const edgeTargets = new Map<
      string,
      { target: Extract<TextTarget, { kind: 'edgeLabel' }>; before: TextStylePatch; after: TextStylePatch }[]
    >()
    for (const t of targets) {
      if (t.target.kind !== 'edgeLabel') continue
      const list = edgeTargets.get(t.target.edgeId) ?? []
      list.push(t as (typeof list)[number])
      edgeTargets.set(t.target.edgeId, list)
    }
    return {
      ...document,
      pages: document.pages.map((p) => {
        if (p.id !== pageId) return p
        return {
          ...p,
          nodes: p.nodes.map((node): DiagramNode => {
            const entry = nodeTargets.get(node.id)
            if (!entry) return node
            const content = node.text ?? createDefaultTextContent()
            return { ...node, text: mergePatch(content, entry[key]) }
          }),
          edges: p.edges.map((edge): DiagramEdge => {
            const entries = edgeTargets.get(edge.id)
            if (!entries) return edge
            let labels = edge.labels
            for (const entry of entries) {
              const target = entry.target as Extract<TextTarget, { kind: 'edgeLabel' }>
              labels = labels.map((label, index) =>
                index === target.labelIndex
                  ? { ...label, text: mergePatch(label.text, entry[key]) }
                  : label,
              )
            }
            return { ...edge, labels }
          }),
        }
      }),
    }
  }
}

// src/application/commands/edit-text.ts
// 编辑文本命令：一次编辑会话一条记录（详细设计 §13）。
// before 必须等于执行时文档真实值（调用方负责从文档读取，命令不猜测）。
// 构造时校验长度并深拷贝入参，命令自含快照。
import {
  createDefaultTextContent,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
} from '@/domain/diagram'
import { MAX_TEXT_LENGTH } from '@/domain/limits'
import type { EditorCommand } from './editor-command'

export type TextTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'edgeLabel'; edgeId: string; labelIndex: number }

export interface EditTextInput {
  pageId: string
  target: TextTarget
  before: string
  after: string
}

export class EditTextCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '编辑文本'
  private readonly input: EditTextInput

  constructor(input: EditTextInput) {
    if (input.after.length > MAX_TEXT_LENGTH) {
      throw new Error('文本长度超出限制。')
    }
    this.input = { ...input, target: { ...input.target } }
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.write(document, this.input.after, 'apply')
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.write(document, this.input.before, 'revert')
  }

  private write(
    document: DiagramDocument,
    value: string,
    mode: 'apply' | 'revert',
  ): DiagramDocument {
    if (this.input.target.kind === 'node') {
      return this.writeNode(document, value)
    }
    return this.writeEdgeLabel(document, value, mode)
  }

  private writeNode(document: DiagramDocument, value: string): DiagramDocument {
    const target = this.input.target as Extract<TextTarget, { kind: 'node' }>
    const page = document.pages.find((p) => p.id === this.input.pageId)
    if (!page || !page.nodes.some((n) => n.id === target.nodeId)) {
      throw new Error('命令目标不存在。')
    }
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.input.pageId
          ? {
              ...p,
              nodes: p.nodes.map((node): DiagramNode => {
                if (node.id !== target.nodeId) return node
                const text = node.text ?? createDefaultTextContent()
                return { ...node, text: { ...text, value } }
              }),
            }
          : p,
      ),
    }
  }

  private writeEdgeLabel(
    document: DiagramDocument,
    value: string,
    mode: 'apply' | 'revert',
  ): DiagramDocument {
    const target = this.input.target as Extract<TextTarget, { kind: 'edgeLabel' }>
    const page = document.pages.find((p) => p.id === this.input.pageId)
    const edge = page?.edges.find((e) => e.id === target.edgeId)
    if (!page || !edge || target.labelIndex > edge.labels.length) {
      throw new Error('命令目标不存在。')
    }
    // apply 时 labelIndex === labels.length → 追加新标签；revert 时该新增标签位于末尾，
    // 判定规则（before === '' 且指向末位）将其移除。退化情形（编辑既有空文本末位标签）
    // 撤销会丢弃该空标签，与实际编辑流（会话不产生空值命令）不冲突。
    const removesAppended =
      mode === 'revert' &&
      this.input.before === '' &&
      target.labelIndex === edge.labels.length - 1
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.input.pageId
          ? {
              ...p,
              edges: p.edges.map((item): DiagramEdge => {
                if (item.id !== target.edgeId) return item
                if (removesAppended) {
                  return { ...item, labels: item.labels.slice(0, target.labelIndex) }
                }
                if (mode === 'apply' && target.labelIndex === item.labels.length) {
                  return {
                    ...item,
                    labels: [
                      ...item.labels,
                      { text: createDefaultTextContent(value), position: 0.5 },
                    ],
                  }
                }
                return {
                  ...item,
                  labels: item.labels.map((label, index) =>
                    index === target.labelIndex
                      ? { ...label, text: { ...label.text, value } }
                      : label,
                  ),
                }
              }),
            }
          : p,
      ),
    }
  }
}

// src/application/commands/update-edge-connector.ts
// 连线类型命令：一次变更全部选中边合并为一条记录；before 逐边快照，撤销逐边恢复。
import type { ConnectorKind, DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export interface UpdateEdgeConnectorInput {
  pageId: string
  edgeIds: string[]
  /** 逐边变更前连接类型，与 edgeIds 等长同序（调用方从文档读取真实值）。 */
  before: ConnectorKind[]
  after: ConnectorKind
}

export class UpdateEdgeConnectorCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '连线类型'
  private readonly input: UpdateEdgeConnectorInput

  constructor(input: UpdateEdgeConnectorInput) {
    if (input.edgeIds.length !== input.before.length) {
      throw new Error('连线类型命令输入无效：before 与 edgeIds 长度不一致。')
    }
    this.input = { ...input, edgeIds: [...input.edgeIds], before: [...input.before] }
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.write(document, () => this.input.after)
  }

  revert(document: DiagramDocument): DiagramDocument {
    const beforeById = new Map(
      this.input.edgeIds.map((id, index) => [id, this.input.before[index]] as const),
    )
    return this.write(document, (edgeId) => beforeById.get(edgeId) ?? this.input.after)
  }

  private write(
    document: DiagramDocument,
    connectorOf: (edgeId: string) => ConnectorKind,
  ): DiagramDocument {
    if (this.input.edgeIds.length === 0) return document
    const page = document.pages.find((p) => p.id === this.input.pageId)
    for (const edgeId of this.input.edgeIds) {
      if (!page || !page.edges.some((e) => e.id === edgeId)) {
        throw new Error('命令目标不存在。')
      }
    }
    const ids = new Set(this.input.edgeIds)
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.input.pageId
          ? {
              ...p,
              edges: p.edges.map((edge) =>
                ids.has(edge.id) ? { ...edge, connector: connectorOf(edge.id) } : edge,
              ),
            }
          : p,
      ),
    }
  }
}

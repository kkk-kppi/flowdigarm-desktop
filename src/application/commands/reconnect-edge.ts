// src/application/commands/reconnect-edge.ts
// 重新连接命令：一次重连手势（拖动边端点到新节点/端口）一条记录；命令只写端点值。
import type { DiagramDocument, DiagramEdge } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export type EdgeEndpoint = DiagramEdge['source'] // { nodeId: string; port?: string }

export interface ReconnectEdgeInput {
  pageId: string
  edgeId: string
  end: 'source' | 'target'
  before: EdgeEndpoint
  after: EdgeEndpoint
}

export class ReconnectEdgeCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '重新连接'
  private readonly input: ReconnectEdgeInput

  constructor(input: ReconnectEdgeInput) {
    this.input = structuredClone(input)
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.reconnect(document, this.input.after)
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.reconnect(document, this.input.before)
  }

  private reconnect(document: DiagramDocument, endpoint: EdgeEndpoint): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.input.pageId)
    if (!page || !page.edges.some((e) => e.id === this.input.edgeId)) {
      throw new Error('命令目标不存在。')
    }
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.input.pageId
          ? {
              ...p,
              edges: p.edges.map((edge) =>
                edge.id === this.input.edgeId
                  ? { ...edge, [this.input.end]: { ...endpoint } }
                  : edge,
              ),
            }
          : p,
      ),
    }
  }
}

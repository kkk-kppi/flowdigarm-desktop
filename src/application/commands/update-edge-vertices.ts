// src/application/commands/update-edge-vertices.ts
// 编辑拐点命令：一次拐点手势（拖动/添加/删除拐点）一条记录；写入深拷贝，外部修改不影响命令。
import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export interface EdgeVerticesInput {
  pageId: string
  edgeId: string
  before: { x: number; y: number }[]
  after: { x: number; y: number }[]
}

export class UpdateEdgeVerticesCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '编辑拐点'
  private readonly input: EdgeVerticesInput

  constructor(input: EdgeVerticesInput) {
    this.input = structuredClone(input)
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.writeVertices(document, this.input.after)
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.writeVertices(document, this.input.before)
  }

  private writeVertices(
    document: DiagramDocument,
    vertices: { x: number; y: number }[],
  ): DiagramDocument {
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
                  ? { ...edge, vertices: vertices.map((v) => ({ ...v })) }
                  : edge,
              ),
            }
          : p,
      ),
    }
  }
}

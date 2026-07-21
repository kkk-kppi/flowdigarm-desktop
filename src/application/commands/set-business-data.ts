import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export interface SetBusinessDataInput {
  pageId: string
  nodeId: string
  before: Record<string, unknown> | undefined
  after: Record<string, unknown>
}

export class SetBusinessDataCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '业务数据'
  private readonly input: SetBusinessDataInput

  constructor(input: SetBusinessDataInput) {
    this.input = {
      ...input,
      before: input.before === undefined ? undefined : structuredClone(input.before),
      after: structuredClone(input.after),
    }
  }

  apply(document: DiagramDocument): DiagramDocument {
    return this.write(document, this.input.after)
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.write(document, this.input.before)
  }

  private write(
    document: DiagramDocument,
    data: Record<string, unknown> | undefined,
  ): DiagramDocument {
    const page = document.pages.find((candidate) => candidate.id === this.input.pageId)
    if (!page?.nodes.some((node) => node.id === this.input.nodeId)) {
      throw new Error('命令目标不存在。')
    }
    return {
      ...document,
      pages: document.pages.map((candidate) =>
        candidate.id === this.input.pageId
          ? {
              ...candidate,
              nodes: candidate.nodes.map((node) =>
                node.id === this.input.nodeId
                  ? {
                      ...node,
                      data: data === undefined ? undefined : structuredClone(data),
                    }
                  : node,
              ),
            }
          : candidate,
      ),
    }
  }
}

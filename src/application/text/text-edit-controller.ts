import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { EditTextCommand } from '@/application/commands/edit-text'
import type { TextTarget } from './text-target'

export class TextEditController {
  constructor(
    private readonly getDocument: () => DiagramDocument,
    private readonly execute: (command: EditorCommand) => void,
  ) {}

  commit(
    pageId: string,
    target: TextTarget,
    before: string,
    after: string,
    expectedDocument: DiagramDocument,
  ): void {
    const document = this.getDocument()
    if (document !== expectedDocument) {
      throw new Error('文档已发生变化，请重新编辑。')
    }
    const page = document.pages.find(({ id }) => id === pageId)
    const current = target.kind === 'node'
      ? page?.nodes.find(({ id }) => id === target.nodeId)?.text?.value ?? ''
      : page?.edges.find(({ id }) => id === target.edgeId)?.labels[target.labelIndex]?.text.value ?? ''
    if (current !== before) {
      throw new Error('文本已被其他操作修改，请重新编辑。')
    }
    const edgeLabelBefore = target.kind === 'edgeLabel'
      ? page?.edges.find(({ id }) => id === target.edgeId)?.labels[target.labelIndex]
      : undefined
    this.execute(new EditTextCommand(target.kind === 'edgeLabel'
      ? {
          pageId, target,
          edgeLabelBefore: edgeLabelBefore ? structuredClone(edgeLabelBefore) : null,
          before, after,
        }
      : { pageId, target, before, after }))
  }
}

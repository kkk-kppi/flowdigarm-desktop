import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { EditTextCommand } from '@/application/commands/edit-text'
import type { TextTarget } from './text-target'

export class TextEditController {
  constructor(
    private readonly getDocument: () => DiagramDocument,
    private readonly execute: (command: EditorCommand) => void,
  ) {}

  commit(pageId: string, target: TextTarget, before: string, after: string): void {
    const edgeLabelBefore = target.kind === 'edgeLabel'
      ? this.getDocument().pages.find(({ id }) => id === pageId)
        ?.edges.find(({ id }) => id === target.edgeId)?.labels[target.labelIndex]
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

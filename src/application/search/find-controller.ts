import type { DiagramDocument } from '@/domain/diagram'
import { EditTextCommand, type TextTarget } from '@/application/commands/edit-text'
import type { EditorCommand } from '@/application/commands/editor-command'
import { createReplaceAllTextCommand } from '@/application/commands/replace-all-text'
import { findText, type FindMatch, type FindTextRequest } from './find-text'

export interface ReplaceAllPreview {
  count: number
  matches: FindMatch[]
}

interface FindControllerDependencies {
  getDocument(): DiagramDocument
  executeCommand(command: EditorCommand): void
  activateMatch(match: FindMatch): void
}

export class FindController {
  private request: FindTextRequest | null = null
  private matches: FindMatch[] = []
  private currentIndex = -1
  private pendingReplacement: string | null = null

  constructor(private readonly dependencies: FindControllerDependencies) {}

  search(request: FindTextRequest): FindMatch[] {
    this.request = { ...request }
    this.matches = findText(this.dependencies.getDocument(), request)
    this.currentIndex = -1
    this.pendingReplacement = null
    return [...this.matches]
  }

  next(): FindMatch | null {
    if (this.matches.length === 0) return null
    this.currentIndex = (this.currentIndex + 1) % this.matches.length
    const match = this.matches[this.currentIndex]
    this.dependencies.activateMatch(match)
    return match
  }

  replaceCurrent(replacement: string): boolean {
    const match = this.matches[this.currentIndex]
    if (!match || !this.request) return false
    const target: TextTarget = match.field === 'nodeText'
      ? { kind: 'node', nodeId: match.cellId }
      : { kind: 'edgeLabel', edgeId: match.cellId, labelIndex: match.labelIndex! }
    const after = `${match.value.slice(0, match.start)}${replacement}${match.value.slice(match.end)}`
    this.dependencies.executeCommand(new EditTextCommand({
      pageId: match.pageId,
      target,
      before: match.value,
      after,
    }))
    this.search(this.request)
    return true
  }

  replaceAll(replacement: string): ReplaceAllPreview {
    this.pendingReplacement = replacement
    return { count: this.matches.length, matches: [...this.matches] }
  }

  confirmReplaceAll(): number {
    if (!this.request || this.pendingReplacement === null) return 0
    const command = createReplaceAllTextCommand(
      this.dependencies.getDocument(),
      this.request,
      this.pendingReplacement,
    )
    this.pendingReplacement = null
    if (!command) return 0
    this.dependencies.executeCommand(command)
    const count = command.count
    this.search(this.request)
    return count
  }
}

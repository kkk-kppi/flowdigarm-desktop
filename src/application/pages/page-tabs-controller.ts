import type { DiagramDocument, DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { AddPageCommand } from '@/application/commands/add-page'
import { RemovePageCommand } from '@/application/commands/remove-page'
import { RenamePageCommand } from '@/application/commands/rename-page'

export class PageTabsController {
  constructor(private readonly dependencies: {
    getDocument(): DiagramDocument
    getActivePageId(): string
    execute(command: EditorCommand): void
    switchPage(pageId: string): void
  }) {}

  rename(page: DiagramPage, name: string): void {
    if (!name || name === page.name) return
    this.dependencies.execute(new RenamePageCommand({ pageId: page.id, before: page.name, after: name }))
  }

  remove(pageId: string): void {
    const document = this.dependencies.getDocument()
    if (this.dependencies.getActivePageId() === pageId) {
      const fallback = document.pages.find((page) => page.id !== pageId)
      if (fallback) this.dependencies.switchPage(fallback.id)
    }
    this.dependencies.execute(new RemovePageCommand({ pageId, document }))
  }

  add(): void {
    const command = new AddPageCommand({})
    this.dependencies.execute(command)
    this.dependencies.switchPage(command.pageId)
  }
}

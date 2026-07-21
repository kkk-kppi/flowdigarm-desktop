import type { DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import { createFitPageCommand } from '@/application/commands/fit-page-to-content'
import {
  pageSettingsEqual,
  pageSettingsSnapshotOf,
  UpdatePageCommand,
  type PageSettingsSnapshot,
} from '@/application/commands/update-page'

export class PageSetupController {
  constructor(private readonly execute: (command: EditorCommand) => void) {}

  canFit(page: DiagramPage | undefined): boolean {
    return page ? createFitPageCommand(page) !== null : false
  }

  fit(page: DiagramPage): boolean {
    const command = createFitPageCommand(page)
    if (!command) return false
    this.execute(command)
    return true
  }

  apply(page: DiagramPage, after: PageSettingsSnapshot): boolean {
    const before = pageSettingsSnapshotOf(page)
    if (pageSettingsEqual(before, after)) return false
    this.execute(new UpdatePageCommand({ pageId: page.id, before, after }))
    return true
  }
}

export type { PageSettingsSnapshot }

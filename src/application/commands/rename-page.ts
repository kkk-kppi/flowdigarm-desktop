// src/application/commands/rename-page.ts
// 重命名页面命令：页签行内编辑一次提交产生一条记录；空名/纯空白拒绝。
import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export class RenamePageCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '重命名页面'

  constructor(
    private readonly input: { pageId: string; before: string; after: string },
  ) {}

  apply(document: DiagramDocument): DiagramDocument {
    if (this.input.after.trim().length === 0) {
      throw new Error('页面名称不能为空。')
    }
    return this.writeName(document, this.input.after)
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.writeName(document, this.input.before)
  }

  private writeName(document: DiagramDocument, name: string): DiagramDocument {
    if (!document.pages.some((page) => page.id === this.input.pageId)) {
      throw new Error('命令目标不存在。')
    }
    return {
      ...document,
      pages: document.pages.map((page) =>
        page.id === this.input.pageId ? { ...page, name } : page,
      ),
    }
  }
}

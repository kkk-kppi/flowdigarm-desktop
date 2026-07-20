// src/application/commands/add-page.ts
// 新建页面命令：默认前景页、A4；未指定名称时自动「页面 N」递增不重名。
// 页面 id 在构造时生成，保证 undo 后 redo 仍得到同一 id。
import { createEmptyPage, type DiagramDocument, type DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

/** 递增查找未被占用的「页面 N」名称（N 从 1 开始取最小可用值）。 */
function nextAvailableName(document: DiagramDocument): string {
  const used = new Set(document.pages.map((page) => page.name))
  let n = 1
  while (used.has(`页面 ${n}`)) {
    n += 1
  }
  return `页面 ${n}`
}

export class AddPageCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '新建页面'
  /** 新页 id（构造时固定），供调用方在执行后切换活动页。 */
  readonly pageId: string

  private readonly page: DiagramPage
  private readonly index?: number
  private readonly autoName: boolean

  constructor(input: { page?: Partial<DiagramPage>; index?: number }) {
    this.pageId = input.page?.id ?? crypto.randomUUID()
    this.page = createEmptyPage({ ...input.page, id: this.pageId })
    this.index = input.index
    this.autoName = input.page?.name === undefined
  }

  apply(document: DiagramDocument): DiagramDocument {
    const page: DiagramPage = this.autoName
      ? { ...this.page, name: nextAvailableName(document) }
      : this.page
    const index = Math.min(this.index ?? document.pages.length, document.pages.length)
    const pages = [...document.pages]
    pages.splice(index, 0, page)
    return { ...document, pages }
  }

  revert(document: DiagramDocument): DiagramDocument {
    return {
      ...document,
      pages: document.pages.filter((page) => page.id !== this.pageId),
    }
  }
}

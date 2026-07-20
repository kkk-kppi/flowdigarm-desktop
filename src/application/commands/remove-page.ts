// src/application/commands/remove-page.ts
// 删除页面命令：构造时深拷贝页面快照与原索引，revert 在原位置完整恢复。
// 深拷贝用 JSON 序列化（领域对象为纯 JSON；兼容调用方传入的响应式代理文档）。
import type { DiagramDocument, DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

function deepClonePage(page: DiagramPage): DiagramPage {
  return JSON.parse(JSON.stringify(page)) as DiagramPage
}

export class RemovePageCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '删除页面'

  private readonly pageId: string
  private readonly snapshot: DiagramPage
  private readonly index: number

  constructor(input: { pageId: string; document: DiagramDocument }) {
    const index = input.document.pages.findIndex((page) => page.id === input.pageId)
    if (index < 0) {
      throw new Error('命令目标不存在。')
    }
    this.pageId = input.pageId
    this.snapshot = deepClonePage(input.document.pages[index])
    this.index = index
  }

  apply(document: DiagramDocument): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.pageId)
    if (!page) {
      throw new Error('命令目标不存在。')
    }
    if (document.pages.length <= 1) {
      throw new Error('至少保留一个页面。')
    }
    const referenced = document.pages.some(
      (p) => p.id !== this.pageId && p.backgroundPageId === this.pageId,
    )
    if (referenced) {
      throw new Error('该页面被引用为背景页，无法删除。')
    }
    return {
      ...document,
      pages: document.pages.filter((p) => p.id !== this.pageId),
    }
  }

  revert(document: DiagramDocument): DiagramDocument {
    const pages = [...document.pages]
    pages.splice(Math.min(this.index, pages.length), 0, deepClonePage(this.snapshot))
    return { ...document, pages }
  }
}

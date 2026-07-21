// src/application/pages/page-manager.ts
// 多页面管理器：活动页切换（视图行为，不产生命令）、每页独立命令栈与视口控制器（惰性创建）。
// 纯 TS 类，不依赖 Pinia/Vue；文档被命令替换后由调用方调 syncFromDocument 对齐。
import type { DiagramDocument } from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import { ViewportController } from '@/application/viewport/viewport-controller'

export class PageManager {
  private activeId: string
  private pageIds: Set<string>
  private readonly histories = new Map<string, CommandHistory>()
  private readonly controllers = new Map<string, ViewportController>()

  constructor(document: DiagramDocument, private defaultZoom = 1) {
    this.pageIds = new Set(document.pages.map((page) => page.id))
    this.activeId = document.pages[0]?.id ?? ''
  }

  get activePageId(): string {
    return this.activeId
  }

  /** 切换活动页：纯视图行为，不产生命令、不进入任何历史。 */
  setActivePage(pageId: string): void {
    if (!this.pageIds.has(pageId)) {
      throw new Error('页面不存在。')
    }
    this.activeId = pageId
  }

  /** 每页独立命令栈（惰性创建，同一页幂等返回同一实例）。 */
  historyFor(pageId: string): CommandHistory {
    let history = this.histories.get(pageId)
    if (!history) {
      history = new CommandHistory()
      this.histories.set(pageId, history)
    }
    return history
  }

  /** 每页独立视口控制器（惰性创建，初始 zoom 取持久化默认值；pan 居中由 UI 首次 fit 决定）。 */
  controllerFor(pageId: string): ViewportController {
    let controller = this.controllers.get(pageId)
    if (!controller) {
      controller = new ViewportController({ zoom: this.defaultZoom })
      this.controllers.set(pageId, controller)
    }
    return controller
  }

  /** 修改尚未访问页面创建视口时采用的初始缩放。 */
  setDefaultZoom(zoom: number): void {
    this.defaultZoom = zoom
  }

  /** 文档替换后对齐：清理已不存在页的栈/视口；活动页失效时回退第一页。 */
  syncFromDocument(document: DiagramDocument): void {
    this.pageIds = new Set(document.pages.map((page) => page.id))
    for (const id of [...this.histories.keys()]) {
      if (!this.pageIds.has(id)) {
        this.histories.delete(id)
      }
    }
    for (const id of [...this.controllers.keys()]) {
      if (!this.pageIds.has(id)) {
        this.controllers.delete(id)
      }
    }
    if (!this.pageIds.has(this.activeId)) {
      this.activeId = document.pages[0]?.id ?? ''
    }
  }
}

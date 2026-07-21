// tests/unit/editor/pages/page-manager.test.ts
// PageManager：多页活动页、每页独立命令栈与视口控制器；纯 TS 类，不依赖 Pinia/Vue。
import { PageManager } from '@/application/pages/page-manager'
import { CommandHistory } from '@/application/commands/command-history'
import { ViewportController } from '@/application/viewport/viewport-controller'
import { RenamePageCommand } from '@/application/commands/rename-page'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'

function twoPageDocument(): DiagramDocument {
  return {
    ...createEmptyDocument(),
    pages: [
      createEmptyPage({ id: 'page-a', name: '页面 1' }),
      createEmptyPage({ id: 'page-b', name: '页面 2' }),
    ],
  }
}

describe('PageManager', () => {
  it('构造时活动页为第一页', () => {
    const manager = new PageManager(twoPageDocument())
    expect(manager.activePageId).toBe('page-a')
  })

  it('setActivePage 切换活动页（视图行为，不产生命令）；未知页抛「页面不存在。」', () => {
    const manager = new PageManager(twoPageDocument())
    manager.setActivePage('page-b')
    expect(manager.activePageId).toBe('page-b')
    expect(() => manager.setActivePage('missing')).toThrow('页面不存在。')
  })

  it('historyFor 惰性创建且幂等返回同一实例', () => {
    const manager = new PageManager(twoPageDocument())
    const history = manager.historyFor('page-a')
    expect(history).toBeInstanceOf(CommandHistory)
    expect(manager.historyFor('page-a')).toBe(history)
  })

  it('每页独立 CommandHistory：A 页执行命令不影响 B 页 canUndo', () => {
    const document = twoPageDocument()
    const manager = new PageManager(document)
    const historyA = manager.historyFor('page-a')
    const historyB = manager.historyFor('page-b')
    historyA.execute(
      new RenamePageCommand({ pageId: 'page-a', before: '页面 1', after: '首页' }),
      document,
    )
    expect(historyA.canUndo).toBe(true)
    expect(historyB.canUndo).toBe(false)
  })

  it('controllerFor 惰性创建且幂等返回同一实例', () => {
    const manager = new PageManager(twoPageDocument())
    const controller = manager.controllerFor('page-a')
    expect(controller).toBeInstanceOf(ViewportController)
    expect(controller.state).toEqual({ zoom: 1, panX: 0, panY: 0 })
    expect(manager.controllerFor('page-a')).toBe(controller)
  })

  it('uses the configured default zoom for every lazily-created page viewport', () => {
    const manager = new PageManager(twoPageDocument(), 1.75)
    expect(manager.controllerFor('page-a').state.zoom).toBe(1.75)
    expect(manager.controllerFor('page-b').state.zoom).toBe(1.75)
  })

  it('syncFromDocument 清理已不存在页的命令栈与视口', () => {
    const document = twoPageDocument()
    const manager = new PageManager(document)
    const historyB = manager.historyFor('page-b')
    const controllerB = manager.controllerFor('page-b')
    historyB.execute(
      new RenamePageCommand({ pageId: 'page-b', before: '页面 2', after: '次页' }),
      document,
    )
    controllerB.setZoom(2)

    const reduced: DiagramDocument = { ...document, pages: [document.pages[0]] }
    manager.syncFromDocument(reduced)

    // 再次获取得到的是全新空栈/默认视口（旧实例已被清理）
    expect(manager.historyFor('page-b')).not.toBe(historyB)
    expect(manager.historyFor('page-b').canUndo).toBe(false)
    expect(manager.controllerFor('page-b')).not.toBe(controllerB)
    expect(manager.controllerFor('page-b').state.zoom).toBe(1)
  })

  it('syncFromDocument 后活动页失效时回退第一页', () => {
    const document = twoPageDocument()
    const manager = new PageManager(document)
    manager.setActivePage('page-b')
    manager.syncFromDocument({ ...document, pages: [document.pages[0]] })
    expect(manager.activePageId).toBe('page-a')
  })

  it('syncFromDocument 保留仍存在页的命令栈', () => {
    const document = twoPageDocument()
    const manager = new PageManager(document)
    const historyA = manager.historyFor('page-a')
    historyA.execute(
      new RenamePageCommand({ pageId: 'page-a', before: '页面 1', after: '首页' }),
      document,
    )
    manager.syncFromDocument({ ...document, pages: [document.pages[0]] })
    expect(manager.historyFor('page-a')).toBe(historyA)
    expect(manager.historyFor('page-a').canUndo).toBe(true)
  })
})

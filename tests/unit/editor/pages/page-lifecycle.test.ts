// tests/unit/editor/pages/page-lifecycle.test.ts
// 页面生命周期三命令：新建（AddPageCommand）、删除（RemovePageCommand）、重命名（RenamePageCommand）。
import { AddPageCommand } from '@/application/commands/add-page'
import { RemovePageCommand } from '@/application/commands/remove-page'
import { RenamePageCommand } from '@/application/commands/rename-page'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

describe('AddPageCommand', () => {
  it('apply 新增默认前景页（A4），revert 删除该页；redo 保持同一页面 id', () => {
    const document = createTestDocument()
    const command = new AddPageCommand({})
    expect(command.label).toBe('新建页面')

    const next = command.apply(document)
    expect(next.pages).toHaveLength(2)
    const added = next.pages[1]
    expect(added.type).toBe('foreground')
    expect(added.pageSize.preset).toBe('a4')
    expect(added.nodes).toEqual([])

    const reverted = command.revert(next)
    expect(reverted.pages).toHaveLength(1)
    expect(reverted.pages[0].id).toBe('page-1')

    const redone = command.apply(reverted)
    expect(redone.pages[1].id).toBe(added.id)
  })

  it('名称自动「页面 N」递增且不重名（跳过已占用名称）', () => {
    const base = createTestDocument() // 已有页名「流程页」
    const first = new AddPageCommand({}).apply(base)
    expect(first.pages[1].name).toBe('页面 1')
    const second = new AddPageCommand({}).apply(first)
    expect(second.pages[2].name).toBe('页面 2')

    const withGap: DiagramDocument = {
      ...createEmptyDocument(),
      pages: [
        createEmptyPage({ id: 'p1', name: '页面 1' }),
        createEmptyPage({ id: 'p3', name: '页面 3' }),
      ],
    }
    const filled = new AddPageCommand({}).apply(withGap)
    expect(filled.pages[2].name).toBe('页面 2')
  })

  it('支持指定名称与插入位置（背景页经 partial 指定）', () => {
    const document = createTestDocument()
    const command = new AddPageCommand({
      page: { name: '通用背景', type: 'background' },
      index: 0,
    })
    const next = command.apply(document)
    expect(next.pages[0].name).toBe('通用背景')
    expect(next.pages[0].type).toBe('background')
    expect(next.pages[1].id).toBe('page-1')
  })
})

describe('RemovePageCommand', () => {
  it('apply 删除页面，revert 在原索引恢复完整页面快照', () => {
    const base = createTestDocument()
    const richPage = createEmptyPage({
      id: 'rich',
      name: '富页面',
      nodes: [createTestNode({ id: 'n-1', x: 36, y: 48 })],
    })
    const document: DiagramDocument = { ...base, pages: [richPage, ...base.pages] }
    const command = new RemovePageCommand({ pageId: 'rich', document })
    expect(command.label).toBe('删除页面')

    const next = command.apply(document)
    expect(next.pages).toHaveLength(1)
    expect(next.pages[0].id).toBe('page-1')

    const reverted = command.revert(next)
    expect(reverted.pages).toHaveLength(2)
    expect(reverted.pages[0]).toEqual(richPage)
    // 深拷贝快照：恢复出的页面不是原文档页面对象本身
    expect(reverted.pages[0]).not.toBe(richPage)
  })

  it('仅剩一页时 apply 抛「至少保留一个页面。」', () => {
    const document = createTestDocument()
    const command = new RemovePageCommand({ pageId: 'page-1', document })
    expect(() => command.apply(document)).toThrow('至少保留一个页面。')
  })

  it('删除页被其他页引用为背景页时抛「该页面被引用为背景页，无法删除。」', () => {
    const base = createTestDocument()
    const background = createEmptyPage({ id: 'bg-1', name: '背景页', type: 'background' })
    const foreground = createEmptyPage({ id: 'fg-2', name: '引用页', backgroundPageId: 'bg-1' })
    const document: DiagramDocument = { ...base, pages: [...base.pages, background, foreground] }
    const command = new RemovePageCommand({ pageId: 'bg-1', document })
    expect(() => command.apply(document)).toThrow('该页面被引用为背景页，无法删除。')
  })

  it('构造时目标页不存在抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    expect(() => new RemovePageCommand({ pageId: 'missing', document })).toThrow('命令目标不存在。')
  })
})

describe('RenamePageCommand', () => {
  it('apply 重命名，revert 恢复原名', () => {
    const document = createTestDocument()
    const command = new RenamePageCommand({ pageId: 'page-1', before: '流程页', after: '主流程' })
    expect(command.label).toBe('重命名页面')

    const next = command.apply(document)
    expect(next.pages[0].name).toBe('主流程')
    expect(command.revert(next).pages[0].name).toBe('流程页')
  })

  it.each(['', '   ', '　'])('名称为空或纯空白（%j）时 apply 抛「页面名称不能为空。」', (name) => {
    const document = createTestDocument()
    const command = new RenamePageCommand({ pageId: 'page-1', before: '流程页', after: name })
    expect(() => command.apply(document)).toThrow('页面名称不能为空。')
  })

  it('目标页不存在时抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const command = new RenamePageCommand({ pageId: 'missing', before: '甲', after: '乙' })
    expect(() => command.apply(document)).toThrow('命令目标不存在。')
  })
})

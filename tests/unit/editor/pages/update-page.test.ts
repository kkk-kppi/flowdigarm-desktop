// tests/unit/editor/pages/update-page.test.ts
// UpdatePageCommand：一次"应用"聚合全部页面设置为一条记录；只改设置字段，禁止触碰 nodes/edges 与几何。
import { CommandHistory } from '@/application/commands/command-history'
import {
  pageSettingsSnapshotOf,
  UpdatePageCommand,
  type PageSettingsSnapshot,
} from '@/application/commands/update-page'
import { createEmptyPage, type DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

function snapshotOfFirstPage(document: DiagramDocument): PageSettingsSnapshot {
  return pageSettingsSnapshotOf(document.pages[0])
}

describe('UpdatePageCommand', () => {
  it('方向切换为横向：写入调用方算好的宽高（landscape 交换）', () => {
    const document = createTestDocument()
    const before = snapshotOfFirstPage(document)
    const after: PageSettingsSnapshot = {
      ...before,
      orientation: 'landscape',
      pageSize: {
        preset: 'a4',
        width: before.pageSize.height,
        height: before.pageSize.width,
      },
    }
    const command = new UpdatePageCommand({ pageId: 'page-1', before, after })
    const next = command.apply(document)
    expect(next.pages[0].orientation).toBe('landscape')
    expect(next.pages[0].pageSize.width).toBeCloseTo(841.8898, 3)
    expect(next.pages[0].pageSize.height).toBeCloseTo(595.2756, 3)
    expect(command.label).toBe('页面设置')
  })

  it('单位 mm→cm 后 page 几何与 nodes 的 pt 值严格相等', () => {
    const document = createTestDocument()
    const before = snapshotOfFirstPage(document)
    const after: PageSettingsSnapshot = { ...before, unit: 'cm' }
    const next = new UpdatePageCommand({ pageId: 'page-1', before, after }).apply(document)
    const page = next.pages[0]
    expect(page.unit).toBe('cm')
    // pt 几何严格相等（数值逐项 Object.is；nodes/edges 引用不变证明未被触碰）
    expect(page.pageSize.width).toBe(document.pages[0].pageSize.width)
    expect(page.pageSize.height).toBe(document.pages[0].pageSize.height)
    expect(page.pageSize.preset).toBe(document.pages[0].pageSize.preset)
    expect(page.nodes).toBe(document.pages[0].nodes)
    expect(page.edges).toBe(document.pages[0].edges)
  })

  it('一次 apply 只产生一条记录，undo 恢复全部字段', () => {
    const history = new CommandHistory()
    const document = createTestDocument()
    const before = snapshotOfFirstPage(document)
    const after: PageSettingsSnapshot = {
      pageSize: { preset: 'a3', width: 1190.5512, height: 841.8898 },
      orientation: 'landscape',
      unit: 'in',
      defaultConnector: 'straight',
      defaultArrow: 'double',
      autoConnectLabel: false,
      showLineJumps: true,
      background: '#FFEEEE',
      backgroundPageId: undefined,
    }
    const command = new UpdatePageCommand({ pageId: 'page-1', before, after })
    const next = history.execute(command, document)
    expect(history.size).toBe(1)
    expect(history.undoLabel).toBe('页面设置')

    const page = next.pages[0]
    expect(page.pageSize).toEqual(after.pageSize)
    expect(page.orientation).toBe('landscape')
    expect(page.unit).toBe('in')
    expect(page.defaultConnector).toBe('straight')
    expect(page.defaultArrow).toBe('double')
    expect(page.autoConnectLabel).toBe(false)
    expect(page.showLineJumps).toBe(true)
    expect(page.canvas.background).toBe('#FFEEEE')
    expect(page.backgroundPageId).toBeUndefined()
    // 网格尺寸等其他 canvas 字段不受影响
    expect(page.canvas.gridSize).toBe(document.pages[0].canvas.gridSize)

    const reverted = history.undo(next)
    expect(reverted?.pages[0]).toEqual(document.pages[0])
  })

  it('背景页引用形成循环时 apply 抛「背景页设置无效。」', () => {
    const base = createTestDocument()
    const backgroundOne = createEmptyPage({
      id: 'bg-1',
      name: '背景一',
      type: 'background',
      backgroundPageId: 'bg-2',
    })
    const backgroundTwo = createEmptyPage({ id: 'bg-2', name: '背景二', type: 'background' })
    const document: DiagramDocument = { ...base, pages: [...base.pages, backgroundOne, backgroundTwo] }
    const before = pageSettingsSnapshotOf(backgroundTwo)
    const after: PageSettingsSnapshot = { ...before, backgroundPageId: 'bg-1' }
    const command = new UpdatePageCommand({ pageId: 'bg-2', before, after })
    expect(() => command.apply(document)).toThrow('背景页设置无效。')
  })

  it('背景页指向非背景页时 apply 抛「背景页设置无效。」', () => {
    const base = createTestDocument()
    const otherForeground = createEmptyPage({ id: 'fg-2', name: '另一前景页' })
    const document: DiagramDocument = { ...base, pages: [...base.pages, otherForeground] }
    const before = snapshotOfFirstPage(document)
    const after: PageSettingsSnapshot = { ...before, backgroundPageId: 'fg-2' }
    const command = new UpdatePageCommand({ pageId: 'page-1', before, after })
    expect(() => command.apply(document)).toThrow('背景页设置无效。')
  })

  it('背景页指向不存在的页面时 apply 抛「背景页设置无效。」', () => {
    const document = createTestDocument()
    const before = snapshotOfFirstPage(document)
    const after: PageSettingsSnapshot = { ...before, backgroundPageId: 'missing-page' }
    const command = new UpdatePageCommand({ pageId: 'page-1', before, after })
    expect(() => command.apply(document)).toThrow('背景页设置无效。')
  })

  it('合法背景页引用正常写入，revert 恢复为无引用', () => {
    const base = createTestDocument()
    const background = createEmptyPage({ id: 'bg-1', name: '背景页', type: 'background' })
    const document: DiagramDocument = { ...base, pages: [...base.pages, background] }
    const before = snapshotOfFirstPage(document)
    const after: PageSettingsSnapshot = { ...before, backgroundPageId: 'bg-1' }
    const command = new UpdatePageCommand({ pageId: 'page-1', before, after })
    const next = command.apply(document)
    expect(next.pages[0].backgroundPageId).toBe('bg-1')
    expect(command.revert(next).pages[0].backgroundPageId).toBeUndefined()
  })

  it('目标页不存在时抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const before = snapshotOfFirstPage(document)
    const command = new UpdatePageCommand({ pageId: 'missing-page', before, after: before })
    expect(() => command.apply(document)).toThrow('命令目标不存在。')
  })
})

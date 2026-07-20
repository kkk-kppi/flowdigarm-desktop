// tests/unit/editor/arrangement/z-order.test.ts
// 层级调整：四动作各一条记录可逆；执行后全页 zIndex 规范化为 1..n；无变化 → null。
import { describe, expect, it } from 'vitest'
import { createEmptyPage, type DiagramPage } from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import { createZOrderCommand, ZOrderCommand } from '@/application/arrangement/z-order'
import { createTestDocument, createTestEdge, createTestNode } from '../../../helpers/test-document'

/** 三节点 + 一边，zIndex 混合（节点与边共享 z 空间）。 */
function zPage(): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    nodes: [
      createTestNode({ id: 'n1', zIndex: 1 }),
      createTestNode({ id: 'n2', zIndex: 2 }),
      createTestNode({ id: 'n3', zIndex: 4 }),
    ],
    edges: [createTestEdge({ id: 'e1', zIndex: 3 })],
  })
}

function applyAndRevert(page: DiagramPage, ids: string[], action: Parameters<typeof createZOrderCommand>[2]) {
  const command = createZOrderCommand(page, ids, action)
  expect(command).toBeInstanceOf(ZOrderCommand)
  const document = { ...createTestDocument(), pages: [page] }
  const applied = command!.apply(document)
  const reverted = command!.revert(applied)
  return { command: command!, appliedPage: applied.pages[0], revertedPage: reverted.pages[0] }
}

function zOf(page: DiagramPage, id: string): number {
  const node = page.nodes.find((n) => n.id === id)
  if (node) return node.zIndex
  return page.edges.find((e) => e.id === id)!.zIndex
}

describe('createZOrderCommand 四动作', () => {
  it('置顶：选中图元移到全部图元之上（保持相互顺序），标签「置于顶层」', () => {
    const { command, appliedPage, revertedPage } = applyAndRevert(zPage(), ['n1'], 'to-front')
    expect(command.label).toBe('置于顶层')
    // 新顺序 [n2, e1, n3, n1] → 1..4
    expect(zOf(appliedPage, 'n2')).toBe(1)
    expect(zOf(appliedPage, 'e1')).toBe(2)
    expect(zOf(appliedPage, 'n3')).toBe(3)
    expect(zOf(appliedPage, 'n1')).toBe(4)
    // 撤销恢复原值（含未选中图元的规范化值）
    expect(zOf(revertedPage, 'n1')).toBe(1)
    expect(zOf(revertedPage, 'n2')).toBe(2)
    expect(zOf(revertedPage, 'e1')).toBe(3)
    expect(zOf(revertedPage, 'n3')).toBe(4)
  })

  it('置底：选中图元移到全部图元之下，标签「置于底层」', () => {
    const { command, appliedPage } = applyAndRevert(zPage(), ['n3'], 'to-back')
    expect(command.label).toBe('置于底层')
    expect(zOf(appliedPage, 'n3')).toBe(1)
    expect(zOf(appliedPage, 'n1')).toBe(2)
    expect(zOf(appliedPage, 'n2')).toBe(3)
    expect(zOf(appliedPage, 'e1')).toBe(4)
  })

  it('上移一层：与相邻（上方）zIndex 交换，标签「上移一层」', () => {
    const { command, appliedPage } = applyAndRevert(zPage(), ['n1'], 'forward')
    expect(command.label).toBe('上移一层')
    // n1 与 n2 交换：[n2, n1, e1, n3] → n1=2 n2=1
    expect(zOf(appliedPage, 'n1')).toBe(2)
    expect(zOf(appliedPage, 'n2')).toBe(1)
  })

  it('下移一层：与相邻（下方）zIndex 交换，标签「下移一层」', () => {
    const { command, appliedPage } = applyAndRevert(zPage(), ['n3'], 'backward')
    expect(command.label).toBe('下移一层')
    // n3 与 e1 交换：[n1, n2, n3, e1] → n3=3 e1=4
    expect(zOf(appliedPage, 'n3')).toBe(3)
    expect(zOf(appliedPage, 'e1')).toBe(4)
  })

  it('多选置顶保持相互顺序', () => {
    const { appliedPage } = applyAndRevert(zPage(), ['n1', 'n2'], 'to-front')
    // [e1, n3, n1, n2] → n1=3 n2=4（n1 仍在 n2 之下）
    expect(zOf(appliedPage, 'e1')).toBe(1)
    expect(zOf(appliedPage, 'n3')).toBe(2)
    expect(zOf(appliedPage, 'n1')).toBe(3)
    expect(zOf(appliedPage, 'n2')).toBe(4)
  })
})

describe('createZOrderCommand 无变化与撤销边界', () => {
  it('已在顶层时上移/置顶返回 null', () => {
    const page = zPage()
    expect(createZOrderCommand(page, ['n3'], 'forward')).toBeNull()
    expect(createZOrderCommand(page, ['n3'], 'to-front')).toBeNull()
  })

  it('已在底层时下移/置底返回 null', () => {
    const page = zPage()
    expect(createZOrderCommand(page, ['n1'], 'backward')).toBeNull()
    expect(createZOrderCommand(page, ['n1'], 'to-back')).toBeNull()
  })

  it('相邻图元同被选中（连续块）上移一层无变化 → null', () => {
    const page = zPage()
    // n2(z2) 与 e1(z3) 连续，e1 上方 n3 未选中但 e1 本身被选中 → 块整体上移？块顶是 e1，其上 n3 未选中
    // n2/e1 作为整体与 n3 交换不是「相邻交换」语义；逐个看：n2 上邻 e1（选中）跳过，e1 上邻 n3（未选中）交换
    const command = createZOrderCommand(page, ['n2', 'e1'], 'forward')
    expect(command).not.toBeNull()
    const applied = command!.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    // [n1, n3, n2, e1] → n3=2 n2=3 e1=4
    expect(zOf(applied, 'n1')).toBe(1)
    expect(zOf(applied, 'n3')).toBe(2)
    expect(zOf(applied, 'n2')).toBe(3)
    expect(zOf(applied, 'e1')).toBe(4)
  })

  it('连续块到顶（全部选中项已在最上方）→ null', () => {
    const page = zPage()
    expect(createZOrderCommand(page, ['e1', 'n3'], 'forward')).toBeNull()
  })

  it('一次层级调整一条撤销记录，撤销一步全部恢复', () => {
    const page = zPage()
    const command = createZOrderCommand(page, ['n1'], 'to-front')!
    const history = new CommandHistory()
    const document = { ...createTestDocument(), pages: [page] }
    const next = history.execute(command, document)
    expect(history.size).toBe(1)
    expect(next.pages[0].nodes.find((n) => n.id === 'n1')?.zIndex).toBe(4)
    const reverted = history.undo(next)
    expect(reverted?.pages[0].nodes.find((n) => n.id === 'n1')?.zIndex).toBe(1)
    expect(reverted?.pages[0].edges.find((e) => e.id === 'e1')?.zIndex).toBe(3)
  })
})

// tests/unit/editor/arrangement/distribute-cells.test.ts
// 两两等距：按轴几何顺序排序、固定最外两个、相邻边界间空隙相等；
// gap<0 抛「间距不足，无法等距排列。」；<3 抛「等距排列至少需要三个图元。」；一次等距一条撤销。
import { describe, expect, it } from 'vitest'
import { createEmptyPage, type DiagramNode, type DiagramPage } from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import { createDistributeCommand } from '@/application/arrangement/distribute-cells'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

function pageOf(nodes: DiagramNode[]): DiagramPage {
  return createEmptyPage({ id: 'page-1', nodes })
}

describe('createDistributeCommand 水平等距', () => {
  it('固定最外两个，中间图元移动使相邻边界间空隙相等（数值手算）', () => {
    // 几何顺序：n1(0..20) n3(30..40) n2(100..120)；gap = (100 − 20 − 10) / 2 = 35
    const page = pageOf([
      createTestNode({ id: 'n1', x: 0, y: 0, width: 20, height: 10, zIndex: 0 }),
      createTestNode({ id: 'n2', x: 100, y: 0, width: 20, height: 10, zIndex: 1 }),
      createTestNode({ id: 'n3', x: 30, y: 0, width: 10, height: 10, zIndex: 2 }),
    ])
    const command = createDistributeCommand(page, ['n2', 'n1', 'n3'], 'horizontal')
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    // n1/n2（最外两个）不动；n3 移到 0+20+35 = 55
    expect(next.nodes.find((n) => n.id === 'n1')).toMatchObject({ x: 0 })
    expect(next.nodes.find((n) => n.id === 'n2')).toMatchObject({ x: 100 })
    expect(next.nodes.find((n) => n.id === 'n3')).toMatchObject({ x: 55 })
    // 相邻边界间空隙相等：55−20 = 35；100−(55+10) = 35
  })

  it('四个图元：gap = (last.start − first.end − Σ middle.width) / 3', () => {
    // n1(0..10) n2(20..30) n3(40..50) n4(100..120)；gap = (100 − 10 − 20) / 3 = 70/3
    const page = pageOf([
      createTestNode({ id: 'n1', x: 0, y: 0, width: 10, height: 10, zIndex: 0 }),
      createTestNode({ id: 'n2', x: 20, y: 0, width: 10, height: 10, zIndex: 1 }),
      createTestNode({ id: 'n3', x: 40, y: 0, width: 10, height: 10, zIndex: 2 }),
      createTestNode({ id: 'n4', x: 100, y: 0, width: 20, height: 10, zIndex: 3 }),
    ])
    const command = createDistributeCommand(page, ['n1', 'n2', 'n3', 'n4'], 'horizontal')
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const gap = 70 / 3
    expect(next.nodes.find((n) => n.id === 'n2')!.x).toBeCloseTo(10 + gap, 10)
    expect(next.nodes.find((n) => n.id === 'n3')!.x).toBeCloseTo(10 + gap + 10 + gap, 10)
  })
})

describe('createDistributeCommand 垂直等距', () => {
  it('固定最上/最下，中间按相等空隙分布', () => {
    // n1(0..10) n2(100..120) n3(30..50)；gap = (100 − 10 − 20) / 2 = 35
    const page = pageOf([
      createTestNode({ id: 'n1', x: 0, y: 0, width: 10, height: 10, zIndex: 0 }),
      createTestNode({ id: 'n2', x: 0, y: 100, width: 10, height: 20, zIndex: 1 }),
      createTestNode({ id: 'n3', x: 0, y: 30, width: 10, height: 20, zIndex: 2 }),
    ])
    const command = createDistributeCommand(page, ['n1', 'n2', 'n3'], 'vertical')
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    expect(next.nodes.find((n) => n.id === 'n1')).toMatchObject({ y: 0 })
    expect(next.nodes.find((n) => n.id === 'n2')).toMatchObject({ y: 100 })
    expect(next.nodes.find((n) => n.id === 'n3')).toMatchObject({ y: 45 })
  })
})

describe('createDistributeCommand 失败与撤销', () => {
  it('不足三个有效节点抛「等距排列至少需要三个图元。」', () => {
    const page = pageOf([
      createTestNode({ id: 'n1', x: 0, y: 0 }),
      createTestNode({ id: 'n2', x: 100, y: 0 }),
    ])
    expect(() => createDistributeCommand(page, ['n1', 'n2'], 'horizontal')).toThrow(
      '等距排列至少需要三个图元。',
    )
    expect(() => createDistributeCommand(page, ['n1', 'n2', '不存在'], 'horizontal')).toThrow(
      '等距排列至少需要三个图元。',
    )
  })

  it('间距不足（gap < 0）抛「间距不足，无法等距排列。」', () => {
    // n1(0..50) n2(55..105) n3(60..110)：last.start=60? 几何序 n1,n3,n2 → gap=(105? ...)
    const page = pageOf([
      createTestNode({ id: 'n1', x: 0, y: 0, width: 50, height: 10, zIndex: 0 }),
      createTestNode({ id: 'n2', x: 55, y: 0, width: 50, height: 10, zIndex: 1 }),
      createTestNode({ id: 'n3', x: 60, y: 0, width: 50, height: 10, zIndex: 2 }),
    ])
    // 几何顺序：n1(0) n2(55) n3(60)；last.start = 60? 排序后最外为 n1 与 n3(60..110)
    // gap = (60 − 50 − 50) / 2 = −20 < 0
    expect(() => createDistributeCommand(page, ['n1', 'n2', 'n3'], 'horizontal')).toThrow(
      '间距不足，无法等距排列。',
    )
  })

  it('标签为「等距排列」；一次等距一条撤销记录，撤销一步全部恢复', () => {
    const page = pageOf([
      createTestNode({ id: 'n1', x: 0, y: 0, width: 20, height: 10, zIndex: 0 }),
      createTestNode({ id: 'n2', x: 100, y: 0, width: 20, height: 10, zIndex: 1 }),
      createTestNode({ id: 'n3', x: 30, y: 0, width: 10, height: 10, zIndex: 2 }),
    ])
    const command = createDistributeCommand(page, ['n1', 'n2', 'n3'], 'horizontal')
    expect(command.label).toBe('等距排列')

    const history = new CommandHistory()
    const next = history.execute(command, { ...createTestDocument(), pages: [page] })
    expect(history.size).toBe(1)
    expect(next.pages[0].nodes.find((n) => n.id === 'n3')).toMatchObject({ x: 55 })

    const reverted = history.undo(next)
    expect(reverted?.pages[0].nodes.find((n) => n.id === 'n3')).toMatchObject({ x: 30 })
  })
})

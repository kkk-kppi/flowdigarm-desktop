// tests/unit/editor/group-cells.test.ts
// 组合/取消组合：组合创建 group 节点（成员 parentId 指向之，ID 与数据保留，bbox=成员外接矩形）；
// 取消组合删除 group 节点并清除成员 parentId；revert 恢复原 group 节点（含原 ID 与样式快照）；
// <2 个有效节点 → null；嵌套组合允许。一条操作一条撤销记录。
import { describe, expect, it, beforeEach } from 'vitest'
import { createEmptyPage, type DiagramPage } from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import {
  createGroupCommand,
  createUngroupCommand,
  GroupCellsCommand,
  UngroupCellsCommand,
} from '@/application/commands/group-cells'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'
import { createTestDocument, createTestNode } from '../../helpers/test-document'

let idSeq = 0
function idGen(): string {
  idSeq += 1
  return `group-${idSeq}`
}

beforeEach(() => {
  idSeq = 0
})

function groupPage(): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    nodes: [
      createTestNode({ id: 'n1', x: 10, y: 20, width: 40, height: 20, zIndex: 0 }),
      createTestNode({
        id: 'n2',
        x: 100,
        y: 60,
        width: 50,
        height: 30,
        zIndex: 1,
        data: { 键: '值' },
      }),
      createTestNode({ id: 'n3', x: 300, y: 300, width: 20, height: 20, zIndex: 2 }),
    ],
  })
}

describe('group 形状注册', () => {
  it('注册 type=group：容器、不入图元库分类、透明填充虚线边框、无端口', () => {
    expect(shapeRegistry.has('group')).toBe(true)
    const def = shapeRegistry.get('group')
    expect(def.isContainer).toBe(true)
    expect(shapeRegistry.byCategory('basic').some((d) => d.type === 'group')).toBe(false)
    expect(shapeRegistry.byCategory('flowchart').some((d) => d.type === 'group')).toBe(false)
    expect(def.defaultStyle.fillOpacity).toBe(0)
    expect(def.defaultStyle.strokeDash).toBe('dash')
    expect(def.ports).toEqual([])
  })
})

describe('createGroupCommand', () => {
  it('组合：创建 group 节点（bbox=成员外接矩形），成员 parentId 指向组合', () => {
    const page = groupPage()
    const command = createGroupCommand(page, ['n1', 'n2'], idGen)
    expect(command).toBeInstanceOf(GroupCellsCommand)
    expect(command!.label).toBe('组合')

    const next = command!.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    expect(next.nodes).toHaveLength(4)
    const group = next.nodes.find((n) => n.id === 'group-1')!
    expect(group.shape).toBe('group')
    expect(group.isContainer).toBe(true)
    // bbox = 成员外接矩形：min(10,100)=10, min(20,60)=20, max(50,150)=150, max(40,90)=90
    expect(group).toMatchObject({ x: 10, y: 20, width: 140, height: 70 })
    expect(next.nodes.find((n) => n.id === 'n1')?.parentId).toBe('group-1')
    expect(next.nodes.find((n) => n.id === 'n2')?.parentId).toBe('group-1')
    expect(next.nodes.find((n) => n.id === 'n3')?.parentId).toBeUndefined()
  })

  it('成员保留原 ID 与全部数据（data/文本/几何/样式）', () => {
    const page = groupPage()
    const before1 = page.nodes.find((n) => n.id === 'n1')!
    const before2 = page.nodes.find((n) => n.id === 'n2')!
    const command = createGroupCommand(page, ['n1', 'n2'], idGen)!
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const n1 = next.nodes.find((n) => n.id === 'n1')!
    const n2 = next.nodes.find((n) => n.id === 'n2')!
    expect(n1).toMatchObject({
      id: 'n1',
      x: before1.x,
      y: before1.y,
      width: before1.width,
      height: before1.height,
      angle: before1.angle,
      style: before1.style,
      zIndex: before1.zIndex,
    })
    expect(n2.data).toEqual({ 键: '值' })
    expect(n2.style).toEqual(before2.style)
  })

  it('组合节点渲染于成员之下（zIndex 取成员最小值，插入位置在成员之前）', () => {
    const page = groupPage()
    const command = createGroupCommand(page, ['n1', 'n2'], idGen)!
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const group = next.nodes.find((n) => n.id === 'group-1')!
    expect(group.zIndex).toBe(0) // min(0, 1)
    const ids = next.nodes.map((n) => n.id)
    expect(ids.indexOf('group-1')).toBeLessThan(ids.indexOf('n1'))
  })

  it('少于 2 个有效节点返回 null（单选/不存在/仅边）', () => {
    const page = groupPage()
    expect(createGroupCommand(page, ['n1'], idGen)).toBeNull()
    expect(createGroupCommand(page, ['n1', '不存在'], idGen)).toBeNull()
    expect(createGroupCommand(page, [], idGen)).toBeNull()
  })

  it('嵌套组合允许（group 可作成员）', () => {
    const page = groupPage()
    const first = createGroupCommand(page, ['n1', 'n2'], idGen)!
    const inner = first.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const second = createGroupCommand(inner, ['group-1', 'n3'], idGen)!
    const outer = second.apply({ ...createTestDocument(), pages: [inner] }).pages[0]
    expect(outer.nodes.find((n) => n.id === 'group-1')?.parentId).toBe('group-2')
    expect(outer.nodes.find((n) => n.id === 'n3')?.parentId).toBe('group-2')
    // 内层成员仍指向内层组合
    expect(outer.nodes.find((n) => n.id === 'n1')?.parentId).toBe('group-1')
  })

  it('一次组合一条撤销记录，撤销一步恢复（group 消失、parentId 清除）', () => {
    const page = groupPage()
    const command = createGroupCommand(page, ['n1', 'n2'], idGen)!
    const history = new CommandHistory()
    const next = history.execute(command, { ...createTestDocument(), pages: [page] })
    expect(history.size).toBe(1)
    expect(next.pages[0].nodes).toHaveLength(4)

    const reverted = history.undo(next)!
    expect(reverted.pages[0].nodes).toHaveLength(3)
    expect(reverted.pages[0].nodes.find((n) => n.id === 'group-1')).toBeUndefined()
    expect(reverted.pages[0].nodes.find((n) => n.id === 'n1')?.parentId).toBeUndefined()
    expect(reverted.pages[0].nodes.find((n) => n.id === 'n2')?.parentId).toBeUndefined()
  })
})

describe('createUngroupCommand', () => {
  function groupedPage(): DiagramPage {
    const page = groupPage()
    const command = createGroupCommand(page, ['n1', 'n2'], idGen)!
    return command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
  }

  it('取消组合：删除 group 节点、成员 parentId 清除，标签「取消组合」', () => {
    const page = groupedPage()
    const command = createUngroupCommand(page, ['group-1'])
    expect(command).toBeInstanceOf(UngroupCellsCommand)
    expect(command!.label).toBe('取消组合')

    const next = command!.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    expect(next.nodes).toHaveLength(3)
    expect(next.nodes.find((n) => n.id === 'group-1')).toBeUndefined()
    expect(next.nodes.find((n) => n.id === 'n1')?.parentId).toBeUndefined()
    expect(next.nodes.find((n) => n.id === 'n2')?.parentId).toBeUndefined()
  })

  it('revert 恢复原 group 节点（含原 ID 与样式快照），成员关系还原', () => {
    const page = groupedPage()
    const groupBefore = page.nodes.find((n) => n.id === 'group-1')!
    const command = createUngroupCommand(page, ['group-1'])!
    const applied = command.apply({ ...createTestDocument(), pages: [page] })
    const reverted = command.revert(applied).pages[0]
    const restored = reverted.nodes.find((n) => n.id === 'group-1')!
    expect(restored).toEqual(groupBefore)
    expect(reverted.nodes.find((n) => n.id === 'n1')?.parentId).toBe('group-1')
    expect(reverted.nodes.find((n) => n.id === 'n2')?.parentId).toBe('group-1')
  })

  it('非组合 ID / 不存在 ID → null', () => {
    const page = groupedPage()
    expect(createUngroupCommand(page, ['n1'])).toBeNull()
    expect(createUngroupCommand(page, ['不存在'])).toBeNull()
    expect(createUngroupCommand(page, [])).toBeNull()
  })

  it('多个组合一次取消为一条记录', () => {
    // 两个组合：g1(n1,n2)、g2(g1,n3) 嵌套；先解外层再解内层
    const page = groupedPage()
    const second = createGroupCommand(page, ['group-1', 'n3'], idGen)!
    const nested = second.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const command = createUngroupCommand(nested, ['group-2', 'group-1'])!
    const history = new CommandHistory()
    const next = history.execute(command, { ...createTestDocument(), pages: [nested] })
    expect(history.size).toBe(1)
    expect(next.pages[0].nodes).toHaveLength(3)
    expect(next.pages[0].nodes.every((n) => n.parentId === undefined)).toBe(true)
  })
})

// tests/unit/editor/container-membership.test.ts
// 通用容器成员关系：加入/移出各一条记录可逆；container 必须由标记或形状定义声明；
// 防环（成员不得包含容器自身及其祖先）；成员数据与 ID 保留。
import { describe, expect, it } from 'vitest'
import { createEmptyPage, type DiagramPage } from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import {
  createAddToContainerCommand,
  createRemoveFromContainerCommand,
} from '@/application/commands/container-membership'
import { createTestDocument, createTestNode } from '../../helpers/test-document'

function containerPage(): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    nodes: [
      createTestNode({ id: 'container', shape: 'group', zIndex: 0 }),
      createTestNode({ id: 'inner', shape: 'group', zIndex: 1, parentId: 'container' }),
      createTestNode({ id: 'a', zIndex: 2, data: { 保留: true } }),
      createTestNode({ id: 'b', zIndex: 3 }),
      createTestNode({ id: 'plain', zIndex: 4 }), // 非容器
    ],
  })
}

describe('createAddToContainerCommand', () => {
  it('加入容器：成员 parentId 指向容器，标签「加入容器」；数据与 ID 保留', () => {
    const page = containerPage()
    const command = createAddToContainerCommand(page, ['a', 'b'], 'container')
    expect(command.label).toBe('加入容器')
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    const a = next.nodes.find((n) => n.id === 'a')!
    expect(a.parentId).toBe('container')
    expect(a.data).toEqual({ 保留: true })
    expect(next.nodes.find((n) => n.id === 'b')?.parentId).toBe('container')
    expect(next.nodes).toHaveLength(5)
  })

  it('可逆：revert 恢复成员原 parentId', () => {
    const page = containerPage()
    const command = createAddToContainerCommand(page, ['a'], 'container')
    const applied = command.apply({ ...createTestDocument(), pages: [page] })
    const reverted = command.revert(applied)
    expect(reverted.pages[0].nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined()
  })

  it('非容器目标拒绝（抛错）', () => {
    const page = containerPage()
    expect(() => createAddToContainerCommand(page, ['a'], 'plain')).toThrow(
      '目标节点不是容器。',
    )
    expect(() => createAddToContainerCommand(page, ['a'], '不存在')).toThrow(
      '目标节点不是容器。',
    )
  })

  it('防环：成员包含容器自身或其祖先时拒绝', () => {
    const page = containerPage()
    // 容器自身作为成员
    expect(() => createAddToContainerCommand(page, ['container'], 'container')).toThrow(
      '加入容器会形成循环。',
    )
    // inner 的祖先是 container：把 container 加入 inner 形成环
    expect(() => createAddToContainerCommand(page, ['container'], 'inner')).toThrow(
      '加入容器会形成循环。',
    )
    // 合法：a 加入 inner（a 不是 inner 祖先）
    expect(() => createAddToContainerCommand(page, ['a'], 'inner')).not.toThrow()
  })

  it('一次加入一条撤销记录', () => {
    const page = containerPage()
    const history = new CommandHistory()
    const next = history.execute(createAddToContainerCommand(page, ['a', 'b'], 'container'), {
      ...createTestDocument(),
      pages: [page],
    })
    expect(history.size).toBe(1)
    const reverted = history.undo(next)!
    expect(reverted.pages[0].nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined()
    expect(reverted.pages[0].nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined()
  })
})

describe('createRemoveFromContainerCommand', () => {
  it('移出容器：成员 parentId 清除，标签「移出容器」；可逆', () => {
    const page = containerPage()
    const addCmd = createAddToContainerCommand(page, ['a', 'b'], 'container')
    const added = addCmd.apply({ ...createTestDocument(), pages: [page] }).pages[0]

    const command = createRemoveFromContainerCommand(added, ['a', 'b'])
    expect(command.label).toBe('移出容器')
    const removed = command.apply({ ...createTestDocument(), pages: [added] }).pages[0]
    expect(removed.nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined()
    expect(removed.nodes.find((n) => n.id === 'b')?.parentId).toBeUndefined()

    const reverted = command.revert({ ...createTestDocument(), pages: [removed] }).pages[0]
    expect(reverted.nodes.find((n) => n.id === 'a')?.parentId).toBe('container')
    expect(reverted.nodes.find((n) => n.id === 'b')?.parentId).toBe('container')
  })

  it('无 parentId 的成员跳过；成员不存在跳过', () => {
    const page = containerPage()
    const command = createRemoveFromContainerCommand(page, ['a', '不存在'])
    const next = command.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    expect(next.nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined()
  })
})

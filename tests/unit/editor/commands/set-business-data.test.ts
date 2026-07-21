import { CommandHistory } from '@/application/commands/command-history'
import { SetBusinessDataCommand } from '@/application/commands/set-business-data'
import type { DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

function businessDataOf(document: DiagramDocument): Record<string, unknown> | undefined {
  return document.pages[0].nodes.find((node) => node.id === 'node-1')?.data
}

describe('设置业务数据命令', () => {
  it('应用与撤销业务数据，并在历史中只产生一条记录', () => {
    const base = createTestDocument()
    base.pages[0].nodes[0].data = { 状态: '待处理' }
    const history = new CommandHistory()
    const command = new SetBusinessDataCommand({
      pageId: 'page-1',
      nodeId: 'node-1',
      before: { 状态: '待处理' },
      after: { 状态: '已完成', 审批: { 通过: true } },
    })

    const applied = history.execute(command, base)

    expect(history.size).toBe(1)
    expect(history.undoLabel).toBe('业务数据')
    expect(businessDataOf(applied)).toEqual({ 状态: '已完成', 审批: { 通过: true } })
    expect(businessDataOf(base)).toEqual({ 状态: '待处理' })

    const reverted = history.undo(applied) as DiagramDocument
    expect(businessDataOf(reverted)).toEqual({ 状态: '待处理' })
    expect(history.canUndo).toBe(false)
  })

  it('构造时保存不可变深快照', () => {
    const before = { 审批: { 人数: 1 } }
    const after = { 审批: { 人数: 2 } }
    const command = new SetBusinessDataCommand({
      pageId: 'page-1',
      nodeId: 'node-1',
      before,
      after,
    })
    before.审批.人数 = 10
    after.审批.人数 = 20

    const applied = command.apply(createTestDocument())
    expect(businessDataOf(applied)).toEqual({ 审批: { 人数: 2 } })

    const reverted = command.revert(applied)
    expect(businessDataOf(reverted)).toEqual({ 审批: { 人数: 1 } })
  })

  it('撤销时恢复未设置业务数据的状态', () => {
    const command = new SetBusinessDataCommand({
      pageId: 'page-1',
      nodeId: 'node-1',
      before: undefined,
      after: { 状态: '新增' },
    })

    const applied = command.apply(createTestDocument())
    expect(businessDataOf(applied)).toEqual({ 状态: '新增' })
    expect(businessDataOf(command.revert(applied))).toBeUndefined()
  })

  it('每次写入独立数据副本', () => {
    const command = new SetBusinessDataCommand({
      pageId: 'page-1',
      nodeId: 'node-1',
      before: {},
      after: { 状态: { 名称: '处理中' } },
    })

    const first = command.apply(createTestDocument())
    const firstData = businessDataOf(first) as { 状态: { 名称: string } }
    firstData.状态.名称 = '外部修改'

    expect(businessDataOf(command.apply(createTestDocument()))).toEqual({
      状态: { 名称: '处理中' },
    })
  })

  it('目标不存在时抛出中文错误', () => {
    const command = new SetBusinessDataCommand({
      pageId: 'page-1',
      nodeId: '不存在',
      before: {},
      after: {},
    })

    expect(() => command.apply(createTestDocument())).toThrow('命令目标不存在。')
  })
})

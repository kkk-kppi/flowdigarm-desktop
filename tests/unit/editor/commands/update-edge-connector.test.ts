// tests/unit/editor/commands/update-edge-connector.test.ts
// 连线类型命令：一次变更全部选中边一条记录；可逆。
import { CommandHistory } from '@/application/commands/command-history'
import { UpdateEdgeConnectorCommand } from '@/application/commands/update-edge-connector'
import type { DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

describe('连线类型命令', () => {
  it('批量写入 after；可逆逐边恢复 before；redo 重放', () => {
    const history = new CommandHistory()
    const base = createTestDocument()
    // edge-2 原本为直线，验证逐边恢复
    const document: DiagramDocument = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          edges: base.pages[0].edges.map((edge) =>
            edge.id === 'edge-2' ? { ...edge, connector: 'straight' as const } : edge,
          ),
        },
      ],
    }
    const command = new UpdateEdgeConnectorCommand({
      pageId: 'page-1',
      edgeIds: ['edge-1', 'edge-2'],
      before: ['orthogonal', 'straight'],
      after: 'curved',
    })
    const styled = history.execute(command, document)
    expect(history.size).toBe(1)
    expect(history.undoLabel).toBe('连线类型')
    expect(styled.pages[0].edges.map((e) => e.connector)).toEqual(['curved', 'curved'])

    const restored = history.undo(styled) as DiagramDocument
    expect(restored.pages[0].edges.map((e) => e.connector)).toEqual(['orthogonal', 'straight'])

    const replayed = history.redo(restored) as DiagramDocument
    expect(replayed.pages[0].edges.map((e) => e.connector)).toEqual(['curved', 'curved'])
  })

  it('before 长度与 edgeIds 不一致构造即抛错', () => {
    expect(
      () =>
        new UpdateEdgeConnectorCommand({
          pageId: 'page-1',
          edgeIds: ['edge-1', 'edge-2'],
          before: ['orthogonal'],
          after: 'curved',
        }),
    ).toThrow()
  })

  it('目标边不存在抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const command = new UpdateEdgeConnectorCommand({
      pageId: 'page-1',
      edgeIds: ['edge-x'],
      before: ['orthogonal'],
      after: 'curved',
    })
    expect(() => command.apply(document)).toThrow('命令目标不存在。')
    expect(() => command.revert(document)).toThrow('命令目标不存在。')
  })

  it('入参文档不被修改', () => {
    const document = createTestDocument()
    const command = new UpdateEdgeConnectorCommand({
      pageId: 'page-1',
      edgeIds: ['edge-1'],
      before: ['orthogonal'],
      after: 'straight',
    })
    command.apply(document)
    expect(document.pages[0].edges[0].connector).toBe('orthogonal')
  })

  it('label 为「连线类型」', () => {
    expect(
      new UpdateEdgeConnectorCommand({ pageId: 'page-1', edgeIds: [], before: [], after: 'curved' })
        .label,
    ).toBe('连线类型')
  })
})

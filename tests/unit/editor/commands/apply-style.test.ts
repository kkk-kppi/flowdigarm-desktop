// tests/unit/editor/commands/apply-style.test.ts
import { CommandHistory } from '@/application/commands/command-history'
import { ApplyStyleCommand, type StyleTarget } from '@/application/commands/apply-style'
import type { DiagramDocument, DiagramNode } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

function nodeById(document: DiagramDocument, nodeId: string): DiagramNode {
  const node = document.pages[0].nodes.find((n) => n.id === nodeId)
  if (!node) throw new Error(`测试文档缺少节点 ${nodeId}`)
  return node
}

describe('应用样式命令', () => {
  it('3 节点批量填充色记为一条记录；undo 逐节点恢复原值；redo 重放', () => {
    const history = new CommandHistory()
    const base = createTestDocument()
    // 各节点填充色互不相同，验证 undo 逐节点恢复原值
    const document: DiagramDocument = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          nodes: base.pages[0].nodes.map((node, index) => ({
            ...node,
            style: { ...node.style, fill: ['#FF0000', '#FFAA00', '#FF00FF'][index] },
          })),
        },
      ],
    }

    const targets: StyleTarget[] = [
      { kind: 'node', pageId: 'page-1', cellId: 'node-1', before: { fill: '#FF0000' }, after: { fill: '#00FF00' } },
      { kind: 'node', pageId: 'page-1', cellId: 'node-2', before: { fill: '#FFAA00' }, after: { fill: '#00FF00' } },
      { kind: 'node', pageId: 'page-1', cellId: 'node-3', before: { fill: '#FF00FF' }, after: { fill: '#00FF00' } },
    ]
    const styled = history.execute(new ApplyStyleCommand(targets), document)

    expect(history.size).toBe(1)
    expect(history.undoLabel).toBe('应用样式')
    expect(nodeById(styled, 'node-1').style.fill).toBe('#00FF00')
    expect(nodeById(styled, 'node-2').style.fill).toBe('#00FF00')
    expect(nodeById(styled, 'node-3').style.fill).toBe('#00FF00')
    // 未涉及的样式字段保持不变
    expect(nodeById(styled, 'node-1').style.stroke).toBe('#000000')

    const restored = history.undo(styled) as DiagramDocument
    expect(nodeById(restored, 'node-1').style.fill).toBe('#FF0000')
    expect(nodeById(restored, 'node-2').style.fill).toBe('#FFAA00')
    expect(nodeById(restored, 'node-3').style.fill).toBe('#FF00FF')

    const replayed = history.redo(restored) as DiagramDocument
    expect(nodeById(replayed, 'node-1').style.fill).toBe('#00FF00')
    expect(nodeById(replayed, 'node-2').style.fill).toBe('#00FF00')
    expect(nodeById(replayed, 'node-3').style.fill).toBe('#00FF00')
  })

  it('边样式批量修改（strokeWidth）同样一条记录可逆', () => {
    const history = new CommandHistory()
    const document = createTestDocument()

    const targets: StyleTarget[] = [
      { kind: 'edge', pageId: 'page-1', cellId: 'edge-1', before: { strokeWidth: 1 }, after: { strokeWidth: 3 } },
      { kind: 'edge', pageId: 'page-1', cellId: 'edge-2', before: { strokeWidth: 1 }, after: { strokeWidth: 3 } },
    ]
    const styled = history.execute(new ApplyStyleCommand(targets), document)

    expect(history.size).toBe(1)
    expect(styled.pages[0].edges.map((e) => e.style.strokeWidth)).toEqual([3, 3])
    // 未涉及的边样式字段保持不变
    expect(styled.pages[0].edges[0].style.stroke).toBe('#666666')

    const restored = history.undo(styled) as DiagramDocument
    expect(restored.pages[0].edges.map((e) => e.style.strokeWidth)).toEqual([1, 1])
  })

  it('入参文档不被修改', () => {
    const document = createTestDocument()
    const command = new ApplyStyleCommand([
      { kind: 'node', pageId: 'page-1', cellId: 'node-1', before: { fill: '#FFFFFF' }, after: { fill: '#00FF00' } },
    ])

    command.apply(document)

    expect(nodeById(document, 'node-1').style.fill).toBe('#FFFFFF')
  })

  it('目标不存在时抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const command = new ApplyStyleCommand([
      { kind: 'node', pageId: 'page-1', cellId: 'node-x', before: {}, after: { fill: '#00FF00' } },
    ])

    expect(() => command.apply(document)).toThrow('命令目标不存在。')
    expect(() => command.revert(document)).toThrow('命令目标不存在。')
  })

  it('label 为「应用样式」', () => {
    expect(new ApplyStyleCommand([]).label).toBe('应用样式')
  })
})

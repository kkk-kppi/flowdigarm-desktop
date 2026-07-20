// tests/unit/editor/commands/text-style-command.test.ts
// 文本样式命令：一次控件变更的全部目标合并为一条记录；style/block/paragraph 三段浅合并；
// 无 text 节点先建默认 TextContent 再合并；边标签目标同批。
import { CommandHistory } from '@/application/commands/command-history'
import {
  TextStyleCommand,
  type TextStylePatch,
} from '@/application/commands/text-style-command'
import { createDefaultTextContent, type DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

function boldPatch(bold: boolean): TextStylePatch {
  return { style: { bold } }
}

describe('文本样式命令', () => {
  it('3 节点批量 bold 一条记录；undo 逐节点复原；redo 重放', () => {
    const history = new CommandHistory()
    const base = createTestDocument()
    // node-1 原本已加粗，验证逐节点恢复原值
    const document: DiagramDocument = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          nodes: base.pages[0].nodes.map((node) =>
            node.id === 'node-1'
              ? { ...node, text: { ...node.text!, style: { ...node.text!.style, bold: true } } }
              : node,
          ),
        },
      ],
    }

    const command = new TextStyleCommand({
      pageId: 'page-1',
      targets: [
        { target: { kind: 'node', nodeId: 'node-1' }, before: boldPatch(true), after: boldPatch(false) },
        { target: { kind: 'node', nodeId: 'node-2' }, before: boldPatch(false), after: boldPatch(false) },
        { target: { kind: 'node', nodeId: 'node-3' }, before: boldPatch(false), after: boldPatch(false) },
      ],
    })
    const styled = history.execute(command, document)

    expect(history.size).toBe(1)
    expect(history.undoLabel).toBe('文本样式')
    expect(styled.pages[0].nodes.map((n) => n.text?.style.bold)).toEqual([false, false, false])
    // 未涉及的样式字段不变
    expect(styled.pages[0].nodes[0].text?.style.fontFamily).toBe('微软雅黑')

    const restored = history.undo(styled) as DiagramDocument
    expect(restored.pages[0].nodes.map((n) => n.text?.style.bold)).toEqual([true, false, false])

    const replayed = history.redo(restored) as DiagramDocument
    expect(replayed.pages[0].nodes.map((n) => n.text?.style.bold)).toEqual([false, false, false])
  })

  it('block/paragraph 三段各自浅合并', () => {
    const document = createTestDocument()
    const command = new TextStyleCommand({
      pageId: 'page-1',
      targets: [
        {
          target: { kind: 'node', nodeId: 'node-1' },
          before: {
            style: { fontSize: 12 },
            block: { horizontalAlign: 'center' },
            paragraph: { lineHeight: 1.2 },
          },
          after: {
            style: { fontSize: 20 },
            block: { horizontalAlign: 'left' },
            paragraph: { lineHeight: 2 },
          },
        },
      ],
    })
    const styled = command.apply(document)
    const text = styled.pages[0].nodes[0].text!
    expect(text.style.fontSize).toBe(20)
    expect(text.block.horizontalAlign).toBe('left')
    expect(text.block.verticalAlign).toBe('middle') // 未涉及字段保持
    expect(text.paragraph.lineHeight).toBe(2)
    expect(text.value).toBe('开始') // 文本值不动

    const reverted = command.revert(styled)
    expect(reverted.pages[0].nodes[0].text!.style.fontSize).toBe(12)
    expect(reverted.pages[0].nodes[0].text!.block.horizontalAlign).toBe('center')
    expect(reverted.pages[0].nodes[0].text!.paragraph.lineHeight).toBe(1.2)
  })

  it('无 text 节点先建默认 TextContent 再合并', () => {
    const base = createTestDocument()
    const document: DiagramDocument = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          nodes: base.pages[0].nodes.map((node) =>
            node.id === 'node-1' ? { ...node, text: undefined } : node,
          ),
        },
      ],
    }
    const command = new TextStyleCommand({
      pageId: 'page-1',
      targets: [
        { target: { kind: 'node', nodeId: 'node-1' }, before: {}, after: boldPatch(true) },
      ],
    })
    const styled = command.apply(document)
    const text = styled.pages[0].nodes[0].text!
    expect(text.value).toBe('')
    expect(text.style.bold).toBe(true)
    expect(text.style.fontFamily).toBe('微软雅黑') // 默认样式补齐
  })

  it('edgeLabel 目标写入边标签样式；可逆', () => {
    const history = new CommandHistory()
    const base = createTestDocument()
    const document: DiagramDocument = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          edges: base.pages[0].edges.map((edge) =>
            edge.id === 'edge-1'
              ? { ...edge, labels: [{ text: createDefaultTextContent('是'), position: 0.5 }] }
              : edge,
          ),
        },
      ],
    }
    const command = new TextStyleCommand({
      pageId: 'page-1',
      targets: [
        {
          target: { kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 0 },
          before: { style: { color: '#000000' } },
          after: { style: { color: '#FF0000' } },
        },
      ],
    })
    const styled = history.execute(command, document)
    expect(styled.pages[0].edges[0].labels[0].text.style.color).toBe('#FF0000')
    expect(styled.pages[0].edges[0].labels[0].text.value).toBe('是')

    const restored = history.undo(styled) as DiagramDocument
    expect(restored.pages[0].edges[0].labels[0].text.style.color).toBe('#000000')
  })

  it('目标不存在抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const badNode = new TextStyleCommand({
      pageId: 'page-1',
      targets: [{ target: { kind: 'node', nodeId: 'node-x' }, before: {}, after: boldPatch(true) }],
    })
    expect(() => badNode.apply(document)).toThrow('命令目标不存在。')
    expect(() => badNode.revert(document)).toThrow('命令目标不存在。')

    const badLabel = new TextStyleCommand({
      pageId: 'page-1',
      targets: [
        { target: { kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 2 }, before: {}, after: boldPatch(true) },
      ],
    })
    expect(() => badLabel.apply(document)).toThrow('命令目标不存在。')
  })

  it('入参文档不被修改；构造后修改入参 patch 不影响命令', () => {
    const document = createTestDocument()
    const after = boldPatch(true)
    const command = new TextStyleCommand({
      pageId: 'page-1',
      targets: [{ target: { kind: 'node', nodeId: 'node-1' }, before: {}, after }],
    })
    after.style!.bold = false // 构造后篡改入参
    const styled = command.apply(document)
    expect(styled.pages[0].nodes[0].text?.style.bold).toBe(true)
    expect(document.pages[0].nodes[0].text?.style.bold).toBe(false)
  })

  it('label 为「文本样式」', () => {
    expect(new TextStyleCommand({ pageId: 'page-1', targets: [] }).label).toBe('文本样式')
  })
})

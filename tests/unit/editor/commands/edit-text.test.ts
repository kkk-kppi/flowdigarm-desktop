// tests/unit/editor/commands/edit-text.test.ts
// 编辑文本命令：节点与边标签目标；超长抛错；一次会话一条记录可逆。
import { CommandHistory } from '@/application/commands/command-history'
import { EditTextCommand } from '@/application/commands/edit-text'
import { MAX_TEXT_LENGTH } from '@/domain/limits'
import { createDefaultTextContent, type DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

describe('编辑文本命令（node 目标）', () => {
  it('写入 node.text.value；可逆', () => {
    const history = new CommandHistory()
    const document = createTestDocument()
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'node', nodeId: 'node-1' },
      before: '开始',
      after: '开始处理',
    })
    const edited = history.execute(command, document)
    expect(history.undoLabel).toBe('编辑文本')
    expect(edited.pages[0].nodes[0].text?.value).toBe('开始处理')
    // 未变更字段保持（样式结构共享原对象）
    expect(edited.pages[0].nodes[0].text?.style).toBe(document.pages[0].nodes[0].text?.style)

    const restored = history.undo(edited) as DiagramDocument
    expect(restored.pages[0].nodes[0].text?.value).toBe('开始')
  })

  it('无 text 节点执行后建默认 TextContent 并写入 after', () => {
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
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'node', nodeId: 'node-1' },
      before: '',
      after: '新建文本',
    })
    const edited = command.apply(document)
    const text = edited.pages[0].nodes[0].text
    expect(text?.value).toBe('新建文本')
    // 默认样式：微软雅黑 12 号
    expect(text?.style.fontFamily).toBe('微软雅黑')
    expect(text?.style.fontSize).toBe(12)

    const reverted = command.revert(edited)
    expect(reverted.pages[0].nodes[0].text?.value).toBe('')
  })

  it('目标节点不存在抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'node', nodeId: 'node-x' },
      before: '',
      after: '甲',
    })
    expect(() => command.apply(document)).toThrow('命令目标不存在。')
    expect(() => command.revert(document)).toThrow('命令目标不存在。')
  })
})

describe('编辑文本命令（edgeLabel 目标）', () => {
  function documentWithEdgeLabel(): DiagramDocument {
    const base = createTestDocument()
    return {
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
  }

  it('labelIndex < labels.length：写入既有标签文本；可逆', () => {
    const history = new CommandHistory()
    const document = documentWithEdgeLabel()
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 0 },
      before: '是',
      after: '条件成立',
    })
    const edited = history.execute(command, document)
    expect(edited.pages[0].edges[0].labels[0].text.value).toBe('条件成立')
    // position 不变
    expect(edited.pages[0].edges[0].labels[0].position).toBe(0.5)

    const restored = history.undo(edited) as DiagramDocument
    expect(restored.pages[0].edges[0].labels[0].text.value).toBe('是')
  })

  it('labelIndex === labels.length：追加新标签（position 0.5）；revert 移除新增标签', () => {
    const history = new CommandHistory()
    const document = documentWithEdgeLabel()
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 1 },
      before: '',
      after: '备注',
    })
    const edited = history.execute(command, document)
    expect(edited.pages[0].edges[0].labels).toHaveLength(2)
    expect(edited.pages[0].edges[0].labels[1].text.value).toBe('备注')
    expect(edited.pages[0].edges[0].labels[1].position).toBe(0.5)

    const restored = history.undo(edited) as DiagramDocument
    expect(restored.pages[0].edges[0].labels).toHaveLength(1)
    expect(restored.pages[0].edges[0].labels[0].text.value).toBe('是')
  })

  it('labelIndex > labels.length 抛「命令目标不存在。」', () => {
    const document = documentWithEdgeLabel()
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 3 },
      before: '',
      after: '甲',
    })
    expect(() => command.apply(document)).toThrow('命令目标不存在。')
  })

  it('目标边不存在抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'edgeLabel', edgeId: 'edge-x', labelIndex: 0 },
      before: '',
      after: '甲',
    })
    expect(() => command.apply(document)).toThrow('命令目标不存在。')
  })
})

describe('编辑文本命令（限制与入参安全）', () => {
  it('after 超长（> MAX_TEXT_LENGTH）构造即抛「文本长度超出限制。」', () => {
    expect(
      () =>
        new EditTextCommand({
          pageId: 'page-1',
          target: { kind: 'node', nodeId: 'node-1' },
          before: '',
          after: '字'.repeat(MAX_TEXT_LENGTH + 1),
        }),
    ).toThrow('文本长度超出限制。')
  })

  it('after 恰为 MAX_TEXT_LENGTH 不抛错', () => {
    expect(
      () =>
        new EditTextCommand({
          pageId: 'page-1',
          target: { kind: 'node', nodeId: 'node-1' },
          before: '',
          after: '字'.repeat(MAX_TEXT_LENGTH),
        }),
    ).not.toThrow()
  })

  it('入参文档不被修改', () => {
    const document = createTestDocument()
    const command = new EditTextCommand({
      pageId: 'page-1',
      target: { kind: 'node', nodeId: 'node-1' },
      before: '开始',
      after: '开始处理',
    })
    command.apply(document)
    expect(document.pages[0].nodes[0].text?.value).toBe('开始')
  })

  it('label 为「编辑文本」', () => {
    expect(
      new EditTextCommand({
        pageId: 'page-1',
        target: { kind: 'node', nodeId: 'node-1' },
        before: '甲',
        after: '乙',
      }).label,
    ).toBe('编辑文本')
  })
})

// tests/unit/editor/commands/command-history.test.ts
import { CommandHistory } from '@/application/commands/command-history'
import type { EditorCommand } from '@/application/commands/editor-command'
import type { DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

function createRenameCommand(id: string, before: string, after: string): EditorCommand {
  return {
    id,
    label: `重命名为${after}`,
    apply: (document) => ({ ...document, name: after }),
    revert: (document) => ({ ...document, name: before }),
  }
}

describe('命令栈', () => {
  it('execute 后 canUndo=true、size=1；undo 还原文档且 canRedo=true；redo 重放', () => {
    const history = new CommandHistory()
    const document = createTestDocument()

    const renamed = history.execute(createRenameCommand('c1', '测试流程图', '订单流程'), document)
    expect(renamed.name).toBe('订单流程')
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
    expect(history.size).toBe(1)

    const restored = history.undo(renamed)
    expect(restored?.name).toBe('测试流程图')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)

    const replayed = history.redo(restored as DiagramDocument)
    expect(replayed?.name).toBe('订单流程')
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('undo 空栈返回 null；redo 空栈返回 null', () => {
    const history = new CommandHistory()
    const document = createTestDocument()
    expect(history.undo(document)).toBeNull()
    expect(history.redo(document)).toBeNull()
  })

  it('execute 新命令清空 redo 栈', () => {
    const history = new CommandHistory()
    const document = createTestDocument()

    const renamed = history.execute(createRenameCommand('c1', '测试流程图', '订单流程'), document)
    history.undo(renamed)
    expect(history.canRedo).toBe(true)

    history.execute(createRenameCommand('c2', '测试流程图', '发货流程'), document)
    expect(history.canRedo).toBe(false)
    expect(history.size).toBe(1)
  })

  it('超出上限丢弃最旧记录', () => {
    const history = new CommandHistory(2)
    let document: DiagramDocument = createTestDocument()
    document = history.execute(createRenameCommand('c1', '测试流程图', '流程一'), document)
    document = history.execute(createRenameCommand('c2', '流程一', '流程二'), document)
    document = history.execute(createRenameCommand('c3', '流程二', '流程三'), document)

    expect(history.size).toBe(2)
    // 最旧的 c1 已被丢弃，只能撤销 c3 与 c2
    document = history.undo(document) as DiagramDocument
    expect(document.name).toBe('流程二')
    document = history.undo(document) as DiagramDocument
    expect(document.name).toBe('流程一')
    expect(history.undo(document)).toBeNull()
  })

  it('apply 抛错时文档与栈不变且错误透传', () => {
    const history = new CommandHistory()
    const document = createTestDocument()
    const failing: EditorCommand = {
      id: 'bad',
      label: '失败命令',
      apply: () => {
        throw new Error('应用失败')
      },
      revert: (doc) => doc,
    }

    expect(() => history.execute(failing, document)).toThrow('应用失败')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
    expect(history.size).toBe(0)
    expect(document.name).toBe('测试流程图')
  })

  it('subscribe 在 execute/undo/redo 时各触发一次；退订后不再触发', () => {
    const history = new CommandHistory()
    const document = createTestDocument()
    const listener = vi.fn()
    const unsubscribe = history.subscribe(listener)

    const renamed = history.execute(createRenameCommand('c1', '测试流程图', '订单流程'), document)
    expect(listener).toHaveBeenCalledTimes(1)

    const restored = history.undo(renamed) as DiagramDocument
    expect(listener).toHaveBeenCalledTimes(2)

    history.redo(restored)
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    history.execute(createRenameCommand('c2', '订单流程', '发货流程'), document)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('undoLabel/redoLabel 返回栈顶命令的中文 label', () => {
    const history = new CommandHistory()
    const document = createTestDocument()
    expect(history.undoLabel).toBeUndefined()
    expect(history.redoLabel).toBeUndefined()

    const renamed = history.execute(createRenameCommand('c1', '测试流程图', '订单流程'), document)
    expect(history.undoLabel).toBe('重命名为订单流程')
    expect(history.redoLabel).toBeUndefined()

    history.undo(renamed)
    expect(history.undoLabel).toBeUndefined()
    expect(history.redoLabel).toBe('重命名为订单流程')
  })
})

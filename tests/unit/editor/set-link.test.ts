// tests/unit/editor/set-link.test.ts
// 设置链接命令：合法设置/清除可逆；非法协议 apply 抛中文错误（文档不变）；
// 空串视为清除（存为 undefined）；标签「设置链接」。
import { describe, expect, it } from 'vitest'
import { CommandHistory } from '@/application/commands/command-history'
import { SetLinkCommand } from '@/application/commands/set-link'
import { createTestDocument } from '../../helpers/test-document'

describe('SetLinkCommand', () => {
  it('节点设置链接 → 撤销恢复 undefined', () => {
    const document = createTestDocument()
    const command = new SetLinkCommand({
      pageId: 'page-1',
      target: { kind: 'node', cellId: 'node-1' },
      before: undefined,
      after: 'https://example.com',
    })
    expect(command.label).toBe('设置链接')

    const applied = command.apply(document)
    expect(applied.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBe(
      'https://example.com',
    )
    // 文档不可变：原文档不变
    expect(document.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBeUndefined()

    const reverted = command.revert(applied)
    expect(reverted.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBeUndefined()
  })

  it('边设置链接并可改/清除（清除存为 undefined）', () => {
    const document = createTestDocument()
    const setCmd = new SetLinkCommand({
      pageId: 'page-1',
      target: { kind: 'edge', cellId: 'edge-1' },
      before: undefined,
      after: 'mailto:a@b.c',
    })
    const withLink = setCmd.apply(document)
    expect(withLink.pages[0].edges.find((e) => e.id === 'edge-1')?.link).toBe('mailto:a@b.c')

    const clearCmd = new SetLinkCommand({
      pageId: 'page-1',
      target: { kind: 'edge', cellId: 'edge-1' },
      before: 'mailto:a@b.c',
      after: '',
    })
    const cleared = clearCmd.apply(withLink)
    expect(cleared.pages[0].edges.find((e) => e.id === 'edge-1')?.link).toBeUndefined()

    const restored = clearCmd.revert(cleared)
    expect(restored.pages[0].edges.find((e) => e.id === 'edge-1')?.link).toBe('mailto:a@b.c')
  })

  it('非法协议 apply 抛「仅支持 http、https、mailto 链接。」（文档不变）', () => {
    const document = createTestDocument()
    const command = new SetLinkCommand({
      pageId: 'page-1',
      target: { kind: 'node', cellId: 'node-1' },
      before: undefined,
      after: 'javascript:alert(1)',
    })
    expect(() => command.apply(document)).toThrow('仅支持 http、https、mailto 链接。')
  })

  it('目标不存在抛「命令目标不存在。」', () => {
    const document = createTestDocument()
    const command = new SetLinkCommand({
      pageId: 'page-1',
      target: { kind: 'node', cellId: '不存在' },
      before: undefined,
      after: 'https://example.com',
    })
    expect(() => command.apply(document)).toThrow('命令目标不存在。')
  })

  it('经命令栈执行：一次设置一条记录，撤销/重做往返一致', () => {
    const document = createTestDocument()
    const history = new CommandHistory()
    const command = new SetLinkCommand({
      pageId: 'page-1',
      target: { kind: 'node', cellId: 'node-2' },
      before: undefined,
      after: 'http://example.com',
    })
    const applied = history.execute(command, document)
    expect(history.size).toBe(1)
    expect(applied.pages[0].nodes.find((n) => n.id === 'node-2')?.link).toBe(
      'http://example.com',
    )
    const undone = history.undo(applied)!
    expect(undone.pages[0].nodes.find((n) => n.id === 'node-2')?.link).toBeUndefined()
    const redone = history.redo(undone)!
    expect(redone.pages[0].nodes.find((n) => n.id === 'node-2')?.link).toBe(
      'http://example.com',
    )
  })
})

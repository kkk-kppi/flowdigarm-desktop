// tests/unit/editor/text/text-session.test.ts
// 文本编辑会话：一次会话一条 EditTextCommand 的纯状态机。
// IME 组合期间禁止 commit；未变更 commit 返回 null；cancel 回原文。
import { TextEditSession } from '@/application/text/text-session'

describe('文本编辑会话', () => {
  it('未变更时 commit 返回 null', () => {
    const session = new TextEditSession('开始')
    expect(session.commit()).toBeNull()
  })

  it('普通输入后 commit 返回最终值', () => {
    const session = new TextEditSession('开始')
    session.update('开始处理')
    expect(session.commit()).toEqual({ value: '开始处理' })
  })

  it('输入后又改回原文，commit 返回 null', () => {
    const session = new TextEditSession('开始')
    session.update('开始处理')
    session.update('开始')
    expect(session.commit()).toBeNull()
  })

  it('IME 组合中 commit 返回 null（组合过程不入栈）', () => {
    const session = new TextEditSession('')
    session.compositionStart()
    session.update('ni')
    expect(session.isComposing).toBe(true)
    expect(session.commit()).toBeNull()
  })

  it('compositionEnd 后可 commit 最终中文', () => {
    const session = new TextEditSession('')
    session.compositionStart()
    session.update('ni')
    session.compositionEnd('你')
    session.update('你好')
    expect(session.isComposing).toBe(false)
    expect(session.commit()).toEqual({ value: '你好' })
  })

  it('cancel 返回原文', () => {
    const session = new TextEditSession('原始文本')
    session.update('被改动的文本')
    expect(session.cancel()).toBe('原始文本')
  })

  it('isComposing 初始为 false', () => {
    expect(new TextEditSession('甲').isComposing).toBe(false)
  })
})

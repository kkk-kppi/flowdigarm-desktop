// src/application/text/text-session.ts
// 文本编辑会话：覆盖式编辑的纯状态机，一次会话对应一条 EditTextCommand。
// IME 组合（compositionstart→compositionend）期间禁止 commit——组合过程的中间拼音不入撤销栈。

export class TextEditSession {
  private current: string
  private composing = false

  constructor(readonly originalValue: string) {
    this.current = originalValue
  }

  /** 普通输入更新当前值。 */
  update(value: string): void {
    this.current = value
  }

  /** IME 组合开始。 */
  compositionStart(): void {
    this.composing = true
  }

  /** IME 组合结束，以上屏文本为当前值。 */
  compositionEnd(value: string): void {
    this.composing = false
    this.current = value
  }

  get isComposing(): boolean {
    return this.composing
  }

  /** 提交：未变更或仍在组合中返回 null（不产生命令）；否则返回最终值。 */
  commit(): { value: string } | null {
    if (this.composing) {
      return null
    }
    if (this.current === this.originalValue) {
      return null
    }
    return { value: this.current }
  }

  /** 取消：返回会话开始前原文（文档不变）。 */
  cancel(): string {
    return this.originalValue
  }
}

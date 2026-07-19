// src/application/commands/command-history.ts
// 用户行为级撤销/重做命令栈：纯 TypeScript，不持有文档、不依赖 Vue/X6。
import type { DiagramDocument } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

export class CommandHistory {
  private undoStack: EditorCommand[] = []
  private redoStack: EditorCommand[] = []
  private readonly listeners = new Set<() => void>()

  constructor(private readonly limit = 100) {}

  execute(command: EditorCommand, document: DiagramDocument): DiagramDocument {
    const next = command.apply(document) // apply 抛错时文档与两栈均不变，错误透传
    this.undoStack.push(command)
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift() // 超上限丢弃最旧记录
    }
    this.redoStack = []
    this.notify()
    return next
  }

  undo(document: DiagramDocument): DiagramDocument | null {
    const command = this.undoStack[this.undoStack.length - 1]
    if (!command) return null
    const next = command.revert(document) // revert 抛错时命令留在原栈
    this.undoStack.pop()
    this.redoStack.push(command)
    this.notify()
    return next
  }

  redo(document: DiagramDocument): DiagramDocument | null {
    const command = this.redoStack[this.redoStack.length - 1]
    if (!command) return null
    const next = command.apply(document) // apply 抛错时命令留在原栈
    this.redoStack.pop()
    this.undoStack.push(command)
    this.notify()
    return next
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label
  }

  get redoLabel(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.label
  }

  get size(): number {
    return this.undoStack.length
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

// src/infrastructure/x6/selection-bridge.ts
// X6 Selection 与领域选择之间的桥：X6 选择只做视觉与交互，
// 领域选择真源由后续 store 持有（本任务仅提供桥接能力）。
import type { Graph } from '@antv/x6'

export class SelectionBridge {
  constructor(private readonly graph: Graph) {}

  /** 当前选中 Cell 的 id 列表（节点与边）。 */
  selectedIds(): string[] {
    return this.graph.getSelectedCells().map((cell) => cell.id)
  }

  /** 以给定 id 集合替换当前选择。 */
  select(ids: string[]): void {
    this.graph.resetSelection(ids)
  }

  /** 清空选择。 */
  clear(): void {
    this.graph.cleanSelection()
  }

  /** 订阅选择变化；返回退订函数。 */
  subscribe(listener: (ids: string[]) => void): () => void {
    const handler = () => listener(this.selectedIds())
    this.graph.on('selection:changed', handler)
    return () => {
      this.graph.off('selection:changed', handler)
    }
  }
}

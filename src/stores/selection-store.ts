// src/stores/selection-store.ts
// 选择 store：当前页选中图元 ID 列表，保序（首元素=选择锚点，详细设计 §15）。
// 选择为视图状态，不进入撤销历史；切换页时由 document-store 调 clear()。
import { defineStore } from 'pinia'

interface SelectionState {
  /** 保序选中 ID 列表；首元素为选择锚点。 */
  selectedIds: string[]
}

export const useSelectionStore = defineStore('selection', {
  state: (): SelectionState => ({
    selectedIds: [],
  }),
  getters: {
    /** 选择锚点：选择序列第一个图元；无选择时为 undefined。 */
    anchorId: (state): string | undefined => state.selectedIds[0],
    count: (state): number => state.selectedIds.length,
    hasSelection: (state): boolean => state.selectedIds.length > 0,
    isSelected: (state) => (id: string): boolean => state.selectedIds.includes(id),
  },
  actions: {
    /** 整体替换选择（保序，首元素为锚点）。 */
    setSelection(ids: string[]) {
      this.selectedIds = [...ids]
    },
    /** 切换选中：已选中则移除，否则追加到末尾。 */
    toggle(id: string) {
      if (this.selectedIds.includes(id)) {
        this.selectedIds = this.selectedIds.filter((selected) => selected !== id)
      } else {
        this.selectedIds = [...this.selectedIds, id]
      }
    },
    /** 追加选中（已存在的去重，保持既有顺序）。 */
    addToSelection(ids: string[]) {
      const existing = new Set(this.selectedIds)
      this.selectedIds = [...this.selectedIds, ...ids.filter((id) => !existing.has(id))]
    },
    /** 移除指定项（保持剩余顺序）。 */
    removeFromSelection(ids: string[]) {
      const removing = new Set(ids)
      this.selectedIds = this.selectedIds.filter((id) => !removing.has(id))
    },
    clear() {
      this.selectedIds = []
    },
  },
})

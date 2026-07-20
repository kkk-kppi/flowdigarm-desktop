// src/stores/format-paint-store.ts
// 格式刷 store：模式状态机 off → once →（应用一次）→ off；off → continuous →（Esc/空白点击）→ off。
// 应用经 document-store 执行 createFormatPaintCommand（一次应用一条「格式刷」记录）；
// 游标反馈由 CanvasArea 读取 mode≠off 时加 CSS 类 format-painting。
import { defineStore } from 'pinia'
import { createFormatPaintCommand } from '@/application/commands/apply-format-paint'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'

export type FormatPaintMode = 'off' | 'once' | 'continuous'

interface FormatPaintState {
  mode: FormatPaintMode
  sourceCellId: string | null
}

/** 恰好 1 个选中图元（当前页内存在）时返回其 id，否则 null。 */
function singleSelectedCellId(): string | null {
  const selection = useSelectionStore()
  if (selection.selectedIds.length !== 1) {
    return null
  }
  const id = selection.selectedIds[0]
  const page = useDocumentStore().activePage
  const exists = page?.nodes.some((n) => n.id === id) || page?.edges.some((e) => e.id === id)
  return exists ? id : null
}

export const useFormatPaintStore = defineStore('format-paint', {
  state: (): FormatPaintState => ({
    mode: 'off',
    sourceCellId: null,
  }),
  actions: {
    /** 单击：恰好 1 个选中图元（页面内存在）时捕获为源并进入 once；否则不动作。 */
    armOnce() {
      const sourceId = singleSelectedCellId()
      if (sourceId !== null) {
        this.sourceCellId = sourceId
        this.mode = 'once'
      }
    },
    /** 双击/锁定：连续模式（同样要求恰好 1 个选中图元作为源）。 */
    armContinuous() {
      const sourceId = singleSelectedCellId()
      if (sourceId !== null) {
        this.sourceCellId = sourceId
        this.mode = 'continuous'
      }
    },
    /** 应用格式到目标；无效目标返回 false 且不退模式。once 应用后自动 off 并清源。 */
    applyTo(targetId: string): boolean {
      if (this.mode === 'off' || this.sourceCellId === null) {
        return false
      }
      const documentStore = useDocumentStore()
      const page = documentStore.activePage
      if (!page) {
        return false
      }
      const command = createFormatPaintCommand(page, this.sourceCellId, [targetId])
      if (!command) {
        return false
      }
      documentStore.executeCommand(command)
      if (this.mode === 'once') {
        this.mode = 'off'
        this.sourceCellId = null
      }
      return true
    },
    /** Esc / 点击空白：退出格式刷并清源。 */
    cancel() {
      this.mode = 'off'
      this.sourceCellId = null
    },
  },
})

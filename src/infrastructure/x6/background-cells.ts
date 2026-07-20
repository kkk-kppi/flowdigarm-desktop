// src/infrastructure/x6/background-cells.ts
// 背景页 cell 元数据与交互谓词的纯函数实现（jsdom 可测）：
// 背景页内容渲染在前景页之下（zIndex 整体压底），且不可在前景页直接选择/交互——
// graph-adapter 的 Graph interacting 与 Selection filter 均调用本文件谓词。
import type { CellMetadata } from './cell-mapper'

/** 背景页 cells 的 zIndex 整体偏移量（压到前景之下；领域 zIndex 为非负小值）。 */
export const BACKGROUND_Z_OFFSET = 1000

/** 背景页 cells 的 data 标记：interacting 与 Selection filter 据此禁止交互/选择。 */
export const BACKGROUND_CELL_DATA = { background: true } as const

/** 由 cell-mapper 元数据生成背景页 cell 元数据：zIndex 压底 + data 标记（不改原对象）。 */
export function toBackgroundCell(meta: CellMetadata): CellMetadata {
  return { ...meta, zIndex: meta.zIndex - BACKGROUND_Z_OFFSET, data: { ...BACKGROUND_CELL_DATA } }
}

/** 判断 cell data 是否为背景页标记。 */
export function isBackgroundCellData(data: unknown): boolean {
  return (data as { background?: boolean } | null | undefined)?.background === true
}

/** Graph interacting / Selection filter 共用谓词：背景页 cell 不可交互、不可选。 */
export function isCellInteractable(cell: { getData(): unknown }): boolean {
  return !isBackgroundCellData(cell.getData())
}

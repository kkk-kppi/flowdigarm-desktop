// src/application/pages/page-breaks.ts
// 分页符：真实打印分块线。打印纸固定为 A4 纵向，打印页 = 纸张 − 四边 PRINTER_MARGIN_PT
// 打印机边距；分块数 = ceil(页面 / 可打印)；线位于可打印宽/高的整数倍处（严格小于页面
// 尺寸）。单张可打印区域 ≥ 页面 → 无分页线。纯计算，不改文档、不入撤销历史。
import { paperSizeFor } from '@/domain/paper-presets'

// 5mm 打印机边距：unitToPt(5, 'mm') = 5 × 72/25.4 ≈ 14.1732pt，保留 3 位小数为 14.173。
export const PRINTER_MARGIN_PT = 14.173

/** A4 打印纸减四边 5mm 边距后的单张可打印区域（pt）：566.930 × 813.544。 */
const PRINTABLE_SHEET_PT = {
  width: paperSizeFor('a4').width - 2 * PRINTER_MARGIN_PT,
  height: paperSizeFor('a4').height - 2 * PRINTER_MARGIN_PT,
}

export interface PageBreaks {
  /** 竖直分页线的 pt x 坐标 */
  vertical: number[]
  /** 水平分页线的 pt y 坐标 */
  horizontal: number[]
}

function breakLines(pageSizePt: number, printablePt: number): number[] {
  const blocks = Math.ceil(pageSizePt / printablePt)
  const lines: number[] = []
  for (let k = 1; k < blocks; k++) {
    const at = k * printablePt
    if (at < pageSizePt) {
      lines.push(at)
    }
  }
  return lines
}

/** 计算页面（pt 尺寸）的打印分块线位置（pt 坐标）。 */
export function computePageBreaks(pagePt: { width: number; height: number }): PageBreaks {
  return {
    vertical: breakLines(pagePt.width, PRINTABLE_SHEET_PT.width),
    horizontal: breakLines(pagePt.height, PRINTABLE_SHEET_PT.height),
  }
}

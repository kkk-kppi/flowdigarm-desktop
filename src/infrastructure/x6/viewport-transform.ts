// src/infrastructure/x6/viewport-transform.ts
// pt ↔ CSS px 视口数学唯一真源：screenPx = panPx + documentPt × 96/72 × zoom。
// 全局只允许本文件定义 96/72 换算系数；devicePixelRatio 不得进入文档/命中/撤销逻辑。

/** 唯一 pt→CSS px 换算系数：1 pt = 96/72 CSS px（100% 缩放 = 96 CSS px/in）。 */
export const PT_TO_CSS_PX = 96 / 72

/** 视口状态：zoom 为用户缩放（1 = 100%），pan 单位为 CSS px。 */
export interface ViewportState {
  zoom: number
  panX: number
  panY: number
}

/**
 * 文档 pt 与屏幕 CSS px 的双向换算。
 * 一维便捷方法（documentPtToScreenPx/screenPxToDocumentPt）沿 X 轴（使用 panX）；
 * Y 轴换算请使用 pointToScreen/pointToDocument。
 */
export class ViewportTransform {
  constructor(private readonly state: ViewportState) {}

  /** 文档 pt → 屏幕 CSS px（X 轴）：panX + pt × 96/72 × zoom。 */
  documentPtToScreenPx(pt: number): number {
    return this.state.panX + this.ptLengthToPx(pt)
  }

  /** 屏幕 CSS px → 文档 pt（X 轴），documentPtToScreenPx 的逆变换。 */
  screenPxToDocumentPt(px: number): number {
    return (px - this.state.panX) / (PT_TO_CSS_PX * this.state.zoom)
  }

  /** 纯长度换算（无 pan）：pt × 96/72 × zoom。 */
  ptLengthToPx(pt: number): number {
    return pt * PT_TO_CSS_PX * this.state.zoom
  }

  /** 二维点：文档 pt → 屏幕 CSS px。 */
  pointToScreen(pt: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.state.panX + pt.x * PT_TO_CSS_PX * this.state.zoom,
      y: this.state.panY + pt.y * PT_TO_CSS_PX * this.state.zoom,
    }
  }

  /** 二维点：屏幕 CSS px → 文档 pt。 */
  pointToDocument(px: { x: number; y: number }): { x: number; y: number } {
    return {
      x: (px.x - this.state.panX) / (PT_TO_CSS_PX * this.state.zoom),
      y: (px.y - this.state.panY) / (PT_TO_CSS_PX * this.state.zoom),
    }
  }
}

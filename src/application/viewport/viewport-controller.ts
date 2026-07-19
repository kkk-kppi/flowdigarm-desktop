// src/application/viewport/viewport-controller.ts
// 视口控制器：缩放/平移/适应（窗口/页面/内容/选择）只改视口状态，
// 不修改文档、不产生撤销记录（视图操作不进入撤销历史）。
import { PT_TO_CSS_PX, type ViewportState } from '@/infrastructure/x6/viewport-transform'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

const DEFAULT_STATE: ViewportState = { zoom: 1, panX: 0, panY: 0 }
const DEFAULT_FIT_PADDING_PX = 24
const ZOOM_STEP = 1.25

interface Size {
  width: number
  height: number
}

interface BBox extends Size {
  x: number
  y: number
}

type ViewportListener = (state: ViewportState) => void

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export class ViewportController {
  private readonly current: ViewportState
  private readonly listeners = new Set<ViewportListener>()

  constructor(initial?: Partial<ViewportState>) {
    this.current = { ...DEFAULT_STATE, ...initial }
  }

  get state(): ViewportState {
    return { ...this.current }
  }

  /** 设置缩放（钳制 0.1–4）；anchorPx 为屏幕锚点时保持锚点下的文档 pt 不变。 */
  setZoom(zoom: number, anchorPx?: { x: number; y: number }): void {
    const next = clampZoom(zoom)
    if (anchorPx) {
      // 锚点 pt = (anchor - pan) / (96/72 × zoom)，缩放前后保持不变，
      // 故 pan' = anchor - (anchor - pan) × (zoom'/zoom)
      this.current.panX = anchorPx.x - ((anchorPx.x - this.current.panX) * next) / this.current.zoom
      this.current.panY = anchorPx.y - ((anchorPx.y - this.current.panY) * next) / this.current.zoom
    }
    this.current.zoom = next
    this.emit()
  }

  /** 放大一档（×1.25，钳制）。 */
  zoomIn(): void {
    this.setZoom(this.current.zoom * ZOOM_STEP)
  }

  /** 缩小一档（÷1.25，钳制）。 */
  zoomOut(): void {
    this.setZoom(this.current.zoom / ZOOM_STEP)
  }

  /** 增量平移（CSS px）。 */
  panBy(dxPx: number, dyPx: number): void {
    this.current.panX += dxPx
    this.current.panY += dyPx
    this.emit()
  }

  /** 直接设置平移（CSS px）。 */
  setPan(panX: number, panY: number): void {
    this.current.panX = panX
    this.current.panY = panY
    this.emit()
  }

  /** 适应页面：整页（pt 尺寸）以 padding 内边距适配视口并居中。 */
  fitToPage(pagePt: Size, viewportPx: Size, paddingPx: number = DEFAULT_FIT_PADDING_PX): void {
    this.fitRect({ x: 0, y: 0, width: pagePt.width, height: pagePt.height }, viewportPx, paddingPx)
  }

  /** 适应内容：bbox 为 null 时不动作（是否回退 fitToPage 由调用方决定）。 */
  fitToContent(bboxPt: BBox | null, viewportPx: Size, paddingPx: number = DEFAULT_FIT_PADDING_PX): void {
    if (!bboxPt) {
      return
    }
    this.fitRect(bboxPt, viewportPx, paddingPx)
  }

  /** 适应选择：选中图元 bbox 适配视口并居中。 */
  fitToSelection(bboxPt: BBox, viewportPx: Size, paddingPx: number = DEFAULT_FIT_PADDING_PX): void {
    this.fitRect(bboxPt, viewportPx, paddingPx)
  }

  /** 订阅视口变更；返回退订函数。 */
  subscribe(listener: ViewportListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** zoom = clamp(min((vw-2p)/w, (vh-2p)/h))；pan 使目标 pt 矩形在视口居中。 */
  private fitRect(rectPt: BBox, viewportPx: Size, paddingPx: number): void {
    const zoom = clampZoom(
      Math.min(
        (viewportPx.width - 2 * paddingPx) / (rectPt.width * PT_TO_CSS_PX),
        (viewportPx.height - 2 * paddingPx) / (rectPt.height * PT_TO_CSS_PX),
      ),
    )
    this.current.zoom = zoom
    this.current.panX =
      (viewportPx.width - rectPt.width * PT_TO_CSS_PX * zoom) / 2 - rectPt.x * PT_TO_CSS_PX * zoom
    this.current.panY =
      (viewportPx.height - rectPt.height * PT_TO_CSS_PX * zoom) / 2 - rectPt.y * PT_TO_CSS_PX * zoom
    this.emit()
  }

  private emit(): void {
    const snapshot = this.state
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}

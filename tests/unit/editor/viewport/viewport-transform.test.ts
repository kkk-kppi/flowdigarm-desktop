// tests/unit/editor/viewport/viewport-transform.test.ts
// 视口数学唯一真源：screenPx = panPx + documentPt × 96/72 × zoom。
import { PT_TO_CSS_PX, ViewportTransform } from '@/infrastructure/x6/viewport-transform'

describe('ViewportTransform', () => {
  it('换算系数 PT_TO_CSS_PX 等于 96/72', () => {
    expect(PT_TO_CSS_PX).toBeCloseTo(96 / 72, 10)
  })

  it('zoom=1、pan=0 时 72pt 换算为 96 CSS px（100% 缩放 = 96px/in）', () => {
    const transform = new ViewportTransform({ zoom: 1, panX: 0, panY: 0 })
    expect(transform.documentPtToScreenPx(72)).toBe(96)
  })

  it('pan=10 时结果叠加平移量', () => {
    const transform = new ViewportTransform({ zoom: 1, panX: 10, panY: 10 })
    expect(transform.documentPtToScreenPx(72)).toBe(106)
  })

  it('screenPxToDocumentPt 是 documentPtToScreenPx 的逆变换', () => {
    const transform = new ViewportTransform({ zoom: 1, panX: 10, panY: 10 })
    expect(transform.screenPxToDocumentPt(106)).toBeCloseTo(72, 10)
  })

  it('zoom=2 时 72pt 换算为 192 CSS px', () => {
    const transform = new ViewportTransform({ zoom: 2, panX: 0, panY: 0 })
    expect(transform.documentPtToScreenPx(72)).toBe(192)
  })

  it('ptLengthToPx 只做纯长度换算，不含 pan', () => {
    const transform = new ViewportTransform({ zoom: 2, panX: 100, panY: 100 })
    expect(transform.ptLengthToPx(72)).toBe(192)
  })

  it('pointToScreen 与 pointToDocument 往返还原', () => {
    const transform = new ViewportTransform({ zoom: 1.5, panX: -30, panY: 55 })
    const point = { x: 123.456, y: -78.9 }
    const roundTrip = transform.pointToDocument(transform.pointToScreen(point))
    expect(roundTrip.x).toBeCloseTo(point.x, 10)
    expect(roundTrip.y).toBeCloseTo(point.y, 10)
  })

  it('pointToScreen 分别使用 panX 与 panY', () => {
    const transform = new ViewportTransform({ zoom: 1, panX: 10, panY: 20 })
    const screen = transform.pointToScreen({ x: 72, y: 72 })
    expect(screen.x).toBe(106)
    expect(screen.y).toBe(116)
  })
})

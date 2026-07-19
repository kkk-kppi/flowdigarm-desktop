// tests/unit/editor/viewport/viewport-controller.test.ts
// 视口控制器：纯视口状态（zoom/pan），不修改文档、不产生撤销记录。
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ViewportController,
} from '@/application/viewport/viewport-controller'

describe('ViewportController', () => {
  it('默认状态为 zoom=1、pan=(0,0)，支持 initial 部分覆盖', () => {
    expect(new ViewportController().state).toEqual({ zoom: 1, panX: 0, panY: 0 })
    expect(new ViewportController({ zoom: 2, panX: 10 }).state).toEqual({
      zoom: 2,
      panX: 10,
      panY: 0,
    })
  })

  it('setZoom 将缩放钳制在 0.1–4', () => {
    const controller = new ViewportController()
    controller.setZoom(10)
    expect(controller.state.zoom).toBe(MAX_ZOOM)
    controller.setZoom(0.01)
    expect(controller.state.zoom).toBe(MIN_ZOOM)
    controller.setZoom(2)
    expect(controller.state.zoom).toBe(2)
  })

  it('zoomIn 放大 ×1.25，zoomOut 缩小 ÷1.25，均受钳制', () => {
    const controller = new ViewportController()
    controller.zoomIn()
    expect(controller.state.zoom).toBe(1.25)
    controller.zoomOut()
    expect(controller.state.zoom).toBe(1)
    controller.setZoom(4)
    controller.zoomIn()
    expect(controller.state.zoom).toBe(4)
    controller.setZoom(0.1)
    controller.zoomOut()
    expect(controller.state.zoom).toBe(0.1)
  })

  it('带锚点缩放保持锚点下的文档 pt 不变', () => {
    const controller = new ViewportController()
    controller.setZoom(2, { x: 100, y: 50 })
    // 锚点 pt：(100-0)/(96/72×1)=75pt；缩放后 pan = anchor - pt×96/72×2
    expect(controller.state.zoom).toBe(2)
    expect(controller.state.panX).toBeCloseTo(-100, 10)
    expect(controller.state.panY).toBeCloseTo(-50, 10)
    // 验证：锚点屏幕坐标反算回同一 pt
    const ptX = (100 - controller.state.panX) / ((96 / 72) * 2)
    const ptY = (50 - controller.state.panY) / ((96 / 72) * 2)
    expect(ptX).toBeCloseTo(75, 10)
    expect(ptY).toBeCloseTo(37.5, 10)
  })

  it('panBy 增量平移，setPan 直接设置', () => {
    const controller = new ViewportController()
    controller.panBy(10, 20)
    expect(controller.state).toMatchObject({ panX: 10, panY: 20 })
    controller.panBy(-5, 5)
    expect(controller.state).toMatchObject({ panX: 5, panY: 25 })
    controller.setPan(100, 200)
    expect(controller.state).toMatchObject({ panX: 100, panY: 200 })
  })

  it('fitToPage：A4（595.276×841.89pt）在 1000×700 视口、padding 20 下居中', () => {
    const controller = new ViewportController()
    controller.fitToPage(
      { width: 595.276, height: 841.89 },
      { width: 1000, height: 700 },
      20,
    )
    // 手算：zoom = min(960/793.7013, 660/1122.52) = 0.587963（高度受限）
    expect(controller.state.zoom).toBeCloseTo(0.587963, 5)
    // panX = (1000 - 793.7013×0.587963)/2 = 266.667；panY = (700-660)/2 = 20
    expect(controller.state.panX).toBeCloseTo(266.667, 2)
    expect(controller.state.panY).toBeCloseTo(20, 5)
  })

  it('fitToPage 的 zoom 同样钳制在 0.1–4', () => {
    const controller = new ViewportController()
    controller.fitToPage({ width: 595.276, height: 841.89 }, { width: 100, height: 100 }, 0)
    expect(controller.state.zoom).toBe(MIN_ZOOM)
    controller.fitToPage({ width: 72, height: 72 }, { width: 100000, height: 100000 }, 0)
    expect(controller.state.zoom).toBe(MAX_ZOOM)
  })

  it('fitToContent 使内容 bbox 居中', () => {
    const controller = new ViewportController()
    controller.fitToContent(
      { x: 10, y: 20, width: 100, height: 50 },
      { width: 500, height: 400 },
      0,
    )
    // 手算：zoom = min(500/133.333, 400/66.667) = 3.75
    expect(controller.state.zoom).toBeCloseTo(3.75, 10)
    // panX = (500-500)/2 - 10×96/72×3.75 = -50；panY = (400-250)/2 - 20×96/72×3.75 = -25
    expect(controller.state.panX).toBeCloseTo(-50, 10)
    expect(controller.state.panY).toBeCloseTo(-25, 10)
  })

  it('fitToContent(null) 不改变视口（由调用方决定是否回退 fitToPage）', () => {
    const controller = new ViewportController({ zoom: 2, panX: 10, panY: 20 })
    controller.fitToContent(null, { width: 500, height: 400 }, 0)
    expect(controller.state).toEqual({ zoom: 2, panX: 10, panY: 20 })
  })

  it('fitToSelection 与 fitToContent 使用同一居中公式', () => {
    const controller = new ViewportController()
    controller.fitToSelection(
      { x: 10, y: 20, width: 100, height: 50 },
      { width: 500, height: 400 },
      0,
    )
    expect(controller.state.zoom).toBeCloseTo(3.75, 10)
    expect(controller.state.panX).toBeCloseTo(-50, 10)
    expect(controller.state.panY).toBeCloseTo(-25, 10)
  })

  it('subscribe 在每次视口变更时触发，退订后不再触发', () => {
    const controller = new ViewportController()
    const states: number[] = []
    const unsubscribe = controller.subscribe((state) => states.push(state.zoom))
    controller.setZoom(2)
    controller.panBy(1, 1)
    controller.fitToPage({ width: 100, height: 100 }, { width: 200, height: 200 }, 0)
    expect(states).toHaveLength(3)
    expect(states[0]).toBe(2)
    unsubscribe()
    controller.setZoom(3)
    expect(states).toHaveLength(3)
  })
})

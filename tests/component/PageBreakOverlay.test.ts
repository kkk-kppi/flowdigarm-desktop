// tests/component/PageBreakOverlay.test.ts
// 分页符叠层：visible 时按 computePageBreaks 渲染低对比虚线（位置经 ViewportTransform 换算）；
// visible=false 或页面不大于单张可打印区域时不渲染。
import { mount } from '@vue/test-utils'
import PageBreakOverlay from '@/ui/canvas/PageBreakOverlay.vue'
import { createEmptyPage } from '@/domain/diagram'

const VIEWPORT = { zoom: 1, panX: 0, panY: 0 }

function styleOf(element: unknown): CSSStyleDeclaration {
  return (element as HTMLElement).style
}

describe('PageBreakOverlay', () => {
  it('showPageBreaks 开时按 computePageBreaks 渲染线数（A4 → 2 条：竖 1 + 横 1）', () => {
    const wrapper = mount(PageBreakOverlay, {
      props: { page: createEmptyPage(), viewport: VIEWPORT, visible: true },
    })
    expect(wrapper.find('[data-testid="page-break-overlay"]').exists()).toBe(true)
    expect(wrapper.findAll('.page-break-line.vertical')).toHaveLength(1)
    expect(wrapper.findAll('.page-break-line.horizontal')).toHaveLength(1)
  })

  it('分页线位置经 ViewportTransform 换算：首条竖线 left ≈ 755.906px（zoom=1, pan=0）', () => {
    const wrapper = mount(PageBreakOverlay, {
      props: { page: createEmptyPage(), viewport: VIEWPORT, visible: true },
    })
    const vertical = wrapper.find('.page-break-line.vertical')
    // (595.2756 − 2×14.173)pt × 96/72 × 1 = 755.9061px
    expect(Number.parseFloat(styleOf(vertical.element).left)).toBeCloseTo(755.9061, 3)
    expect(Number.parseFloat(styleOf(vertical.element).top)).toBeCloseTo(0, 6)
    // 线高 = 页面高度 841.8898pt × 96/72 = 1122.5197px
    expect(Number.parseFloat(styleOf(vertical.element).height)).toBeCloseTo(1122.5197, 3)

    const horizontal = wrapper.find('.page-break-line.horizontal')
    // (841.8898 − 2×14.173)pt × 96/72 = 1084.7250px
    expect(Number.parseFloat(styleOf(horizontal.element).top)).toBeCloseTo(1084.725, 3)
    // 线宽 = 页面宽度 595.2756pt × 96/72 = 793.7008px
    expect(Number.parseFloat(styleOf(horizontal.element).width)).toBeCloseTo(793.7008, 3)
  })

  it('pan/zoom 参与换算：panX=100、zoom=2 时竖线 left = 100 + 566.9296×96/72×2', () => {
    const wrapper = mount(PageBreakOverlay, {
      props: { page: createEmptyPage(), viewport: { zoom: 2, panX: 100, panY: 50 }, visible: true },
    })
    const vertical = wrapper.find('.page-break-line.vertical')
    expect(Number.parseFloat(styleOf(vertical.element).left)).toBeCloseTo(
      100 + 566.9296 * (96 / 72) * 2,
      3,
    )
  })

  it('showPageBreaks 关时不渲染', () => {
    const wrapper = mount(PageBreakOverlay, {
      props: { page: createEmptyPage(), viewport: VIEWPORT, visible: false },
    })
    expect(wrapper.find('[data-testid="page-break-overlay"]').exists()).toBe(false)
    expect(wrapper.findAll('.page-break-line')).toHaveLength(0)
  })

  it('页面不大于单张可打印区域时不渲染任何线', () => {
    const small = createEmptyPage({ pageSize: { preset: 'custom', width: 500, height: 700 } })
    const wrapper = mount(PageBreakOverlay, {
      props: { page: small, viewport: VIEWPORT, visible: true },
    })
    expect(wrapper.findAll('.page-break-line')).toHaveLength(0)
  })

  it('叠层不拦截指针事件', () => {
    const wrapper = mount(PageBreakOverlay, {
      props: { page: createEmptyPage(), viewport: VIEWPORT, visible: true },
    })
    expect(wrapper.find('[data-testid="page-break-overlay"]').classes()).toContain('pointer-none')
  })
})

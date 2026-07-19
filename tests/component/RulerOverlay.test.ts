// tests/component/RulerOverlay.test.ts
// 标尺叠层：主刻度标签用 <span> 渲染（可测试）；canvas 绘制判空保护。
import { mount } from '@vue/test-utils'
import RulerOverlay from '@/ui/canvas/RulerOverlay.vue'

function labelTexts(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('.ruler-label').map((label) => label.text())
}

describe('RulerOverlay', () => {
  beforeEach(() => {
    // jsdom 的 getContext('2d') 返回 null 并打印 Not implemented；显式 mock 保持输出干净。
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('水平标尺：cm、zoom=1、pan=0 时主刻度标签为 0/2/4/6/8/10', () => {
    const wrapper = mount(RulerOverlay, {
      props: {
        orientation: 'horizontal',
        unit: 'cm',
        viewport: { zoom: 1, panX: 0, panY: 0 },
        lengthPx: 400,
      },
    })
    expect(wrapper.attributes('data-testid')).toBe('ruler-horizontal')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    // cm@1 主刻度 2cm（75.59px），400px 视窗容纳 0–10cm
    expect(labelTexts(wrapper)).toEqual(['0', '2', '4', '6', '8', '10'])
  })

  it('已知 pan 下从屏幕坐标反算文档 pt：panX=100 时标签为 -2/0/2/4/6', () => {
    const wrapper = mount(RulerOverlay, {
      props: {
        orientation: 'horizontal',
        unit: 'cm',
        viewport: { zoom: 1, panX: 100, panY: 0 },
        lengthPx: 400,
      },
    })
    expect(labelTexts(wrapper)).toEqual(['-2', '0', '2', '4', '6'])
  })

  it('垂直标尺：使用 panY，data-testid 为 ruler-vertical', () => {
    const wrapper = mount(RulerOverlay, {
      props: {
        orientation: 'vertical',
        unit: 'cm',
        viewport: { zoom: 1, panX: 0, panY: 0 },
        lengthPx: 200,
      },
    })
    expect(wrapper.attributes('data-testid')).toBe('ruler-vertical')
    // 200px 视窗 → 0–150pt → 0–5.29cm → 主刻度 0/2/4
    expect(labelTexts(wrapper)).toEqual(['0', '2', '4'])
  })

  it('prop 变更后标签更新：zoom 1→2 时主刻度变为 1cm 间隔', () => {
    const wrapper = mount(RulerOverlay, {
      props: {
        orientation: 'horizontal',
        unit: 'cm',
        viewport: { zoom: 1, panX: 0, panY: 0 },
        lengthPx: 400,
      },
    })
    return wrapper
      .setProps({ viewport: { zoom: 2, panX: 0, panY: 0 } })
      .then(() => {
        // zoom=2 可见范围 0–150pt → 0–5.29cm；cm@2 主刻度 1cm
        expect(labelTexts(wrapper)).toEqual(['0', '1', '2', '3', '4', '5'])
      })
  })

  it('切换单位后标签按新单位显示', () => {
    const wrapper = mount(RulerOverlay, {
      props: {
        orientation: 'horizontal',
        unit: 'cm',
        viewport: { zoom: 1, panX: 0, panY: 0 },
        lengthPx: 400,
      },
    })
    return wrapper.setProps({ unit: 'mm' }).then(() => {
      // mm@1 主刻度 20mm；400px → 0–300pt → 0–105.83mm
      expect(labelTexts(wrapper)).toEqual(['0', '20', '40', '60', '80', '100'])
    })
  })

  it('canvas 2d 上下文为 null 时不报错且标签仍渲染', () => {
    expect(HTMLCanvasElement.prototype.getContext('2d' as never)).toBeNull()
    const wrapper = mount(RulerOverlay, {
      props: {
        orientation: 'horizontal',
        unit: 'cm',
        viewport: { zoom: 1, panX: 0, panY: 0 },
        lengthPx: 400,
      },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(labelTexts(wrapper).length).toBeGreaterThan(0)
  })
})

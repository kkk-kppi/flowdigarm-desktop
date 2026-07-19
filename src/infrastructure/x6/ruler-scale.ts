// src/infrastructure/x6/ruler-scale.ts
// 标尺刻度自适应：主刻度取 1/2/5×10ⁿ（当前单位制）中换算后首个 ≥ 60 CSS px 者；
// 次刻度为主刻度的 1/5。换算系数 96/72 只允许来自 viewport-transform。
import { unitToPt, type Unit } from '@/domain/measurement'
import { PT_TO_CSS_PX } from './viewport-transform'

export interface RulerScale {
  /** 主刻度步长（当前单位，如 2cm、20mm、0.5in） */
  majorStep: number
  /** 次刻度步长 = majorStep / 5 */
  minorStep: number
  /** 主刻度屏幕间距（CSS px），目标约 60–120，极端为首个 ≥60 的候选 */
  majorPx: number
  /** 次刻度屏幕间距（CSS px），约 8–20 */
  minorPx: number
  /** 主刻度标签小数位：步长为单位整数时 0 位，否则按需（0.2→1 位、0.05→2 位） */
  labelDecimals: number
}

const STEP_MANTISSAS = [1, 2, 5] as const
// n 可正可负：覆盖 zoom 0.1–4 下全部单位（最极端 px@0.1 需 10³）；正常流程必然命中。
const MIN_EXPONENT = -12
const MAX_EXPONENT = 12

/**
 * 计算标尺刻度。算法：按步长升序扫描 1/2/5×10ⁿ 候选，
 * 取换算后（unitToPt × 96/72 × zoom）首个 ≥ 60 CSS px 者；
 * 即使该候选超过 120px（如 1×10ⁿ 已超 120 而上一候选不足 60）也直接采用。
 */
export function computeRulerScale(unit: Unit, zoom: number): RulerScale {
  for (let n = MIN_EXPONENT; n <= MAX_EXPONENT; n++) {
    for (const mantissa of STEP_MANTISSAS) {
      const majorStep = mantissa * 10 ** n
      const majorPx = unitToPt(majorStep, unit) * PT_TO_CSS_PX * zoom
      if (majorPx >= 60) {
        return {
          majorStep,
          minorStep: majorStep / 5,
          majorPx,
          minorPx: majorPx / 5,
          labelDecimals: Number.isInteger(majorStep) ? 0 : Math.max(0, -n),
        }
      }
    }
  }
  // 不可达：n 范围对全部合法单位与缩放总能给出 ≥60px 的候选。
  throw new Error(`无法为 ${unit}@${zoom} 计算标尺刻度`)
}

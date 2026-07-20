// src/application/inspector/aggregate-display.ts
// 聚合显示辅助：属性面板与紧凑工具栏共用——Aggregate<T> → 控件显示值的纯函数。
import type { Aggregate } from '@/application/inspector/aggregate-style'

/** 颜色控件显示值：value 且为字符串 → 该值；mixed/none/非字符串 → 回退色。 */
export function colorValue(agg: Aggregate<unknown>, fallback = '#FFFFFF'): string {
  return agg.kind === 'value' && typeof agg.value === 'string' ? agg.value : fallback
}

/** 数字输入框显示值：value 且非 null → 字符串；mixed/none/null → 空串（配 placeholder）。 */
export function numberValue(agg: Aggregate<unknown>): string {
  return agg.kind === 'value' && agg.value !== null ? String(agg.value) : ''
}

/** 布尔按钮 aria-pressed：mixed → 'mixed'；value 为 true → 'true'；其余 → 'false'。 */
export function boolPressed(agg: Aggregate<unknown>): 'true' | 'false' | 'mixed' {
  if (agg.kind === 'mixed') return 'mixed'
  return agg.kind === 'value' && agg.value === true ? 'true' : 'false'
}

/** 选项按钮 aria-pressed：mixed → 'mixed'；value 等于选项 → 'true'；其余 → 'false'。 */
export function alignPressed(agg: Aggregate<unknown>, option: string): 'true' | 'false' | 'mixed' {
  if (agg.kind === 'mixed') return 'mixed'
  return agg.kind === 'value' && agg.value === option ? 'true' : 'false'
}

/** 字形布尔切换的下一值：mixed 或不全为 true → true；全 true → false。 */
export function toggledStyleBool(agg: Aggregate<unknown>): boolean {
  return !(agg.kind === 'value' && agg.value === true)
}

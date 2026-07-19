<template>
  <div
    class="ruler-overlay"
    :class="`ruler-${orientation}`"
    :data-testid="`ruler-${orientation}`"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="ruler-canvas" :width="canvasWidth" :height="canvasHeight" />
    <span
      v-for="tick in majorTicks"
      :key="tick.key"
      class="ruler-label"
      :style="tick.style"
    >{{ tick.text }}</span>
  </div>
</template>

<script setup lang="ts">
// 标尺叠层：次/主刻度线画在 canvas（jsdom 下 getContext('2d') 为 null，已判空保护），
// 主刻度标签用绝对定位 <span> 渲染。pt↔px 换算一律经 ViewportTransform，本文件不写换算公式。
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ptToUnit, unitToPt, type Unit } from '@/domain/measurement'
import { computeRulerScale } from '@/infrastructure/x6/ruler-scale'
import { ViewportTransform, type ViewportState } from '@/infrastructure/x6/viewport-transform'

const props = defineProps<{
  orientation: 'horizontal' | 'vertical'
  unit: Unit
  viewport: ViewportState
  lengthPx: number
}>()

// 标尺厚度（px）：与 tokens.css 的 --ruler-size 保持一致（canvas 位图尺寸需数值）。
const RULER_THICKNESS_PX = 20
// 防御异常视口导致的海量刻度：主/次刻度数量上限。
const MAX_MAJOR_TICKS = 500
const MAX_MINOR_TICKS = 2000

const isHorizontal = computed(() => props.orientation === 'horizontal')
const canvasWidth = computed(() =>
  isHorizontal.value ? Math.max(0, Math.round(props.lengthPx)) : RULER_THICKNESS_PX,
)
const canvasHeight = computed(() =>
  isHorizontal.value ? RULER_THICKNESS_PX : Math.max(0, Math.round(props.lengthPx)),
)

const transform = computed(() => new ViewportTransform(props.viewport))
const scale = computed(() => computeRulerScale(props.unit, props.viewport.zoom))

/** 可见范围的文档 pt 起止（沿标尺轴）：从屏幕坐标经 ViewportTransform 反算。 */
const visibleRangePt = computed(() => {
  const start = transform.value.pointToDocument({ x: 0, y: 0 })
  const end = transform.value.pointToDocument({ x: props.lengthPx, y: props.lengthPx })
  return isHorizontal.value ? { from: start.x, to: end.x } : { from: start.y, to: end.y }
})

/** 标签值 = 文档 pt 转当前单位后按需保留小数；规范 -0 显示。 */
function formatTickLabel(pt: number, decimals: number): string {
  const text = ptToUnit(pt, props.unit).toFixed(decimals)
  return Number(text) === 0 ? (0).toFixed(decimals) : text
}

interface MajorTick {
  key: string
  text: string
  style: { left?: string; top?: string }
}

const majorTicks = computed<MajorTick[]>(() => {
  const { majorStep, labelDecimals } = scale.value
  const kMin = Math.ceil(ptToUnit(visibleRangePt.value.from, props.unit) / majorStep - 1e-9)
  const kMax = Math.floor(ptToUnit(visibleRangePt.value.to, props.unit) / majorStep + 1e-9)
  if (kMax - kMin > MAX_MAJOR_TICKS) {
    return []
  }
  const ticks: MajorTick[] = []
  for (let k = kMin; k <= kMax; k++) {
    const pt = unitToPt(k * majorStep, props.unit)
    const screen = transform.value.pointToScreen({ x: pt, y: pt })
    const px = isHorizontal.value ? screen.x : screen.y
    ticks.push({
      key: String(k),
      text: formatTickLabel(pt, labelDecimals),
      style: isHorizontal.value ? { left: `${px}px` } : { top: `${px}px` },
    })
  }
  return ticks
})

const canvasRef = ref<HTMLCanvasElement | null>(null)

/** 次/主刻度线绘制；canvas 2d 上下文为 null（jsdom）时直接跳过。 */
function drawTicks(): void {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) {
    return
  }
  const { width, height } = canvas
  context.clearRect(0, 0, width, height)
  const strokeColor =
    getComputedStyle(canvas).getPropertyValue('--color-text-secondary').trim() || '#6b7280'
  context.strokeStyle = strokeColor
  context.lineWidth = 1

  const { minorStep } = scale.value
  const kMin = Math.ceil(ptToUnit(visibleRangePt.value.from, props.unit) / minorStep - 1e-9)
  const kMax = Math.floor(ptToUnit(visibleRangePt.value.to, props.unit) / minorStep + 1e-9)
  if (kMax - kMin > MAX_MINOR_TICKS) {
    return
  }
  for (let k = kMin; k <= kMax; k++) {
    const pt = unitToPt(k * minorStep, props.unit)
    const screen = transform.value.pointToScreen({ x: pt, y: pt })
    const px = Math.round(isHorizontal.value ? screen.x : screen.y) + 0.5
    const isMajor = Math.abs(k % 5) === 0 // minorStep = majorStep / 5
    const tickLength = isMajor ? 9 : 5
    context.beginPath()
    if (isHorizontal.value) {
      context.moveTo(px, height)
      context.lineTo(px, height - tickLength)
    } else {
      context.moveTo(width, px)
      context.lineTo(width - tickLength, px)
    }
    context.stroke()
  }
}

onMounted(drawTicks)
watch([majorTicks, canvasWidth, canvasHeight], () => {
  void nextTick(drawTicks)
})
</script>

<style scoped>
.ruler-overlay {
  position: relative;
  overflow: hidden;
  background: var(--color-panel);
  user-select: none;
}

.ruler-horizontal {
  width: 100%;
  height: var(--ruler-size);
  border-bottom: 1px solid var(--color-border);
}

.ruler-vertical {
  width: var(--ruler-size);
  height: 100%;
  border-right: 1px solid var(--color-border);
}

.ruler-canvas {
  position: absolute;
  inset: 0;
}

.ruler-label {
  position: absolute;
  font-size: 9px;
  line-height: 1;
  color: var(--color-text-secondary);
  white-space: nowrap;
  pointer-events: none;
}

.ruler-horizontal .ruler-label {
  top: 2px;
  margin-left: 2px;
}

.ruler-vertical .ruler-label {
  left: 2px;
  margin-top: 2px;
  writing-mode: vertical-rl;
}
</style>

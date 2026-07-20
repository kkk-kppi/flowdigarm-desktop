<template>
  <div
    v-if="visible"
    class="page-break-overlay pointer-none"
    data-testid="page-break-overlay"
    aria-hidden="true"
  >
    <div
      v-for="(left, index) in verticalLefts"
      :key="`v-${index}`"
      class="page-break-line vertical"
      :style="{ left: `${left}px`, top: `${originPx.y}px`, height: `${pageHeightPx}px` }"
    />
    <div
      v-for="(top, index) in horizontalTops"
      :key="`h-${index}`"
      class="page-break-line horizontal"
      :style="{ top: `${top}px`, left: `${originPx.x}px`, width: `${pageWidthPx}px` }"
    />
  </div>
</template>

<script setup lang="ts">
// 分页符叠层：真实打印分块的低对比虚线。线位（pt）由 computePageBreaks 计算，
// 屏幕位置一律经 ViewportTransform 换算（本文件不写 pt↔px 换算公式）。
// visible 由 app-store.showPageBreaks 控制（视图开关，不入历史、不改文档）。
import { computed } from 'vue'
import type { DiagramPage } from '@/domain/diagram'
import { ViewportTransform, type ViewportState } from '@/application/viewport/viewport-transform'
import { computePageBreaks } from '@/application/pages/page-breaks'

const props = defineProps<{
  page: DiagramPage
  viewport: ViewportState
  visible: boolean
}>()

const transform = computed(() => new ViewportTransform(props.viewport))
const breaks = computed(() => computePageBreaks(props.page.pageSize))

const originPx = computed(() => transform.value.pointToScreen({ x: 0, y: 0 }))
const pageWidthPx = computed(() => transform.value.ptLengthToPx(props.page.pageSize.width))
const pageHeightPx = computed(() => transform.value.ptLengthToPx(props.page.pageSize.height))

const verticalLefts = computed(() =>
  breaks.value.vertical.map((x) => transform.value.pointToScreen({ x, y: 0 }).x),
)
const horizontalTops = computed(() =>
  breaks.value.horizontal.map((y) => transform.value.pointToScreen({ x: 0, y }).y),
)
</script>

<style scoped>
.page-break-overlay {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.pointer-none {
  pointer-events: none;
}

.page-break-line {
  position: absolute;
}

.page-break-line.vertical {
  width: 0;
  border-left: 1px dashed #d1d5db;
}

.page-break-line.horizontal {
  height: 0;
  border-top: 1px dashed #d1d5db;
}
</style>

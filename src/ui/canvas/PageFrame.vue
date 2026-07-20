<template>
  <div
    class="page-frame"
    data-testid="page-frame"
    aria-hidden="true"
    :style="{
      left: `${originPx.x}px`,
      top: `${originPx.y}px`,
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      background: page.canvas.background,
    }"
  />
</template>

<script setup lang="ts">
// 页面边界可视化：页面矩形（页面背景色）+ 1px 边框 + 柔和阴影。
// 位置尺寸一律经 ViewportTransform 换算（本文件不写 pt↔px 换算公式）；pointer-events: none。
import { computed } from 'vue'
import type { DiagramPage } from '@/domain/diagram'
import { ViewportTransform, type ViewportState } from '@/application/viewport/viewport-transform'

const props = defineProps<{
  page: DiagramPage
  viewport: ViewportState
}>()

const transform = computed(() => new ViewportTransform(props.viewport))
const originPx = computed(() => transform.value.pointToScreen({ x: 0, y: 0 }))
const widthPx = computed(() => transform.value.ptLengthToPx(props.page.pageSize.width))
const heightPx = computed(() => transform.value.ptLengthToPx(props.page.pageSize.height))
</script>

<style scoped>
.page-frame {
  position: absolute;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  pointer-events: none;
}
</style>

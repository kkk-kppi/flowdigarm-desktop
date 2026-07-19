<template>
  <div class="canvas-area" :class="{ 'with-rulers': appStore.showRulers }">
    <template v-if="appStore.showRulers">
      <RulerCorner class="canvas-corner" />
      <RulerOverlay
        class="canvas-ruler-h"
        orientation="horizontal"
        :unit="page.unit"
        :viewport="viewport"
        :length-px="canvasSize.width"
      />
      <RulerOverlay
        class="canvas-ruler-v"
        orientation="vertical"
        :unit="page.unit"
        :viewport="viewport"
        :length-px="canvasSize.height"
      />
    </template>
    <div ref="containerRef" class="graph-container" data-testid="x6-canvas" />
  </div>
</template>

<script setup lang="ts">
// 画布区：左上标尺角、顶部/左侧标尺、中间 X6 画布。
// 持有 ViewportController（provide 给后代）与 GraphAdapter（onMounted 创建、onBeforeUnmount 销毁）。
// 本文件不写 pt↔px 换算公式（一律经 ViewportController/ViewportTransform）。
import { onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import type { DiagramPage } from '@/domain/diagram'
import { ViewportController } from '@/application/viewport/viewport-controller'
import type { ViewportState } from '@/application/viewport/viewport-transform'
import { GraphAdapter } from '@/infrastructure/x6/graph-adapter'
import { useAppStore } from '@/stores/app-store'
import RulerCorner from './RulerCorner.vue'
import RulerOverlay from './RulerOverlay.vue'

const props = defineProps<{ page: DiagramPage }>()

const appStore = useAppStore()

// 视口控制器：缩放/平移/适应的唯一状态源（视图操作不进入撤销历史）
const viewportController = new ViewportController()
provide('viewportController', viewportController)

const viewport = ref<ViewportState>(viewportController.state)
const canvasSize = reactive({ width: 0, height: 0 })

const containerRef = ref<HTMLElement | null>(null)
let adapter: GraphAdapter | null = null
let unsubscribeViewport: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const container = containerRef.value
  if (!container) {
    return
  }
  adapter = new GraphAdapter(container, {
    // X6 手势回流：整体写回控制器，单次通知（同步会再经订阅回到 adapter.syncViewport，值相同自然收敛）
    onViewportChanged: (state) => {
      viewportController.setViewport(state)
    },
  })
  adapter.renderPage(props.page)
  adapter.setGridVisible(appStore.showGrid)

  unsubscribeViewport = viewportController.subscribe((state) => {
    viewport.value = state
    adapter?.syncViewport(state)
  })

  // 跟踪画布尺寸供标尺长度使用（jsdom 无 ResizeObserver，判空保护）
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        canvasSize.width = rect.width
        canvasSize.height = rect.height
      }
    })
    resizeObserver.observe(container)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  unsubscribeViewport?.()
  unsubscribeViewport = null
  adapter?.dispose()
  adapter = null
})

watch(
  () => props.page,
  (page) => {
    adapter?.renderPage(page)
  },
)

watch(
  () => appStore.showGrid,
  (visible) => {
    adapter?.setGridVisible(visible)
  },
)
</script>

<style scoped>
.canvas-area {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.graph-container {
  position: absolute;
  inset: 0;
}

.with-rulers .graph-container {
  left: var(--ruler-size);
  top: var(--ruler-size);
}

.canvas-corner {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
}

.canvas-ruler-h {
  position: absolute;
  left: var(--ruler-size);
  right: 0;
  top: 0;
  z-index: 2;
}

.canvas-ruler-v {
  position: absolute;
  left: 0;
  top: var(--ruler-size);
  bottom: 0;
  z-index: 2;
}
</style>

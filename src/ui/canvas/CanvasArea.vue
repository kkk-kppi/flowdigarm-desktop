<template>
  <div class="canvas-area" :class="{ 'with-rulers': appStore.showRulers }">
    <template v-if="appStore.showRulers">
      <RulerCorner class="canvas-corner" />
      <RulerOverlay
        class="canvas-ruler-h"
        orientation="horizontal"
        :unit="pageUnit"
        :viewport="viewport"
        :length-px="canvasSize.width"
      />
      <RulerOverlay
        class="canvas-ruler-v"
        orientation="vertical"
        :unit="pageUnit"
        :viewport="viewport"
        :length-px="canvasSize.height"
      />
    </template>
    <div class="graph-viewport">
      <PageFrame v-if="activePage" :page="activePage" :viewport="viewport" />
      <div ref="containerRef" class="graph-container" data-testid="x6-canvas" />
      <PageBreakOverlay
        v-if="activePage"
        :page="activePage"
        :viewport="viewport"
        :visible="appStore.showPageBreaks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// 画布区：左上标尺角、顶部/左侧标尺、页面边界（PageFrame）、X6 画布、分页符叠层。
// 文档真源为 document-store（activePage + 背景页）；视口控制器按页取自 PageManager，
// 切换页时重渲染并应用该页视口状态（每页首次显示时 fitToPage 居中）。
// 本文件不写 pt↔px 换算公式（一律经 ViewportController/ViewportTransform）。
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { PageUnit } from '@/domain/diagram'
import type { ViewportController } from '@/application/viewport/viewport-controller'
import type { ViewportState } from '@/application/viewport/viewport-transform'
import { resolveBackgroundPage } from '@/application/pages/background-page-resolver'
import { GraphAdapter } from '@/infrastructure/x6/graph-adapter'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import PageBreakOverlay from './PageBreakOverlay.vue'
import PageFrame from './PageFrame.vue'
import RulerCorner from './RulerCorner.vue'
import RulerOverlay from './RulerOverlay.vue'

const appStore = useAppStore()
const documentStore = useDocumentStore()

const activePage = computed(() => documentStore.activePage)
const backgroundPage = computed(() =>
  resolveBackgroundPage(documentStore.document, documentStore.activePageId),
)
const pageUnit = computed<PageUnit>(() => activePage.value?.unit ?? 'mm')

const viewport = ref<ViewportState>({ zoom: 1, panX: 0, panY: 0 })
const canvasSize = reactive({ width: 0, height: 0 })

const containerRef = ref<HTMLElement | null>(null)
let adapter: GraphAdapter | null = null
let unsubscribeViewport: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
/** 已完成首次 fit 的页（每页首次显示时 fitToPage 一次，之后保持用户视口）。 */
const fittedPageIds = new Set<string>()

function activeController(): ViewportController {
  return documentStore.pageManager.controllerFor(documentStore.activePageId)
}

function renderActivePage(): void {
  const page = activePage.value
  if (!adapter || !page) {
    return
  }
  adapter.renderPage(page, backgroundPage.value)
}

/** 绑定当前页视口控制器：应用其持久状态并重订阅后续变更。 */
function bindViewport(): void {
  unsubscribeViewport?.()
  const controller = activeController()
  viewport.value = controller.state
  adapter?.syncViewport(controller.state)
  unsubscribeViewport = controller.subscribe((state) => {
    viewport.value = state
    adapter?.syncViewport(state)
  })
}

/** 每页首次显示时按视口大小适应页面并居中（初始 zoom=1 pan 由本次 fit 决定）。 */
function fitPageIfFirst(): void {
  const page = activePage.value
  const container = containerRef.value
  const pageId = documentStore.activePageId
  if (!page || !container || fittedPageIds.has(pageId)) {
    return
  }
  fittedPageIds.add(pageId)
  const rect = container.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    activeController().fitToPage(page.pageSize, { width: rect.width, height: rect.height })
  }
}

onMounted(() => {
  const container = containerRef.value
  if (!container) {
    return
  }
  adapter = new GraphAdapter(container, {
    // X6 手势回流：整体写回当前页控制器，单次通知（同步会再经订阅回到 adapter.syncViewport，值相同自然收敛）
    onViewportChanged: (state) => {
      activeController().setViewport(state)
    },
  })
  renderActivePage()
  adapter.setGridVisible(appStore.showGrid)
  bindViewport()
  fitPageIfFirst()

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

// 切换页：重渲染（含背景页）并应用该页视口状态
watch(
  () => documentStore.activePageId,
  () => {
    bindViewport()
    renderActivePage()
    fitPageIfFirst()
  },
)

// 文档内容/设置变化：重渲染当前页（含页面尺寸、背景页引用变化）
watch(
  () => documentStore.document,
  () => {
    renderActivePage()
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

/* 画布工作区：页面边界（PageFrame）外的底色 */
.graph-viewport {
  position: absolute;
  inset: 0;
  background: #f5f5f5;
}

.with-rulers .graph-viewport {
  left: var(--ruler-size);
  top: var(--ruler-size);
}

.graph-container {
  position: absolute;
  inset: 0;
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

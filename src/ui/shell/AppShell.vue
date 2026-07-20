<template>
  <div class="editor-shell" data-testid="editor-shell">
    <header class="titlebar" data-testid="titlebar">
      <span class="app-name">流程图编辑器</span>
      <span class="doc-name">{{ documentStore.document.name }}</span>
    </header>
    <!-- 菜单栏占位（Task 8 实现），先渲染空条占位高度 -->
    <div class="menubar" data-testid="menubar-placeholder" role="menubar" aria-label="菜单栏" />
    <CompactToolbar />
    <PageTabs />
    <div class="shell-main" data-testid="shell-main">
      <ElementLibrary @create-request="onCreateRequest" @more-shapes="onMoreShapes" />
      <CanvasArea ref="canvasAreaRef" class="shell-canvas" />
      <RightPanel />
    </div>
    <footer class="statusbar" data-testid="statusbar">就绪</footer>
  </div>
</template>

<script setup lang="ts">
// 应用外壳：标题栏（28px，应用名+文件名，Task 8 完善）→ 菜单栏占位（28px）→
// 紧凑工具栏（48px）→ 页面标签（32px）→ 主区（图元库 220px / 画布 / 右侧面板 280px）→
// 状态栏占位（24px，Task 8 完善）。布局高度一律 tokens 变量。
// 图元库 create-request 转发 CanvasArea（视口中心换算 pt 后走 document-store 创建命令）；
// 拖拽起点经 shapeDragStartKey 注入转发 CanvasArea（provide 只沿组件树向下，故在外壳中转）；
// more-shapes 经 document-store lastNotice 提示。
import { provide, ref } from 'vue'
import CanvasArea from '@/ui/canvas/CanvasArea.vue'
import CompactToolbar from '@/ui/toolbar/CompactToolbar.vue'
import ElementLibrary from '@/ui/shapes/ElementLibrary.vue'
import PageTabs from '@/ui/pages/PageTabs.vue'
import RightPanel from '@/ui/inspector/RightPanel.vue'
import { shapeDragStartKey } from '@/ui/shapes/shape-drag-key'
import { useDocumentStore } from '@/stores/document-store'

const documentStore = useDocumentStore()

const canvasAreaRef = ref<InstanceType<typeof CanvasArea> | null>(null)

provide(shapeDragStartKey, (shapeType, e) => {
  canvasAreaRef.value?.startShapeDrag(shapeType, e)
})

function onCreateRequest(shapeType: string): void {
  canvasAreaRef.value?.createShapeAtViewportCenter(shapeType)
}

function onMoreShapes(): void {
  documentStore.setNotice('更多形状将在后续版本提供。')
}
</script>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

.titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--titlebar-h);
  padding: 0 12px;
  font-size: 12px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.app-name {
  font-weight: 600;
  color: var(--color-text);
}

.doc-name {
  color: var(--color-text-secondary);
}

.menubar {
  height: var(--menubar-h);
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.shell-main {
  display: flex;
  flex: 1;
  min-height: 0;
}

.shell-canvas {
  flex: 1;
  min-width: 0;
}

.statusbar {
  display: flex;
  align-items: center;
  height: var(--statusbar-h);
  padding: 0 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-panel);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}
</style>

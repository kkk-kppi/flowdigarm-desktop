<template>
  <AppShell>
    <div class="app-body">
      <ElementLibrary @create-request="onCreateRequest" @more-shapes="onMoreShapes" />
      <div class="app-main">
        <PageTabs />
        <CanvasArea ref="canvasAreaRef" />
      </div>
    </div>
    <button
      v-if="documentStore.lastNotice"
      type="button"
      class="app-notice"
      role="status"
      @click="documentStore.clearNotice()"
    >
      {{ documentStore.lastNotice }}
    </button>
  </AppShell>
</template>

<script setup lang="ts">
// 应用外壳：左栏图元库 + 页面标签栏 + 画布区；文档真源为 document-store（初始空文档含一页 A4）。
// 图元库 create-request 转发 CanvasArea（视口中心换算 pt 后走 document-store 创建命令）；
// 拖拽起点经 shapeDragStartKey 注入转发 CanvasArea（provide 只沿组件树向下，故在 App 层中转）；
// more-shapes 与空剪贴板提示经 lastNotice 显示（点击关闭；toast 机制后续任务替换）。
// TODO(Task 8)：文件新建/打开/保存接线后替换此处的 newDocument 初始化。
import { provide, ref } from 'vue'
import AppShell from '@/ui/shell/AppShell.vue'
import PageTabs from '@/ui/pages/PageTabs.vue'
import CanvasArea from '@/ui/canvas/CanvasArea.vue'
import ElementLibrary from '@/ui/shapes/ElementLibrary.vue'
import { shapeDragStartKey } from '@/ui/shapes/shape-drag-key'
import { useDocumentStore } from '@/stores/document-store'

const documentStore = useDocumentStore()
documentStore.newDocument()

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
.app-body {
  display: flex;
  width: 100%;
  height: 100vh;
}

.app-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.app-main > :last-child {
  flex: 1;
  min-height: 0;
}

.app-notice {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 20;
  padding: 8px 16px;
  border: 1px solid var(--color-border, #d9d9d9);
  border-radius: 4px;
  background: var(--color-bg-panel, #ffffff);
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
  font-size: 13px;
  cursor: pointer;
}
</style>

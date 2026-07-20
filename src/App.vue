<template>
  <AppShell>
    <div class="app-main">
      <PageTabs />
      <CanvasArea />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
// 应用外壳：页面标签栏 + 画布区；文档真源为 document-store（初始空文档含一页 A4）。
// TODO(Task 8)：文件新建/打开/保存接线后替换此处的 newDocument 初始化。
import AppShell from '@/ui/shell/AppShell.vue'
import PageTabs from '@/ui/pages/PageTabs.vue'
import CanvasArea from '@/ui/canvas/CanvasArea.vue'
import { useDocumentStore } from '@/stores/document-store'

const documentStore = useDocumentStore()
documentStore.newDocument()
</script>

<style scoped>
.app-main {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
}

.app-main > :last-child {
  flex: 1;
  min-height: 0;
}
</style>

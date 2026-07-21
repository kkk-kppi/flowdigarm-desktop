<template>
  <AppShell />
  <button
    v-if="documentStore.lastNotice"
    type="button"
    class="app-notice"
    role="status"
    @click="documentStore.clearNotice()"
  >
    {{ documentStore.lastNotice }}
  </button>
</template>

<script setup lang="ts">
// 应用根组件：外壳布局全部由 AppShell 组装；此处仅初始化文档并渲染全局通知。
import AppShell from '@/ui/shell/AppShell.vue'
import { useDocumentStore } from '@/stores/document-store'

const documentStore = useDocumentStore()
</script>

<style scoped>
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

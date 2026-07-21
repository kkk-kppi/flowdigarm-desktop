<template>
  <header class="title-bar" data-testid="titlebar" data-tauri-drag-region>
    <svg class="app-icon" viewBox="0 0 20 20" aria-hidden="true" data-tauri-drag-region><rect x="2" y="3" width="6" height="5" rx="1"/><rect x="12" y="12" width="6" height="5" rx="1"/><path d="M8 5.5h3v9h1"/></svg>
    <span class="title" data-tauri-drag-region>流程图编辑器 - {{ fileName }}{{ dirty ? '*未保存' : '' }}</span>
    <div class="window-actions">
      <button type="button" data-testid="title-minimize" aria-label="最小化窗口" title="最小化窗口。将编辑器收起到任务栏。" @click="$emit('minimize')">−</button>
      <button type="button" data-testid="title-maximize" aria-label="最大化或还原窗口" title="最大化或还原窗口。切换编辑器窗口大小。" @click="$emit('maximize')">□</button>
      <button type="button" data-testid="title-close" aria-label="关闭窗口" title="关闭窗口。关闭当前编辑器窗口。" @click="$emit('close')">×</button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ fileName: string; dirty: boolean }>()
defineEmits<{ minimize: []; maximize: []; close: [] }>()
</script>

<style scoped>
.title-bar { display: flex; align-items: center; height: var(--titlebar-h); padding-left: 9px; background: #263247; color: #f8fafc; user-select: none; }
.app-icon { width: 16px; height: 16px; margin-right: 8px; fill: none; stroke: #9dc1ff; stroke-width: 1.6; }
.title { flex: 1; font-size: 12px; text-align: center; }
.window-actions { display: flex; align-self: stretch; }
.window-actions button { width: 44px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.window-actions button:hover, .window-actions button:focus-visible { background: rgb(255 255 255 / 12%); outline: 2px solid #9dc1ff; outline-offset: -2px; }
.window-actions button:last-child:hover { background: #c42b1c; }
</style>

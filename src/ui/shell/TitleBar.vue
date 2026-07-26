<template>
  <header class="title-bar" data-testid="titlebar" data-tauri-drag-region>
    <AppIcon class="title-brand-icon" name="appGraph" data-tauri-drag-region />
    <span class="title" data-tauri-drag-region>流程图编辑器 - {{ fileName }}{{ dirty ? ' *未保存' : '' }}</span>
    <div class="window-actions">
      <button type="button" data-testid="title-minimize" aria-label="最小化窗口" title="最小化窗口。将编辑器收起到任务栏。" @click="$emit('minimize')"><AppIcon name="minimize" /></button>
      <button
        type="button"
        data-testid="title-maximize"
        :aria-label="maximized ? '还原窗口' : '最大化窗口'"
        :title="maximized ? '还原窗口。恢复编辑器窗口大小。' : '最大化窗口。扩展编辑器到可用屏幕。'"
        @click="$emit('maximize')"
      ><AppIcon :name="maximized ? 'restore' : 'maximize'" /></button>
      <button type="button" data-testid="title-close" aria-label="关闭窗口" title="关闭窗口。关闭当前编辑器窗口。" @click="$emit('close')"><AppIcon name="close" /></button>
    </div>
  </header>
</template>

<script setup lang="ts">
import AppIcon from '@/ui/icons/AppIcon.vue'

defineProps<{ fileName: string; dirty: boolean; maximized: boolean }>()
defineEmits<{ minimize: []; maximize: []; close: [] }>()
</script>

<style scoped>
.title-bar { display: flex; align-items: center; height: var(--titlebar-h); padding-left: 9px; background: #263247; color: #f8fafc; user-select: none; }
.title-brand-icon { color: #9dc1ff; }
.title { flex: 1; font-size: 12px; text-align: center; }
.window-actions { display: flex; align-self: stretch; }
.window-actions button { display: grid; width: 44px; padding: 0; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
.window-actions button:hover, .window-actions button:focus-visible { background: rgb(255 255 255 / 12%); }
.window-actions button:last-child:hover { background: #c42b1c; }
</style>

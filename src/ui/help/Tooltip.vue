<template>
  <span class="tooltip" role="tooltip">
    <span class="tooltip__text">{{ text }}</span>
    <kbd v-if="shortcut" class="tooltip__shortcut" aria-hidden="true">{{ shortcut }}</kbd>
  </span>
</template>

<script setup lang="ts">
// 通用提示气泡：仅渲染文本与可选快捷键，不含业务逻辑。
defineProps<{
  /** 提示内容（简体中文） */
  text: string
  /** 可选快捷键说明，如 Ctrl+Z */
  shortcut?: string
}>()
</script>

<style scoped>
.tooltip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tooltip__shortcut {
  font-family: inherit;
  font-size: 0.85em;
  color: var(--color-text-secondary);
}
</style>

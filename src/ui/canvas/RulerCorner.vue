<template>
  <div class="ruler-corner" data-testid="ruler-corner" aria-hidden="true" />
</template>

<script setup lang="ts">
// 标尺交汇角块：左上角 20×20（--ruler-size），仅视觉占位。
</script>

<style scoped>
.ruler-corner {
  width: var(--ruler-size);
  height: var(--ruler-size);
  background: var(--color-panel);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
}
</style>

<template>
  <button
    type="button"
    class="quick-help"
    :data-help-id="helpId"
    :aria-label="`${label}帮助`"
    :title="`${label}帮助。查看目的、操作方式、影响范围、撤销边界与限制。`"
    @click.stop="appStore.openHelp(helpId)"
  >?</button>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app-store'
defineProps<{ helpId: string; label: string }>()
const appStore = useAppStore()
</script>

<style scoped>
.quick-help { display: inline-grid; place-items: center; width: 22px; height: 22px; flex: 0 0 auto; padding: 0; border: 1px solid var(--color-border); border-radius: 50%; background: transparent; color: var(--color-text-secondary); font-size: 11px; cursor: pointer; }
.quick-help:hover, .quick-help:focus-visible { border-color: var(--color-primary); color: var(--color-primary); outline: 2px solid transparent; }
</style>

<template>
  <button
    type="button"
    class="quick-help"
    :data-help-id="helpId"
    :aria-label="`${entry?.title ?? label}帮助`"
    :title="entry ? `${entry.title}：${entry.purpose}` : `${label}帮助`"
    @click.stop="appStore.openHelp(helpId)"
  ><AppIcon name="help" :size="16" /></button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app-store'
import AppIcon from '@/ui/icons/AppIcon.vue'
import { getFeatureHelp } from './feature-help-registry'
const props = defineProps<{ helpId: string; label: string }>()
const appStore = useAppStore()
const entry = computed(() => getFeatureHelp(props.helpId))
</script>

<style scoped>
.quick-help { display: inline-grid; place-items: center; width: 22px; height: 22px; flex: 0 0 auto; padding: 0; border: 1px solid var(--color-border); border-radius: 50%; background: transparent; color: var(--color-text-secondary); font-size: 11px; cursor: pointer; }
.quick-help:hover, .quick-help:focus-visible { border-color: var(--color-primary); color: var(--color-primary); outline: 2px solid transparent; }
</style>

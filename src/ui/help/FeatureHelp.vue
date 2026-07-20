<template>
  <aside v-if="entry" ref="panel" class="feature-help" role="complementary" tabindex="-1" :aria-label="`${entry.title}帮助`">
    <header><h2>{{ entry.title }}</h2><button ref="closeButton" type="button" aria-label="关闭帮助" title="关闭帮助。返回此前的编辑位置。" @click="close">×</button></header>
    <dl>
      <dt>目的</dt><dd>{{ entry.purpose }}</dd>
      <dt>操作方式</dt><dd>{{ entry.operation }}</dd>
      <dt>影响范围</dt><dd>{{ entry.scope }}</dd>
      <dt>撤销边界</dt><dd>{{ entry.undoBoundary }}</dd>
      <dt>限制</dt><dd>{{ entry.limits }}</dd>
    </dl>
    <a :href="entry.docAnchor">查看文档：{{ entry.docAnchor }}</a>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getFeatureHelp } from './feature-help-registry'
const props = defineProps<{ helpId: string; returnFocus?: HTMLElement | null }>()
const emit = defineEmits<{ close: [] }>()
const fallbackFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const entry = computed(() => getFeatureHelp(props.helpId))
function close(): void {
  emit('close')
  const target = props.returnFocus?.isConnected ? props.returnFocus : fallbackFocus?.isConnected ? fallbackFocus : null
  target?.focus()
}
function onKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); close() } }
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  void nextTick(() => (closeButton.value ?? panel.value)?.focus())
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.feature-help { position: absolute; top: calc(var(--titlebar-h) + var(--menubar-h)); right: 12px; z-index: 35; width: 340px; max-height: calc(100% - 100px); padding: 14px; overflow: auto; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-panel); box-shadow: 0 10px 32px rgb(0 0 0 / 18%); color: var(--color-text); }
header { display: flex; align-items: center; justify-content: space-between; }
h2 { margin: 0; font-size: 16px; }
header button { width: 28px; height: 28px; border: 0; background: transparent; cursor: pointer; font-size: 18px; }
dt { margin-top: 12px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
dd { margin: 3px 0 0; font-size: 12px; line-height: 1.55; }
a { display: inline-block; margin-top: 14px; color: var(--color-primary); font-size: 12px; }
</style>

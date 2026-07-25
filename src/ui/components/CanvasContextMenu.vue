<template>
  <div
    ref="root"
    class="context-menu"
    role="menu"
    aria-label="画布右键菜单"
    tabindex="-1"
    :style="positionStyle"
    @keydown="onKeydown"
  >
    <div v-for="(item, index) in items" :key="item.id" class="context-item">
      <button
        :ref="(element) => setItem(element, index)"
        type="button"
        role="menuitem"
        :data-command-id="item.id"
        :aria-disabled="Boolean(item.disabledReason)"
        :aria-haspopup="item.children ? 'menu' : undefined"
        :title="item.disabledReason"
        :class="{ active: index === activeIndex, disabled: item.disabledReason }"
        @click="execute(item)"
        @mouseenter="activeIndex = index; submenuIndex = item.children ? index : -1"
      >{{ item.label }}<AppIcon v-if="item.children" class="arrow" name="chevronRight" :size="14" /></button>
      <div v-if="item.children && submenuIndex === index" class="context-submenu" role="menu" :aria-label="`${item.label}子菜单`">
        <button
          v-for="(child, indexOfChild) in item.children"
          :key="child.id"
          type="button"
          role="menuitem"
          :data-command-id="child.id"
          :aria-disabled="Boolean(child.disabledReason)"
          :title="child.disabledReason"
          :class="{ active: childIndex === indexOfChild }"
          @click="execute(child)"
        >{{ child.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'
import type { MenuItem } from '@/application/menus/menu-model'
import AppIcon from '@/ui/icons/AppIcon.vue'

const props = defineProps<{ x: number; y: number; items: MenuItem[]; returnFocus?: HTMLElement | null }>()
const emit = defineEmits<{ execute: [id: string]; close: [] }>()
const root = ref<HTMLElement | null>(null)
const elements: HTMLButtonElement[] = []
const activeIndex = ref(0)
const submenuIndex = ref(-1)
const childIndex = ref(0)
const width = 220
const positionStyle = computed(() => {
  const height = props.items.length * 28 + 12
  return { left: `${Math.max(0, Math.min(props.x, window.innerWidth - width))}px`, top: `${Math.max(0, Math.min(props.y, window.innerHeight - height))}px` }
})
function setItem(value: Element | ComponentPublicInstance | null, index: number): void {
  if (value instanceof HTMLButtonElement) elements[index] = value
}
function execute(item: MenuItem): void {
  if (item.disabledReason) return
  if (item.children) { submenuIndex.value = activeIndex.value; childIndex.value = 0; return }
  emit('execute', item.id)
  close()
}
function close(): void {
  emit('close')
  props.returnFocus?.focus()
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key === 'ArrowRight') {
    const item = props.items[activeIndex.value]
    if (item?.children) { event.preventDefault(); submenuIndex.value = activeIndex.value; childIndex.value = nextEnabled(item.children, -1, 1) }
    return
  }
  if (event.key === 'ArrowLeft' && submenuIndex.value !== -1) {
    event.preventDefault(); submenuIndex.value = -1; return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const children = props.items[activeIndex.value]?.children
    if (submenuIndex.value === activeIndex.value && children) {
      childIndex.value = nextEnabled(children, childIndex.value, step)
      return
    }
    activeIndex.value = (activeIndex.value + step + props.items.length) % props.items.length
    elements[activeIndex.value]?.focus()
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const item = props.items[activeIndex.value]
    if (submenuIndex.value === activeIndex.value && item?.children) execute(item.children[childIndex.value])
    else execute(item)
  }
}
function nextEnabled(items: MenuItem[], current: number, step: number): number {
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (current + step * offset + items.length) % items.length
    if (!items[index].disabledReason) return index
  }
  return current
}
function onDocumentMouseDown(event: MouseEvent): void {
  if (!root.value?.contains(event.target as Node)) close()
}
onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown)
  root.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))
</script>

<style scoped>
.context-menu { position: fixed; z-index: 60; width: 220px; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); box-shadow: 0 8px 24px rgb(0 0 0 / 18%); }
.context-item { position: relative; }
.context-submenu { position: absolute; top: -6px; left: calc(100% - 2px); width: 190px; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); box-shadow: 0 8px 24px rgb(0 0 0 / 18%); }
button { width: 100%; height: 28px; padding: 0 10px; border: 0; border-radius: 3px; background: transparent; color: var(--color-text); text-align: left; cursor: pointer; }
button span { float: right; }
button:hover, button.active, button:focus-visible { background: #e9eef8; outline: none; }
button.disabled { color: #9ca3af; cursor: not-allowed; }
</style>

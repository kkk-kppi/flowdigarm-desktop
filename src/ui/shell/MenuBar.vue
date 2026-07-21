<template>
  <nav ref="root" class="menu-bar" role="menubar" aria-label="应用菜单栏" data-testid="menubar">
    <div v-for="(menu, menuIndex) in menus" :key="menu.id" class="menu-root">
      <button
        :ref="(element) => setTrigger(element, menuIndex)"
        type="button"
        role="menuitem"
        :data-menu-id="menu.id"
        :aria-expanded="openIndex === menuIndex"
        aria-haspopup="menu"
        @click="toggleMenu(menuIndex)"
        @mouseenter="switchOpenMenu(menuIndex)"
        @keydown="onTriggerKeydown($event, menuIndex)"
      >
        {{ menu.label }}
      </button>
      <div
        v-if="openIndex === menuIndex"
        class="menu-popup"
        role="menu"
        :aria-label="`${menu.label}菜单`"
        tabindex="-1"
        @keydown="onMenuKeydown"
      >
        <div v-for="(item, itemIndex) in menu.items" :key="item.id" class="menu-item-wrap">
          <hr v-if="item.separatorBefore" />
          <button
            :ref="(element) => setItem(element, itemIndex)"
            type="button"
            role="menuitem"
            :data-command-id="item.id"
            :aria-disabled="Boolean(item.disabledReason)"
            :aria-haspopup="item.children ? 'menu' : undefined"
            :title="item.title || item.disabledReason"
            :class="{ active: activeItem === itemIndex, disabled: item.disabledReason }"
            @click="runItem(item)"
            @mouseenter="activeItem = itemIndex; submenuIndex = item.children ? itemIndex : -1"
          >
            <span class="check" aria-hidden="true">{{ item.checked ? '✓' : '' }}</span>
            <span>{{ item.label }}</span>
            <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
            <span v-if="item.children" class="arrow" aria-hidden="true">›</span>
          </button>
          <div v-if="item.children && submenuIndex === itemIndex" class="submenu" role="menu">
            <button
              v-for="(child, childIndex) in item.children"
              :key="child.id"
              type="button"
              role="menuitem"
              :data-command-id="child.id"
              :aria-disabled="Boolean(child.disabledReason)"
              :title="child.title || child.disabledReason"
              :class="{ active: activeChild === childIndex, disabled: child.disabledReason }"
              @click="runItem(child)"
            >{{ child.label }}</button>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'
import type { MenuDefinition, MenuItem } from '@/application/menus/menu-model'

const props = defineProps<{ menus: MenuDefinition[] }>()
const emit = defineEmits<{ execute: [id: string, trigger: HTMLButtonElement | null] }>()
const root = ref<HTMLElement | null>(null)
const triggers: HTMLButtonElement[] = []
const itemElements: HTMLButtonElement[] = []
const openIndex = ref(-1)
const activeItem = ref(0)
const submenuIndex = ref(-1)
const activeChild = ref(0)

function asElement(value: Element | ComponentPublicInstance | null): HTMLButtonElement | null {
  return value instanceof HTMLButtonElement ? value : null
}
function setTrigger(value: Element | ComponentPublicInstance | null, index: number): void {
  const element = asElement(value)
  if (element) triggers[index] = element
}
function setItem(value: Element | ComponentPublicInstance | null, index: number): void {
  const element = asElement(value)
  if (element) itemElements[index] = element
}
function toggleMenu(index: number): void {
  openIndex.value = openIndex.value === index ? -1 : index
  activeItem.value = 0
  submenuIndex.value = -1
}
function switchOpenMenu(index: number): void {
  if (openIndex.value !== -1) toggleMenu(index)
}
function focusTop(index: number): void {
  const normalized = (index + props.menus.length) % props.menus.length
  triggers[normalized]?.focus()
  if (openIndex.value !== -1) {
    openIndex.value = normalized
    activeItem.value = 0
  }
}
function onTriggerKeydown(event: KeyboardEvent, index: number): void {
  if (event.key === 'ArrowRight') { event.preventDefault(); focusTop(index + 1) }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); focusTop(index - 1) }
  else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openIndex.value = index
    activeItem.value = 0
    void nextTick(() => itemElements[0]?.focus())
  } else if (event.key === 'Escape') close(true)
}
function onMenuKeydown(event: KeyboardEvent): void {
  const items = props.menus[openIndex.value]?.items ?? []
  if (event.key === 'Escape') { event.preventDefault(); close(true); return }
  if (event.key === 'ArrowRight') {
    const item = items[activeItem.value]
    if (item?.children) { submenuIndex.value = activeItem.value; activeChild.value = 0 }
    else focusTop(openIndex.value + 1)
    return
  }
  if (event.key === 'ArrowLeft') {
    if (submenuIndex.value !== -1) submenuIndex.value = -1
    else focusTop(openIndex.value - 1)
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const submenu = items[activeItem.value]?.children
    if (submenuIndex.value === activeItem.value && submenu) {
      activeChild.value = (activeChild.value + step + submenu.length) % submenu.length
      return
    }
    activeItem.value = (activeItem.value + step + items.length) % items.length
    itemElements[activeItem.value]?.focus()
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const item = items[activeItem.value]
    if (submenuIndex.value === activeItem.value && item?.children) runItem(item.children[activeChild.value])
    else runItem(item)
  }
}
function runItem(item: MenuItem | undefined): void {
  if (!item || item.disabledReason) return
  if (item.children) { submenuIndex.value = activeItem.value; return }
  const trigger = triggers[openIndex.value] ?? null
  close(false)
  trigger?.focus()
  emit('execute', item.id, trigger)
}
function close(restoreFocus: boolean): void {
  const trigger = triggers[openIndex.value]
  openIndex.value = -1
  submenuIndex.value = -1
  if (restoreFocus) void nextTick(() => trigger?.focus())
}
function onDocumentMouseDown(event: MouseEvent): void {
  if (!root.value?.contains(event.target as Node)) close(false)
}
onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))
</script>

<style scoped>
.menu-bar { display: flex; align-items: stretch; height: var(--menubar-h); padding: 0 6px; background: var(--color-panel); border-bottom: 1px solid var(--color-border); }
.menu-root { position: relative; }
.menu-root > button { height: 100%; padding: 0 10px; border: 0; background: transparent; color: var(--color-text); font-size: 12px; cursor: pointer; }
.menu-root > button:hover, .menu-root > button:focus-visible, .menu-root > button[aria-expanded="true"] { background: #e9eef8; outline: 2px solid transparent; }
.menu-popup, .submenu { position: absolute; z-index: 40; min-width: 210px; padding: 5px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); box-shadow: 0 6px 18px rgb(0 0 0 / 16%); }
.menu-popup { top: 100%; left: 0; }
.submenu { top: -5px; left: calc(100% - 2px); }
.menu-item-wrap { position: relative; }
.menu-popup button, .submenu button { display: flex; align-items: center; width: 100%; min-height: 28px; padding: 4px 8px; border: 0; border-radius: 3px; background: transparent; color: var(--color-text); font-size: 12px; text-align: left; cursor: pointer; }
.menu-popup button:hover, .menu-popup button.active, .menu-popup button:focus-visible { background: #e9eef8; outline: none; }
.menu-popup button.disabled { color: #9ca3af; cursor: not-allowed; }
.check { width: 18px; font-weight: 700; }
kbd { margin-left: auto; color: var(--color-text-secondary); font: inherit; }
.arrow { margin-left: auto; }
hr { margin: 4px 5px; border: 0; border-top: 1px solid var(--color-border); }
</style>

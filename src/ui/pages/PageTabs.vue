<template>
  <div class="page-tabs" data-testid="page-tabs">
    <div
      v-for="page in pages"
      :key="page.id"
      class="page-tab"
      :class="{ active: page.id === documentStore.activePageId }"
      data-testid="page-tab"
      @click="switchPage(page.id)"
      @dblclick="startRename(page)"
    >
      <span v-if="renamingId !== page.id" class="page-tab-name" :title="page.name">
        {{ page.name }}
      </span>
      <input
        v-else
        ref="renameInputRef"
        v-model="renameDraft"
        class="page-tab-rename"
        data-testid="rename-input"
        aria-label="重命名页面"
        @keydown.enter="commitRename(page)"
        @keydown.esc="cancelRename"
        @blur="commitRename(page)"
        @click.stop
        @dblclick.stop
      />
      <button
        v-if="pages.length > 1 && renamingId !== page.id"
        type="button"
        class="page-tab-close"
        data-testid="close-tab"
        aria-label="关闭页面"
        title="删除此页"
        @click.stop="askDelete(page.id)"
      >
        <AppIcon name="close" :size="12" />
      </button>
      <div
        v-if="confirmingDeleteId === page.id"
        class="delete-confirm"
        data-testid="delete-confirm"
        @click.stop
      >
        <span class="delete-confirm-text">删除此页？</span>
        <span v-if="deleteError" class="delete-confirm-error" role="alert">{{ deleteError }}</span>
        <button
          type="button"
          data-testid="confirm-delete"
          aria-label="确定删除"
          title="确定"
          @click="confirmDelete(page.id)"
        >
          确定
        </button>
        <button
          type="button"
          data-testid="cancel-delete"
          aria-label="取消删除"
          title="取消"
          @click="cancelDelete"
        >
          取消
        </button>
      </div>
    </div>
    <button
      type="button"
      class="page-tab-add"
      aria-label="新建页面"
      title="新建页面"
      @click="addPage"
    >
      <AppIcon name="add" :size="14" />
    </button>
    <div class="zoom-controls">
      <input
        type="range"
        class="zoom-slider"
        data-testid="zoom-slider"
        min="10"
        max="400"
        :value="zoomPercent"
        aria-label="缩放滑块"
        title="缩放"
        @input="onZoomInput"
      />
      <span class="zoom-percent" data-testid="zoom-percent">{{ zoomPercent }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 页面标签栏（32px）：页签切换/双击行内重命名/内联确认删除/新建页/当前页缩放控件。
// 命令（新建/删除/重命名）经 document-store 执行；切换页与缩放为视图行为，不产生命令。
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { DiagramPage } from '@/domain/diagram'
import { PageTabsController } from '@/application/pages/page-tabs-controller'
import { useDocumentStore } from '@/stores/document-store'
import AppIcon from '@/ui/icons/AppIcon.vue'

const documentStore = useDocumentStore()
const pageTabsController = new PageTabsController({
  getDocument: () => documentStore.document,
  getActivePageId: () => documentStore.activePageId,
  execute: (command) => documentStore.executeCommand(command),
  switchPage: (pageId) => documentStore.switchPage(pageId),
})

const pages = computed(() => documentStore.document.pages)

// ---- 切换页（视图行为，不产生命令） ----
function switchPage(pageId: string): void {
  if (pageId !== documentStore.activePageId) {
    documentStore.switchPage(pageId)
  }
}

// ---- 行内重命名 ----
const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

function startRename(page: DiagramPage): void {
  renamingId.value = page.id
  renameDraft.value = page.name
  void nextTick(() => {
    const input = Array.isArray(renameInputRef.value)
      ? renameInputRef.value[0]
      : renameInputRef.value
    input?.focus()
    input?.select()
  })
}

function commitRename(page: DiagramPage): void {
  if (renamingId.value !== page.id) {
    return
  }
  const name = renameDraft.value.trim()
  renamingId.value = null
  if (name.length === 0 || name === page.name) {
    return // 空白或 unchanged 视为取消
  }
  pageTabsController.rename(page, name)
}

function cancelRename(): void {
  renamingId.value = null
}

// ---- 删除（内联二次确认） ----
const confirmingDeleteId = ref<string | null>(null)
const deleteError = ref('')

function askDelete(pageId: string): void {
  confirmingDeleteId.value = pageId
  deleteError.value = ''
}

function cancelDelete(): void {
  confirmingDeleteId.value = null
  deleteError.value = ''
}

function confirmDelete(pageId: string): void {
  try {
    pageTabsController.remove(pageId)
    confirmingDeleteId.value = null
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : String(error)
  }
}

// ---- 新建页 ----
function addPage(): void {
  pageTabsController.add()
}

// ---- 缩放控件（绑定当前页 ViewportController，视图行为不入历史） ----
const zoomPercent = ref(100)
let unsubscribeViewport: (() => void) | null = null

watch(
  () => documentStore.activePageId,
  (pageId) => {
    unsubscribeViewport?.()
    const controller = documentStore.pageManager.controllerFor(pageId)
    zoomPercent.value = Math.round(controller.state.zoom * 100)
    unsubscribeViewport = controller.subscribe((state) => {
      zoomPercent.value = Math.round(state.zoom * 100)
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unsubscribeViewport?.()
  unsubscribeViewport = null
})

function onZoomInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) {
    return
  }
  documentStore.pageManager.controllerFor(documentStore.activePageId).setZoom(value / 100)
}
</script>

<style scoped>
.page-tabs {
  position: relative;
  display: flex;
  align-items: stretch;
  height: var(--pagetabs-h);
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text);
  user-select: none;
}

.page-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  border-right: 1px solid var(--color-border);
  cursor: default;
  color: var(--color-text-secondary);
}

.page-tab.active {
  background: var(--color-bg);
  color: var(--color-text);
  box-shadow: inset 0 2px 0 var(--color-primary);
}

.page-tab-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-tab-rename {
  width: 96px;
  font-size: 12px;
  padding: 1px 4px;
  border: 1px solid var(--color-primary);
  border-radius: 2px;
  outline: none;
}

.page-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 2px;
  border-radius: 2px;
}

.page-tab-close:hover {
  color: #d4380d;
  background: rgba(0, 0, 0, 0.06);
}

.delete-confirm {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  white-space: nowrap;
}

.delete-confirm-error {
  color: #d4380d;
}

.delete-confirm button {
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  cursor: pointer;
}

.delete-confirm button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.page-tab-add {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  width: 22px;
  height: 22px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.page-tab-add:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.zoom-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
}

.zoom-slider {
  width: 120px;
}

.zoom-percent {
  min-width: 40px;
  text-align: right;
  color: var(--color-text-secondary);
}
</style>

<template>
  <div class="right-panel-wrap" :class="{ collapsed: appStore.rightPanelCollapsed }">
    <button
      type="button"
      class="collapse-toggle"
      data-testid="rp-collapse"
      :aria-label="appStore.rightPanelCollapsed ? '展开右侧面板' : '折叠右侧面板'"
      :title="appStore.rightPanelCollapsed ? '展开右侧面板' : '折叠右侧面板'"
      @click="appStore.toggleRightPanel()"
    >
      {{ appStore.rightPanelCollapsed ? '«' : '»' }}
    </button>
    <aside
      v-if="!appStore.rightPanelCollapsed"
      class="right-panel"
      :class="{ floating: isFloating }"
      data-testid="right-panel"
    >
      <div class="panel-title-row">
        <span class="panel-title" data-testid="rp-title">{{ title }}</span>
        <button
          type="button"
          class="panel-close"
          data-testid="rp-close"
          aria-label="关闭面板"
          title="关闭面板"
          @click="appStore.toggleRightPanel()"
        >
          ×
        </button>
      </div>
      <template v-if="actualMode === 'tabs'">
        <div class="panel-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            data-testid="rp-tab-property"
            :class="{ active: tab === 'property' }"
            :aria-selected="tab === 'property'"
            @click="tab = 'property'"
          >
            属性
          </button>
          <button
            type="button"
            role="tab"
            data-testid="rp-tab-page"
            :class="{ active: tab === 'page' }"
            :aria-selected="tab === 'page'"
            @click="tab = 'page'"
          >
            页面设置
          </button>
        </div>
        <div class="panel-body">
          <PropertyTab v-if="tab === 'property'" ref="propertyTab" />
          <PageSetupTab v-else />
        </div>
      </template>
      <div v-else class="panel-body">
        <!-- 查找替换模式由外壳注入，面板本身只负责布局。 -->
        <slot name="find" />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
// 右侧面板（280px）：标题行（当前标题 + 关闭×）+ 属性/页面设置两标签。
// 左侧边中点折叠按钮收起/展开整栏（app-store.rightPanelCollapsed，视图状态不入历史）；
// 窄窗口（<1100px）浮层化（floating 类：absolute 右侧 + 阴影，可关闭）；
// mode='find' 显示外壳注入的查找替换内容。
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app-store'
import PageSetupTab from '@/ui/pages/PageSetupTab.vue'
import PropertyTab from './PropertyTab.vue'

const props = defineProps<{ mode?: 'tabs' | 'find' }>()

const appStore = useAppStore()
const tab = ref<'property' | 'page'>('property')
const propertyTab = ref<{ focusSection(section: 'link' | 'text' | 'line'): Promise<void> } | null>(null)
const isFloating = ref(false)
const actualMode = computed<'tabs' | 'find'>(() =>
  props.mode ?? (appStore.rightPanelMode === 'find' ? 'find' : 'tabs'),
)

const title = computed(() => {
  if (actualMode.value === 'find') return '查找替换'
  return tab.value === 'property' ? '属性' : '页面设置'
})

async function focusSection(section: 'link' | 'text' | 'line'): Promise<void> {
  appStore.showProperties()
  tab.value = 'property'
  await nextTick()
  await propertyTab.value?.focusSection(section)
}
defineExpose({ focusSection })

function syncFloating(): void {
  isFloating.value = window.innerWidth < 1100
}

onMounted(() => {
  syncFloating()
  window.addEventListener('resize', syncFloating)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncFloating)
})
</script>

<style scoped>
.right-panel-wrap {
  position: relative;
  width: var(--inspector-w);
  height: 100%;
  flex-shrink: 0;
}

.right-panel-wrap.collapsed {
  width: 0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  border-left: 1px solid var(--color-border);
  background: var(--color-panel);
  overflow: hidden;
}

/* 窄窗口浮层化：absolute 右侧 + 阴影（类切换由 window 宽度驱动） */
.right-panel.floating {
  position: absolute;
  right: 0;
  top: 0;
  width: var(--inspector-w);
  box-shadow: -4px 0 12px rgb(0 0 0 / 15%);
  z-index: 12;
}

@media (width < 1100px) {
  .right-panel:not(.floating) {
    position: absolute;
    right: 0;
    top: 0;
    width: var(--inspector-w);
    box-shadow: -4px 0 12px rgb(0 0 0 / 15%);
    z-index: 12;
  }
}

.collapse-toggle {
  position: absolute;
  left: -14px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 13;
  width: 14px;
  height: 48px;
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: 4px 0 0 4px;
  background: var(--color-panel);
  cursor: pointer;
  font-size: 10px;
  color: var(--color-text-secondary);
  padding: 0;
}

.right-panel-wrap.collapsed .collapse-toggle {
  left: -14px;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 4px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.panel-close {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-secondary);
  padding: 0 4px;
}

.panel-close:hover {
  color: var(--color-text);
}

.panel-tabs {
  display: flex;
  gap: 4px;
  padding: 0 12px;
  border-bottom: 1px solid var(--color-border);
}

.panel-tabs button {
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  padding: 6px 4px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.panel-tabs button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>

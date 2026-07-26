<template>
  <footer class="status-bar" data-testid="statusbar">
    <div class="status-left">
      <span>已选择 {{ selectedCount }} 个图元</span>
      <span v-if="anchorX">X {{ anchorX }}</span><span v-if="anchorY">Y {{ anchorY }}</span>
    </div>
    <div class="status-right">
      <span>页 {{ pageIndex }}/{{ pageCount }}</span>
      <label class="zoom-label"><span class="sr-only">缩放比例</span>
        <select data-testid="status-zoom" :value="String(zoom)" title="缩放比例。调整当前页面视图，不修改文档。" @change="onZoom">
          <option v-if="!isPresetZoom" :value="String(zoom)">{{ Math.round(zoom * 100) }}%</option>
          <option v-for="value in zooms" :key="value" :value="value">{{ Math.round(value * 100) }}%</option>
        </select>
      </label>
      <button type="button" data-testid="status-fit" aria-label="适应屏幕" title="适应屏幕。缩放当前页面以适合画布。" @click="emit('setZoom', 'fit')"><AppIcon name="fitToScreen" :size="14" /></button>
      <button type="button" data-testid="status-grid" :aria-pressed="appStore.showGrid" aria-label="切换网格" title="切换网格。显示或隐藏画布网格，不进入撤销历史。" @click="appStore.toggleGrid()"><AppIcon :name="appStore.showGrid ? 'gridOn' : 'gridOff'" :size="14" />网格 {{ appStore.showGrid ? '开' : '关' }}</button>
      <button type="button" data-testid="status-snap" :aria-pressed="appStore.snapToGrid" aria-label="切换对齐吸附" title="切换对齐吸附。控制图元移动时的网格吸附，不进入撤销历史。" @click="appStore.toggleSnap()"><AppIcon name="magnet" :size="14" />对齐 {{ appStore.snapToGrid ? '开' : '关' }}</button>
      <span class="save-state"><i :class="dirty ? 'dirty' : 'saved'" />{{ dirty ? '未保存' : '已保存' }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/ui/icons/AppIcon.vue'
import { useAppStore } from '@/stores/app-store'
const props = defineProps<{ selectedCount: number; anchorX?: string; anchorY?: string; pageIndex: number; pageCount: number; zoom: number; dirty: boolean }>()
const emit = defineEmits<{ setZoom: [zoom: number | 'fit'] }>()
const appStore = useAppStore()
const zooms = [0.5, 0.75, 1, 1.25, 1.5, 2]
const isPresetZoom = computed(() => zooms.includes(props.zoom))
function onZoom(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  emit('setZoom', value === 'fit' ? 'fit' : Number(value))
}
</script>

<style scoped>
.status-bar { display: flex; align-items: center; justify-content: space-between; height: var(--statusbar-h); padding: 0 8px; border-top: 1px solid var(--color-border); background: var(--color-panel); color: var(--color-text-secondary); font-size: 11px; }
.status-left, .status-right { display: flex; align-items: center; gap: 10px; }
select, button { height: 20px; border: 1px solid transparent; background: transparent; color: inherit; font-size: 11px; }
button { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
button:hover, button:focus-visible, select:focus-visible { border-color: var(--color-primary); outline: none; }
.save-state { display: flex; align-items: center; gap: 4px; }
.save-state i { width: 7px; height: 7px; border-radius: 50%; background: #31a36b; }
.save-state i.dirty { background: #e19032; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
</style>

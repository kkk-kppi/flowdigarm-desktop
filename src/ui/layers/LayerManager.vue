<template>
  <aside class="layer-manager" aria-label="图层管理" data-testid="layer-manager">
    <div class="layer-actions">
      <button type="button" data-testid="layer-front" aria-label="置于顶层" title="置于顶层。将所选图元移动到最上层。" @click="move('to-front')">置顶</button>
      <button type="button" aria-label="上移一层" title="上移一层。将所选图元向上移动一个层级。" @click="move('forward')">上移</button>
      <button type="button" aria-label="下移一层" title="下移一层。将所选图元向下移动一个层级。" @click="move('backward')">下移</button>
      <button type="button" aria-label="置于底层" title="置于底层。将所选图元移动到最下层。" @click="move('to-back')">置底</button>
    </div>
    <button
      v-for="cell in cells"
      :key="cell.id"
      type="button"
      data-testid="layer-item"
      :data-cell-id="cell.id"
        :class="{ selected: controller.isSelected(cell.id) }"
        @click="controller.locate(cell.id)"
    ><span>{{ cell.kind === 'node' ? '节点' : '连线' }}</span><strong>{{ cell.name }}</strong><small>z {{ cell.zIndex }}</small></button>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZOrderAction } from '@/application/arrangement/z-order'
import type { LayerManagerPort } from '@/application/layers/layer-manager-controller'

const props = defineProps<{ controller: LayerManagerPort }>()
const cells = computed(() => props.controller.cells())
function move(action: ZOrderAction): void {
  props.controller.move(action)
}
</script>

<style scoped>
.layer-manager { width: var(--inspector-w); padding: 8px; border-left: 1px solid var(--color-border); background: var(--color-panel); overflow: auto; }
.layer-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 8px; }
.layer-actions button { min-height: 28px; border: 1px solid var(--color-border); border-radius: 3px; background: #f8fafc; cursor: pointer; font-size: 11px; }
[data-testid="layer-item"] { display: grid; grid-template-columns: 38px 1fr auto; align-items: center; width: 100%; min-height: 32px; padding: 0 7px; border: 0; border-bottom: 1px solid #edf0f4; background: transparent; text-align: left; cursor: pointer; }
[data-testid="layer-item"].selected { background: #e9eef8; box-shadow: inset 2px 0 var(--color-primary); }
strong { overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; }
small, span { color: var(--color-text-secondary); font-size: 10px; }
</style>

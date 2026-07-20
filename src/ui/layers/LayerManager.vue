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
      :class="{ selected: selectionStore.isSelected(cell.id) }"
      @click="select(cell.id)"
    ><span>{{ cell.kind === 'node' ? '节点' : '连线' }}</span><strong>{{ cell.name }}</strong><small>z {{ cell.zIndex }}</small></button>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { createZOrderCommand, type ZOrderAction } from '@/application/arrangement/z-order'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'

const emit = defineEmits<{ locate: [cellId: string] }>()
const documentStore = useDocumentStore()
const selectionStore = useSelectionStore()
const cells = computed(() => {
  const page = documentStore.activePage
  if (!page) return []
  return [
    ...page.nodes.map((node) => ({ id: node.id, kind: 'node' as const, name: node.text?.value || node.shape, zIndex: node.zIndex })),
    ...page.edges.map((edge) => ({ id: edge.id, kind: 'edge' as const, name: edge.labels[0]?.text.value || edge.id, zIndex: edge.zIndex })),
  ].sort((a, b) => b.zIndex - a.zIndex)
})
function select(cellId: string): void {
  selectionStore.setSelection([cellId])
  emit('locate', cellId)
}
function move(action: ZOrderAction): void {
  const page = documentStore.activePage
  if (!page) return
  const command = createZOrderCommand(page, selectionStore.selectedIds, action)
  if (command) documentStore.executeCommand(command)
  else documentStore.setNotice('当前图元已在目标层级。')
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

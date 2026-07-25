<template>
  <aside class="element-library" :class="{ collapsed }" data-testid="element-library">
    <div class="library-header">
      <span class="library-title">图元</span>
      <QuickHelpButton help-id="shape-library" label="形状库" />
      <button
        type="button"
        class="collapse-toggle"
        data-testid="collapse-toggle"
        :aria-label="collapsed ? '展开图元库' : '折叠图元库'"
        :title="collapsed ? '展开图元库' : '折叠图元库'"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <AppIcon :name="collapsed ? 'chevronRight' : 'chevronLeft'" :size="14" />
      </button>
    </div>
    <template v-if="!collapsed">
      <div class="library-search-wrap">
        <AppIcon name="search" :size="14" />
        <input
          v-model="query"
          class="library-search"
          type="search"
          placeholder="搜索图元..."
          aria-label="搜索图元"
        />
      </div>
      <div class="library-body">
        <!-- 常用（Top 20，搜索时隐藏）：与分类格子同一创建交互 -->
        <section v-if="normalizedQuery === ''" class="category">
          <button
            type="button"
            class="category-header"
            data-testid="category-top-header"
            :aria-expanded="topExpanded"
            @click="topExpanded = !topExpanded"
          >
            <AppIcon
              class="category-arrow"
              :name="topExpanded ? 'chevronDown' : 'chevronRight'"
              :size="12"
            />
            常用
          </button>
          <div v-if="topExpanded" class="category-grid">
            <div
              v-for="shape in topShapes"
              :key="shape.type"
              class="shape-cell"
              data-testid="top-shape-cell"
              role="button"
              tabindex="0"
              :aria-label="shape.label"
              :title="shape.label"
              @mousedown="onCellMouseDown(shape.type, $event)"
              @dblclick="emit('create-request', shape.type)"
              @keydown.enter="emit('create-request', shape.type)"
              @keydown.space.prevent="emit('create-request', shape.type)"
            >
              <svg class="shape-thumb" viewBox="0 0 100 100" aria-hidden="true">
                <rect
                  v-if="shape.body.markup === 'rect'"
                  x="4"
                  y="4"
                  width="92"
                  height="92"
                  :rx="thumbRadius(shape)"
                  :ry="thumbRadius(shape)"
                  class="thumb-body"
                />
                <ellipse
                  v-else-if="shape.body.markup === 'ellipse'"
                  cx="50"
                  cy="50"
                  rx="46"
                  ry="46"
                  class="thumb-body"
                />
                <path v-else :d="shape.body.path" class="thumb-body" />
              </svg>
              <span class="shape-label">{{ shape.label }}</span>
            </div>
          </div>
        </section>
        <section v-for="section in sections" :key="section.category" class="category">
          <button
            type="button"
            class="category-header"
            :data-testid="`category-${section.category}-header`"
            :aria-expanded="section.expanded"
            @click="section.expanded = !section.expanded"
          >
            <AppIcon
              class="category-arrow"
              :name="section.expanded ? 'chevronDown' : 'chevronRight'"
              :size="12"
            />
            {{ section.title }}
          </button>
          <div v-if="section.expanded" class="category-grid">
            <div
              v-for="shape in filteredShapes(section.category)"
              :key="shape.type"
              class="shape-cell"
              data-testid="shape-cell"
              role="button"
              tabindex="0"
              :aria-label="shape.label"
              :title="shape.label"
              @mousedown="onCellMouseDown(shape.type, $event)"
              @dblclick="emit('create-request', shape.type)"
              @keydown.enter="emit('create-request', shape.type)"
              @keydown.space.prevent="emit('create-request', shape.type)"
            >
              <svg class="shape-thumb" viewBox="0 0 100 100" aria-hidden="true">
                <rect
                  v-if="shape.body.markup === 'rect'"
                  x="4"
                  y="4"
                  width="92"
                  height="92"
                  :rx="thumbRadius(shape)"
                  :ry="thumbRadius(shape)"
                  class="thumb-body"
                />
                <ellipse
                  v-else-if="shape.body.markup === 'ellipse'"
                  cx="50"
                  cy="50"
                  rx="46"
                  ry="46"
                  class="thumb-body"
                />
                <path v-else :d="shape.body.path" class="thumb-body" />
              </svg>
              <span class="shape-label">{{ shape.label }}</span>
            </div>
          </div>
        </section>
        <p v-if="totalVisible === 0" class="empty-hint">无匹配图元</p>
      </div>
      <button
        type="button"
        class="more-shapes"
        data-testid="more-shapes"
        @click="emit('more-shapes')"
      >
        <AppIcon name="add" :size="14" />
        更多形状...
      </button>
    </template>
  </aside>
</template>

<script setup lang="ts">
// 左侧图元库（220px）：搜索、常用区（Top 20）、基本形状/流程图手风琴、3 列缩略图网格。
// 常用区：computeTopShapes(20)（次数降序、同次按内置序、新用户按内置序补足），
// 使用记录经 document-store 注入的 repository；shapeUsageVersion 变化时异步刷新；搜索时隐藏。
// 拖拽经 X6 Dnd（CanvasArea 注入 shapeDragStartKey）获得画布内拖拽预览；双击/回车直接创建。
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import QuickHelpButton from '@/ui/help/QuickHelpButton.vue'
import AppIcon from '@/ui/icons/AppIcon.vue'
import { shapeRegistry, type ShapeDefinition } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册内置形状
import { computeTopShapes } from '@/application/shapes/shape-usage-repository'
import { useDocumentStore } from '@/stores/document-store'
import { shapeDragStartKey } from './shape-drag-key'

const emit = defineEmits<{
  (e: 'create-request', shapeType: string): void
  (e: 'more-shapes'): void
}>()

const startShapeDrag = inject(shapeDragStartKey, null)
const documentStore = useDocumentStore()

const collapsed = ref(false)
const query = ref('')
const topExpanded = ref(true)

/** 常用区形状（Top 20 → 库内 12 格）；仅 basic/flowchart 分类可入库展示。 */
const topShapes = ref<ShapeDefinition[]>([])

/** 图元库内置顺序（基本 → 流程图），即 computeTopShapes 的补足顺序。 */
function libraryTypes(): string[] {
  return [
    ...shapeRegistry.byCategory('basic').map((def) => def.type),
    ...shapeRegistry.byCategory('flowchart').map((def) => def.type),
  ]
}

async function refreshTopShapes(): Promise<void> {
  const rows = await documentStore.shapeUsageRepository.topUsed(20)
  topShapes.value = computeTopShapes(rows, libraryTypes(), 20)
    .map((type) => shapeRegistry.get(type))
    .filter((def) => def.category === 'basic' || def.category === 'flowchart')
}

onMounted(() => {
  void refreshTopShapes()
})

watch(
  () => documentStore.shapeUsageVersion,
  () => {
    void refreshTopShapes()
  },
)

interface CategorySection {
  category: 'basic' | 'flowchart'
  title: string
  expanded: boolean
}

const sections = reactive<CategorySection[]>([
  { category: 'basic', title: '基本形状', expanded: true },
  { category: 'flowchart', title: '流程图', expanded: true },
])

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

/** 按分类返回过滤后的形状（label 匹配，大小写不敏感）。 */
function filteredShapes(category: 'basic' | 'flowchart'): ShapeDefinition[] {
  return shapeRegistry
    .byCategory(category)
    .filter((def) => def.label.toLowerCase().includes(normalizedQuery.value))
}

const totalVisible = computed(
  () => filteredShapes('basic').length + filteredShapes('flowchart').length,
)

/** 圆角缩略半径：按形状宽比换算到 100×100 缩略坐标系。 */
function thumbRadius(def: ShapeDefinition): number {
  if (!def.body.roundedRadius) {
    return 0
  }
  return (def.body.roundedRadius / def.defaultSize.width) * 100
}

let clearPendingDrag: (() => void) | undefined

function onCellMouseDown(shapeType: string, event: MouseEvent): void {
  if (event.button !== 0 || !startShapeDrag) return
  clearPendingDrag?.()
  const origin = { x: event.clientX, y: event.clientY }
  const clear = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', clear)
    if (clearPendingDrag === clear) clearPendingDrag = undefined
  }
  const onMove = (moveEvent: MouseEvent) => {
    if (Math.hypot(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y) <= 3) return
    clear()
    startShapeDrag(shapeType, moveEvent)
  }
  clearPendingDrag = clear
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', clear)
}

onBeforeUnmount(() => clearPendingDrag?.())
</script>

<style scoped>
.element-library {
  display: flex;
  flex-direction: column;
  width: 220px;
  min-width: 48px;
  height: 100%;
  border-right: 1px solid var(--color-border, #d9d9d9);
  background: var(--color-bg-panel, #fafafa);
  overflow: hidden;
}

.element-library.collapsed {
  width: 48px;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 600;
}

.collapse-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
}

.library-search-wrap {
  position: relative;
  margin: 0 8px 6px;
}

.library-search-wrap > .app-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary, #666666);
  pointer-events: none;
}

.library-search {
  box-sizing: border-box;
  width: 100%;
  padding: 4px 8px;
  padding-left: 26px;
  font-size: 12px;
  border: 1px solid var(--color-border, #d9d9d9);
  border-radius: 4px;
}

.library-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 0;
  text-align: left;
}

.category-arrow {
  color: var(--color-text-secondary, #666666);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding-bottom: 8px;
}

.shape-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
}

.shape-cell:hover,
.shape-cell:focus-visible {
  border-color: #5f95ff;
  background: #f0f5ff;
  outline: none;
}

.shape-thumb {
  width: 32px;
  height: 32px;
}

.thumb-body {
  fill: #ffffff;
  stroke: #333333;
  stroke-width: 3;
}

.shape-label {
  font-size: 11px;
  color: var(--color-text, #333333);
  white-space: nowrap;
}

.empty-hint {
  margin: 12px 0;
  font-size: 12px;
  color: #999999;
  text-align: center;
}

.more-shapes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 6px 8px 8px;
  padding: 6px 0;
  border: 1px dashed var(--color-border, #d9d9d9);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: #666666;
}

.more-shapes:hover {
  color: #5f95ff;
  border-color: #5f95ff;
}
</style>

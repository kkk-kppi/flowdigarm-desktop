<template>
  <div class="compact-toolbar" data-testid="compact-toolbar">
    <!-- 操作 -->
    <div class="toolbar-group" role="group" aria-label="操作">
      <button
        type="button"
        data-testid="tb-undo"
        :disabled="!documentStore.canUndo"
        :title="undoTooltip"
        aria-label="撤销"
        @click="documentStore.undo()"
      >
        <AppIcon name="undo" />
        撤销
      </button>
      <button
        type="button"
        data-testid="tb-redo"
        :disabled="!documentStore.canRedo"
        :title="redoTooltip"
        aria-label="重做"
        @click="documentStore.redo()"
      >
        <AppIcon name="redo" />
        重做
      </button>
    </div>
    <div class="toolbar-divider" />

    <!-- 粘贴板 -->
    <div class="toolbar-group" role="group" aria-label="粘贴板">
      <button
        type="button"
        data-testid="tb-copy"
        :disabled="!selectionStore.hasSelection"
        title="复制（Ctrl+C）：复制选中图元到应用内剪贴板"
        aria-label="复制"
        @click="documentStore.copySelection()"
      >
        <AppIcon name="copy" />
        复制
      </button>
      <button
        type="button"
        data-testid="tb-cut"
        :disabled="!selectionStore.hasSelection"
        title="剪切（Ctrl+X）：剪切选中图元（一条删除记录）"
        aria-label="剪切"
        @click="documentStore.cutSelection()"
      >
        <AppIcon name="cut" />
        剪切
      </button>
      <button
        type="button"
        data-testid="tb-paste"
        :disabled="!documentStore.canPaste"
        title="粘贴（Ctrl+V）：优先粘贴应用内内容，否则读取系统剪贴板"
        aria-label="粘贴"
        @click="documentStore.pasteClipboard()"
      >
        <AppIcon name="paste" />
        粘贴
      </button>
      <button
        type="button"
        data-testid="tb-format-painter"
        :disabled="formatPainterDisabled"
        :class="{ active: formatPaintStore.mode === 'once', continuous: formatPaintStore.mode === 'continuous' }"
        :aria-pressed="formatPaintStore.mode !== 'off'"
        title="格式刷：单击复制一次选中图元的格式（填充/边框/阴影/字体/文本块/段落，不含位置/尺寸/内容/链接）；双击锁定连续刷多个目标；Esc 或点击空白退出"
        aria-label="格式刷"
        @click="formatPaintStore.armOnce()"
        @dblclick="formatPaintStore.armContinuous()"
      >
        <AppIcon name="formatPaint" />
        格式刷
      </button>
      <QuickHelpButton help-id="format-paint" label="格式刷" />
    </div>
    <div class="toolbar-divider" />

    <!-- 字体 -->
    <div class="toolbar-group" role="group" aria-label="字体">
      <span class="toolbar-control">
        <AppIcon name="font" />
        <select
          data-testid="tb-font-family"
          title="字体：设置选中文本的字体"
          aria-label="字体"
          :disabled="textAgg.style.fontFamily.kind === 'none'"
          :value="selectValue(textAgg.style.fontFamily)"
          @change="writeTextPatch({ style: { fontFamily: ($event.target as HTMLSelectElement).value } })"
        >
          <option v-if="textAgg.style.fontFamily.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
          <option v-for="family in fontFamilies" :key="family" :value="family">{{ family }}</option>
        </select>
      </span>
      <span class="toolbar-control">
        <AppIcon name="fontSize" />
        <input
          type="number"
          class="font-size-input"
          data-testid="tb-font-size"
          title="字号：设置选中文本的字号（可输入 8–72）"
          aria-label="字号"
          min="1"
          list="tb-font-size-options"
          :disabled="textAgg.style.fontSize.kind === 'none'"
          :value="numberValue(textAgg.style.fontSize)"
          :placeholder="textAgg.style.fontSize.kind === 'mixed' ? '多个值' : ''"
          @change="commitFontSize"
        />
      </span>
      <datalist id="tb-font-size-options">
        <option v-for="size in fontSizes" :key="size" :value="size" />
      </datalist>
      <button
        v-for="btn in styleButtons"
        :key="btn.key"
        type="button"
        class="style-btn"
        :data-testid="`tb-${btn.key}`"
        :title="btn.title"
        :aria-label="btn.ariaLabel"
        :class="{ active: isActive(textAgg.style[btn.key]), indeterminate: textAgg.style[btn.key].kind === 'mixed' }"
        :aria-pressed="boolPressed(textAgg.style[btn.key])"
        :disabled="textAgg.style[btn.key].kind === 'none'"
        @click="toggleStyleBool(btn.key)"
      >
        <AppIcon :name="btn.icon" />
      </button>
      <span class="toolbar-control">
        <AppIcon name="textColor" />
        <input
          type="color"
          data-testid="tb-text-color"
          title="文字颜色：设置选中文本的颜色"
          aria-label="文字颜色"
          :disabled="textAgg.style.color.kind === 'none'"
          :value="colorValue(textAgg.style.color, '#000000')"
          @change="writeTextPatch({ style: { color: ($event.target as HTMLInputElement).value } })"
        />
      </span>
      <span class="toolbar-control">
        <AppIcon name="fillColor" />
        <input
          type="color"
          data-testid="tb-text-background"
          title="文字背景色：设置选中文本的背景色"
          aria-label="文字背景色"
          :disabled="textAgg.style.background.kind === 'none'"
          :value="colorValue(textAgg.style.background, '#000000')"
          @change="writeTextPatch({ style: { background: ($event.target as HTMLInputElement).value } })"
        />
      </span>
      <QuickHelpButton help-id="text-style" label="文本格式" />
    </div>
    <div class="toolbar-divider" />

    <!-- 段落对齐 -->
    <div class="toolbar-group" role="group" aria-label="段落对齐">
      <button
        v-for="opt in verticalOptions"
        :key="opt.value"
        type="button"
        class="align-btn"
        :data-testid="`tb-valign-${opt.value}`"
        :title="opt.title"
        :aria-label="opt.title"
        :class="{ active: isActiveValue(textAgg.block.verticalAlign, opt.value), indeterminate: textAgg.block.verticalAlign.kind === 'mixed' }"
        :aria-pressed="alignPressed(textAgg.block.verticalAlign, opt.value)"
        :disabled="textAgg.block.verticalAlign.kind === 'none'"
        @click="writeTextPatch({ block: { verticalAlign: opt.value } })"
      >
        <AppIcon :name="opt.icon" />
      </button>
      <button
        v-for="opt in horizontalOptions"
        :key="opt.value"
        type="button"
        class="align-btn"
        :data-testid="`tb-align-${opt.value}`"
        :title="opt.title"
        :aria-label="opt.title"
        :class="{ active: isActiveValue(textAgg.block.horizontalAlign, opt.value), indeterminate: textAgg.block.horizontalAlign.kind === 'mixed' }"
        :aria-pressed="alignPressed(textAgg.block.horizontalAlign, opt.value)"
        :disabled="textAgg.block.horizontalAlign.kind === 'none'"
        @click="writeTextPatch({ block: { horizontalAlign: opt.value } })"
      >
        <AppIcon :name="opt.icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 紧凑工具栏（48px）：操作/粘贴板/字体/段落对齐四组（竖线分隔）。
// 撤销/重做 disabled 绑定 canUndo/canRedo，tooltip 含 undoLabel/redoLabel；
// 字体与段落对齐经聚合态显示（value→按态、mixed→不定态、none→禁用）；
// 写入一律 TextStyleCommand（全部选中节点一条；含边选择时边标签同批，经共享模块）。
// 颜色控件用 @change（取色器关闭/确认时一次提交一条记录；拖动过程的 input 事件不入栈）。
// 格式刷：单击 armOnce（恰好 1 选中否则禁用）、双击 armContinuous（橙色 continuous 态）、
// Esc 全局 keydown 取消（输入控件聚焦/文本编辑中不拦截）；应用由 CanvasArea 点击图元触发。
import { computed, onBeforeUnmount, onMounted } from 'vue'
import AppIcon from '@/ui/icons/AppIcon.vue'
import type { IconName } from '@/ui/icons/icon-registry'
import QuickHelpButton from '@/ui/help/QuickHelpButton.vue'
import type { TextBlock, TextStyle } from '@/domain/diagram'
import { PropertyController, type TextStylePatch } from '@/application/inspector/property-controller'
import { aggregateTextStyles, type Aggregate } from '@/application/inspector/aggregate-style'
import {
  alignPressed,
  boolPressed,
  colorValue,
  numberValue,
  toggledStyleBool,
} from '@/application/inspector/aggregate-display'
import { fontFamilies, fontSizes } from '@/application/inspector/font-presets'
import { textContentsForSelection } from '@/application/inspector/text-style-targets'
import { useDocumentStore } from '@/stores/document-store'
import { useFormatPaintStore } from '@/stores/format-paint-store'
import { useSelectionStore } from '@/stores/selection-store'

const documentStore = useDocumentStore()
const selectionStore = useSelectionStore()
const formatPaintStore = useFormatPaintStore()
const propertyController = new PropertyController((command) => documentStore.executeCommand(command))

/** 格式刷按钮禁用：off 模式下需恰好 1 个选中图元；armed（once/continuous）时保持可用以显示状态。 */
const formatPainterDisabled = computed(
  () => formatPaintStore.mode === 'off' && selectionStore.selectedIds.length !== 1,
)

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
}

/** Esc 退出格式刷（全局 keydown；输入控件聚焦/文本编辑中不拦截）。 */
function onGlobalKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || isEditableTarget(event.target)) {
    return
  }
  if (formatPaintStore.mode !== 'off') {
    formatPaintStore.cancel()
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown)
})

const undoTooltip = computed(() =>
  `撤销${documentStore.undoLabel ? `：${documentStore.undoLabel}` : ''}（Ctrl+Z）`,
)
const redoTooltip = computed(() =>
  `重做${documentStore.redoLabel ? `：${documentStore.redoLabel}` : ''}（Ctrl+Y）`,
)

/** 文本聚合：选中节点文本 + 选中边首标签文本。 */
const textAgg = computed(() => {
  const page = documentStore.activePage
  if (!page) return aggregateTextStyles([])
  return aggregateTextStyles(textContentsForSelection(page, selectionStore.selectedIds))
})

const styleButtons: Array<{
  key: 'bold' | 'italic' | 'underline' | 'strikethrough'
  icon: IconName
  title: string
  ariaLabel: string
}> = [
  { key: 'bold', icon: 'bold', title: '加粗：切换选中文本加粗', ariaLabel: '加粗' },
  { key: 'italic', icon: 'italic', title: '斜体：切换选中文本斜体', ariaLabel: '斜体' },
  { key: 'underline', icon: 'underline', title: '下划线：切换选中文本下划线', ariaLabel: '下划线' },
  { key: 'strikethrough', icon: 'strikethrough', title: '删除线：切换选中文本删除线', ariaLabel: '删除线' },
]

const verticalOptions: { value: TextBlock['verticalAlign']; icon: IconName; title: string }[] = [
  { value: 'top', icon: 'alignTop', title: '顶端对齐' },
  { value: 'middle', icon: 'alignMiddle', title: '垂直居中' },
  { value: 'bottom', icon: 'alignBottom', title: '底端对齐' },
]
const horizontalOptions: { value: TextBlock['horizontalAlign']; icon: IconName; title: string }[] = [
  { value: 'left', icon: 'alignLeft', title: '左对齐' },
  { value: 'center', icon: 'alignCenter', title: '居中对齐' },
  { value: 'right', icon: 'alignRight', title: '右对齐' },
]

function selectValue(agg: Aggregate<unknown>): string {
  if (agg.kind === 'mixed') return '__mixed__'
  return agg.kind === 'value' && agg.value !== null ? String(agg.value) : ''
}

function isActive(agg: Aggregate<unknown>): boolean {
  return agg.kind === 'value' && agg.value === true
}

function isActiveValue(agg: Aggregate<unknown>, option: string): boolean {
  return agg.kind === 'value' && agg.value === option
}

/** 文本样式写入：全部选中节点 + 选中边首标签，一次控件变更一条记录。 */
function writeTextPatch(patch: TextStylePatch): void {
  const page = documentStore.activePage
  if (!page) return
  propertyController.applyTextStyle(page, selectionStore.selectedIds, patch)
}

/** 字形布尔切换：下一值经共享纯函数（mixed 或不全 true → true；全 true → false）。 */
function toggleStyleBool(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
  const next = toggledStyleBool(textAgg.value.style[key])
  writeTextPatch({ style: { [key]: next } as Partial<TextStyle> })
}

function commitFontSize(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value) || value <= 0) return
  writeTextPatch({ style: { fontSize: value } })
}
</script>

<style scoped>
.compact-toolbar {
  box-sizing: border-box;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  height: var(--toolbar-h);
  padding: 0 4px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-panel);
  overflow: hidden;
}

.toolbar-group {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
}

.toolbar-group button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 12px;
  padding: 3px 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar-group button:hover:not(:disabled) {
  background: var(--color-bg);
}

.toolbar-group button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-group button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(47, 111, 237, 0.08);
}

/* 格式刷连续模式：橙色 active 态（与单次蓝色区分） */
.toolbar-group button.continuous {
  border-color: #e8890c;
  color: #e8890c;
  background: rgba(232, 137, 12, 0.1);
}

.toolbar-group button.indeterminate {
  border-style: dashed;
  border-color: var(--color-border);
}

.style-btn,
.align-btn {
  min-width: 26px;
}

.toolbar-control {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  min-width: 0;
}

.toolbar-group select,
.font-size-input {
  font-size: 12px;
  padding: 2px 3px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text);
}

.toolbar-group select {
  width: 76px;
}

.font-size-input {
  width: 44px;
}

.toolbar-group input[type='color'] {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: none;
  cursor: pointer;
}

.toolbar-group input[type='color']:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

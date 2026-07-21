<template>
  <div class="page-setup-tab" data-testid="page-setup-tab">
    <div class="setup-help"><QuickHelpButton help-id="page-setup" label="页面设置" /></div>
    <fieldset class="setup-section">
      <legend>页面属性</legend>

      <label class="setup-row">
        <span class="setup-label">纸张大小</span>
        <select v-model="draft.preset" data-testid="paper-preset" title="纸张大小" @change="onPresetChange">
          <option v-for="option in paperOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <template v-if="draft.preset === 'custom'">
        <label class="setup-row">
          <span class="setup-label">宽度（{{ draft.unit }}）</span>
          <input
            type="number"
            step="any"
            min="0"
            data-testid="custom-width"
            title="自定义宽度"
            :value="formatPageMeasure(draft.widthPt, draft.unit)"
            @change="onCustomSizeChange('width', $event)"
          />
        </label>
        <label class="setup-row">
          <span class="setup-label">高度（{{ draft.unit }}）</span>
          <input
            type="number"
            step="any"
            min="0"
            data-testid="custom-height"
            title="自定义高度"
            :value="formatPageMeasure(draft.heightPt, draft.unit)"
            @change="onCustomSizeChange('height', $event)"
          />
        </label>
      </template>

      <div class="setup-row">
        <span class="setup-label">方向</span>
        <div class="button-group" role="group" aria-label="页面方向">
          <button
            type="button"
            data-testid="orientation-portrait"
            title="纵向"
            :class="{ active: draft.orientation === 'portrait' }"
            :aria-pressed="draft.orientation === 'portrait'"
            @click="setOrientation('portrait')"
          >
            纵向
          </button>
          <button
            type="button"
            data-testid="orientation-landscape"
            title="横向"
            :class="{ active: draft.orientation === 'landscape' }"
            :aria-pressed="draft.orientation === 'landscape'"
            @click="setOrientation('landscape')"
          >
            横向
          </button>
        </div>
      </div>

      <label class="setup-row">
        <span class="setup-label">单位</span>
        <select v-model="draft.unit" data-testid="page-unit" title="页面单位">
          <option v-for="unit in unitOptions" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </label>

      <label class="setup-row">
        <span class="setup-label">背景色</span>
        <input v-model="draft.background" type="color" data-testid="page-background" title="页面背景色" />
      </label>

      <label class="setup-row">
        <span class="setup-label">背景页</span>
        <select v-model="draft.backgroundPageId" data-testid="background-page" title="背景页">
          <option value="">无</option>
          <option v-for="page in backgroundPageOptions" :key="page.id" :value="page.id">
            {{ page.name }}
          </option>
        </select>
      </label>

      <div class="setup-row">
        <button
          type="button"
          data-testid="fit-page"
          :disabled="!canFitPage"
          :title="canFitPage ? '按内容自动调整页面大小' : '页面无图元'"
          @click="fitPage"
        >
          自动调整大小
        </button>
      </div>
    </fieldset>

    <fieldset class="setup-section">
      <legend>连线配置</legend>

      <label class="setup-row">
        <span class="setup-label">连线类型</span>
        <select v-model="draft.defaultConnector" data-testid="default-connector" title="连线类型">
          <option value="straight">直线</option>
          <option value="orthogonal">直角</option>
          <option value="curved">曲线</option>
        </select>
      </label>

      <div class="setup-row">
        <span class="setup-label">默认箭头</span>
        <div class="button-group" role="group" aria-label="默认箭头">
          <button
            type="button"
            data-testid="arrow-none"
            title="无箭头"
            :class="{ active: draft.defaultArrow === 'none' }"
            :aria-pressed="draft.defaultArrow === 'none'"
            @click="draft.defaultArrow = 'none'"
          >
            无
          </button>
          <button
            type="button"
            data-testid="arrow-single"
            title="单向箭头"
            :class="{ active: draft.defaultArrow === 'single' }"
            :aria-pressed="draft.defaultArrow === 'single'"
            @click="draft.defaultArrow = 'single'"
          >
            单向
          </button>
          <button
            type="button"
            data-testid="arrow-double"
            title="双向箭头"
            :class="{ active: draft.defaultArrow === 'double' }"
            :aria-pressed="draft.defaultArrow === 'double'"
            @click="draft.defaultArrow = 'double'"
          >
            双向
          </button>
        </div>
      </div>

      <label class="setup-row setup-switch">
        <input v-model="draft.autoConnectLabel" type="checkbox" data-testid="auto-connect-label" />
        <span title="自动连线时生成标签">自动连线标签</span>
      </label>

      <label class="setup-row setup-switch">
        <input v-model="draft.showLineJumps" type="checkbox" data-testid="show-line-jumps" />
        <span title="交叉连线显示跳线">连线跳线</span>
      </label>
    </fieldset>

    <p v-if="applyError" class="setup-error" role="alert">{{ applyError }}</p>

    <div class="setup-actions">
      <button
        type="button"
        class="primary"
        data-testid="apply-settings"
        title="应用页面设置"
        @click="applySettings"
      >
        应用
      </button>
      <button type="button" data-testid="reset-settings" title="重置为页面当前值" @click="resetDraft">
        重置
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 页面设置标签页：面板内编辑为本地草稿态（改输入不立即改文档）；
// 「应用」把草稿与页面原值打包为一个 UpdatePageCommand 执行（无变化不执行）；
// 「重置」恢复显示为页面当前值（不产生命令）。单位换算一律经 formatMeasure/unitToPt。
import { computed, reactive, ref, watch } from 'vue'
import QuickHelpButton from '@/ui/help/QuickHelpButton.vue'
import type { ConnectorKind, Orientation, PageUnit } from '@/domain/diagram'
import { paperSizeFor, type PaperPreset } from '@/domain/paper-presets'
import { PageSetupController, type PageSettingsSnapshot } from '@/application/pages/page-setup-controller'
import { formatPageMeasure, parsePageLength } from '@/application/pages/page-setup-view-model'
import { useDocumentStore } from '@/stores/document-store'

const documentStore = useDocumentStore()
const pageSetupController = new PageSetupController((command) => documentStore.executeCommand(command))

interface Draft {
  preset: PaperPreset
  widthPt: number
  heightPt: number
  orientation: Orientation
  unit: PageUnit
  defaultConnector: ConnectorKind
  defaultArrow: 'none' | 'single' | 'double'
  autoConnectLabel: boolean
  showLineJumps: boolean
  background: string
  backgroundPageId: string
}

const draft = reactive<Draft>({
  preset: 'a4',
  widthPt: 0,
  heightPt: 0,
  orientation: 'portrait',
  unit: 'mm',
  defaultConnector: 'orthogonal',
  defaultArrow: 'single',
  autoConnectLabel: true,
  showLineJumps: false,
  background: '#FFFFFF',
  backgroundPageId: '',
})

const paperOptions: { value: PaperPreset; label: string }[] = [
  { value: 'a3', label: 'A3' },
  { value: 'a4', label: 'A4' },
  { value: 'a5', label: 'A5' },
  { value: 'letter', label: 'Letter' },
  { value: 'tabloid', label: 'Tabloid' },
  { value: 'legal', label: 'Legal' },
  { value: 'statement', label: 'Statement' },
  { value: 'executive', label: 'Executive' },
  { value: 'b4-jis', label: 'B4-JIS' },
  { value: 'b5-jis', label: 'B5-JIS' },
  { value: 'custom', label: '自定义' },
]

const unitOptions: PageUnit[] = ['mm', 'cm', 'in', 'pt', 'px']

const backgroundPageOptions = computed(() =>
  documentStore.document.pages.filter(
    (page) => page.type === 'background' && page.id !== documentStore.activePageId,
  ),
)

/** 自动调整大小命令（无图元页为 null → 按钮禁用）。 */
const canFitPage = computed(() => pageSetupController.canFit(documentStore.activePage))

/** 重置草稿为页面当前值（不产生命令）。 */
function resetDraft(): void {
  const page = documentStore.activePage
  if (!page) {
    return
  }
  draft.preset = page.pageSize.preset ?? 'custom'
  draft.widthPt = page.pageSize.width
  draft.heightPt = page.pageSize.height
  draft.orientation = page.orientation
  draft.unit = page.unit
  draft.defaultConnector = page.defaultConnector
  draft.defaultArrow = page.defaultArrow
  draft.autoConnectLabel = page.autoConnectLabel
  draft.showLineJumps = page.showLineJumps
  draft.background = page.canvas.background
  draft.backgroundPageId = page.backgroundPageId ?? ''
}

const applyError = ref('')

// 切页：重置草稿并清除滞留的应用错误
watch(
  () => documentStore.activePageId,
  () => {
    applyError.value = ''
    resetDraft()
  },
  { immediate: true },
)

// 草稿任何编辑后清除滞留的应用错误
watch(draft, () => {
  applyError.value = ''
})

/** 预设切换：非自定义时按当前方向写入预设尺寸。 */
function onPresetChange(): void {
  if (draft.preset === 'custom') {
    return
  }
  const size = paperSizeFor(draft.preset)
  draft.widthPt = draft.orientation === 'landscape' ? size.height : size.width
  draft.heightPt = draft.orientation === 'landscape' ? size.width : size.height
}

/** 方向切换：宽高交换（横向取大值为宽）。 */
function setOrientation(orientation: Orientation): void {
  if (draft.orientation === orientation) {
    return
  }
  draft.orientation = orientation
  const small = Math.min(draft.widthPt, draft.heightPt)
  const large = Math.max(draft.widthPt, draft.heightPt)
  draft.widthPt = orientation === 'landscape' ? large : small
  draft.heightPt = orientation === 'landscape' ? small : large
}

/** 自定义尺寸输入：按当前单位解析为 pt；非法输入忽略。 */
function onCustomSizeChange(kind: 'width' | 'height', event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  const pt = parsePageLength(value, draft.unit)
  if (pt === null || pt === 0) return
  if (kind === 'width') {
    draft.widthPt = pt
  } else {
    draft.heightPt = pt
  }
}

function fitPage(): void {
  const page = documentStore.activePage
  if (page && pageSetupController.fit(page)) {
    // 命令已改写页面尺寸/方向：同步草稿，避免后续「应用」打包旧值静默回退 fit
    resetDraft()
  }
}

/** 「应用」：草稿与页面原值打包为一个 UpdatePageCommand；无变化不执行。 */
function applySettings(): void {
  const page = documentStore.activePage
  if (!page) {
    return
  }
  const after: PageSettingsSnapshot = {
    pageSize: { preset: draft.preset, width: draft.widthPt, height: draft.heightPt },
    orientation: draft.orientation,
    unit: draft.unit,
    defaultConnector: draft.defaultConnector,
    defaultArrow: draft.defaultArrow,
    autoConnectLabel: draft.autoConnectLabel,
    showLineJumps: draft.showLineJumps,
    background: draft.background,
    backgroundPageId: draft.backgroundPageId === '' ? undefined : draft.backgroundPageId,
  }
  try {
    pageSetupController.apply(page, after)
    applyError.value = ''
  } catch (error) {
    applyError.value = error instanceof Error ? error.message : String(error)
  }
}
</script>

<style scoped>
.setup-help { display: flex; justify-content: flex-end; padding: 4px 12px 0; }
.page-setup-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  font-size: 12px;
  color: var(--color-text);
}

.setup-section {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 8px 10px 10px;
  margin: 0;
}

.setup-section legend {
  padding: 0 4px;
  color: var(--color-text-secondary);
}

.setup-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.setup-label {
  width: 64px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.setup-row select,
.setup-row input[type='number'] {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text);
}

.setup-switch {
  cursor: pointer;
}

.setup-switch span {
  color: var(--color-text);
}

.button-group {
  display: flex;
  gap: 4px;
}

.button-group button {
  font-size: 12px;
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.button-group button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(47, 111, 237, 0.08);
}

.setup-error {
  margin: 0;
  color: #d4380d;
}

.setup-actions {
  display: flex;
  gap: 8px;
}

.setup-actions button {
  flex: 1;
  font-size: 12px;
  padding: 5px 0;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text);
  cursor: pointer;
}

.setup-actions button.primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #ffffff;
}

.setup-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

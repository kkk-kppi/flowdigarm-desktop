<template>
  <div class="export-backdrop">
    <section
      ref="dialog"
      class="export-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
      @keydown="onKeydown"
    >
      <header>
        <h2 id="export-title">导出</h2>
        <div class="header-actions">
          <button data-testid="export-help" type="button" aria-label="导出帮助" title="导出帮助。查看格式、页面范围、分辨率与安全链接说明。" :disabled="busy" @click="emit('help')"><AppIcon name="help" :size="16" /></button>
          <button type="button" aria-label="关闭导出" title="关闭导出。返回此前的编辑位置。" :disabled="busy" @click="emit('close')"><AppIcon name="close" :size="16" /></button>
        </div>
      </header>

      <fieldset :disabled="busy">
        <legend>页面范围</legend>
        <label v-for="option in scopes" :key="option.value" class="inline-option">
          <input :data-testid="`export-scope-${option.value}`" v-model="draft.scope" type="radio" name="export-scope" :value="option.value" :disabled="busy">
          {{ option.label }}
        </label>
      </fieldset>

      <fieldset class="format-grid" :disabled="busy">
        <legend>格式</legend>
        <label v-for="option in formats" :key="option.value" :class="['format-card', { selected: draft.format === option.value }]">
          <input :data-testid="`export-format-${option.value}`" v-model="draft.format" type="radio" name="export-format" :value="option.value" :disabled="busy" @change="destination = ''">
          <strong>{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </label>
      </fieldset>

      <label v-if="draft.format === 'png'" class="form-row">PNG DPI
        <select v-model.number="draft.dpi" data-testid="export-dpi" :disabled="busy">
          <option :value="96">96 DPI</option>
          <option :value="150">150 DPI</option>
          <option :value="300">300 DPI</option>
        </select>
      </label>

      <label class="form-row">文件名
        <input ref="firstControl" v-model="draft.fileName" type="text" data-testid="export-file-name" :disabled="busy" autocomplete="off">
      </label>
      <div class="form-row">
        <label for="export-destination">保存位置</label>
        <div class="destination-row">
          <input id="export-destination" data-testid="export-destination" :value="destination" type="text" readonly :disabled="busy" placeholder="请选择保存位置">
          <button data-testid="export-browse" type="button" :disabled="busy" @click="browse">浏览…</button>
        </div>
      </div>

      <p v-if="draft.format === 'svg' || draft.format === 'pdf'" class="hint">SVG/PDF 将保留 http、https 与 mailto 安全链接。</p>
      <p v-if="success" role="status" class="success">{{ success }}</p>
      <p v-if="error" role="alert" class="error">{{ error }}<br>请检查保存位置、可用空间或文件权限后重试。</p>

      <footer>
        <span v-if="busy" class="busy">正在导出…</span>
        <button type="button" :disabled="busy" @click="emit('close')">取消</button>
        <button data-testid="export-submit" class="primary" type="button" :disabled="busy" @click="submit">导出</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { ExportFormat, ExportOptions, ExportScope } from '@/application/export/export-ports'
import AppIcon from '@/ui/icons/AppIcon.vue'

interface ExportDialogController {
  chooseDestination(input: { format: ExportFormat; fileName: string }): Promise<string | null>
  export(options: ExportOptions): Promise<string[]>
}

const props = defineProps<{
  controller: ExportDialogController
  fileName: string
  pngDpi: number
  returnFocus?: HTMLElement | null
}>()
const emit = defineEmits<{ close: []; help: []; success: [path: string] }>()

const formats: Array<{ value: ExportFormat; label: string; description: string }> = [
  { value: 'svg', label: 'SVG', description: '矢量图，适合继续编辑' },
  { value: 'png', label: 'PNG', description: '位图，支持精确 DPI' },
  { value: 'pdf', label: 'PDF', description: '全部页面合并为多页文档' },
  { value: 'json', label: 'JSON', description: '完整可重新打开的图文件' },
]
const scopes: Array<{ value: ExportScope; label: string }> = [
  { value: 'currentPage', label: '当前页' },
  { value: 'allPages', label: '全部页面' },
]
const initialName = props.fileName.replace(/\.flowdiagram$/i, '')
const draft = reactive<{ format: ExportFormat; scope: ExportScope; fileName: string; dpi: number }>({
  format: 'svg', scope: 'currentPage', fileName: initialName, dpi: [96, 150, 300].includes(props.pngDpi) ? props.pngDpi : 150,
})
const destination = ref('')
const busy = ref(false)
const success = ref('')
const error = ref('')
const dialog = ref<HTMLElement | null>(null)
const firstControl = ref<HTMLInputElement | null>(null)
let returnFocus: HTMLElement | null = null

onMounted(() => {
  returnFocus = props.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  void nextTick(() => firstControl.value?.focus())
})
onBeforeUnmount(() => {
  if (returnFocus?.isConnected) returnFocus.focus()
})

async function browse(): Promise<string | null> {
  error.value = ''
  try {
    const path = await props.controller.chooseDestination({ format: draft.format, fileName: draft.fileName })
    if (path) destination.value = path
    return path
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '无法选择保存位置。'
    return null
  }
}

async function submit(): Promise<void> {
  if (busy.value) return
  success.value = ''
  error.value = ''
  if (!destination.value && !await browse()) return
  busy.value = true
  try {
    const paths = await props.controller.export({
      format: draft.format,
      scope: draft.scope,
      fileName: draft.fileName,
      destination: destination.value,
      dpi: draft.format === 'png' ? draft.dpi : undefined,
    })
    const path = paths.at(-1) ?? destination.value
    success.value = `已导出到 ${path}`
    emit('success', path)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '导出失败，当前文档未受影响：未知错误。'
  } finally {
    busy.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !busy.value) {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])') ?? [])]
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
</script>

<style scoped>
.export-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgb(15 23 42 / 42%); }
.export-modal { width: min(480px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto; padding: 20px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-panel); color: var(--color-text); box-shadow: 0 18px 50px rgb(0 0 0 / 24%); }
header, footer, .header-actions, .destination-row { display: flex; align-items: center; gap: 8px; }
header { justify-content: space-between; margin-bottom: 16px; }
h2 { margin: 0; font-size: 18px; }
fieldset { margin: 0 0 14px; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; }
legend { padding: 0 5px; font-size: 12px; color: var(--color-text-secondary); }
.inline-option { margin-right: 22px; font-size: 13px; }
.format-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.format-grid legend { grid-column: 1 / -1; }
.format-card { display: grid; grid-template-columns: auto 1fr; gap: 2px 7px; padding: 9px; border: 1px solid var(--color-border); border-radius: 5px; cursor: pointer; }
.format-card.selected { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
.format-card input { grid-row: 1 / 3; }
.format-card small { color: var(--color-text-secondary); }
.form-row { display: grid; gap: 5px; margin-bottom: 12px; font-size: 13px; }
.destination-row input { flex: 1; min-width: 0; }
input[type='text'], select { min-height: 32px; padding: 4px 7px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); color: var(--color-text); }
.hint, .success, .error { margin: 10px 0; font-size: 12px; }
.hint { color: var(--color-text-secondary); }
.success { color: #16794b; }
.error { color: #b42318; }
footer { justify-content: flex-end; margin-top: 18px; }
.busy { margin-right: auto; color: var(--color-text-secondary); font-size: 12px; }
button { min-height: 30px; padding: 5px 11px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); color: var(--color-text); cursor: pointer; }
button.primary { border-color: var(--color-primary); background: var(--color-primary); color: #fff; }
button:disabled { opacity: 0.55; cursor: not-allowed; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
@media (max-width: 420px) { .format-grid { grid-template-columns: 1fr; } }
</style>

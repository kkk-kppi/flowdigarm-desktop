<template>
  <div class="modal-backdrop">
    <section ref="dialog" class="modal" role="dialog" aria-modal="true" aria-labelledby="preferences-title" @keydown="onKeydown">
      <h2 id="preferences-title">首选项</h2>
      <div class="form-grid">
        <label>主题
          <select ref="firstControl" v-model="draft.theme" data-testid="preference-theme">
            <option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>
          </select>
        </label>
        <fieldset>
          <legend>画布显示</legend>
          <label><input v-model="draft.showRulers" data-testid="preference-show-rulers" type="checkbox"> 标尺</label>
          <label><input v-model="draft.showGrid" data-testid="preference-show-grid" type="checkbox"> 网格</label>
          <label><input v-model="draft.showGuides" data-testid="preference-show-guides" type="checkbox"> 参考线</label>
          <label><input v-model="draft.showPageBreaks" data-testid="preference-show-page-breaks" type="checkbox"> 分页符</label>
          <label><input v-model="draft.snapToGrid" data-testid="preference-snap-to-grid" type="checkbox"> 网格吸附</label>
        </fieldset>
        <fieldset class="window-preferences">
          <legend>窗口</legend>
          <label class="described-option">
            <input
              v-model="draft.centerOnStartup"
              data-testid="preference-center-on-startup"
              type="checkbox"
              aria-describedby="preference-center-on-startup-description"
            >
            <span class="setting-copy">
              <span>应用启动居中</span>
              <small id="preference-center-on-startup-description" class="setting-description">
                下次打开应用时，窗口会显示在上次使用的屏幕中央。窗口大小和最大化状态保持不变。
              </small>
            </span>
          </label>
        </fieldset>
        <label>默认缩放
          <input v-model.number="draft.defaultZoom" data-testid="preference-default-zoom" type="number" min="0.1" max="8" step="0.1">
        </label>
        <label>默认单位
          <select v-model="draft.defaultPageUnit" data-testid="preference-default-unit">
            <option v-for="unit in ['mm', 'cm', 'in', 'pt', 'px']" :key="unit" :value="unit">{{ unit }}</option>
          </select>
        </label>
        <label>默认连接线
          <select v-model="draft.defaultConnector" data-testid="preference-default-connector">
            <option value="straight">直线</option><option value="orthogonal">正交</option><option value="curved">曲线</option>
          </select>
        </label>
        <label>最近文件数量
          <input v-model.number="draft.recentLimit" data-testid="preference-recent-limit" type="number" min="1" max="100">
        </label>
        <label>PNG DPI
          <input v-model.number="draft.pngDpi" data-testid="preference-png-dpi" type="number" min="72" max="600">
        </label>
      </div>
      <div class="actions">
        <button type="button" data-testid="preferences-defaults" @click="restoreDefaults">恢复默认</button>
        <span class="spacer" />
        <button type="button" @click="emit('close')">取消</button>
        <button type="button" data-testid="preferences-apply" class="primary" @click="emit('apply', { ...draft })">应用</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  DEFAULT_EDITOR_PREFERENCES,
  type EditorPreferences,
} from '@/application/settings/settings-controller'

const props = defineProps<{ modelValue: EditorPreferences; returnFocus?: HTMLElement | null }>()
const emit = defineEmits<{ apply: [settings: EditorPreferences]; close: [] }>()
const draft = reactive<EditorPreferences>({ ...props.modelValue })
const dialog = ref<HTMLElement | null>(null)
const firstControl = ref<HTMLSelectElement | null>(null)
let returnFocus: HTMLElement | null = null

onMounted(() => {
  returnFocus = props.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  void nextTick(() => firstControl.value?.focus())
})
onBeforeUnmount(() => {
  if (returnFocus?.isConnected) returnFocus.focus()
})

function restoreDefaults(): void {
  Object.assign(draft, DEFAULT_EDITOR_PREFERENCES)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('button, input, select') ?? [])]
    .filter((element) => !element.hasAttribute('disabled'))
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
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgb(15 23 42 / 42%); }
.modal { width: min(620px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-panel); color: var(--color-text); box-shadow: 0 18px 50px rgb(0 0 0 / 24%); }
h2 { margin: 0 0 16px; font-size: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; }
label { display: grid; gap: 5px; font-size: 13px; }
fieldset { grid-column: 1 / -1; display: flex; gap: 18px; border: 1px solid var(--color-border); }
fieldset label { display: flex; align-items: center; gap: 5px; }
.window-preferences { display: block; }
fieldset .described-option { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; }
.described-option input { margin-top: 2px; }
.setting-copy { display: grid; gap: 3px; }
.setting-description { color: var(--color-text-secondary); font-size: 12px; font-weight: 400; line-height: 1.5; }
input:not([type='checkbox']), select { min-height: 32px; padding: 4px 7px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); color: var(--color-text); }
.actions { display: flex; gap: 8px; margin-top: 22px; }
.spacer { flex: 1; }
button { padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); color: var(--color-text); cursor: pointer; }
button.primary { border-color: var(--color-primary); background: var(--color-primary); color: white; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
@media (max-width: 560px) { .form-grid { grid-template-columns: 1fr; } }
</style>

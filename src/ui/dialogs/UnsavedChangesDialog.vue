<template>
  <div class="modal-backdrop">
    <section ref="dialog" class="modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-title" @keydown="onKeydown">
      <h2 id="unsaved-title">未保存的更改</h2>
      <p>{{ description }}</p>
      <div class="actions">
        <button ref="firstButton" type="button" data-testid="unsaved-save" class="primary" @click="emit('choose', 'save')">保存</button>
        <button type="button" data-testid="unsaved-discard" @click="emit('choose', 'discard')">不保存</button>
        <button type="button" data-testid="unsaved-cancel" @click="emit('choose', 'cancel')">取消</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ action: 'new' | 'open' | 'close'; returnFocus?: HTMLElement | null }>()
const emit = defineEmits<{ choose: [choice: 'save' | 'discard' | 'cancel'] }>()
const dialog = ref<HTMLElement | null>(null)
const firstButton = ref<HTMLButtonElement | null>(null)
let returnFocus: HTMLElement | null = null

const description = computed(() => ({
  new: '新建流程图前，是否保存当前更改？',
  open: '打开其他流程图前，是否保存当前更改？',
  close: '关闭窗口前，是否保存当前更改？',
}[props.action]))

onMounted(() => {
  returnFocus = props.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  void nextTick(() => firstButton.value?.focus())
})
onBeforeUnmount(() => {
  if (returnFocus?.isConnected) returnFocus.focus()
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('choose', 'cancel')
    return
  }
  if (event.key !== 'Tab') return
  const buttons = [...(dialog.value?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
  if (buttons.length === 0) return
  const first = buttons[0]
  const last = buttons.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgb(15 23 42 / 42%); }
.modal { width: min(420px, calc(100vw - 32px)); padding: 22px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-panel); color: var(--color-text); box-shadow: 0 18px 50px rgb(0 0 0 / 24%); }
h2 { margin: 0 0 10px; font-size: 18px; }
p { margin: 0; color: var(--color-text-secondary); line-height: 1.6; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; }
button { min-width: 76px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); color: var(--color-text); cursor: pointer; }
button.primary { border-color: var(--color-primary); background: var(--color-primary); color: white; }
button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
</style>

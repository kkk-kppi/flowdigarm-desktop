<template>
  <div class="modal-backdrop">
    <section ref="dialog" class="modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title" @keydown="onKeydown">
      <h2 id="recovery-title">发现未完成的编辑</h2>
      <dl>
        <dt>文档</dt><dd>{{ snapshot.name }}</dd>
        <dt>更新时间</dt><dd>{{ updatedAt }}</dd>
        <dt>来源</dt><dd :title="snapshot.sourcePath">{{ snapshot.sourcePath || '未保存的新文档' }}</dd>
      </dl>
      <p v-if="confirming" class="warning">确认丢弃这份恢复数据？此操作无法撤销。</p>
      <div class="actions">
        <button ref="firstButton" type="button" data-testid="recovery-restore" class="primary" @click="emit('restore')">恢复</button>
        <button v-if="!confirming" type="button" data-testid="recovery-discard" @click="requestDiscard">丢弃</button>
        <button v-else ref="confirmDiscardButton" type="button" data-testid="recovery-confirm-discard" class="danger" @click="emit('discard')">确认丢弃</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RecoverySnapshot } from '@/application/persistence/persistence-ports'

const props = defineProps<{ snapshot: RecoverySnapshot }>()
const emit = defineEmits<{ restore: []; discard: [] }>()
const dialog = ref<HTMLElement | null>(null)
const firstButton = ref<HTMLButtonElement | null>(null)
const confirmDiscardButton = ref<HTMLButtonElement | null>(null)
const confirming = ref(false)
let returnFocus: HTMLElement | null = null
const updatedAt = computed(() => new Date(props.snapshot.updatedAt).toLocaleString('zh-CN'))

onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  void nextTick(() => firstButton.value?.focus())
})
onBeforeUnmount(() => {
  if (returnFocus?.isConnected) returnFocus.focus()
})

async function requestDiscard(): Promise<void> {
  confirming.value = true
  await nextTick()
  confirmDiscardButton.value?.focus()
}

function onKeydown(event: KeyboardEvent): void {
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
.modal { width: min(480px, calc(100vw - 32px)); padding: 22px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-panel); color: var(--color-text); box-shadow: 0 18px 50px rgb(0 0 0 / 24%); }
h2 { margin: 0 0 16px; font-size: 18px; }
dl { display: grid; grid-template-columns: 72px 1fr; gap: 8px; margin: 0; font-size: 13px; }
dt { color: var(--color-text-secondary); }
dd { min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.warning { color: #a33a2b; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; }
button { padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-panel); color: var(--color-text); cursor: pointer; }
button.primary { border-color: var(--color-primary); background: var(--color-primary); color: white; }
button.danger { border-color: #b42318; color: #b42318; }
button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
</style>

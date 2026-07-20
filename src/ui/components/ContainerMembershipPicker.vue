<template>
  <div class="membership-backdrop" data-testid="membership-backdrop" @click.self="emit('cancel')" @keydown="onKeydown">
    <section
      ref="dialog"
      class="membership-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="membership-title"
      tabindex="-1"
    >
      <h2 id="membership-title">{{ request.mode === 'add-to-container' ? '选择目标容器' : '选择要添加的成员' }}</h2>
      <p v-if="error" class="command-error" role="alert">{{ error }}</p>
      <fieldset v-if="request.mode === 'add-to-container'">
        <legend>目标容器</legend>
        <label v-for="container in request.containers" :key="container.id">
          <input v-model="containerId" type="radio" name="target-container" :value="container.id" />
          {{ container.label }}
        </label>
      </fieldset>
      <div v-else class="fixed-target">目标容器：{{ request.containers[0]?.label }}</div>
      <fieldset v-if="request.mode === 'add-members'">
        <legend>成员</legend>
        <label v-for="member in request.members" :key="member.id">
          <input v-model="memberIds" type="checkbox" :value="member.id" />
          {{ member.label }}
        </label>
      </fieldset>
      <p v-else>成员：{{ request.members.map((member) => member.label).join('、') }}</p>
      <div class="actions">
        <button type="button" @click="emit('cancel')">取消</button>
        <button type="button" data-testid="membership-confirm" :disabled="!canConfirm" @click="confirm">确定</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ContainerMembershipSelection, ContainerPickerRequest } from '@/application/menus/menu-command-controller'

const props = defineProps<{ request: ContainerPickerRequest; error?: string }>()
const emit = defineEmits<{ confirm: [selection: ContainerMembershipSelection]; cancel: [] }>()
const dialog = ref<HTMLElement | null>(null)
const containerId = ref(props.request.mode === 'add-members' ? props.request.containers[0]?.id ?? '' : '')
const memberIds = ref(props.request.mode === 'add-to-container' ? props.request.members.map(({ id }) => id) : [])
const canConfirm = computed(() => containerId.value !== '' && memberIds.value.length > 0)

function confirm(): void {
  if (canConfirm.value) emit('confirm', { containerId: containerId.value, memberIds: [...memberIds.value] })
}
function focusableElements(): HTMLElement[] {
  return dialog.value
    ? [...dialog.value.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    : []
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('cancel')
    return
  }
  if (event.key === 'Tab') {
    const focusable = focusableElements()
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.value?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && (document.activeElement === first || !dialog.value?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.value?.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }
}
onMounted(() => {
  dialog.value?.querySelector<HTMLElement>('input, button')?.focus()
})
</script>

<style scoped>
.membership-backdrop { position: absolute; inset: 0; z-index: 69; background: rgb(0 0 0 / 32%); }
.membership-picker { position: absolute; inset: 50% auto auto 50%; z-index: 70; width: min(360px, calc(100% - 32px)); max-height: calc(100% - 48px); padding: 16px; overflow: auto; transform: translate(-50%, -50%); border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-panel); box-shadow: 0 12px 36px rgb(0 0 0 / 24%); }
h2 { margin: 0 0 12px; font-size: 16px; }
fieldset { display: grid; gap: 7px; margin: 10px 0; border: 1px solid var(--color-border); }
label { display: flex; gap: 7px; align-items: center; }
.fixed-target, p { margin: 10px 0; font-size: 12px; }
.command-error { color: var(--color-danger, #c62828); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
button { min-width: 64px; min-height: 28px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-panel); cursor: pointer; }
button:last-child { border-color: var(--color-primary); background: var(--color-primary); color: white; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

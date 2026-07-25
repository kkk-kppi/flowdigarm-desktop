<template>
  <span
    class="app-icon"
    :data-icon="name"
    aria-hidden="true"
    :style="iconStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { iconUrls, type IconName } from './icon-registry'

const props = withDefaults(defineProps<{ name: IconName; size?: number | string }>(), {
  size: 16,
})

const iconStyle = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: size,
    height: size,
    '--app-icon-url': `url("${iconUrls[props.name]}")`,
  }
})
</script>

<style scoped>
.app-icon {
  display: inline-block;
  flex: 0 0 auto;
  background-color: currentColor;
  mask-image: var(--app-icon-url);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
  -webkit-mask-image: var(--app-icon-url);
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}

@media (forced-colors: active) {
  .app-icon {
    forced-color-adjust: none;
    background-color: CanvasText;
  }

  :global(button:disabled) .app-icon,
  :global([aria-disabled='true']) .app-icon {
    background-color: GrayText;
  }

  :global([aria-pressed='true']) .app-icon {
    background-color: Highlight;
  }
}
</style>

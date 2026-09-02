<template>
  <div class="popover-wrapper" ref="wrapperRef">
    <div class="popover-trigger" @mouseenter="show" @mouseleave="hide">
      <slot name="trigger" />
    </div>
    <Teleport to="body">
      <Transition name="popover">
        <div
          v-if="visible"
          class="popover-content"
          :style="popoverStyle"
          @mouseenter="cancelHide"
          @mouseleave="hide"
        >
          <slot />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'left-end' | 'right-end'
  hover?: boolean
  disabled?: boolean
}>(), {
  placement: 'top',
  hover: false,
  disabled: false
})

const visible = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const position = ref({ x: 0, y: 0 })
let hideTimer: ReturnType<typeof setTimeout> | null = null

const popoverStyle = computed(() => {
  const base: Record<string, string> = {
    position: 'fixed',
    zIndex: '9999'
  }

  // Get trigger element position
  if (wrapperRef.value) {
    const rect = wrapperRef.value.getBoundingClientRect()
    
    switch (props.placement) {
      case 'top':
        base.bottom = `${window.innerHeight - rect.top + 8}px`
        base.left = `${rect.left}px`
        break
      case 'bottom':
        base.top = `${rect.bottom + 8}px`
        base.left = `${rect.left}px`
        break
      case 'left':
        base.top = `${rect.top}px`
        base.right = `${window.innerWidth - rect.left + 8}px`
        break
      case 'left-end':
        base.bottom = `${window.innerHeight - rect.bottom}px`
        base.right = `${window.innerWidth - rect.left + 8}px`
        break
      case 'right':
        base.top = `${rect.top}px`
        base.left = `${rect.right + 8}px`
        break
      case 'right-end':
        base.bottom = `${window.innerHeight - rect.bottom}px`
        base.left = `${rect.right + 8}px`
        break
    }
  }

  return base
})

const show = () => {
  if (props.disabled) return
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  visible.value = true
}

const hide = () => {
  if (!visible.value) return
  hideTimer = setTimeout(() => {
    visible.value = false
  }, 100)
}

const cancelHide = () => {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
})
</script>

<style scoped>
.popover-wrapper {
  display: inline-flex;
}

.popover-trigger {
  display: inline-flex;
}

.popover-content {
  pointer-events: auto;
}

/* Popover Animation */
.popover-enter-active,
.popover-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

<script setup lang="ts">
import type { Component } from 'vue'

const props = withDefaults(defineProps<{
  active?: boolean
  danger?: boolean
  icon: Component
  label: string
}>(), {
  active: false,
  danger: false,
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="results-menu-button"
    :class="{ active: props.active, danger: props.danger }"
    type="button"
    :aria-pressed="props.active || undefined"
    @click="emit('click')"
  >
    <component :is="props.icon" :size="14" />
    <span>{{ props.label }}</span>
  </button>
</template>

<style scoped>
.results-menu-button {
  min-width: 0;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 4px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--bg-hover) 42%, transparent);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--sys-duration-fast) ease, background var(--sys-duration-fast) ease, border-color var(--sys-duration-fast) ease;
}

.results-menu-button:hover,
.results-menu-button.active {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-hover));
  color: var(--text-primary);
}

.results-menu-button.danger {
  color: var(--error);
}

.results-menu-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>

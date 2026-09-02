<template>
  <el-popover
    ref="popoverRef"
    :width="480"
    role="dialog"
    popper-class="generator-prompt-preset-popover"
    trigger="click"
    placement="top-start"
    :show-arrow="false"
  >
    <template #reference>
      <button class="toolbar-preset-btn" type="button" aria-label="提示词预设" title="提示词预设">
        <ClipboardList :size="14" />
        <span>提示词</span>
      </button>
    </template>
    <PromptPresetPanel
      @apply="handleApply"
      @apply-batch="handleApplyBatch"
      @close="hidePopover"
    />
  </el-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ClipboardList } from '@/components/common/icon/lucide'
import PromptPresetPanel from './PromptPresetPanel.vue'
import type { PBRChannel } from '@/types/pbr.types'

const emit = defineEmits<{
  (e: 'apply', payload: { content: string; channel?: PBRChannel }): void
  (e: 'apply-batch', texts: string[], channels?: PBRChannel[]): void
}>()

const popoverRef = ref<{ hide?: () => void } | null>(null)

function hidePopover(): void {
  popoverRef.value?.hide?.()
}

function handleApply(payload: { content: string; channel?: PBRChannel }): void {
  emit('apply', payload)
  hidePopover()
}

function handleApplyBatch(texts: string[], channels?: PBRChannel[]): void {
  emit('apply-batch', texts, channels)
  hidePopover()
}
</script>

<style scoped>
.toolbar-preset-btn {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--generator-text-secondary, var(--text-secondary));
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
}

.toolbar-preset-btn:hover {
  background: var(--generator-surface-hover, var(--bg-hover));
  color: var(--generator-text-primary, var(--text-primary));
}

.toolbar-preset-btn:focus-visible {
  outline: 2px solid var(--generator-accent, var(--accent));
  outline-offset: 2px;
}

@media (max-width: 720px) {
  .toolbar-preset-btn { min-height: 44px; padding-inline: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .toolbar-preset-btn { transition: none; }
}
</style>

<style>
.generator-prompt-preset-popover.el-popover {
  width: min(480px, calc(100vw - 16px)) !important;
  max-width: calc(100vw - 16px);
}
</style>

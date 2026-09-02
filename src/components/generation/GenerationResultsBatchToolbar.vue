<script setup lang="ts">
type BatchActionType = 'favorite' | 'delete'

const emit = defineEmits<{
  cancel: []
  confirm: []
  'confirm-favorite': [favorite: boolean]
}>()

const props = defineProps<{
  actionType: BatchActionType
  selectedCount: number
}>()
</script>

<template>
  <div class="batch-toolbar">
    <span class="batch-count">已选 {{ props.selectedCount }} 项</span>
    <button
      v-if="props.actionType === 'delete'"
      type="button"
      class="filter-chip danger-chip"
      :disabled="props.selectedCount === 0"
      @click="emit('confirm')"
    >删除</button>
    <template v-else>
      <button type="button" class="filter-chip" :disabled="props.selectedCount === 0" @click="emit('confirm-favorite', true)">收藏</button>
      <button type="button" class="filter-chip" :disabled="props.selectedCount === 0" @click="emit('confirm-favorite', false)">取消收藏</button>
    </template>
    <button type="button" class="filter-chip" @click="emit('cancel')">退出批量</button>
  </div>
</template>

<style scoped>
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
  margin-left: auto;
}

.batch-count {
  height: 28px;
  display: inline-flex;
  align-items: center;
  margin-right: 2px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--text-secondary);
  font-size: 11px;
}

.filter-chip {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: color-mix(in srgb, var(--bg-hover) 35%, transparent);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: color var(--sys-duration-fast) ease, background var(--sys-duration-fast) ease, border-color var(--sys-duration-fast) ease;
}

.filter-chip:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-hover));
  color: var(--text-primary);
}

.filter-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.filter-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.danger-chip:not(:disabled) {
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 38%, var(--border));
}
</style>

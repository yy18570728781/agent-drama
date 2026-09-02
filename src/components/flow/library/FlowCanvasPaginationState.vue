<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineOptions({ name: 'FlowCanvasPaginationState' })
defineProps<{
  hasItems: boolean
  hasMore: boolean
  loading: boolean
}>()
</script>

<template>
  <div v-if="loading" class="pagination-state">
    <Icon icon="lucide:loader-circle" class="spin" />正在加载更多画布
  </div>
  <div v-else-if="hasItems && !hasMore" class="pagination-state">
    没有更多画布了
  </div>
</template>

<style scoped>
.pagination-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0 4px;
  color: var(--text-muted, #71717a);
  font-size: 12px;
}

.spin {
  animation: flow-pagination-spin 0.8s linear infinite;
}

@keyframes flow-pagination-spin {
  to { transform: rotate(360deg); }
}
</style>

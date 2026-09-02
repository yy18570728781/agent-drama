<template>
  <button
    class="flow-toolbox-btn"
    :class="{ active }"
    title="工具箱"
    @click="$emit('toggle')"
  >
    <Box :size="18" />
  </button>
</template>

<script setup lang="ts">
import { Box } from '@/components/common/icon/lucide'

defineProps<{ active?: boolean }>()
defineEmits<{ (event: 'toggle'): void }>()
</script>

<style scoped>
.flow-toolbox-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s ease;
}

.flow-toolbox-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f5;
}

.flow-toolbox-btn.active {
  background: rgba(129, 140, 248, 0.15);
  color: #818cf8;
}
</style>

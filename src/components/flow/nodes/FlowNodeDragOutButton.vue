<script setup>
import { ArrowUpRight } from '@/components/common/icon/lucide'

defineProps({
  visible: Boolean,
})

const emit = defineEmits(['dragstart', 'dragend'])
</script>

<template>
  <button
    v-if="visible"
    type="button"
    draggable="true"
    class="flow-node-drag-out-btn nodrag"
    title="拖出到外部"
    @dragstart.stop="emit('dragstart', $event)"
    @dragend.stop="emit('dragend', $event)"
  >
    <ArrowUpRight :size="14" />
  </button>
</template>

<style scoped>
.flow-node-drag-out-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(244, 244, 245, 0.16);
  border-radius: 9999px;
  background: rgba(24, 24, 27, 0.86);
  color: rgba(244, 244, 245, 0.92);
  backdrop-filter: blur(10px);
  cursor: grab;
  transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.flow-node-drag-out-btn:hover {
  background: rgba(39, 39, 42, 0.96);
  border-color: rgba(244, 244, 245, 0.26);
  transform: translateY(-1px);
}

.flow-node-drag-out-btn:active {
  cursor: grabbing;
}
</style>

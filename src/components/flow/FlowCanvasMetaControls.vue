<script setup lang="ts">
import { Wand2 } from 'lucide-vue-next'

defineProps<{
  isRepairing: boolean
  nodeCount: number
  repairTitle: string
}>()

const emit = defineEmits<{
  (event: 'repair'): void
}>()
</script>

<template>
  <div class="flow-canvas-meta-controls">
    <button
      class="flow-canvas-repair"
      :class="{ repairing: isRepairing }"
      :disabled="isRepairing"
      :title="repairTitle"
      type="button"
      @click="emit('repair')"
    >
      <Wand2 :size="14" :class="{ 'animate-spin': isRepairing }" />
    </button>
    <div class="flow-canvas-node-count" :title="`当前子树节点总数：${nodeCount}`">
      <span>节点</span>
      <strong>{{ nodeCount }}</strong>
    </div>
  </div>
</template>

<style scoped>
.flow-canvas-meta-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.flow-canvas-repair,
.flow-canvas-node-count {
  height: 32px;
  border: 1px solid #292c33;
  border-radius: 8px;
  background: rgba(21, 23, 28, 0.92);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

.flow-canvas-repair {
  display: grid;
  width: 32px;
  padding: 0;
  place-items: center;
  color: #717680;
  cursor: pointer;
  pointer-events: auto;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.flow-canvas-repair:hover:not(:disabled) {
  color: #e4e7ec;
  border-color: #3b404a;
  background: rgba(35, 38, 45, 0.96);
}

.flow-canvas-repair.repairing {
  color: #c7d2fe;
}

.flow-canvas-repair:disabled {
  cursor: wait;
  opacity: 0.72;
}

.flow-canvas-node-count {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  color: #717680;
  font-size: 11px;
}

.flow-canvas-node-count strong {
  color: #d5d7dd;
  font-weight: 600;
}
</style>

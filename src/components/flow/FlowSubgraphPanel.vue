<script setup lang="ts">
import FlowSubgraphOutlinePanel from './FlowSubgraphOutlinePanel.vue'

type OutlineNode = {
  graphId: string
  label: string
  nodeCount: number
  descendantCount: number
  children: OutlineNode[]
}

const props = defineProps<{
  visible: boolean
  activeGraphId: string
  activePathLabels: string[]
  outlineTree: OutlineNode[]
  expandedKeys: string[]
}>()

const emit = defineEmits<{
  (event: 'select', graphId: string): void
  (event: 'refresh'): void
  (event: 'update:visible', value: boolean): void
}>()
</script>

<template>
  <Transition name="slide">
    <div v-if="visible" class="subgraph-slide-panel">
      <div class="subgraph-slide-panel__header">
        <div class="subgraph-slide-panel__meta">
          <span class="subgraph-slide-panel__title">子图导航</span>
        </div>
        <div class="subgraph-slide-panel__actions">
          <button class="subgraph-slide-panel__refresh" @click="emit('refresh')" title="强刷子图导航">
            刷新
          </button>
          <button class="subgraph-slide-panel__close" @click="emit('update:visible', false)">×</button>
        </div>
      </div>
      <FlowSubgraphOutlinePanel
        class="subgraph-slide-panel__body"
        :active-graph-id="activeGraphId"
        :outline-tree="outlineTree"
        :expanded-keys="expandedKeys"
        @select="emit('select', $event)"
      />
    </div>
  </Transition>
</template>

<style scoped>
.subgraph-slide-panel {
  position: absolute;
  left: 24px;
  top: 80px;
  bottom: 24px;
  width: 292px;
  display: flex;
  flex-direction: column;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  z-index: 150;
  overflow: hidden;
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.22);
}

.subgraph-slide-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #27272a;
}

.subgraph-slide-panel__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subgraph-slide-panel__title {
  color: #f4f4f5;
  font-size: 13px;
  font-weight: 600;
}

.subgraph-slide-panel__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.subgraph-slide-panel__refresh {
  min-width: 36px;
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #71717a;
  font-size: 11px;
  cursor: pointer;
}

.subgraph-slide-panel__refresh:hover {
  color: #fff;
  background: #27272a;
}

.subgraph-slide-panel__close {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #71717a;
  cursor: pointer;
}

.subgraph-slide-panel__close:hover {
  color: #fff;
  background: #27272a;
}

.subgraph-slide-panel__body {
  flex: 1;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}
</style>

<script setup lang="ts">
import { ElScrollbar, ElTree } from 'element-plus'
import { ref, watch } from 'vue'

const ROOT_GRAPH_ID = 'root'

type OutlineNode = {
  graphId: string
  label: string
  nodeCount: number
  descendantCount: number
  children: OutlineNode[]
}

const props = defineProps<{
  activeGraphId: string
  outlineTree: OutlineNode[]
  expandedKeys: string[]
}>()

const emit = defineEmits<{
  (event: 'select', graphId: string): void
}>()

const expandedKeysState = ref<string[]>([])

function handleNodeClick(node: OutlineNode): void {
  emit('select', node.graphId)
}

function handleNavigateToRoot(): void {
  emit('select', ROOT_GRAPH_ID)
}

function handleNodeCollapse(node: OutlineNode): void {
  expandedKeysState.value = expandedKeysState.value.filter((key) => key !== node.graphId)
}

function handleNodeExpand(node: OutlineNode): void {
  if (!expandedKeysState.value.includes(node.graphId)) {
    expandedKeysState.value = [...expandedKeysState.value, node.graphId]
  }
}

watch(
  () => props.expandedKeys,
  (keys) => {
    expandedKeysState.value = Array.from(new Set(keys.filter(Boolean)))
  },
  { immediate: true },
)
</script>

<template>
  <aside class="subgraph-outline-panel">
    <div class="subgraph-outline-panel__root">
      <button
        class="subgraph-outline-panel__root-main"
        :class="{ active: activeGraphId === ROOT_GRAPH_ID }"
        @click="handleNavigateToRoot"
      >
        主画布
      </button>
      <button
        class="subgraph-outline-panel__root-action"
        :disabled="activeGraphId === ROOT_GRAPH_ID"
        @click="handleNavigateToRoot"
      >
        回到主画布
      </button>
    </div>
    <ElScrollbar class="subgraph-outline-panel__body">
      <div v-if="!outlineTree.length" class="subgraph-outline-panel__empty">当前还没有子图</div>
      <ElTree
        v-else
        :data="outlineTree"
        node-key="graphId"
        :current-node-key="activeGraphId"
        :expanded-keys="expandedKeysState"
        :default-expand-all="true"
        highlight-current
        :expand-on-click-node="false"
        @node-click="handleNodeClick"
        @node-collapse="handleNodeCollapse"
        @node-expand="handleNodeExpand"
      >
        <template #default="{ data }">
          <div class="subgraph-outline-node">
            <span class="subgraph-outline-node__label">{{ data.label }}</span>
            <span class="subgraph-outline-node__badge">{{ data.nodeCount }} 个节点</span>
          </div>
        </template>
      </ElTree>
    </ElScrollbar>
  </aside>
</template>

<style scoped lang="scss">
.subgraph-outline-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.subgraph-outline-panel__root {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px;
  border-bottom: 1px solid rgba(39, 39, 42, 0.8);
}

.subgraph-outline-panel__root-main,
.subgraph-outline-panel__root-action {
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.subgraph-outline-panel__root-main {
  min-width: 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: #d4d4d8;
  font-size: 11px;
}

.subgraph-outline-panel__root-main.active {
  background: rgba(129, 140, 248, 0.16);
  color: #eef2ff;
}

.subgraph-outline-panel__root-main:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f5;
}

.subgraph-outline-panel__root-action {
  padding: 4px 0;
  background: transparent;
  color: #818cf8;
  font-size: 11px;
}

.subgraph-outline-panel__root-action:hover:not(:disabled) {
  color: #a5b4fc;
}

.subgraph-outline-panel__root-action:disabled {
  color: #52525b;
  cursor: default;
}

.subgraph-outline-panel__body {
  flex: 1;
  padding: 10px 8px 12px 10px;
}

.subgraph-outline-panel__empty {
  padding: 10px 6px;
  color: #71717a;
  font-size: 11px;
  line-height: 1.6;
}

.subgraph-outline-node {
  width: 100%;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #d4d4d8;
  font-size: 11px;
}

.subgraph-outline-node__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subgraph-outline-node__badge {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(161, 161, 170, 0.1);
  color: #a1a1aa;
  font-size: 9px;
  text-align: center;
}

:deep(.el-tree) {
  background: transparent;
  color: inherit;
}

:deep(.el-tree-node__children) {
  position: relative;
  margin-left: 6px;
}

:deep(.el-tree-node__children::before) {
  content: '';
  position: absolute;
  left: 8px;
  top: 2px;
  bottom: 10px;
  width: 1px;
  background: rgba(113, 113, 122, 0.18);
}

:deep(.el-tree-node__content) {
  position: relative;
  height: 28px;
  border-radius: 10px;
  margin-bottom: 2px;
  padding-right: 4px;
}

:deep(.el-tree-node__content::before) {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  width: 8px;
  height: 1px;
  background: rgba(113, 113, 122, 0.18);
}

:deep(.el-tree > .el-tree-node > .el-tree-node__content::before) {
  display: none;
}

:deep(.el-tree-node__content:hover) {
  background: rgba(255, 255, 255, 0.05);
}

:deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content) {
  background: rgba(129, 140, 248, 0.14);
}

:deep(.el-tree-node__expand-icon) {
  font-size: 11px;
  color: #71717a;
}

:deep(.el-tree-node.is-current .subgraph-outline-node__label) {
  color: #f4f4f5;
}

:deep(.el-tree-node.is-current .subgraph-outline-node__badge) {
  background: rgba(129, 140, 248, 0.16);
  color: #c4b5fd;
}
</style>

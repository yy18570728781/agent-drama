<template>
  <div class="flow-workspace" :class="{ 'is-loading-workflow': isLoadingWorkflow }">
    <FlowSidebar
      ref="flowSidebarRef"
      :model-nodes="modelNodes"
      :active-graph-id="activeGraphId"
      :outline-expanded-keys="outlineExpandedKeys"
      :outline-path-labels="outlinePathLabels"
      :outline-tree="outlineTree"
      :project-examples="projectExamples"
      @drop-asset="emit('drop-asset', $event)"
      @focus-node="focusNodeById"
      @update:shortcuts="emit('update:shortcuts', $event)"
      @outline-select="emit('outline-select', $event)"
      @outline-refresh="emit('outline-refresh')"
      @save-example="emit('save-example', $event)"
      @load-example="emit('load-example', $event)"
      @overwrite-example="emit('overwrite-example', $event)"
      @delete-example="emit('delete-example', $event)"
      @rename-example="(id, name) => emit('rename-example', id, name)"
    />

    <FlowCanvas
      ref="flowCanvasRef"
      :model-nodes="modelNodes"
      :model-edges="modelEdges"
      :node-types="nodeTypes"
      :shortcuts="shortcuts"
      :active-graph-id="activeGraphId"
      :subgraph-definitions="subgraphDefinitions"
      :allow-subgraph-create="allowSubgraphCreate"
      @update:model-nodes="emit('update:model-nodes', $event)"
      @update:model-edges="emit('update:model-edges', $event)"
      @node-select="emit('node-select', $event)"
      @pane-click="emit('pane-click')"
      @param-change="emit('param-change', $event)"
      @save-request="emit('save-request')"
      @undo-request="emit('undo-request')"
      @redo-request="emit('redo-request')"
      @record-tab-history="emit('record-tab-history')"
      @paste-subgraphs="emit('paste-subgraphs', $event)"
      @node-data-update="emit('node-data-update', $event)"
      @repair-progress="handleRepairProgress"
      @draft-save="emit('draft-save')"
      @create-subgraph="emit('create-subgraph', $event)"
      @open-subgraph="emit('open-subgraph', $event)"
      @rename-subgraph="emit('rename-subgraph', $event)"
      @dissolve-subgraph="emit('dissolve-subgraph', $event)"
      @delete-subgraph-request="emit('delete-subgraph-request', $event)"
    />

    <FlowCanvasMetaControls
      :is-repairing="isRepairingGeneratingCards"
      :node-count="currentCanvasNodeCount"
      :repair-title="repairButtonTitle"
      @repair="emit('repair-generating-cards')"
    />

    <FlowWorkflowOverlay
      :is-loading="isLoadingWorkflow"
      :load-progress="loadProgress"
      :load-progress-text="loadProgressText"
      @cancel-load="emit('cancel-load')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FlowCanvas from './FlowCanvas.vue'
import FlowCanvasMetaControls from './FlowCanvasMetaControls.vue'
import FlowSidebar from './FlowSidebar.vue'
import FlowWorkflowOverlay from './FlowWorkflowOverlay.vue'
import type { ProjectExample } from '@/composables/flow/projectExample.types'
import type { FlowNode, WorkflowSubgraph } from '@/composables/flow/flowCore.types'

type OutlineNode = {
  graphId: string
  label: string
  nodeCount: number
  descendantCount: number
  children: OutlineNode[]
}

defineProps<{
  modelNodes: FlowNode[]
  modelEdges: unknown[]
  nodeTypes: unknown[]
  shortcuts: Record<string, unknown>
  activeGraphId: string
  activeWorkflowId: string
  currentCanvasNodeCount: number
  isRepairingGeneratingCards: boolean
  repairButtonTitle: string
  subgraphDefinitions: Record<string, WorkflowSubgraph>
  allowSubgraphCreate: boolean
  outlineExpandedKeys: string[]
  outlinePathLabels: string[]
  outlineTree: OutlineNode[]
  isLoadingWorkflow: boolean
  loadProgress: number
  loadProgressText: string
  workflows: Array<{ id: string; name?: string; updated_at?: string }>
  projectExamples: ProjectExample[]
}>()

const emit = defineEmits([
  'drop-asset',
  'focus-node',
  'repair-generating-cards',
  'update:shortcuts',
  'outline-select',
  'outline-refresh',
  'save-example',
  'load-example',
  'overwrite-example',
  'delete-example',
  'rename-example',
  'update:model-nodes',
  'update:model-edges',
  'node-select',
  'pane-click',
  'param-change',
  'save-request',
  'undo-request',
  'redo-request',
  'record-tab-history',
  'paste-subgraphs',
  'node-data-update',
  'repair-progress',
  'draft-save',
  'create-subgraph',
  'open-subgraph',
  'rename-subgraph',
  'dissolve-subgraph',
  'delete-subgraph-request',
  'cancel-load',
])

const flowCanvasRef = ref<InstanceType<typeof FlowCanvas> | null>(null)
const flowSidebarRef = ref<InstanceType<typeof FlowSidebar> | null>(null)
const isRepairing = ref(false)

function closeAllPanels() {
  flowSidebarRef.value?.closeAllPanels?.()
}

function dropAssetAt(asset: unknown, clientX: number, clientY: number) {
  flowCanvasRef.value?.dropAssetAt?.(asset, clientX, clientY)
}

function focusNodeById(nodeId: string) {
  flowCanvasRef.value?.focusNodeById?.(nodeId)
  emit('focus-node', nodeId)
}

function getEdges() {
  return flowCanvasRef.value?.getEdges?.()
}

function getNodes() {
  return flowCanvasRef.value?.getNodes?.()
}

function getViewport() {
  return flowCanvasRef.value?.getViewport?.()
}

function isViewportReady() {
  return !!flowCanvasRef.value?.isViewportReady?.()
}

function refreshNodeInternals() {
  flowCanvasRef.value?.refreshNodeInternals?.()
}

async function repairGeneratingNodes(): Promise<void> {
  if (isRepairing.value) return
  isRepairing.value = true
  try {
    await flowCanvasRef.value?.repairGeneratingNodes?.()
  } finally {
    isRepairing.value = false
  }
}

function handleRepairProgress(payload: { active?: boolean; current?: number; total?: number }): void {
  isRepairing.value = !!payload.active
  emit('repair-progress', payload)
}

function setCapabilityPorts(ports: Record<string, unknown>) {
  flowCanvasRef.value?.setCapabilityPorts?.(ports)
}

function setViewport(viewport: unknown) {
  flowCanvasRef.value?.setViewport?.(viewport)
}

defineExpose({
  closeAllPanels,
  dropAssetAt,
  focusNodeById,
  getEdges,
  getNodes,
  getViewport,
  isViewportReady,
  propagateDataFlow: () => flowCanvasRef.value?.propagateDataFlow?.(),
  refreshNodeInternals,
  repairGeneratingNodes,
  setCapabilityPorts,
  setViewport,
})
</script>

<style scoped>
.flow-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.flow-workspace.is-loading-workflow :deep(.flow-canvas-wrapper) {
  visibility: hidden;
}
</style>

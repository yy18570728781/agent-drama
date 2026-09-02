<script setup lang="ts">
import type {
  FlowEdge,
  FlowNode,
  WorkflowDefinition,
  WorkflowSubgraph,
} from '@/composables/flow/flowCore.types'
import type { Node, NodeMouseEvent } from '@vue-flow/core'
import { computed, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import { Background } from '@vue-flow/background'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { injectSubgraphCards } from '@/composables/flow/flowSubgraphCreation.utils'
import { nodeComponents } from '@/composables/flow/flowNodeRegistry'
import { ROOT_GRAPH_ID } from '@/composables/flow/useFlowCore'
import { useFlowReadonlyPanelPosition } from '@/composables/flow/useFlowReadonlyPanelPosition'
import { useFlowReadonlyRuntime } from '@/composables/flow/useFlowReadonlyRuntime'
import ColoredBezierEdge from './edges/ColoredBezierEdge.vue'
import ColoredSmoothStepEdge from './edges/ColoredSmoothStepEdge.vue'
import FlowErEdge from './edges/FlowErEdge.vue'
import FlowManhattanEdge from './edges/FlowManhattanEdge.vue'
import FlowMetroEdge from './edges/FlowMetroEdge.vue'
import FlowSimpleBezierEdge from './edges/FlowSimpleBezierEdge.vue'
import FlowStepEdge from './edges/FlowStepEdge.vue'
import StraightEdge from './edges/StraightEdge.vue'
import WorkflowGenerationPanel from './WorkflowGenerationPanel.vue'
import './FlowReadonlyCanvas.scss'

defineOptions({ name: 'FlowReadonlyCanvas' })

const props = withDefaults(defineProps<{
  ariaLabel?: string
  definition: WorkflowDefinition
  inspectable?: boolean
  instanceId?: string
}>(), {
  ariaLabel: '只读画布预览',
  inspectable: false,
  instanceId: 'flow-readonly-canvas',
})

const graphId = computed(() => props.definition.activeGraphId || ROOT_GRAPH_ID)
const graph = computed<WorkflowDefinition | WorkflowSubgraph>(() => (
  graphId.value === ROOT_GRAPH_ID
    ? props.definition
    : props.definition.subgraphs?.[graphId.value] || props.definition
))
const previewNodes = computed<FlowNode[]>(() => [
  ...injectSubgraphCards(props.definition.subgraphs || {}, graphId.value) as FlowNode[],
  ...(graph.value.nodes || []),
])
const sourceEdges = computed<FlowEdge[]>(() => graph.value.edges || [])
const {
  closeInspector,
  openInspector,
  runtimeEdges,
  runtimeNodes,
  selectedNode,
} = useFlowReadonlyRuntime({ sourceEdges, sourceNodes: previewNodes })
const vueFlowNodes = computed<Node[]>(() => runtimeNodes.value as unknown as Node[])
const previewViewport = computed(() => graph.value.viewport || { x: 0, y: 0, zoom: 1 })
const fullRenderNodeIds = computed(() => new Set(runtimeNodes.value.map((node) => node.id)))
const flowCanvasWrapperRef = ref<HTMLElement | null>(null)
const groupPresetColors = ref([
  'rgba(39, 39, 42, 0.5)',
  'rgba(49, 46, 129, 0.5)',
  'rgba(6, 78, 59, 0.5)',
  'rgba(159, 18, 57, 0.5)',
  'rgba(120, 53, 15, 0.5)',
])
const { updateNodeInternals, viewport } = useVueFlow(props.instanceId)
const { panelStyle: readonlyPanelStyle, refreshPanelPosition } = useFlowReadonlyPanelPosition({
  selectedNode,
  viewport,
  wrapperRef: flowCanvasWrapperRef,
})
let geometryFrame = 0

function refreshNodeGeometry(): void {
  cancelAnimationFrame(geometryFrame)
  void nextTick(() => {
    geometryFrame = requestAnimationFrame(() => {
      const nodeIds = runtimeNodes.value.map((node) => node.id)
      if (nodeIds.length) updateNodeInternals(nodeIds)
      geometryFrame = requestAnimationFrame(() => {
        if (nodeIds.length) updateNodeInternals(nodeIds)
        refreshPanelPosition()
      })
    })
  })
}

function handleNodeClick({ node }: NodeMouseEvent): void {
  if (props.inspectable) openInspector(node as unknown as FlowNode)
}

watch(runtimeNodes, refreshNodeGeometry, { flush: 'post' })
onBeforeUnmount(() => cancelAnimationFrame(geometryFrame))

provide('groupPresetColors', groupPresetColors)
provide('flowNodes', runtimeNodes)
provide('flowEdges', runtimeEdges)
provide('flowFullRenderNodeIds', fullRenderNodeIds)
provide('flowRenderableMediaNodeIds', fullRenderNodeIds)
provide('flowThumbRenderableMediaNodeIds', fullRenderNodeIds)
provide('flowLightweightNodeMode', computed(() => false))
provide('flowUltraLightNodeMode', computed(() => false))
provide('flowHasMultiSelection', computed(() => false))
provide('flowViewportZoom', computed(() => previewViewport.value.zoom))
</script>

<template>
  <div ref="flowCanvasWrapperRef" class="flow-readonly-canvas-shell">
    <VueFlow
      :id="instanceId"
      class="flow-readonly-canvas"
      :class="{ 'is-inspectable': inspectable }"
      :aria-label="ariaLabel"
      :nodes="vueFlowNodes"
      :edges="runtimeEdges"
      :node-types="nodeComponents"
      :default-viewport="previewViewport"
      :min-zoom="0.05"
      :max-zoom="4"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :zoom-on-double-click="false"
      :pan-on-drag="[0, 1, 2]"
      :selection-key-code="null"
      :delete-key-code="null"
      only-render-visible-elements
      @node-click="handleNodeClick"
      @nodes-initialized="refreshNodeGeometry"
      @pane-click="inspectable && closeInspector()"
    >
      <Background pattern-color="#3f3f46" :gap="20" :size="1" />
      <template #edge-smoothstep="edgeProps"><ColoredSmoothStepEdge v-bind="edgeProps" /></template>
      <template #edge-straight="edgeProps"><StraightEdge v-bind="edgeProps" /></template>
      <template #edge-default="edgeProps"><ColoredBezierEdge v-bind="edgeProps" /></template>
      <template #edge-simplebezier="edgeProps"><FlowSimpleBezierEdge v-bind="edgeProps" /></template>
      <template #edge-step="edgeProps"><FlowStepEdge v-bind="edgeProps" /></template>
      <template #edge-manhattan="edgeProps"><FlowManhattanEdge v-bind="edgeProps" /></template>
      <template #edge-metro="edgeProps"><FlowMetroEdge v-bind="edgeProps" /></template>
      <template #edge-er="edgeProps"><FlowErEdge v-bind="edgeProps" /></template>
    </VueFlow>
    <WorkflowGenerationPanel
      v-if="inspectable && selectedNode"
      :node="selectedNode"
      :style="readonlyPanelStyle"
      read-only
      @close="closeInspector"
    />
  </div>
</template>

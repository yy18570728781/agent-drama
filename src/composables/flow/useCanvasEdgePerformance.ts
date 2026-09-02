import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { MarkerType } from '@vue-flow/core'
import { updateCanvasEdgePresentation } from './canvasEdgePresentation'
import type { FlowEdge, FlowNode } from './flowCore.types'

interface CanvasEdgePerformanceDeps {
  nodes: Ref<FlowNode[]>
  edges: Ref<FlowEdge[]>
  edgeStyle: Ref<string>
  getSelectedNodes: Ref<FlowNode[]>
  isUltraLightCanvasMode: ComputedRef<boolean>
  isLargeCanvasConnectionMode: ComputedRef<boolean>
  shouldSuspendHeavyCanvasWork: ComputedRef<boolean>
  isPointSelectionSuppressed: Ref<boolean>
}

/**
 * 统一大画布的边样式与延迟更新状态，避免交互期间反复改写所有连接线。
 * @param deps 节点、连接线和画布性能状态。
 * @returns 默认边配置、样式同步和待同步状态访问器。
 */
export function useCanvasEdgePerformance(deps: CanvasEdgePerformanceDeps) {
  let pendingStyleSync = false
  const defaultEdgeOptions = computed(() => ({
    type: deps.edgeStyle.value,
    style: deps.isUltraLightCanvasMode.value
      ? { stroke: 'transparent', strokeWidth: 1, opacity: 0 }
      : { stroke: '#818cf8', strokeWidth: 2 },
    animated: !deps.isUltraLightCanvasMode.value && !deps.isLargeCanvasConnectionMode.value,
    updatable: true,
    pathOptions: { borderRadius: 20 },
    markerEnd: MarkerType.ArrowClosed,
  }))

  function applyEdgePresentation(hidden: boolean, clearSelection: boolean): void {
    updateCanvasEdgePresentation({
      clearSelection,
      edges: deps.edges.value,
      hidden,
      largeCanvas: hidden || deps.isLargeCanvasConnectionMode.value,
      nodes: deps.nodes.value,
      selectedNodes: hidden ? [] : deps.getSelectedNodes.value,
    })
  }

  function updateEdgeStyles(): void {
    if (deps.isPointSelectionSuppressed.value) {
      applyEdgePresentation(true, true)
      return
    }
    if (deps.shouldSuspendHeavyCanvasWork.value && !deps.isUltraLightCanvasMode.value) {
      pendingStyleSync = true
      return
    }
    applyEdgePresentation(deps.isUltraLightCanvasMode.value, false)
  }

  return {
    defaultEdgeOptions,
    updateEdgeStyles,
    setPendingEdgeStyleSync: (value: boolean): void => { pendingStyleSync = value },
    getPendingEdgeStyleSync: (): boolean => pendingStyleSync,
  }
}

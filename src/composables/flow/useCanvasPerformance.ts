import type { Ref } from 'vue'
import type { useFlowNodeClassification } from './useFlowNodeClassification'
import { useCanvasEdgePerformance } from './useCanvasEdgePerformance'
import { NODE_FULL_RENDER_VIEWPORT_PADDING, useCanvasMediaRendering } from './useCanvasMediaRendering'
import { useCanvasPerformanceState } from './useCanvasPerformanceState'
import { ZOOM_PROMOTION_SETTLE_MS, useCanvasPerformanceSync } from './useCanvasPerformanceSync'
import { useCanvasPointOverview } from './useCanvasPointOverview'
import { useCanvasViewportMovement } from './useCanvasViewportMovement'

export interface CanvasPerformanceDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  viewport: Ref<any>
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  pointOverviewCanvasRef: Ref<HTMLCanvasElement | null>
  mediaPreviewLimit: Ref<number>
  edgeStyle: Ref<string>
  isDraggingNode: Ref<boolean>
  isResizing: Ref<boolean>
  getSelectedNodes: Ref<any[]>
  classification: Pick<
    ReturnType<typeof useFlowNodeClassification>,
    'getNodeWidth' | 'getNodeHeight' | 'isRenderableMediaNode' | 'hasRenderableMediaThumb' | 'isPlaceholderEligibleNode'
  >
  toolbarDropdown: Ref<any>
  groupToolbarDropdown: Ref<any>
  hoveredNodeId: Ref<string | null>
  isConnecting: Ref<boolean>
  findNode: (id: string) => any
  clearSourceConnectionHighlight: () => void
}

type PerformanceState = ReturnType<typeof useCanvasPerformanceState>

function createOverview(deps: CanvasPerformanceDeps, state: PerformanceState) {
  return useCanvasPointOverview({
    nodes: deps.nodes,
    viewport: deps.viewport,
    flowCanvasWrapperRef: deps.flowCanvasWrapperRef,
    pointOverviewCanvasRef: deps.pointOverviewCanvasRef,
    showOverviewCanvas: state.showOverviewCanvas,
    getNodeWidth: deps.classification.getNodeWidth,
    getNodeHeight: deps.classification.getNodeHeight,
    getViewportWorldBounds: state.getViewportWorldBounds,
  })
}

function createMediaRendering(deps: CanvasPerformanceDeps, state: PerformanceState) {
  return useCanvasMediaRendering({
    nodes: deps.nodes,
    viewport: deps.viewport,
    effectiveRenderZoom: state.effectiveRenderZoom,
    effectiveMediaPreviewLimit: state.effectiveMediaPreviewLimit,
    isViewportMoving: state.isViewportMoving,
    isZoomPromotionPending: state.isZoomPromotionPending,
    shouldSuspendHeavyCanvasWork: state.shouldSuspendHeavyCanvasWork,
    getViewportWorldBounds: state.getViewportWorldBounds,
    isNodeIntersectingWorldBounds: state.isNodeIntersectingWorldBounds,
    ...deps.classification,
  })
}

function createEdgePerformance(deps: CanvasPerformanceDeps, state: PerformanceState) {
  return useCanvasEdgePerformance({
    nodes: deps.nodes,
    edges: deps.edges,
    edgeStyle: deps.edgeStyle,
    getSelectedNodes: deps.getSelectedNodes,
    isUltraLightCanvasMode: state.isUltraLightCanvasMode,
    isLargeCanvasConnectionMode: state.isLargeCanvasConnectionMode,
    shouldSuspendHeavyCanvasWork: state.shouldSuspendHeavyCanvasWork,
    isPointSelectionSuppressed: state.isPointSelectionSuppressed,
  })
}

/**
 * 编排画布媒体预算、点状概览、连接线降级和视口交互状态。
 * @param deps Vue Flow 状态、画布引用和节点分类依赖。
 * @returns FlowCanvas 使用的性能状态与调度方法。
 */
export function useCanvasPerformance(deps: CanvasPerformanceDeps) {
  const state = useCanvasPerformanceState(deps)
  const overview = createOverview(deps, state)
  const media = createMediaRendering(deps, state)
  const edge = createEdgePerformance(deps, state)
  const sync = useCanvasPerformanceSync({
    ...deps,
    effectiveRenderZoom: state.effectiveRenderZoom,
    isUltraLightCanvasMode: state.isUltraLightCanvasMode,
    isSelectionBoxActive: state.isSelectionBoxActive,
    isInteractionEffectsSuppressed: state.isInteractionEffectsSuppressed,
    isViewportMoving: state.isViewportMoving,
    isViewportRestoring: state.isViewportRestoring,
    isZoomPromotionPending: state.isZoomPromotionPending,
    scheduleMediaUpdate: media.scheduleRenderableMediaNodeIdsUpdate,
    scheduleOverviewRender: overview.schedulePointOverviewRender,
    updateEdgeStyles: edge.updateEdgeStyles,
  })

  const movement = useCanvasViewportMovement({
    flowCanvasWrapperRef: deps.flowCanvasWrapperRef,
    isViewportMoving: state.isViewportMoving,
    isViewportRestoring: state.isViewportRestoring,
    scheduleMediaUpdate: media.scheduleRenderableMediaNodeIdsUpdate,
    scheduleOverviewRender: overview.schedulePointOverviewRender,
  })

  function clearTimers(): void {
    sync.clearRenderZoomTimer()
    overview.clearPointOverviewRender()
    media.clearMediaRenderFrame()
    movement.clearViewportMovingResetTimer()
  }

  return {
    ZOOM_PROMOTION_SETTLE_MS,
    NODE_FULL_RENDER_VIEWPORT_PADDING,
    ...media,
    ...state,
    defaultEdgeOptions: edge.defaultEdgeOptions,
    schedulePointOverviewRender: overview.schedulePointOverviewRender,
    renderPointOverviewCanvas: overview.renderPointOverviewCanvas,
    updateEdgeStyles: edge.updateEdgeStyles,
    clearTimers,
    ...movement,
    setPendingEdgeStyleSync: edge.setPendingEdgeStyleSync,
    getPendingEdgeStyleSync: edge.getPendingEdgeStyleSync,
  }
}

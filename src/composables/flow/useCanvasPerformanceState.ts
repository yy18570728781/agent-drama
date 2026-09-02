import { computed, ref } from 'vue'
import { getCanvasViewportWorldBounds, isCanvasNodeIntersectingWorldBounds } from './canvasViewportGeometry'
import type { CanvasNodeLike, CanvasViewportBounds } from './canvasViewportGeometry'
import type { CanvasPerformanceDeps } from './useCanvasPerformance'

function createCanvasPerformanceCoreState(deps: CanvasPerformanceDeps) {
  const isSelectionBoxActive = ref(false)
  const isViewportMoving = ref(false)
  const isViewportRestoring = ref(false)
  const isPointSelectionSuppressed = ref(false)
  const effectiveRenderZoom = ref(Number(deps.viewport.value?.zoom || 1))
  const effectiveMediaPreviewLimit = computed(() => (
    Math.max(10, Math.min(500, Number(deps.mediaPreviewLimit.value || 80)))
  ))
  const isZoomPromotionPending = computed(() => (
    Number(deps.viewport.value?.zoom || 1) - effectiveRenderZoom.value > 0.001
  ))
  const getViewportWorldBounds = (padding = 0): CanvasViewportBounds | null => (
    getCanvasViewportWorldBounds(deps.flowCanvasWrapperRef, deps.viewport, padding)
  )
  const isNodeIntersectingWorldBounds = (
    node: CanvasNodeLike,
    bounds: CanvasViewportBounds | null,
  ): boolean => isCanvasNodeIntersectingWorldBounds(
    node,
    bounds,
    deps.classification.getNodeWidth,
    deps.classification.getNodeHeight,
  )
  const viewportVisibleMediaCount = computed(() => {
    const bounds = getViewportWorldBounds()
    if (!bounds) return 0
    return deps.nodes.value.filter((node) => (
      !node?.hidden
      && !node?.data?._collapsedByGroup
      && deps.classification.isRenderableMediaNode(node)
      && isNodeIntersectingWorldBounds(node, bounds)
    )).length
  })
  return {
    isSelectionBoxActive,
    isViewportMoving,
    isViewportRestoring,
    isPointSelectionSuppressed,
    effectiveRenderZoom,
    effectiveMediaPreviewLimit,
    isZoomPromotionPending,
    viewportVisibleMediaCount,
    getViewportWorldBounds,
    isNodeIntersectingWorldBounds,
  }
}

function createCanvasPerformanceModes(
  deps: CanvasPerformanceDeps,
  core: ReturnType<typeof createCanvasPerformanceCoreState>,
) {
  const isLightweightNodeMode = computed(() => {
    const zoom = core.effectiveRenderZoom.value
    return zoom < 0.68 || (deps.nodes.value.length > 180 && zoom < 1.02)
  })
  const isUltraLightCanvasMode = computed(() => {
    const zoom = core.effectiveRenderZoom.value
    const nodeCount = deps.nodes.value.length
    const isMovingLargeCanvas = core.isViewportMoving.value && nodeCount > 500
    const isHugeCanvasOverview = nodeCount >= 2000 && zoom < 0.8
    const isLowZoomLargeCanvas = nodeCount > 60 && zoom < 0.38
    return isMovingLargeCanvas
      || isHugeCanvasOverview
      || isLowZoomLargeCanvas
      || core.viewportVisibleMediaCount.value > core.effectiveMediaPreviewLimit.value
  })
  const isViewportCanvasPreviewMode = computed(() => (
    (core.isViewportMoving.value || core.isViewportRestoring.value)
    && (isUltraLightCanvasMode.value || deps.nodes.value.length > 500)
  ))
  const showOverviewCanvas = computed(() => isViewportCanvasPreviewMode.value)
  const isInteractionEffectsSuppressed = computed(() => (
    isUltraLightCanvasMode.value
    || core.isViewportMoving.value
    || core.isViewportRestoring.value
    || core.effectiveRenderZoom.value < 0.5
    || deps.nodes.value.length > 260
  ))
  const isLargeCanvasConnectionMode = computed(() => (
    deps.nodes.value.length > 220 || deps.edges.value.length > 320
  ))
  const shouldSuspendHeavyCanvasWork = computed(() => (
    deps.isDraggingNode.value
    || deps.isResizing.value
    || core.isSelectionBoxActive.value
    || core.isViewportMoving.value
    || core.isViewportRestoring.value
  ))
  return {
    isLightweightNodeMode,
    isUltraLightCanvasMode,
    isViewportCanvasPreviewMode,
    showOverviewCanvas,
    isInteractionEffectsSuppressed,
    isLargeCanvasConnectionMode,
    shouldSuspendHeavyCanvasWork,
  }
}

/**
 * 创建画布性能模式依赖的基础状态与视口派生量。
 * @param deps 画布节点、视口和节点分类依赖。
 * @returns 性能模式状态、视口边界与节点相交判断。
 */
export function useCanvasPerformanceState(deps: CanvasPerformanceDeps) {
  const core = createCanvasPerformanceCoreState(deps)
  const modes = createCanvasPerformanceModes(deps, core)
  return { ...core, ...modes }
}

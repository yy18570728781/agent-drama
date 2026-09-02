import { watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

interface CanvasPerformanceSyncDeps {
  nodes: Ref<Array<{ id: string }>>
  edges: Ref<Array<Record<string, unknown>>>
  viewport: Ref<unknown>
  mediaPreviewLimit: Ref<number>
  edgeStyle: Ref<string>
  effectiveRenderZoom: Ref<number>
  isUltraLightCanvasMode: ComputedRef<boolean>
  isSelectionBoxActive: Ref<boolean>
  isInteractionEffectsSuppressed: ComputedRef<boolean>
  isViewportMoving: Ref<boolean>
  isViewportRestoring: Ref<boolean>
  isDraggingNode: Ref<boolean>
  isResizing: Ref<boolean>
  isZoomPromotionPending: ComputedRef<boolean>
  toolbarDropdown: Ref<unknown>
  groupToolbarDropdown: Ref<unknown>
  hoveredNodeId: Ref<string | null>
  isConnecting: Ref<boolean>
  findNode: (id: string) => { class?: string } | undefined
  clearSourceConnectionHighlight: () => void
  scheduleMediaUpdate: () => void
  scheduleOverviewRender: () => void
  updateEdgeStyles: () => void
}

export const ZOOM_PROMOTION_SETTLE_MS = 140

function createZoomSynchronizer(deps: CanvasPerformanceSyncDeps) {
  let promoteTimer = 0
  const scheduleAll = (): void => {
    deps.scheduleMediaUpdate()
    deps.scheduleOverviewRender()
  }
  const sync = (nextZoom: number): void => {
    if (promoteTimer) clearTimeout(promoteTimer)
    promoteTimer = 0
    if (nextZoom <= deps.effectiveRenderZoom.value + 0.001) {
      deps.effectiveRenderZoom.value = nextZoom
      scheduleAll()
      return
    }
    promoteTimer = window.setTimeout(() => {
      promoteTimer = 0
      const viewport = (deps.viewport.value || {}) as { zoom?: number }
      deps.effectiveRenderZoom.value = Number(viewport.zoom || nextZoom) || nextZoom
      scheduleAll()
    }, ZOOM_PROMOTION_SETTLE_MS)
  }
  const clear = (): void => {
    if (!promoteTimer) return
    clearTimeout(promoteTimer)
    promoteTimer = 0
  }
  return { sync, scheduleAll, clear }
}

function registerRenderWatchers(
  deps: CanvasPerformanceSyncDeps,
  zoom: ReturnType<typeof createZoomSynchronizer>,
): void {
  watch(
    () => Number(((deps.viewport.value || {}) as { zoom?: number }).zoom || 1),
    (value) => { if (Number.isFinite(value) && value > 0) zoom.sync(value) },
    { immediate: true },
  )
  watch(deps.mediaPreviewLimit, zoom.scheduleAll)
  watch(deps.edgeStyle, (style) => {
    deps.edges.value = deps.edges.value.map((edge) => ({ ...edge, type: style }))
  })
  watch(
    () => [deps.isUltraLightCanvasMode.value, deps.isSelectionBoxActive.value],
    () => {
      zoom.scheduleAll()
      deps.updateEdgeStyles()
    },
  )
  watch(
    () => {
      const viewport = (deps.viewport.value || {}) as { x?: number; y?: number; zoom?: number }
      return [viewport.x || 0, viewport.y || 0, viewport.zoom || 1]
    },
    () => {
      deps.scheduleOverviewRender()
      if (!deps.isZoomPromotionPending.value) deps.scheduleMediaUpdate()
    },
    { immediate: true },
  )
  watch(() => deps.nodes.value, zoom.scheduleAll, { immediate: true })
}

function registerInteractionWatchers(deps: CanvasPerformanceSyncDeps): void {
  watch(deps.isInteractionEffectsSuppressed, (suppressed) => {
    if (!suppressed) return
    deps.toolbarDropdown.value = null
    deps.groupToolbarDropdown.value = null
    if (deps.hoveredNodeId.value) {
      const node = deps.findNode(deps.hoveredNodeId.value)
      if (node?.class === 'is-connecting-hover') node.class = ''
      deps.hoveredNodeId.value = null
    }
    if (!deps.isConnecting.value) deps.clearSourceConnectionHighlight()
  })
  watch(
    () => [
      deps.isViewportMoving.value,
      deps.isViewportRestoring.value,
      deps.isDraggingNode.value,
      deps.isResizing.value,
      deps.isZoomPromotionPending.value,
    ],
    ([moving, restoring, dragging, resizing, pending]) => {
      if (!moving && !restoring && !dragging && !resizing && !pending) deps.scheduleMediaUpdate()
    },
  )
}

/**
 * 连接画布性能状态与 Vue 响应式数据，集中管理低频同步和缩放晋级延迟。
 * @param deps 性能状态、交互状态与调度回调。
 * @returns 定时器清理方法。
 */
export function useCanvasPerformanceSync(deps: CanvasPerformanceSyncDeps) {
  const zoom = createZoomSynchronizer(deps)
  registerRenderWatchers(deps, zoom)
  registerInteractionWatchers(deps)
  return { clearRenderZoomTimer: zoom.clear }
}

import { computed, nextTick, onScopeDispose, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type { GenerationOrchestrationDeps } from './useGenerationOrchestration.types'
import { resolveGenerationPanelAnchor } from './generationPanelPosition'

export interface GenerationPanelViewportApi {
  getGenerationPanelElement: () => HTMLElement | null
  ensureGenerationPanelVisibleInViewport: () => void
  scheduleGenerationPanelViewportAdjustment: () => void
  getConstrainedPanelPosition: (wrapperRect: DOMRect, anchorCenterX: number, anchorBottomY: number) => { left: number; top: number }
  panelStyle: ComputedRef<Record<string, string | number>>
}

const PANEL_WIDTH = 720
const PANEL_HEIGHT_FALLBACK = 560
const PANEL_VIEWPORT_MARGIN = 12
const EMPTY_PANEL_STYLE: Record<string, string | number> = {}

/**
 * Keeps panel positioning logic independent from generation state mutations.
 */
export function useGenerationPanelViewport(deps: GenerationOrchestrationDeps): GenerationPanelViewportApi {
  let anchorRefreshFrame = 0

  function getGenerationPanelElement(): HTMLElement | null {
    const panelRef = deps.generationPanelRef.value
    if (!panelRef) return null
    if (panelRef.$el instanceof HTMLElement) return panelRef.$el
    return panelRef instanceof HTMLElement ? panelRef : null
  }

  function ensureGenerationPanelVisibleInViewport(): void {
    if (!deps.panelVisible.value || !deps.activePanelNode.value?.id) return
    const wrapperEl = deps.flowCanvasWrapperRef.value
    if (!(wrapperEl instanceof HTMLElement)) return
    const panelEl = getGenerationPanelElement()
    if (!(panelEl instanceof HTMLElement)) return
    const nodeEl = wrapperEl.querySelector(`.vue-flow__node[data-id="${deps.activePanelNode.value.id}"]`)
    if (!(nodeEl instanceof HTMLElement)) return

    const wrapperRect = wrapperEl.getBoundingClientRect()
    const nodeRect = nodeEl.getBoundingClientRect()
    const panelRect = panelEl.getBoundingClientRect()
    const panelWidth = panelRect.width || panelEl.offsetWidth || PANEL_WIDTH
    const panelHeight = panelRect.height || panelEl.offsetHeight || PANEL_HEIGHT_FALLBACK
    const nodeLeft = nodeRect.left - wrapperRect.left
    const nodeTop = nodeRect.top - wrapperRect.top
    const nodeRight = nodeRect.right - wrapperRect.left
    const nodeBottom = nodeRect.bottom - wrapperRect.top
    const panelLeft = nodeLeft + nodeRect.width / 2 - panelWidth / 2
    const panelTop = nodeBottom + 12
    const panelRight = panelLeft + panelWidth
    const panelBottom = panelTop + panelHeight
    const combinedLeft = Math.min(nodeLeft, panelLeft)
    const combinedTop = Math.min(nodeTop, panelTop)
    const combinedRight = Math.max(nodeRight, panelRight)
    const combinedBottom = Math.max(nodeBottom, panelBottom)
    const nextViewport = deps.viewport.value || { x: 0, y: 0, zoom: 1 }
    let dx = 0
    let dy = 0

    if (combinedLeft < PANEL_VIEWPORT_MARGIN) {
      dx = PANEL_VIEWPORT_MARGIN - combinedLeft
    } else if (combinedRight > wrapperRect.width - PANEL_VIEWPORT_MARGIN) {
      dx = wrapperRect.width - PANEL_VIEWPORT_MARGIN - combinedRight
    }

    if (combinedTop < PANEL_VIEWPORT_MARGIN) {
      dy = PANEL_VIEWPORT_MARGIN - combinedTop
    } else if (combinedBottom > wrapperRect.height - PANEL_VIEWPORT_MARGIN) {
      dy = wrapperRect.height - PANEL_VIEWPORT_MARGIN - combinedBottom
    }

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
    deps.setViewport({
      x: Number(nextViewport.x || 0) + dx,
      y: Number(nextViewport.y || 0) + dy,
      zoom: Number(nextViewport.zoom || 1),
    })
  }

  function scheduleGenerationPanelViewportAdjustment(): void {
    if (deps.generationPanelViewportAdjustFrame.value) {
      cancelAnimationFrame(deps.generationPanelViewportAdjustFrame.value)
    }
    deps.generationPanelViewportAdjustFrame.value = requestAnimationFrame(() => {
      deps.generationPanelViewportAdjustFrame.value = 0
      ensureGenerationPanelVisibleInViewport()
    })
  }

  function getConstrainedPanelPosition(wrapperRect: DOMRect, anchorCenterX: number, anchorBottomY: number) {
    const panelEl = getGenerationPanelElement()
    const maxWidth = Math.max(0, wrapperRect.width - PANEL_VIEWPORT_MARGIN * 2)
    const measuredWidth = panelEl?.getBoundingClientRect?.().width || panelEl?.offsetWidth || PANEL_WIDTH
    return resolveGenerationPanelAnchor(anchorCenterX, anchorBottomY, Math.min(measuredWidth, maxWidth))
  }

  function schedulePanelAnchorRefresh(): void {
    cancelAnimationFrame(anchorRefreshFrame)
    void nextTick(() => {
      anchorRefreshFrame = requestAnimationFrame(() => {
        anchorRefreshFrame = 0
        deps.generationPanelLayoutTick.value += 1
      })
    })
  }

  const panelStyle = computed<Record<string, string | number>>(() => {
    if (!deps.activePanelNode.value) return EMPTY_PANEL_STYLE

    void `${deps.viewport.value.zoom}:${deps.viewport.value.x}:${deps.viewport.value.y}`
    void deps.generationPanelLayoutTick.value
    const nodeId = deps.activePanelNode.value.id
    const wrapperEl = deps.flowCanvasWrapperRef.value
    if (wrapperEl && nodeId) {
      const nodeEl = wrapperEl.querySelector(`.vue-flow__node[data-id="${nodeId}"]`)
      if (nodeEl instanceof HTMLElement) {
        const wrapperRect = wrapperEl.getBoundingClientRect()
        const nodeRect = nodeEl.getBoundingClientRect()
        const constrained = getConstrainedPanelPosition(
          wrapperRect,
          nodeRect.left - wrapperRect.left + nodeRect.width / 2,
          nodeRect.top - wrapperRect.top + nodeRect.height,
        )
        return {
          position: 'absolute',
          width: `${Math.min(PANEL_WIDTH, Math.max(0, wrapperRect.width - PANEL_VIEWPORT_MARGIN * 2))}px`,
          left: `${constrained.left}px`,
          top: `${constrained.top}px`,
          zIndex: 50,
        }
      }
    }

    const node = deps.findNode(deps.activePanelNode.value.id)
    if (!node) return EMPTY_PANEL_STYLE
    const x = node.computedPosition?.x ?? node.position.x
    const y = node.computedPosition?.y ?? node.position.y
    const width = node.dimensions?.width || 220
    const height = node.dimensions?.height || 100
    const screenCenterX = (x + width / 2) * deps.viewport.value.zoom + deps.viewport.value.x
    const screenBottomY = (y + height) * deps.viewport.value.zoom + deps.viewport.value.y
    const wrapperRect = wrapperEl?.getBoundingClientRect?.()
    const constrained = wrapperRect
      ? getConstrainedPanelPosition(wrapperRect, screenCenterX, screenBottomY)
      : { left: screenCenterX - PANEL_WIDTH / 2, top: screenBottomY + 12 }

    return {
      position: 'absolute',
      width: `${PANEL_WIDTH}px`,
      left: `${constrained.left}px`,
      top: `${constrained.top}px`,
      zIndex: 50,
    }
  })

  watch(
    () => `${deps.viewport.value.zoom}:${deps.viewport.value.x}:${deps.viewport.value.y}`,
    schedulePanelAnchorRefresh,
    { flush: 'post' },
  )
  onScopeDispose(() => cancelAnimationFrame(anchorRefreshFrame))

  return {
    getGenerationPanelElement,
    ensureGenerationPanelVisibleInViewport,
    scheduleGenerationPanelViewportAdjustment,
    getConstrainedPanelPosition,
    panelStyle,
  }
}

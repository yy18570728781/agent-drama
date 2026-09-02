import { ref, computed, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { useFlowNodeClassification } from './useFlowNodeClassification'

export interface PointSelectionDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  viewport: Ref<any>
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  classification: Pick<ReturnType<typeof useFlowNodeClassification>, 'getNodeWidth' | 'getNodeHeight'>
  emit: {
    (e: 'update:modelNodes', value: any[]): void
  }
  updateEdgeStyles: () => void
  stopPanelClickOutside?: () => void
  clearMultiSelectionConnection?: () => void
}

export function usePointSelection(deps: PointSelectionDeps) {
  const {
    nodes,
    edges,
    viewport,
    flowCanvasWrapperRef,
    classification,
    emit,
    updateEdgeStyles,
    stopPanelClickOutside,
    clearMultiSelectionConnection,
  } = deps

  const pointSelectionState = ref<{
    start: { x: number; y: number }
    end: { x: number; y: number }
    preselectedIds?: Set<string>
    modifier?: string | null
  } | null>(null)

  const pointSelectionRectStyle = computed(() => {
    const state = pointSelectionState.value
    if (!state) return null
    const left = Math.min(state.start.x, state.end.x)
    const top = Math.min(state.start.y, state.end.y)
    const width = Math.abs(state.end.x - state.start.x)
    const height = Math.abs(state.end.y - state.start.y)
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    }
  })

  function clientPointToCanvasPoint(clientX: number, clientY: number) {
    const wrapper = flowCanvasWrapperRef.value
    const rect = wrapper?.getBoundingClientRect?.()
    if (!rect) return { x: clientX, y: clientY }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  function clearPointSelectionState() {
    pointSelectionState.value = null
  }

  function shouldIgnorePointSelectionTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(
      target.closest(
        'button, input, textarea, select, .group-header, .group-collapse-btn, .flow-bottom-panel, .minimap-container, .context-menu, .connection-popup, .node-toolbar-wrap, .group-alignment-toolbar, .group-lock-anchor'
      )
    )
  }

  function applyPointModeSelection(state: NonNullable<typeof pointSelectionState.value>) {
    if (!state) return
    const left = Math.min(state.start.x, state.end.x)
    const top = Math.min(state.start.y, state.end.y)
    const right = Math.max(state.start.x, state.end.x)
    const bottom = Math.max(state.start.y, state.end.y)
    const dragDistance = Math.abs(state.end.x - state.start.x) + Math.abs(state.end.y - state.start.y)
    if (dragDistance < 6) return

    const zoom = Number(viewport.value?.zoom || 1)
    const offsetX = Number(viewport.value?.x || 0)
    const offsetY = Number(viewport.value?.y || 0)
    const preselectedIds = new Set(state.preselectedIds || [])
    const nextSelectedIds = state.modifier ? new Set(preselectedIds) : new Set()

    for (const node of nodes.value) {
      if (!node || node.hidden || node.data?._collapsedByGroup) continue
      const nodeX = Number(node?.computedPosition?.x ?? node?.position?.x) || 0
      const nodeY = Number(node?.computedPosition?.y ?? node?.position?.y) || 0
      const nodeW = classification.getNodeWidth(node) * zoom
      const nodeH = classification.getNodeHeight(node) * zoom
      const screenLeft = nodeX * zoom + offsetX
      const screenTop = nodeY * zoom + offsetY
      const screenRight = screenLeft + nodeW
      const screenBottom = screenTop + nodeH
      const intersects = !(screenRight < left || screenLeft > right || screenBottom < top || screenTop > bottom)
      if (intersects) nextSelectedIds.add(node.id)
    }

    nodes.value.forEach((node) => {
      node.selected = nextSelectedIds.has(node.id)
    })
    edges.value.forEach((edge) => {
      edge.selected = false
    })
    nodes.value = [...nodes.value]
    emit('update:modelNodes', nodes.value)
    updateEdgeStyles()
  }

  function onPointSelectionPointerMove(event: PointerEvent) {
    const state = pointSelectionState.value
    if (!state) return
    pointSelectionState.value = {
      ...state,
      end: clientPointToCanvasPoint(event.clientX, event.clientY),
    }
  }

  function onPointSelectionPointerUp() {
    const state = pointSelectionState.value
    clearPointSelectionState()
    window.removeEventListener('pointermove', onPointSelectionPointerMove, true)
    window.removeEventListener('pointerup', onPointSelectionPointerUp, true)
    if (state) applyPointModeSelection(state)
  }

  // ==================== Cleanup ====================

  onUnmounted(() => {
    stopPanelClickOutside?.()
    clearMultiSelectionConnection?.()
    window.removeEventListener('pointermove', onPointSelectionPointerMove, true)
    window.removeEventListener('pointerup', onPointSelectionPointerUp, true)
  })

  return {
    pointSelectionState,
    pointSelectionRectStyle,
    clientPointToCanvasPoint,
    clearPointSelectionState,
    shouldIgnorePointSelectionTarget,
    applyPointModeSelection,
    onPointSelectionPointerMove,
    onPointSelectionPointerUp,
  }
}

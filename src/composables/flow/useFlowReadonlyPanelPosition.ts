import type { CSSProperties, ComputedRef, Ref } from 'vue'
import type { FlowNode, FlowViewport } from './flowCore.types'
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { resolveGenerationPanelAnchor } from './generationPanelPosition'

interface FlowReadonlyPanelPositionOptions {
  selectedNode: Readonly<Ref<FlowNode | null>>
  viewport: Readonly<Ref<FlowViewport>>
  wrapperRef: Ref<HTMLElement | null>
}

interface FlowReadonlyPanelPositionState {
  panelStyle: ComputedRef<CSSProperties>
  refreshPanelPosition: () => void
}

const PANEL_MAX_WIDTH = 720
const PANEL_MARGIN = 12

/**
 * Keeps the read-only generation panel anchored to its node after viewport transforms.
 * @param options Selected node, Vue Flow viewport and wrapper element
 * @returns Reactive panel style and an explicit geometry refresh function
 */
export function useFlowReadonlyPanelPosition(
  options: FlowReadonlyPanelPositionOptions,
): FlowReadonlyPanelPositionState {
  const layoutTick = ref(0)
  let positionFrame = 0

  function refreshPanelPosition(): void {
    cancelAnimationFrame(positionFrame)
    void nextTick(() => {
      positionFrame = requestAnimationFrame(() => {
        positionFrame = 0
        layoutTick.value += 1
      })
    })
  }

  const panelStyle = computed<CSSProperties>(() => {
    void layoutTick.value
    const wrapper = options.wrapperRef.value
    const nodeId = options.selectedNode.value?.id
    if (!wrapper || !nodeId) return {}
    const nodeElement = wrapper.querySelector(`.vue-flow__node[data-id="${nodeId}"]`)
    if (!(nodeElement instanceof HTMLElement)) return {}
    const wrapperRect = wrapper.getBoundingClientRect()
    const nodeRect = nodeElement.getBoundingClientRect()
    const width = Math.min(PANEL_MAX_WIDTH, Math.max(0, wrapperRect.width - PANEL_MARGIN * 2))
    const anchor = resolveGenerationPanelAnchor(
      nodeRect.left - wrapperRect.left + nodeRect.width / 2,
      nodeRect.bottom - wrapperRect.top,
      width,
    )
    return {
      left: `${anchor.left}px`,
      position: 'absolute',
      top: `${anchor.top}px`,
      width: `${width}px`,
      zIndex: 50,
    }
  })

  watch(
    () => `${options.selectedNode.value?.id || ''}:${options.viewport.value.x}:${options.viewport.value.y}:${options.viewport.value.zoom}`,
    refreshPanelPosition,
    { flush: 'post', immediate: true },
  )
  onScopeDispose(() => cancelAnimationFrame(positionFrame))

  return { panelStyle, refreshPanelPosition }
}

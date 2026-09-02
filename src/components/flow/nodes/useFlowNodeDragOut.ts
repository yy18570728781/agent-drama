import { computed, ref, type ComputedRef } from 'vue'

export function useFlowNodeDragOut(
  _nodeId: string,
  _mediaType: ComputedRef<string>,
  _nodeData: ComputedRef<Record<string, any>>,
) {
  const isDraggingOut = ref(false)
  let activeNodeEl: HTMLElement | null = null
  const canDragOut = computed(() => false)

  function applyDraggingOutState(nodeEl: HTMLElement | null): void {
    if (!nodeEl) return
    nodeEl.style.opacity = '0.76'
    nodeEl.style.filter = 'saturate(1.08) brightness(1.04)'
  }

  function clearDraggingOutState(nodeEl: HTMLElement | null): void {
    if (!nodeEl) return
    nodeEl.style.opacity = ''
    nodeEl.style.filter = ''
  }

  function handleDragOutStart(_event: DragEvent): void {
    clearDraggingOutState(activeNodeEl)
    activeNodeEl = null
    isDraggingOut.value = false
  }

  function handleDragOutEnd(_event: DragEvent): void {
    clearDraggingOutState(activeNodeEl)
    activeNodeEl = null
    isDraggingOut.value = false
  }

  return {
    canDragOut,
    isDraggingOut,
    handleDragOutStart,
    handleDragOutEnd,
  }
}

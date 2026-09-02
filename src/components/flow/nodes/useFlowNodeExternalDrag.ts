import { computed, ref, type ComputedRef } from 'vue'

export function useFlowNodeExternalDrag(_nodeId: string, _hasMediaUrl: ComputedRef<boolean>) {
  const isCtrlDragArmed = ref(false)
  const canExternalDrag = computed(() => false)

  const isExternalDragDraggable = computed(() => (
    canExternalDrag.value && isCtrlDragArmed.value
  ))

  function armExternalDrag(_event: MouseEvent): void {
    isCtrlDragArmed.value = false
  }

  function resetExternalDragState(): void {
    isCtrlDragArmed.value = false
  }

  function handleExternalDragStart(_event: DragEvent): void {
    resetExternalDragState()
  }

  function handleExternalDragEnd(_event: DragEvent): void {
    resetExternalDragState()
  }

  return {
    isExternalDragDraggable,
    armExternalDrag,
    resetExternalDragState,
    handleExternalDragStart,
    handleExternalDragEnd,
  }
}

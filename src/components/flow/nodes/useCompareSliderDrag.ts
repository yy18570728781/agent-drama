import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

interface CompareSliderDragApi {
  compareSliderPosition: Ref<number>
  compareContainerRef: Ref<HTMLElement | null>
  startCompareDrag: (event: MouseEvent) => void
}

/**
 * Manages compare-slider pointer listeners and guarantees teardown when a node unmounts.
 * @returns Reactive slider state and the drag starter used by compare nodes.
 */
export function useCompareSliderDrag(): CompareSliderDragApi {
  const compareSliderPosition = ref(50)
  const compareContainerRef = ref<HTMLElement | null>(null)
  const isComparing = ref(false)

  function handleCompareDrag(event: MouseEvent): void {
    const container = compareContainerRef.value
    if (!isComparing.value || !container) return
    const rect = container.getBoundingClientRect()
    if (!rect.width) return
    const position = ((event.clientX - rect.left) / rect.width) * 100
    compareSliderPosition.value = Math.max(0, Math.min(100, position))
  }

  function stopCompareDrag(): void {
    isComparing.value = false
    window.removeEventListener('mousemove', handleCompareDrag)
    window.removeEventListener('mouseup', stopCompareDrag)
  }

  function startCompareDrag(event: MouseEvent): void {
    event.preventDefault()
    stopCompareDrag()
    isComparing.value = true
    window.addEventListener('mousemove', handleCompareDrag)
    window.addEventListener('mouseup', stopCompareDrag)
  }

  onUnmounted(stopCompareDrag)

  return {
    compareSliderPosition,
    compareContainerRef,
    startCompareDrag,
  }
}

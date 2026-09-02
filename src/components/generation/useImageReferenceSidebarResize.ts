import { onBeforeUnmount, ref } from 'vue'

const MIN_WIDTH = 260
const MAX_WIDTH = 520
const DEFAULT_WIDTH = 320

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

export function useImageReferenceSidebarResize() {
  const toolsWidth = ref(DEFAULT_WIDTH)
  const toolsResizeActive = ref(false)

  let startX = 0
  let startWidth = DEFAULT_WIDTH

  function stopResize() {
    toolsResizeActive.value = false
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopResize)
  }

  function handlePointerMove(event: PointerEvent) {
    const delta = startX - event.clientX
    toolsWidth.value = clampWidth(startWidth + delta)
  }

  function startToolsResize(event: PointerEvent) {
    event.preventDefault()
    startX = event.clientX
    startWidth = toolsWidth.value
    toolsResizeActive.value = true
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
  }

  onBeforeUnmount(stopResize)

  return {
    toolsWidth,
    toolsResizeActive,
    startToolsResize,
  }
}

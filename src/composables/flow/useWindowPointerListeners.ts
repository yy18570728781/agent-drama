import { onUnmounted } from 'vue'

type PointerHandler = (event: PointerEvent) => void

interface WindowPointerListenersApi {
  bind: (moveHandler: PointerHandler, upHandler: PointerHandler) => void
  clear: () => void
}

/**
 * Owns a pointer move/up listener pair so interrupted gestures cannot outlive the component scope.
 * @returns Methods for replacing and clearing the active listener pair.
 */
export function useWindowPointerListeners(): WindowPointerListenersApi {
  let moveHandler: PointerHandler | null = null
  let upHandler: PointerHandler | null = null

  function clear(): void {
    if (moveHandler) {
      window.removeEventListener('pointermove', moveHandler, true)
      moveHandler = null
    }
    if (upHandler) {
      window.removeEventListener('pointerup', upHandler, true)
      upHandler = null
    }
  }

  function bind(nextMoveHandler: PointerHandler, nextUpHandler: PointerHandler): void {
    clear()
    moveHandler = nextMoveHandler
    upHandler = nextUpHandler
    window.addEventListener('pointermove', moveHandler, true)
    window.addEventListener('pointerup', upHandler, true)
  }

  onUnmounted(clear)

  return { bind, clear }
}

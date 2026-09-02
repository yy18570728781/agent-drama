import { ref, type Ref } from 'vue'

export const isCanvasViewportLayoutSuspended = ref(false)

interface CanvasViewportMovementOptions {
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  isViewportMoving: Ref<boolean>
  isViewportRestoring: Ref<boolean>
  scheduleMediaUpdate: () => void
  scheduleOverviewRender: () => void
  settleMs?: number
}

interface UseCanvasViewportMovementReturn {
  clearViewportMovingResetTimer: () => void
  onViewportMoveEnd: () => void
  onViewportMoveStart: () => void
}

/**
 * 管理视口手势期间的轻量预览状态及松手后的延迟恢复。
 * @param options 视口状态和恢复调度方法。
 * @returns Vue Flow 移动事件处理与定时器清理方法。
 */
export function useCanvasViewportMovement(
  options: CanvasViewportMovementOptions,
): UseCanvasViewportMovementReturn {
  let resetTimer = 0
  let restoreFrame = 0
  let restoreFallbackTimer = 0

  function setRestorePreparation(active: boolean): void {
    const wrapper = options.flowCanvasWrapperRef.value
    if (!wrapper) return
    if (active) wrapper.dataset.viewportRestore = 'true'
    else delete wrapper.dataset.viewportRestore
  }

  function clearRestoreSchedule(): void {
    if (restoreFrame) cancelAnimationFrame(restoreFrame)
    if (restoreFallbackTimer) clearTimeout(restoreFallbackTimer)
    restoreFrame = 0
    restoreFallbackTimer = 0
  }

  function finishViewportRestore(): void {
    clearRestoreSchedule()
    options.isViewportRestoring.value = false
    isCanvasViewportLayoutSuspended.value = false
    setRestorePreparation(false)
    options.scheduleOverviewRender()
    options.scheduleMediaUpdate()
  }

  function scheduleViewportRestore(): void {
    clearRestoreSchedule()
    restoreFallbackTimer = window.setTimeout(finishViewportRestore, 96)
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(finishViewportRestore)
    })
  }

  function startViewportRestore(): void {
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = 0
    options.isViewportRestoring.value = true
    isCanvasViewportLayoutSuspended.value = true
    setRestorePreparation(true)
    options.isViewportMoving.value = false
    options.scheduleOverviewRender()
    scheduleViewportRestore()
  }

  function clearViewportMovingResetTimer(): void {
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = 0
    clearRestoreSchedule()
    options.isViewportRestoring.value = false
    isCanvasViewportLayoutSuspended.value = false
    setRestorePreparation(false)
  }

  function onViewportMoveStart(): void {
    clearViewportMovingResetTimer()
    options.isViewportMoving.value = true
    isCanvasViewportLayoutSuspended.value = true
    options.scheduleOverviewRender()
    resetTimer = window.setTimeout(startViewportRestore, options.settleMs ?? 260)
  }

  function onViewportMoveEnd(): void {
    startViewportRestore()
  }

  return { clearViewportMovingResetTimer, onViewportMoveStart, onViewportMoveEnd }
}

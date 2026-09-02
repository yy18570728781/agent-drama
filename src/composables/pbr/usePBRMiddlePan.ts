interface ViewOffset {
  x: number
  y: number
}

interface UsePBRMiddlePanOptions {
  readOffset: () => ViewOffset
  updateOffset: (offset: ViewOffset) => void
}

interface UsePBRMiddlePanReturn {
  bind: (element: HTMLElement) => void
  dispose: () => void
}

/**
 * 管理 PBR 预览中鼠标中键平移的 DOM 监听器。
 * @param options - 当前视图偏移读取和更新方法。
 * @returns 可重复绑定元素并可显式释放的控制器。
 */
export function usePBRMiddlePan(options: UsePBRMiddlePanOptions): UsePBRMiddlePanReturn {
  let target: HTMLElement | null = null
  let dragging = false
  let startX = 0
  let startY = 0
  let startOffset: ViewOffset = { x: 0, y: 0 }

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 1) return
    dragging = true
    startX = event.clientX
    startY = event.clientY
    startOffset = options.readOffset()
    event.preventDefault()
    event.stopPropagation()
  }

  const handlePointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    options.updateOffset({
      x: startOffset.x - (event.clientX - startX),
      y: startOffset.y - (event.clientY - startY),
    })
  }

  const handlePointerUp = (event: PointerEvent): void => {
    if (event.button === 1) dragging = false
  }

  const dispose = (): void => {
    target?.removeEventListener('pointerdown', handlePointerDown)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    target = null
    dragging = false
  }

  const bind = (element: HTMLElement): void => {
    dispose()
    target = element
    target.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return { bind, dispose }
}

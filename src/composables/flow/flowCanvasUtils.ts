import type { Ref } from 'vue'

export function isTextInputLike(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('input, textarea, [contenteditable="true"], [contenteditable=""], .ProseMirror, .el-input, .el-textarea')
  )
}

export function isGenerationPanelInputLike(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('.workflow-generation-panel, .generator-shell, .input-container')
  )
}

export function isPointInsideCanvas(clientX: number, clientY: number, wrapperRef: Ref<HTMLElement | null>): boolean {
  const wrapper = wrapperRef.value
  const rect = wrapper?.getBoundingClientRect?.()
  if (!rect) return false
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
}

export function getCanvasPastePosition(
  event: any,
  lastMousePosition: { x: number; y: number },
  project: (pos: { x: number; y: number }) => { x: number; y: number },
  clientPointToCanvasPoint: (clientX: number, clientY: number) => { x: number; y: number },
  wrapperRef: Ref<HTMLElement | null>,
): { x: number; y: number } | null {
  const wrapper = wrapperRef.value
  const rect = wrapper?.getBoundingClientRect?.()
  if (!rect) return null

  const mouseInsideCanvas = isPointInsideCanvas(lastMousePosition.x, lastMousePosition.y, wrapperRef)

  if (mouseInsideCanvas) {
    return project(clientPointToCanvasPoint(lastMousePosition.x, lastMousePosition.y))
  }

  return project({
    x: rect.width / 2,
    y: rect.height / 2,
  })
}

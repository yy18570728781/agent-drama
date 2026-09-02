export interface ImageEditorSnapshot {
  width: number
  height: number
  imageData: ImageData
  elements: any[]
  rotation: number
  flipH: boolean
  flipV: boolean
  brightness: number
  contrast: number
  saturation: number
}

/**
 * Keeps snapshot history isolated so pointer and drawing code can stay focused on editor behavior.
 */
export function useImageReferenceHistory(deps: {
  editCanvasRef: { value: HTMLCanvasElement | null }
  drawElements: { value: any[] }
  activeElementId: { value: string | null }
  drawHistory: { value: ImageEditorSnapshot[] }
  drawFuture: { value: ImageEditorSnapshot[] }
  imgAdjust: { value: { brightness: number; contrast: number; saturation: number } }
  cropRect: { value: { x: number; y: number; w: number; h: number } }
  expandDrag: { value: { top: number; bottom: number; left: number; right: number } }
  getRotation: () => number
  getFlipH: () => boolean
  getFlipV: () => boolean
  setRotation: (value: number) => void
  setFlipH: (value: boolean) => void
  setFlipV: (value: boolean) => void
  resetCurrentDrawing: () => void
  clearExpandState: () => void
  clearOverlay: () => void
  syncAllLayers: () => void
}) {
  function createEditorSnapshot(): ImageEditorSnapshot | null {
    const canvas = deps.editCanvasRef.value
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    return {
      width: canvas.width,
      height: canvas.height,
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      elements: JSON.parse(JSON.stringify(deps.drawElements.value)),
      rotation: deps.getRotation(),
      flipH: deps.getFlipH(),
      flipV: deps.getFlipV(),
      brightness: deps.imgAdjust.value.brightness,
      contrast: deps.imgAdjust.value.contrast,
      saturation: deps.imgAdjust.value.saturation,
    }
  }

  function restoreEditorSnapshot(snapshot: ImageEditorSnapshot | null): void {
    const canvas = deps.editCanvasRef.value
    if (!canvas || !snapshot) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = snapshot.width
    canvas.height = snapshot.height
    ctx.putImageData(snapshot.imageData, 0, 0)
    deps.drawElements.value = JSON.parse(JSON.stringify(snapshot.elements))
    deps.activeElementId.value = null
    deps.resetCurrentDrawing()
    deps.setRotation(snapshot.rotation)
    deps.setFlipH(snapshot.flipH)
    deps.setFlipV(snapshot.flipV)
    deps.imgAdjust.value = {
      brightness: snapshot.brightness,
      contrast: snapshot.contrast,
      saturation: snapshot.saturation,
    }
    deps.cropRect.value = { x: 0, y: 0, w: 0, h: 0 }
    deps.expandDrag.value = { top: 0, bottom: 0, left: 0, right: 0 }
    deps.clearExpandState()
    deps.clearOverlay()
    deps.syncAllLayers()
  }

  function saveToHistory(): void {
    const snapshot = createEditorSnapshot()
    if (!snapshot) return
    deps.drawHistory.value.push(snapshot)
    if (deps.drawHistory.value.length > 50) deps.drawHistory.value.shift()
    deps.drawFuture.value = []
  }

  function drawUndo(): void {
    if (!deps.drawHistory.value.length) return
    const current = createEditorSnapshot()
    if (!current) return
    deps.drawFuture.value.push(current)
    const previous = deps.drawHistory.value.pop() || null
    restoreEditorSnapshot(previous)
  }

  function drawRedo(): void {
    if (!deps.drawFuture.value.length) return
    const current = createEditorSnapshot()
    if (!current) return
    deps.drawHistory.value.push(current)
    const next = deps.drawFuture.value.pop() || null
    restoreEditorSnapshot(next)
  }

  return {
    createEditorSnapshot,
    restoreEditorSnapshot,
    saveToHistory,
    drawUndo,
    drawRedo,
  }
}

import { onUnmounted, type Ref } from 'vue'

interface MinimapTransform {
  left: number
  top: number
  scale: number
  offsetX: number
  offsetY: number
}

interface MinimapInteractionOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  dimensions: Ref<{ width: number; height: number }>
  getMaximumZoom: () => number
  getMinimumZoom: () => number
  mapTransform: MinimapTransform
  previewCenter: Ref<{ x: number; y: number } | null>
  scheduleRender: () => void
  setViewport: (viewport: { x: number; y: number; zoom: number }) => Promise<boolean>
  viewport: Ref<{ x: number; y: number; zoom: number }>
}

interface UseFlowCanvasMinimapInteractionReturn {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onWheel: (event: WheelEvent) => void
}

interface MinimapPanState {
  isPanning: boolean
  panFrame: number
  pendingPoint: { x: number; y: number } | null
}

interface MinimapWheelState {
  wheelFrame: number
  pendingDelta: number
}

function clampZoom(options: MinimapInteractionOptions, zoom: number): number {
  return Math.max(options.getMinimumZoom(), Math.min(options.getMaximumZoom(), zoom))
}

function updatePreviewCenter(
  options: MinimapInteractionOptions,
  clientX: number,
  clientY: number,
): void {
  const canvas = options.canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mapX = (clientX - rect.left) * ((canvas.clientWidth || 220) / rect.width)
  const mapY = (clientY - rect.top) * ((canvas.clientHeight || 140) / rect.height)
  const worldX = options.mapTransform.left
    + (mapX - options.mapTransform.offsetX) / options.mapTransform.scale
  const worldY = options.mapTransform.top
    + (mapY - options.mapTransform.offsetY) / options.mapTransform.scale
  options.previewCenter.value = { x: worldX, y: worldY }
  options.scheduleRender()
}

function flushPendingPoint(options: MinimapInteractionOptions, state: MinimapPanState): void {
  state.panFrame = 0
  if (!state.pendingPoint) return
  const point = state.pendingPoint
  state.pendingPoint = null
  updatePreviewCenter(options, point.x, point.y)
}

function handlePointerDown(
  options: MinimapInteractionOptions,
  state: MinimapPanState,
  event: PointerEvent,
): void {
  state.isPanning = true
  options.canvasRef.value?.setPointerCapture(event.pointerId)
  updatePreviewCenter(options, event.clientX, event.clientY)
}

function handlePointerMove(
  options: MinimapInteractionOptions,
  state: MinimapPanState,
  event: PointerEvent,
): void {
  if (!state.isPanning) return
  state.pendingPoint = { x: event.clientX, y: event.clientY }
  if (!state.panFrame) {
    state.panFrame = requestAnimationFrame(() => flushPendingPoint(options, state))
  }
}

function handlePointerUp(
  options: MinimapInteractionOptions,
  state: MinimapPanState,
  event: PointerEvent,
): void {
  state.isPanning = false
  if (state.panFrame) cancelAnimationFrame(state.panFrame)
  state.panFrame = 0
  flushPendingPoint(options, state)
  const center = options.previewCenter.value
  if (center) {
    const zoom = clampZoom(options, options.viewport.value.zoom)
    void options.setViewport({
      x: options.dimensions.value.width / 2 - center.x * zoom,
      y: options.dimensions.value.height / 2 - center.y * zoom,
      zoom,
    })
  }
  options.previewCenter.value = null
  options.scheduleRender()
  if (options.canvasRef.value?.hasPointerCapture(event.pointerId)) {
    options.canvasRef.value.releasePointerCapture(event.pointerId)
  }
}

function applyWheelZoom(options: MinimapInteractionOptions, state: MinimapWheelState): void {
  state.wheelFrame = 0
  const viewport = options.viewport.value
  const nextZoom = clampZoom(options, viewport.zoom * 2 ** (-state.pendingDelta * 0.002))
  state.pendingDelta = 0
  const centerX = (-viewport.x + options.dimensions.value.width / 2) / viewport.zoom
  const centerY = (-viewport.y + options.dimensions.value.height / 2) / viewport.zoom
  void options.setViewport({
    x: options.dimensions.value.width / 2 - centerX * nextZoom,
    y: options.dimensions.value.height / 2 - centerY * nextZoom,
    zoom: nextZoom,
  })
}

function handleWheel(
  options: MinimapInteractionOptions,
  state: MinimapWheelState,
  event: WheelEvent,
): void {
  state.pendingDelta += event.deltaY
  if (!state.wheelFrame) {
    state.wheelFrame = requestAnimationFrame(() => applyWheelZoom(options, state))
  }
}

function disposeInteraction(panState: MinimapPanState, wheelState: MinimapWheelState): void {
  if (panState.panFrame) cancelAnimationFrame(panState.panFrame)
  if (wheelState.wheelFrame) cancelAnimationFrame(wheelState.wheelFrame)
}

/**
 * 将小地图的高频指针与滚轮输入合并到动画帧，避免连续触发 Vue Flow 全量视口计算。
 * @param options 小地图坐标换算与 Vue Flow 视口依赖。
 * @returns 可直接绑定到 Canvas 的交互处理器。
 */
export function useFlowCanvasMinimapInteraction(
  options: MinimapInteractionOptions,
): UseFlowCanvasMinimapInteractionReturn {
  const panState: MinimapPanState = { isPanning: false, panFrame: 0, pendingPoint: null }
  const wheelState: MinimapWheelState = { wheelFrame: 0, pendingDelta: 0 }
  const onPointerDown = (event: PointerEvent) => handlePointerDown(options, panState, event)
  const onPointerMove = (event: PointerEvent) => handlePointerMove(options, panState, event)
  const onPointerUp = (event: PointerEvent) => handlePointerUp(options, panState, event)
  const onWheel = (event: WheelEvent) => handleWheel(options, wheelState, event)
  onUnmounted(() => disposeInteraction(panState, wheelState))
  return { onPointerDown, onPointerMove, onPointerUp, onWheel }
}

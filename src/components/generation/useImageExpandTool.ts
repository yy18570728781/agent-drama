import { computed, ref, type Ref } from 'vue'
import { DEFAULT_EXPAND_INSETS, IMAGE_EXPAND_RATIOS } from './imageExpand.constants'
import type { ExpandHandle, ExpandInsets, ExpandPreviewInfo, ExpandRatioOption, ExpandSide } from './imageExpand.types'

type ExpandableDrawElement = { offsetX: number; offsetY: number }
type EditorSnapshot<TElement extends ExpandableDrawElement> = { width: number; height: number; imageData: ImageData; elements: TElement[]; rotation: number; flipH: boolean; flipV: boolean; brightness: number; contrast: number; saturation: number }

type Deps<TElement extends ExpandableDrawElement, TSnapshot extends EditorSnapshot<TElement>> = {
  editCanvasRef: Ref<HTMLCanvasElement | null>
  drawLayerRef: Ref<HTMLCanvasElement | null>
  overlayCanvasRef: Ref<HTMLCanvasElement | null>
  drawElements: Ref<TElement[]>
  editImageInfo: Ref<{ width: number; height: number }>
  renderDrawLayer: () => void
  syncDrawLayerSize: () => void
  syncCursorLayerSize: () => void
  syncAllLayers: () => void
  getCanvasCoords: (event: MouseEvent) => { x: number; y: number }
  createHistorySnapshot: (imageData: ImageData, width: number, height: number) => TSnapshot
  pushHistorySnapshot: (snapshot: TSnapshot) => void
  clearFutureHistory: () => void
  markDirty: () => void
  notifyApplied: () => void
}

const SIDE_LABELS: Record<ExpandSide, string> = { top: '上', right: '右', bottom: '下', left: '左' }
const DRAG_SENSITIVITY = 0.45
const DRAG_STEP = 4

export function useImageExpandTool<
  TElement extends ExpandableDrawElement,
  TSnapshot extends EditorSnapshot<TElement>,
>(deps: Deps<TElement, TSnapshot>) {
  const expandDrag = ref<ExpandInsets>({ ...DEFAULT_EXPAND_INSETS })
  const expandColor = ref('#ffffff')
  const expandRatio = ref('自由')
  const expandRatios = IMAGE_EXPAND_RATIOS
  const expandHoverHandle = ref<ExpandHandle | ''>('')
  const hoverCoords = ref<{ x: number; y: number } | null>(null)
  const originWidth = ref(0)
  const originHeight = ref(0)
  let snapshotCanvas: HTMLCanvasElement | null = null
  let sourceCanvas: HTMLCanvasElement | null = null
  let activeHandle: ExpandHandle | '' = ''
  let dragStart = { x: 0, y: 0, ...DEFAULT_EXPAND_INSETS }

  const expandInfo = computed<ExpandPreviewInfo>(() => ({
    width: originWidth.value + expandDrag.value.left + expandDrag.value.right,
    height: originHeight.value + expandDrag.value.top + expandDrag.value.bottom,
    originX: expandDrag.value.left,
    originY: expandDrag.value.top,
    sourceWidth: originWidth.value,
    sourceHeight: originHeight.value,
    hasPending: Object.values(expandDrag.value).some((value) => value > 0),
  }))
  const isExpandReady = computed(() => originWidth.value > 0 && originHeight.value > 0)
  const canApplyExpand = computed(() => expandInfo.value.hasPending)
  const expandCursor = computed(() => resolveHandleCursor(activeHandle || expandHoverHandle.value))
  const expandSummary = computed(() =>
    (Object.entries(expandDrag.value) as Array<[ExpandSide, number]>)
      .filter(([, value]) => value > 0)
      .map(([side, value]) => `${SIDE_LABELS[side]} ${value}px`)
      .join(' · ')
  )

  function clearExpandState() {
    snapshotCanvas = null
    sourceCanvas = null
    activeHandle = ''
    expandHoverHandle.value = ''
    hoverCoords.value = null
  }

  function ensureSnapshot(): boolean {
    if (snapshotCanvas && sourceCanvas) return true
    const canvas = deps.editCanvasRef.value
    if (!canvas) return false
    if (canvas.width <= 0 || canvas.height <= 0) return false
    originWidth.value = canvas.width
    originHeight.value = canvas.height
    snapshotCanvas = document.createElement('canvas')
    snapshotCanvas.width = originWidth.value
    snapshotCanvas.height = originHeight.value
    snapshotCanvas.getContext('2d')?.drawImage(canvas, 0, 0)
    sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = originWidth.value
    sourceCanvas.height = originHeight.value
    sourceCanvas.getContext('2d')?.drawImage(canvas, 0, 0)
    return true
  }

  function restoreExpandSnapshot() {
    if (!snapshotCanvas) return
    const canvas = deps.editCanvasRef.value
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = originWidth.value
    canvas.height = originHeight.value
    ctx.clearRect(0, 0, originWidth.value, originHeight.value)
    ctx.drawImage(snapshotCanvas, 0, 0)
    deps.editImageInfo.value = { width: originWidth.value, height: originHeight.value }
    deps.syncAllLayers()
  }

  function setExpandInset(side: ExpandSide, value: number) {
    expandDrag.value = { ...expandDrag.value, [side]: Math.max(0, Math.round(value || 0)) }
    renderExpandOverlay()
  }

  function setExpandRatio(option: ExpandRatioOption) {
    expandRatio.value = option.label
    if (!ensureSnapshot() || option.w <= 0 || option.h <= 0) return renderExpandOverlay()
    const currentRatio = originWidth.value / originHeight.value
    const targetRatio = option.w / option.h
    if (Math.abs(currentRatio - targetRatio) < 0.001) expandDrag.value = { ...DEFAULT_EXPAND_INSETS }
    else if (currentRatio < targetRatio) {
      const targetWidth = Math.ceil(originHeight.value * targetRatio)
      const extra = Math.max(0, targetWidth - originWidth.value)
      expandDrag.value = { top: 0, bottom: 0, left: Math.floor(extra / 2), right: Math.ceil(extra / 2) }
    } else {
      const targetHeight = Math.ceil(originWidth.value / targetRatio)
      const extra = Math.max(0, targetHeight - originHeight.value)
      expandDrag.value = { top: Math.floor(extra / 2), bottom: Math.ceil(extra / 2), left: 0, right: 0 }
    }
    renderExpandOverlay()
  }

  function renderExpandOverlay() {
    if (!ensureSnapshot() || !sourceCanvas) return
    const canvas = deps.editCanvasRef.value
    const overlay = deps.overlayCanvasRef.value
    const ctx = canvas?.getContext('2d')
    const overlayCtx = overlay?.getContext('2d')
    if (!canvas || !overlay || !ctx || !overlayCtx) return
    const info = expandInfo.value
    canvas.width = info.width
    canvas.height = info.height
    drawCheckerboard(ctx, info.width, info.height)
    ctx.fillStyle = `${expandColor.value}22`
    ctx.fillRect(0, 0, info.width, info.height)
    ctx.drawImage(sourceCanvas, info.originX, info.originY)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(info.originX + 0.75, info.originY + 0.75, originWidth.value - 1.5, originHeight.value - 1.5)
    deps.syncDrawLayerSize()
    deps.renderDrawLayer()
    shiftDrawLayerBitmap(deps.drawLayerRef.value, info.originX, info.originY)
    deps.syncCursorLayerSize()
    overlay.width = info.width
    overlay.height = info.height
    deps.editImageInfo.value = { width: info.width, height: info.height }
    overlayCtx.clearRect(0, 0, info.width, info.height)
    drawExpandMask(overlayCtx, info)
    drawExpandHandles(overlayCtx, info, hoverCoords.value, activeHandle || expandHoverHandle.value)
  }

  function handleExpandMouseDown(coords: { x: number; y: number }) {
    if (!ensureSnapshot()) return
    hoverCoords.value = coords
    const hit = findHandleAt(coords, expandInfo.value, hoverCoords.value, activeHandle || expandHoverHandle.value)
    if (!hit) return
    activeHandle = hit.id
    expandHoverHandle.value = hit.id
    dragStart = { x: coords.x, y: coords.y, ...expandDrag.value }
  }

  function handleExpandMouseMove(event: MouseEvent) {
    const { x, y } = deps.getCanvasCoords(event)
    hoverCoords.value = { x, y }
    if (!activeHandle) {
      expandHoverHandle.value = findHandleAt({ x, y }, expandInfo.value, hoverCoords.value, activeHandle || expandHoverHandle.value)?.id ?? ''
      deps.renderDrawLayer()
      renderExpandOverlay()
      return
    }
    const dx = scaleDragDistance(x - dragStart.x)
    const dy = scaleDragDistance(y - dragStart.y)
    const next = { ...dragStart }
    if (activeHandle.includes('top')) next.top = Math.max(0, dragStart.top - dy)
    if (activeHandle.includes('bottom')) next.bottom = Math.max(0, dragStart.bottom + dy)
    if (activeHandle.includes('left')) next.left = Math.max(0, dragStart.left - dx)
    if (activeHandle.includes('right')) next.right = Math.max(0, dragStart.right + dx)
    expandDrag.value = next
    renderExpandOverlay()
  }

  function stopExpandDrag() {
    activeHandle = ''
  }

  function clearExpandHover() {
    expandHoverHandle.value = ''
    hoverCoords.value = null
  }

  function resetExpandDrag() {
    expandDrag.value = { ...DEFAULT_EXPAND_INSETS }
    renderExpandOverlay()
  }

  function deactivateExpandPreview() {
    restoreExpandSnapshot()
    expandDrag.value = { ...DEFAULT_EXPAND_INSETS }
    clearExpandState()
  }

  function applyExpand() {
    const ctx = snapshotCanvas?.getContext('2d')
    if (!snapshotCanvas || !ctx || !expandInfo.value.hasPending) return
    deps.pushHistorySnapshot(
      deps.createHistorySnapshot(
        ctx.getImageData(0, 0, originWidth.value, originHeight.value),
        originWidth.value,
        originHeight.value,
      ),
    )
    deps.clearFutureHistory()
    deps.drawElements.value.forEach((element) => {
      element.offsetX += expandInfo.value.originX
      element.offsetY += expandInfo.value.originY
    })
    clearExpandState()
    expandDrag.value = { ...DEFAULT_EXPAND_INSETS }
    deps.syncAllLayers()
    deps.markDirty()
    deps.notifyApplied()
  }

  return { expandDrag, expandColor, expandRatio, expandRatios, expandInfo, expandSummary, canApplyExpand, isExpandReady, expandCursor, setExpandInset, setExpandRatio, clearExpandState, restoreExpandSnapshot, renderExpandOverlay, handleExpandMouseDown, handleExpandMouseMove, stopExpandDrag, clearExpandHover, resetExpandDrag, deactivateExpandPreview, applyExpand }
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const size = 24
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = ((x / size) + (y / size)) % 2 === 0 ? '#1b1b1d' : '#232326'
      ctx.fillRect(x, y, size, size)
    }
  }
}

function shiftDrawLayerBitmap(target: HTMLCanvasElement | null, offsetX: number, offsetY: number) {
  const drawCanvas = document.createElement('canvas')
  if (!target || (!offsetX && !offsetY)) return
  drawCanvas.width = target.width
  drawCanvas.height = target.height
  drawCanvas.getContext('2d')?.drawImage(target, 0, 0)
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(drawCanvas, offsetX, offsetY)
}

function drawExpandMask(ctx: CanvasRenderingContext2D, info: ExpandPreviewInfo) {
  const rightStart = info.originX + info.sourceWidth
  const bottomStart = info.originY + info.sourceHeight
  const ratioText = formatRatioText(info.width, info.height)
  ctx.fillStyle = 'rgba(99,102,241,0.14)'
  if (info.originY > 0) ctx.fillRect(0, 0, info.width, info.originY)
  if (info.originX > 0) ctx.fillRect(0, 0, info.originX, info.height)
  if (rightStart < info.width) ctx.fillRect(rightStart, 0, info.width - rightStart, info.height)
  if (bottomStart < info.height) ctx.fillRect(0, bottomStart, info.width, info.height - bottomStart)
  drawRatioBadge(ctx, ratioText)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '600 11px sans-serif'
  if (info.originY > 0) drawInsetLabel(ctx, `上 +${info.originY}px`, info.width / 2, Math.max(20, info.originY / 2), 'center')
  if (rightStart < info.width) drawInsetLabel(ctx, `右 +${info.width - rightStart}px`, info.width - 14, Math.max(34, info.height / 2), 'right')
  if (bottomStart < info.height) drawInsetLabel(ctx, `下 +${info.height - bottomStart}px`, info.width / 2, info.height - 14, 'center')
  if (info.originX > 0) drawInsetLabel(ctx, `左 +${info.originX}px`, 14, Math.max(34, info.height / 2), 'left')
}

function drawExpandHandles(
  ctx: CanvasRenderingContext2D,
  info: ExpandPreviewInfo,
  pointer: { x: number; y: number } | null,
  focusHandle: ExpandHandle | '',
) {
  buildHandles(info, pointer, focusHandle).forEach((handle) => {
    ctx.fillStyle = 'rgba(99,102,241,1)'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 8
    ctx.fillRect(handle.x, handle.y, handle.w, handle.h)
    ctx.strokeRect(handle.x, handle.y, handle.w, handle.h)
    ctx.shadowBlur = 0
    drawHandleGlyph(ctx, handle)
  })
}

function buildHandles(
  info: ExpandPreviewInfo,
  pointer: { x: number; y: number } | null = null,
  focusHandle: ExpandHandle | '' = '',
) {
  const edge = 14
  const corner = 20
  const topCenterX = resolveEdgeCenter(pointer?.x, info.width / 2, 38, info.width - 38, focusHandle === 'top')
  const bottomCenterX = resolveEdgeCenter(pointer?.x, info.width / 2, 38, info.width - 38, focusHandle === 'bottom')
  const leftCenterY = resolveEdgeCenter(pointer?.y, info.height / 2, 38, info.height - 38, focusHandle === 'left')
  const rightCenterY = resolveEdgeCenter(pointer?.y, info.height / 2, 38, info.height - 38, focusHandle === 'right')
  return [
    { id: 'top' as ExpandHandle, x: topCenterX - 34, y: 4, w: 68, h: edge },
    { id: 'bottom' as ExpandHandle, x: bottomCenterX - 34, y: info.height - edge - 4, w: 68, h: edge },
    { id: 'left' as ExpandHandle, x: 4, y: leftCenterY - 34, w: edge, h: 68 },
    { id: 'right' as ExpandHandle, x: info.width - edge - 4, y: rightCenterY - 34, w: edge, h: 68 },
    { id: 'top-left' as ExpandHandle, x: 4, y: 4, w: corner, h: corner },
    { id: 'top-right' as ExpandHandle, x: info.width - corner - 4, y: 4, w: corner, h: corner },
    { id: 'bottom-left' as ExpandHandle, x: 4, y: info.height - corner - 4, w: corner, h: corner },
    { id: 'bottom-right' as ExpandHandle, x: info.width - corner - 4, y: info.height - corner - 4, w: corner, h: corner },
  ]
}

function hitHandle(coords: { x: number; y: number }, handle: { x: number; y: number; w: number; h: number }) {
  return coords.x >= handle.x && coords.x <= handle.x + handle.w && coords.y >= handle.y && coords.y <= handle.y + handle.h
}

function findHandleAt(
  coords: { x: number; y: number },
  info: ExpandPreviewInfo,
  pointer: { x: number; y: number } | null,
  focusHandle: ExpandHandle | '',
) {
  return buildHandles(info, pointer, focusHandle).find((handle) => hitHandle(coords, handle))
}

function scaleDragDistance(distance: number) {
  const scaled = distance * DRAG_SENSITIVITY
  if (Math.abs(scaled) < DRAG_STEP) return 0
  return Math.round(scaled / DRAG_STEP) * DRAG_STEP
}

function resolveEdgeCenter(
  pointerValue: number | undefined,
  fallback: number,
  min: number,
  max: number,
  enabled: boolean,
) {
  if (!enabled || pointerValue == null) return fallback
  return Math.max(min, Math.min(max, pointerValue))
}

function drawHandleGlyph(
  ctx: CanvasRenderingContext2D,
  handle: { id: ExpandHandle; x: number; y: number; w: number; h: number },
) {
  const cx = handle.x + handle.w / 2
  const cy = handle.y + handle.h / 2
  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  if (handle.id === 'top' || handle.id === 'bottom') drawArrowGlyph(ctx, cx, cy, handle.id === 'top' ? 0 : Math.PI)
  if (handle.id === 'left' || handle.id === 'right') drawArrowGlyph(ctx, cx, cy, handle.id === 'left' ? -Math.PI / 2 : Math.PI / 2)
  if (handle.id === 'top-left') drawCornerGlyph(ctx, cx, cy, -1, -1)
  if (handle.id === 'top-right') drawCornerGlyph(ctx, cx, cy, 1, -1)
  if (handle.id === 'bottom-left') drawCornerGlyph(ctx, cx, cy, -1, 1)
  if (handle.id === 'bottom-right') drawCornerGlyph(ctx, cx, cy, 1, 1)
  ctx.restore()
}

function drawArrowGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.beginPath()
  ctx.moveTo(-6, 4)
  ctx.lineTo(0, -4)
  ctx.lineTo(6, 4)
  ctx.stroke()
  ctx.restore()
}

function drawCornerGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, dirX: number, dirY: number) {
  ctx.beginPath()
  ctx.moveTo(x - dirX * 4, y)
  ctx.lineTo(x + dirX * 4, y)
  ctx.lineTo(x + dirX * 4, y + dirY * 4)
  ctx.stroke()
}

function resolveHandleCursor(handle: ExpandHandle | '') {
  if (handle === 'top' || handle === 'bottom') return 'ns-resize'
  if (handle === 'left' || handle === 'right') return 'ew-resize'
  if (handle === 'top-left' || handle === 'bottom-right') return 'nwse-resize'
  if (handle === 'top-right' || handle === 'bottom-left') return 'nesw-resize'
  return 'default'
}

function drawInsetLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
) {
  ctx.save()
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  const width = ctx.measureText(text).width + 12
  const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x
  ctx.fillStyle = 'rgba(24,24,27,0.8)'
  ctx.fillRect(left, y - 10, width, 20)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawRatioBadge(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save()
  ctx.font = '600 11px sans-serif'
  ctx.textBaseline = 'middle'
  const width = ctx.measureText(text).width + 16
  ctx.fillStyle = 'rgba(24,24,27,0.82)'
  ctx.fillRect(12, 12, width, 24)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, 20, 24)
  ctx.restore()
}

function formatRatioText(width: number, height: number) {
  const divisor = gcd(width, height)
  return `当前比例 ${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

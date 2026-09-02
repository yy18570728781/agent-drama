import { ref, nextTick, type Ref } from 'vue'

/** 角点类型：tl=左上 tr=右上 bl=左下 br=右下 */
export type TextBoxCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface TextBoxState {
  visible: boolean
  x: number
  y: number
  value: string
  canvasX: number
  canvasY: number
  fontSize: number
  width: number
  height: number
  backgroundColor: string
  color: string
  editingElementId: string | null
}

interface UseTextBoxOverlayDeps {
  textInput: Ref<TextBoxState>
  textInputRef: Ref<HTMLElement | null>
  editCanvasRef: Ref<HTMLCanvasElement | null>
  canvasZoom: Ref<number>
}

interface ResizeDragSnapshot {
  mouseX: number
  mouseY: number
  startWidth: number
  startX: number
  startCanvasX: number
  startFontSize: number
}

interface MoveDragSnapshot {
  mouseX: number
  mouseY: number
  startX: number
  startY: number
  startCanvasX: number
  startCanvasY: number
}

export interface UseTextBoxOverlayReturn {
  textResizing: Ref<boolean>
  textMoving: Ref<boolean>
  autoFitHeight: () => void
  onCornerPointerDown: (e: PointerEvent, corner: TextBoxCorner) => void
  onEdgePointerDown: (e: PointerEvent) => void
}

const MIN_BOX_WIDTH = 60
const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 120

/** display px -> canvas px（基于 canvas 实际分辨率与 CSS 显示宽度） */
function displayToCanvasPx(px: number, canvas: HTMLCanvasElement | null): number {
  if (!canvas || canvas.clientWidth === 0) return px
  return (px * canvas.width) / canvas.clientWidth
}

/**
 * 文字选框浮层逻辑：高度根据文字内容自适应撑高，
 * 四个角点可拖拽调整宽度（左角点移动左边缘，右角点移动右边缘），
 * 垂直拖拽微调字号使整体缩放更有意义。
 */
export function useTextBoxOverlay(deps: UseTextBoxOverlayDeps): UseTextBoxOverlayReturn {
  const { textInput, textInputRef, editCanvasRef, canvasZoom } = deps
  const textResizing = ref(false)
  const textMoving = ref(false)

  let resizeDrag: ResizeDragSnapshot | null = null
  let moveDrag: MoveDragSnapshot | null = null
  let activeCorner: TextBoxCorner = 'br'

  /** 根据当前文字内容自动撑高文字框（宽度固定，高度跟随内容） */
  function autoFitHeight(): void {
    const ta = textInputRef.value
    if (!ta || !textInput.value.visible) return
    ta.style.height = 'auto'
    const measured = ta.scrollHeight
    ta.style.height = ''
    const minH = Math.ceil(textInput.value.fontSize * 1.4) + 6
    textInput.value.height = Math.max(measured, minH)
  }

  function onCornerPointerDown(e: PointerEvent, corner: TextBoxCorner): void {
    e.preventDefault()
    e.stopPropagation()
    textResizing.value = true
    activeCorner = corner
    resizeDrag = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: textInput.value.width,
      startX: textInput.value.x,
      startCanvasX: textInput.value.canvasX,
      startFontSize: textInput.value.fontSize,
    }
    window.addEventListener('pointermove', onResizePointerMove)
    window.addEventListener('pointerup', onResizePointerUp)
  }

  function onResizePointerMove(e: PointerEvent): void {
    if (!resizeDrag) return
    const zoom = canvasZoom.value || 1
    const dx = (e.clientX - resizeDrag.mouseX) / zoom
    const isLeft = activeCorner === 'tl' || activeCorner === 'bl'

    // 宽度变化
    if (isLeft) {
      const newWidth = Math.max(MIN_BOX_WIDTH, resizeDrag.startWidth - dx)
      const delta = newWidth - resizeDrag.startWidth
      textInput.value.width = newWidth
      textInput.value.x = resizeDrag.startX + delta
      textInput.value.canvasX = resizeDrag.startCanvasX + displayToCanvasPx(delta, editCanvasRef.value)
    } else {
      textInput.value.width = Math.max(MIN_BOX_WIDTH, resizeDrag.startWidth + dx)
    }

    // 拖拽时文字字号随宽度等比缩放，高度由 autoFitHeight 自适应
    const fontSizeScale = textInput.value.width / resizeDrag.startWidth
    textInput.value.fontSize = Math.max(
      MIN_FONT_SIZE,
      Math.min(MAX_FONT_SIZE, Math.round(resizeDrag.startFontSize * fontSizeScale)),
    )

    nextTick(autoFitHeight)
  }

  function onResizePointerUp(): void {
    resizeDrag = null
    textResizing.value = false
    window.removeEventListener('pointermove', onResizePointerMove)
    window.removeEventListener('pointerup', onResizePointerUp)
  }

  /** 从边框拖拽移动整个文字框 */
  function onEdgePointerDown(e: PointerEvent): void {
    e.preventDefault()
    e.stopPropagation()
    textMoving.value = true
    moveDrag = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: textInput.value.x,
      startY: textInput.value.y,
      startCanvasX: textInput.value.canvasX,
      startCanvasY: textInput.value.canvasY,
    }
    window.addEventListener('pointermove', onMovePointerMove)
    window.addEventListener('pointerup', onMovePointerUp)
  }

  function onMovePointerMove(e: PointerEvent): void {
    if (!moveDrag) return
    const zoom = canvasZoom.value || 1
    const displayDx = (e.clientX - moveDrag.mouseX) / zoom
    const displayDy = (e.clientY - moveDrag.mouseY) / zoom
    const canvas = editCanvasRef.value
    const sx = canvas && canvas.clientWidth > 0 ? canvas.clientWidth / canvas.width : 1
    const sy = canvas && canvas.clientHeight > 0 ? canvas.clientHeight / canvas.height : 1

    textInput.value.x = moveDrag.startX + displayDx
    textInput.value.y = moveDrag.startY + displayDy
    textInput.value.canvasX = moveDrag.startCanvasX + (sx !== 0 ? displayDx / sx : 0)
    textInput.value.canvasY = moveDrag.startCanvasY + (sy !== 0 ? displayDy / sy : 0)
  }

  function onMovePointerUp(): void {
    moveDrag = null
    textMoving.value = false
    window.removeEventListener('pointermove', onMovePointerMove)
    window.removeEventListener('pointerup', onMovePointerUp)
  }

  return { textResizing, textMoving, autoFitHeight, onCornerPointerDown, onEdgePointerDown }
}

import { computed, ref, type Ref } from 'vue'
import {
  MAX_SPLIT_DIMENSION,
  MIN_SPLIT_GAP,
  SPLIT_MODES,
  createEvenSplitConfig,
  type SplitConfig,
  type SplitMode,
} from '@/composables/flow/useImageSplit'

type CanvasRef = Ref<HTMLCanvasElement | null>

export interface SplitUploadProgress {
  active: boolean
  completed: number
  total: number
  percent: number
  message: string
}

export interface SplitResultPayload {
  mode: { rows: number; cols: number }
  pieces: { url: string; blob: Blob; index?: number }[]
  onProgress?: (completed: number, total: number) => void
  onSettled?: () => void
}

export interface UseSplitToolDeps {
  editCanvasRef: CanvasRef
  drawLayerRef: CanvasRef
  overlayCanvasRef: CanvasRef
  getCanvasCoords: (e: { clientX: number; clientY: number }) => { x: number; y: number }
  emitSplitResult: (payload: SplitResultPayload) => void
}

type SplitLineAxis = 'row' | 'col'
interface SplitLineId { axis: SplitLineAxis; index: number }

/** 命中带半宽（画布坐标系像素），与 handle 圆点半径一致 */
const HIT_HALF = 6

function emptyProgress(): SplitUploadProgress {
  return { active: false, completed: 0, total: 0, percent: 0, message: '' }
}

function resolveLineCursor(axis: SplitLineAxis): string {
  return axis === 'row' ? 'ns-resize' : 'ew-resize'
}

/**
 * 宫格拆分工具：支持预设模式、自定义行列数、拖拽分割线做非等距微调。
 * 切割结果以 splitResult 事件抛出，下游按等距网格展示（方案A）。
 */
export function useSplitTool(deps: UseSplitToolDeps) {
  const splitConfig = ref<SplitConfig | null>(null)
  const splitting = ref(false)
  const splitUploadProgress = ref<SplitUploadProgress>(emptyProgress())
  const customRows = ref(2)
  const customCols = ref(2)
  const splitHoverLine = ref('')
  let activeLine: SplitLineId | null = null

  const splitCursor = computed(() => {
    if (activeLine) return resolveLineCursor(activeLine.axis)
    if (splitHoverLine.value.startsWith('row')) return 'ns-resize'
    if (splitHoverLine.value.startsWith('col')) return 'ew-resize'
    return 'default'
  })

  function applyConfig(config: SplitConfig | null): void {
    splitConfig.value = config
    renderSplitOverlay()
  }

  function clampDimension(value: number): number {
    return Math.max(1, Math.min(MAX_SPLIT_DIMENSION, Math.round(value) || 1))
  }

  /** 选择预设模式：同步自定义输入框并生成等距线位 */
  function setSplitMode(mode: SplitMode): void {
    const canvas = deps.editCanvasRef.value
    if (!canvas) return
    customRows.value = mode.rows
    customCols.value = mode.cols
    applyConfig(createEvenSplitConfig(canvas.width, canvas.height, mode.rows, mode.cols))
  }

  /** 应用自定义行列数：clamp 后生成等距线位 */
  function applyCustomSplitMode(): void {
    const canvas = deps.editCanvasRef.value
    if (!canvas) return
    const rows = clampDimension(customRows.value)
    const cols = clampDimension(customCols.value)
    customRows.value = rows
    customCols.value = cols
    applyConfig(createEvenSplitConfig(canvas.width, canvas.height, rows, cols))
  }

  function applyCustomRows(value: number): void {
    customRows.value = clampDimension(value)
    applyCustomSplitMode()
  }

  function applyCustomCols(value: number): void {
    customCols.value = clampDimension(value)
    applyCustomSplitMode()
  }

  function renderSplitOverlay(): void {
    const overlay = deps.overlayCanvasRef.value
    const config = splitConfig.value
    if (!overlay) return
    const ctx = overlay.getContext('2d')!
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    if (!config || (config.rows < 2 && config.cols < 2)) return
    ctx.strokeStyle = 'rgba(16,185,129,0.8)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    for (const y of config.rowLines) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(overlay.width, y); ctx.stroke()
    }
    for (const x of config.colLines) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, overlay.height); ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.fillStyle = '#10b981'
    for (const y of config.rowLines) {
      ctx.beginPath(); ctx.arc(overlay.width / 2, y, HIT_HALF, 0, Math.PI * 2); ctx.fill()
    }
    for (const x of config.colLines) {
      ctx.beginPath(); ctx.arc(x, overlay.height / 2, HIT_HALF, 0, Math.PI * 2); ctx.fill()
    }
  }

  function hitLineAt(coords: { x: number; y: number }): SplitLineId | null {
    const config = splitConfig.value
    if (!config) return null
    for (let i = 0; i < config.rowLines.length; i++) {
      if (coords.x >= 0 && coords.x <= config.width && Math.abs(coords.y - config.rowLines[i]) <= HIT_HALF) {
        return { axis: 'row', index: i }
      }
    }
    for (let i = 0; i < config.colLines.length; i++) {
      if (coords.y >= 0 && coords.y <= config.height && Math.abs(coords.x - config.colLines[i]) <= HIT_HALF) {
        return { axis: 'col', index: i }
      }
    }
    return null
  }

  /** clamp 线位防交叉：相邻线/边界之间至少留 MIN_SPLIT_GAP */
  function clampLineValue(axis: SplitLineAxis, index: number, value: number): number {
    const config = splitConfig.value
    if (!config) return value
    if (axis === 'row') {
      const lower = (index === 0 ? 0 : config.rowLines[index - 1]) + MIN_SPLIT_GAP
      const upper = (index === config.rowLines.length - 1 ? config.height : config.rowLines[index + 1]) - MIN_SPLIT_GAP
      return Math.max(lower, Math.min(upper, Math.round(value)))
    }
    const lower = (index === 0 ? 0 : config.colLines[index - 1]) + MIN_SPLIT_GAP
    const upper = (index === config.colLines.length - 1 ? config.width : config.colLines[index + 1]) - MIN_SPLIT_GAP
    return Math.max(lower, Math.min(upper, Math.round(value)))
  }

  function handleSplitMouseDown(coords: { x: number; y: number }): void {
    activeLine = hitLineAt(coords)
  }

  function handleSplitMouseMove(e: { clientX: number; clientY: number }): void {
    const config = splitConfig.value
    if (!config) return
    const coords = deps.getCanvasCoords(e)
    if (activeLine) {
      const { axis, index } = activeLine
      const next = clampLineValue(axis, index, axis === 'row' ? coords.y : coords.x)
      if (axis === 'row') config.rowLines[index] = next
      else config.colLines[index] = next
      renderSplitOverlay()
      return
    }
    const hit = hitLineAt(coords)
    splitHoverLine.value = hit ? `${hit.axis}-${hit.index}` : ''
  }

  function stopSplitDrag(): void {
    activeLine = null
  }

  function resetSplitState(): void {
    splitConfig.value = null
    activeLine = null
    splitHoverLine.value = ''
    splitting.value = false
    splitUploadProgress.value = emptyProgress()
  }

  function applySplit(): void {
    const bgCanvas = deps.editCanvasRef.value
    const drawCanvas = deps.drawLayerRef.value
    const config = splitConfig.value
    if (!bgCanvas || !config || splitting.value) return
    splitting.value = true
    const offscreen = document.createElement('canvas')
    offscreen.width = bgCanvas.width
    offscreen.height = bgCanvas.height
    const octx = offscreen.getContext('2d')!
    octx.drawImage(bgCanvas, 0, 0)
    if (drawCanvas) octx.drawImage(drawCanvas, 0, 0)
    const rowBounds = [0, ...config.rowLines, config.height]
    const colBounds = [0, ...config.colLines, config.width]
    const { rows, cols } = config
    const pieces: { blob: Blob; url: string; row: number; col: number }[] = []
    let pending = rows * cols
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cropTile(offscreen, colBounds[c], rowBounds[r], colBounds[c + 1] - colBounds[c], rowBounds[r + 1] - rowBounds[r], pieces, r, c, () => {
          pending--
          if (pending === 0) finishSplit()
        })
      }
    }

    function finishSplit(): void {
      pieces.sort((a, b) => a.row * cols + a.col - b.row * cols - b.col)
      splitting.value = false
      splitUploadProgress.value = {
        active: true, completed: 0, total: pieces.length, percent: 0,
        message: pieces.length > 0 ? `正在上传拆分图片 0/${pieces.length}（0%）` : '正在上传拆分图片',
      }
      deps.emitSplitResult({
        mode: { rows, cols },
        pieces: pieces.map((p) => ({ url: p.url, blob: p.blob })),
        onProgress: (completed, total) => {
          const percent = Math.round((completed / Math.max(1, total)) * 100)
          splitUploadProgress.value = {
            active: true, completed, total, percent,
            message: `正在上传拆分图片 ${completed}/${total}（${percent}%）`,
          }
        },
        onSettled: () => { splitUploadProgress.value = emptyProgress() },
      })
    }
  }

  return {
    splitConfig, splitting, splitUploadProgress,
    customRows, customCols, splitHoverLine, splitCursor,
    maxDimension: MAX_SPLIT_DIMENSION,
    SPLIT_MODES,
    setSplitMode, applyCustomSplitMode, applyCustomRows, applyCustomCols,
    renderSplitOverlay, handleSplitMouseDown, handleSplitMouseMove,
    stopSplitDrag, applySplit, resetSplitState,
  }
}

/** 切割单块到 blob，完成后回调递减计数 */
function cropTile(
  source: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  pieces: { blob: Blob; url: string; row: number; col: number }[],
  row: number, col: number,
  onDone: () => void,
): void {
  const tile = document.createElement('canvas')
  tile.width = Math.round(sw)
  tile.height = Math.round(sh)
  const ctx = tile.getContext('2d')!
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, tile.width, tile.height)
  tile.toBlob((blob) => {
    if (blob) pieces.push({ blob, url: URL.createObjectURL(blob), row, col })
    onDone()
  }, 'image/png')
}

export type UseSplitToolReturn = ReturnType<typeof useSplitTool>

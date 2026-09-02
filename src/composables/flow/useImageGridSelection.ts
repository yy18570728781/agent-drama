import { computed, ref, type ComputedRef, type Ref } from 'vue'

export interface GridSelectionPiece {
  blob: Blob
  url: string
  index: number
}

export interface GridSelectionResult {
  mode: { rows: number; cols: number }
  pieces: GridSelectionPiece[]
  sourceImageSize: { width: number; height: number }
}

export interface UseImageGridSelectionReturn {
  rows: Ref<number>
  cols: Ref<number>
  selectedIndices: Ref<Set<number>>
  selectedCount: ComputedRef<number>
  totalCells: ComputedRef<number>
  configure: (rows: number, cols: number) => void
  toggleCell: (index: number) => void
  selectAll: () => void
  clearSelection: () => void
  cropSelection: (imageUrl: string) => Promise<GridSelectionResult>
}

const MIN_GRID_SIZE = 1
const MAX_GRID_SIZE = 5

function clampGridSize(value: number): number {
  return Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, Math.round(value)))
}

function isCrossOriginHttpUrl(imageUrl: string): boolean {
  try {
    const parsed = new URL(imageUrl, window.location.href)
    return ['http:', 'https:'].includes(parsed.protocol)
      && parsed.origin !== window.location.origin
  } catch {
    return false
  }
}

function loadImageOnce(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('原图加载失败，无法执行宫格切分'))
    image.src = imageUrl
  })
}

async function loadSourceImage(imageUrl: string): Promise<HTMLImageElement> {
  try {
    return await loadImageOnce(imageUrl)
  } catch (error) {
    if (!isCrossOriginHttpUrl(imageUrl)) throw error
    const proxyUrl = `/__image-proxy?url=${encodeURIComponent(imageUrl)}`
    return loadImageOnce(proxyUrl)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('宫格图片编码失败'))
    }, 'image/png')
  })
}

async function cropCell(
  image: HTMLImageElement,
  rows: number,
  cols: number,
  index: number,
): Promise<GridSelectionPiece> {
  const row = Math.floor(index / cols)
  const col = index % cols
  const left = Math.round((image.naturalWidth * col) / cols)
  const top = Math.round((image.naturalHeight * row) / rows)
  const right = Math.round((image.naturalWidth * (col + 1)) / cols)
  const bottom = Math.round((image.naturalHeight * (row + 1)) / rows)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, right - left)
  canvas.height = Math.max(1, bottom - top)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器不支持图片裁切')
  context.drawImage(
    image,
    left,
    top,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  const blob = await canvasToBlob(canvas)
  return { blob, url: URL.createObjectURL(blob), index }
}

/**
 * 管理图片宫格选区，并按原图像素裁切选中的格子。
 *
 * @returns 宫格配置、选区状态和裁切方法。
 * @throws 图片加载、Canvas 绘制或 PNG 编码失败时抛出错误。
 */
export function useImageGridSelection(): UseImageGridSelectionReturn {
  const rows = ref(2)
  const cols = ref(2)
  const selectedIndices = ref<Set<number>>(new Set())
  const totalCells = computed(() => rows.value * cols.value)
  const selectedCount = computed(() => selectedIndices.value.size)

  function configure(nextRows: number, nextCols: number): void {
    rows.value = clampGridSize(nextRows)
    cols.value = clampGridSize(nextCols)
    selectedIndices.value = new Set()
  }

  function toggleCell(index: number): void {
    const next = new Set(selectedIndices.value)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    selectedIndices.value = next
  }

  function selectAll(): void {
    selectedIndices.value = new Set(Array.from({ length: totalCells.value }, (_, index) => index))
  }

  function clearSelection(): void {
    selectedIndices.value = new Set()
  }

  async function cropSelection(imageUrl: string): Promise<GridSelectionResult> {
    const image = await loadSourceImage(imageUrl)
    const indices = [...selectedIndices.value].sort((a, b) => a - b)
    const pieces = await Promise.all(
      indices.map((index) => cropCell(image, rows.value, cols.value, index)),
    )
    return {
      mode: { rows: rows.value, cols: cols.value },
      pieces,
      sourceImageSize: {
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
    }
  }

  return {
    rows,
    cols,
    selectedIndices,
    selectedCount,
    totalCells,
    configure,
    toggleCell,
    selectAll,
    clearSelection,
    cropSelection,
  }
}

import { type Ref } from 'vue'
import { createFlowId } from '@/utils/flowId'

/** 自定义拆分行列上限，与 8×8 阵列对齐 */
export const MAX_SPLIT_DIMENSION = 8
/** 拆分线之间最小间距（像素），避免零宽切片 */
export const MIN_SPLIT_GAP = 8

/**
 * 拆分配置：支持非等距线位。
 * rowLines 长度为 rows-1，colLines 长度为 cols-1，均为像素坐标升序。
 * 首尾边界固定为 0 与 width/height，拖拽线位仅改变中间值。
 */
export interface SplitConfig {
  rows: number
  cols: number
  rowLines: number[]
  colLines: number[]
  width: number
  height: number
}

export interface SplitMode {
  key: string
  rows: number
  cols: number
  label: string
}

export const SPLIT_MODES: SplitMode[] = [
  { key: '2x2', rows: 2, cols: 2, label: '2×2' },
  { key: '2x3', rows: 2, cols: 3, label: '2×3' },
  { key: '3x2', rows: 3, cols: 2, label: '3×2' },
  { key: '3x3', rows: 3, cols: 3, label: '3×3' },
  { key: '3x4', rows: 3, cols: 4, label: '3×4' },
  { key: '4x3', rows: 4, cols: 3, label: '4×3' },
  { key: '4x4', rows: 4, cols: 4, label: '4×4' },
]

/**
 * 生成等距拆分线位配置。
 * 由预设模式或自定义行列数调用，得到初始均匀分布的线位，
 * 用户随后可在编辑器中拖动线位做非等距微调。
 */
export function createEvenSplitConfig(
  width: number,
  height: number,
  rows: number,
  cols: number,
): SplitConfig {
  const rowLines: number[] = []
  for (let i = 1; i < rows; i++) rowLines.push(Math.round((height * i) / rows))
  const colLines: number[] = []
  for (let i = 1; i < cols; i++) colLines.push(Math.round((width * i) / cols))
  return { rows, cols, rowLines, colLines, width, height }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function cropToBlob(
  img: HTMLImageElement,
  sx: number, sy: number, sw: number, sh: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sw)
    canvas.height = Math.round(sh)
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('no canvas context')); return }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('toBlob failed'))
    }, 'image/png')
  })
}

export interface SplitDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  emit: { (e: 'update:modelNodes', value: any[]): void }
  findNode: (id: string) => any
  createConnectedAssetNode: (sourceNodeId: string, options: any) => any
  getNodeBoxSize: (node: any, style?: any) => { width: number; height: number }
}

export async function splitImageToNodes(
  imageUrl: string,
  mode: SplitMode,
  sourceNodeId: string | null,
  deps: SplitDeps,
): Promise<string[]> {
  const img = await loadImage(imageUrl)
  const { rows, cols } = mode
  const tileW = img.naturalWidth / cols
  const tileH = img.naturalHeight / rows
  const sourceNode = sourceNodeId ? deps.findNode(sourceNodeId) : null
  const sourceLabel = sourceNode?.data?.label || '图片'
  const sourcePos = sourceNode?.position || { x: 0, y: 0 }
  const sourceSize = sourceNode ? deps.getNodeBoxSize(sourceNode) : { width: 320, height: 180 }
  const nodeW = 160
  const nodeH = Math.round(nodeW / (tileW / tileH))
  const gapX = 20
  const gapY = 20
  const baseX = sourcePos.x + sourceSize.width + 60
  const baseY = sourcePos.y
  const createdIds: string[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = c * tileW
      const sy = r * tileH
      const blob = await cropToBlob(img, sx, sy, tileW, tileH)
      const blobUrl = URL.createObjectURL(blob)
      const idx = r * cols + c + 1
      const padded = String(idx).padStart(2, '0')
      const tileLabel = `${sourceLabel}_拆分_${rows}x${cols}_${padded}`
      const posX = baseX + c * (nodeW + gapX)
      const posY = baseY + r * (nodeH + gapY)

      const created = deps.createConnectedAssetNode(sourceNodeId || '', {
        id: createFlowId('node'),
        label: tileLabel,
        url: blobUrl,
        mediaType: 'image',
        style: { width: `${nodeW}px`, height: `${nodeH}px` },
        position: { x: posX, y: posY },
      })
      if (created?.id) {
        const createdNode = deps.nodes.value.find((n: any) => n.id === created.id)
        if (createdNode?.data) {
          createdNode.data.thumb = blobUrl
          createdNode.data.thumbnail_url = blobUrl
        }
        createdIds.push(created.id)
      }
    }
  }

  deps.emit('update:modelNodes', deps.nodes.value)
  return createdIds
}

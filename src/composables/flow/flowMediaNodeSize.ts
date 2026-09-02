const MAX_MEDIA_WIDTH = 320
const MAX_MEDIA_HEIGHT = 260

type FlowMediaNodeSizeInput = {
  mediaType: string
  width?: number
  height?: number
  aspectRatio?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toPositiveNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

function fitMediaFrame(aspectRatio: number): { width: number; height: number } {
  const ratio = toPositiveNumber(aspectRatio) || 1
  const widthByMaxHeight = MAX_MEDIA_HEIGHT * ratio
  if (widthByMaxHeight <= MAX_MEDIA_WIDTH) {
    return {
      width: Math.max(Math.round(widthByMaxHeight), 1),
      height: MAX_MEDIA_HEIGHT,
    }
  }
  return {
    width: MAX_MEDIA_WIDTH,
    height: Math.max(Math.round(MAX_MEDIA_WIDTH / ratio), 1),
  }
}

function scaleMediaFrame(width: number, height: number): { width: number; height: number } {
  const safeWidth = toPositiveNumber(width) || 1
  const safeHeight = toPositiveNumber(height) || 1
  const scale = Math.min(1, MAX_MEDIA_WIDTH / safeWidth, MAX_MEDIA_HEIGHT / safeHeight)
  return {
    width: Math.max(Math.round(safeWidth * scale), 1),
    height: Math.max(Math.round(safeHeight * scale), 1),
  }
}

/**
 * 为什么这样算：媒体节点主要承担“看内容”而不是“占固定卡片框”，因此优先保留素材宽高比，
 * 同时限制在统一的可视上限里，避免极长图或极高图把画布撑坏。
 */
export function getFlowMediaNodeSize(input: FlowMediaNodeSizeInput): { width: number; height: number; aspectRatio: number } {
  if (input.mediaType === 'audio' || input.mediaType === 'text' || input.mediaType === '3d_model') {
    return { width: 320, height: 180, aspectRatio: 320 / 180 }
  }
  const width = toPositiveNumber(input.width)
  const height = toPositiveNumber(input.height)
  if (width > 0 && height > 0) {
    const scaled = scaleMediaFrame(width, height)
    return {
      width: scaled.width,
      height: scaled.height,
      aspectRatio: width / height,
    }
  }
  const fallback = fitMediaFrame(input.aspectRatio || 1)
  return {
    width: fallback.width,
    height: fallback.height,
    aspectRatio: toPositiveNumber(input.aspectRatio) || fallback.width / fallback.height,
  }
}

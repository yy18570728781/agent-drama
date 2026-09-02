/**
 * texture_material 容器的网格布局纯函数。
 * 容器作为 Vue Flow group 节点，子卡用相对父容器的局部坐标定位。
 * 无副作用，可单测。
 */

export interface TextureGridLayout {
  rows: number
  cols: number
  gap: number
}

const TM_ITEM_SIZE = 100
const TM_HEADER_H = 28
const TM_PADDING = 8
/** 内容区相对容器左/上的内边距（左右各 TM_PADDING，上下另含 header） */
const TM_CONTENT_OFFSET_X = TM_PADDING
const TM_CONTENT_OFFSET_Y = TM_PADDING + TM_HEADER_H

/** 由总数推导行列（最多 4 列），与历史 batch_grid 视觉一致。 */
export function computeLayout(count: number): TextureGridLayout {
  const safeCount = Math.max(count, 1)
  const cols = Math.min(safeCount, 4)
  const rows = Math.ceil(safeCount / cols)
  return { rows, cols, gap: 4 }
}

/** 由子卡数量计算容器外框尺寸（含 header + padding）。 */
export function computeContainerSize(count: number): { width: number; height: number } {
  const { rows, cols, gap } = computeLayout(count)
  const width = cols * TM_ITEM_SIZE + (cols - 1) * gap + TM_PADDING * 2
  const height = rows * TM_ITEM_SIZE + (rows - 1) * gap + TM_PADDING * 2 + TM_HEADER_H
  return { width, height }
}

/**
 * 子卡在父容器内的相对坐标（按扁平索引铺进网格）。
 * Vue Flow 中 parentNode 子节点的 position 即相对父容器的局部坐标。
 */
export function computeChildRelativePosition(
  index: number,
  layout: TextureGridLayout,
): { x: number; y: number } {
  const { rows, cols, gap } = layout
  const safeCols = Math.max(cols, 1)
  const r = Math.floor(index / safeCols)
  const c = index % safeCols
  void rows
  return {
    x: TM_CONTENT_OFFSET_X + c * (TM_ITEM_SIZE + gap),
    y: TM_CONTENT_OFFSET_Y + r * (TM_ITEM_SIZE + gap),
  }
}

export const TEXTURE_MATERIAL_CONSTANTS = {
  ITEM_SIZE: TM_ITEM_SIZE,
  HEADER_H: TM_HEADER_H,
  PADDING: TM_PADDING,
} as const

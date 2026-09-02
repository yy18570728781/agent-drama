// src/utils/gridGridLayout.ts

export type GroupLayoutMode = 'free' | 'grid'

export interface GridSplitMeta {
  rows: number
  cols: number
  gap: number
  cellWidth: number
  cellHeight: number
  splitSource?: string
  batchGenNodeId?: string
  siblingGroupId?: string
  role?: 'split-input' | 'split-output' | 'plain-grid'
}

export interface GridCellPos {
  x: number
  y: number
}

export const GRID_DEFAULT_GAP = 4

/** 行优先格位索引 → 相对组左上角的坐标 */
export function gridCellPosition(
  index: number,
  cols: number,
  cellWidth: number,
  cellHeight: number,
  gap: number,
  padLeft: number,
  padTop: number,
): GridCellPos {
  const row = Math.floor(index / Math.max(cols, 1))
  const col = index % Math.max(cols, 1)
  return {
    x: padLeft + col * (cellWidth + gap),
    y: padTop + row * (cellHeight + gap),
  }
}

/** 给定 rows/cols/cell/gap/padding → 组内宽高 */
export function gridGroupSize(
  rows: number,
  cols: number,
  cellWidth: number,
  cellHeight: number,
  gap: number,
  padX: number,
  padTop: number,
  padBottom: number,
): { width: number; height: number } {
  const width = padX * 2 + Math.max(cols, 1) * cellWidth + (Math.max(cols, 1) - 1) * gap
  const height = padTop + padBottom + Math.max(rows, 1) * cellHeight + (Math.max(rows, 1) - 1) * gap
  return { width, height }
}

/** 根据子节点数 N 推 cols/rows（手动切 grid 模式用） */
export function inferGridShape(count: number): { rows: number; cols: number } {
  const n = Math.max(count, 1)
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { rows, cols }
}

/** 在 gridOrder 里交换两个 id 的位置 */
export function swapGridOrder(gridOrder: string[], idA: string, idB: string): string[] {
  const next = [...gridOrder]
  const iA = next.indexOf(idA)
  const iB = next.indexOf(idB)
  if (iA < 0 || iB < 0) return next
  next[iA] = idB
  next[iB] = idA
  return next
}

/** 把一个 id 插入到 targetIndex 位置，原位置置空（插入语义：被挤的顺延到下一空格） */
export function insertGridOrder(
  gridOrder: string[],
  id: string,
  targetIndex: number,
): string[] {
  const next = [...gridOrder]
  const fromIndex = next.indexOf(id)
  // 外部新进入：targetIndex 处若被占，顺延到下一空格
  if (fromIndex < 0) {
    if (targetIndex >= next.length) next.push(id)
    else if (next[targetIndex] === '' || next[targetIndex] == null) next[targetIndex] = id
    else {
      // 找下一个空格
      let empty = next.findIndex((v, i) => i > targetIndex && (v === '' || v == null))
      if (empty < 0) {
        // 往前找
        empty = next.findIndex((v) => v === '' || v == null)
      }
      if (empty < 0) next.push(id)
      else {
        // 把 targetIndex 到 empty 之间的元素整体后移一位
        for (let i = empty; i > targetIndex; i--) next[i] = next[i - 1]
        next[targetIndex] = id
      }
    }
    return next
  }
  // 组内移动：直接交换到 targetIndex
  next[fromIndex] = next[targetIndex]
  next[targetIndex] = id
  return next
}

/** 删一个 id → 置空 */
export function removeGridId(gridOrder: string[], id: string): string[] {
  return gridOrder.map((v) => (v === id ? '' : v))
}

/** 第一个空格索引；无空格返回 -1 */
export function firstEmptyCell(gridOrder: string[]): number {
  return gridOrder.findIndex((v) => v === '' || v == null)
}

// ── 瀑布流（masonry）布局：按实际子节点尺寸排列 ───────────────

export interface MeasuredChild {
  id: string
  width: number
  height: number
}

/**
 * 单节点列宽归一化：返回把 (curW, curH) 钉到 targetWidth（保持宽高比）后的尺寸；
 * 与 targetWidth 偏差在 epsilon 之内返回 null，表示无需调整。
 */
export function computeNormalizedSize(
  curW: number,
  curH: number,
  targetWidth: number,
  epsilon = 2,
): { width: number; height: number } | null {
  if (!targetWidth || targetWidth <= 0) return null
  if (Math.abs(curW - targetWidth) <= epsilon) return null
  const aspectRatio = curW > 0 ? curH / curW : 1
  return { width: targetWidth, height: Math.round(targetWidth * aspectRatio) }
}

export interface MasonryLayoutResult {
  positions: Map<string, { x: number; y: number }>
  groupWidth: number
  groupHeight: number
}

/**
 * 行优先 masonry 布局：每行 cols 个，列宽取所有子节点最大宽（列对齐），
 * 行高取本行最高（适应不同纵横比）。
 * - 不重叠、不留尾格子造成的错位
 * - 组宽高刚好包裹全部子节点 + padding
 * - reservedRows：可选，保留额外的空行（用于"行数+"预留拖入位）
 */
export function masonryLayout(
  children: MeasuredChild[],
  cols: number,
  gap: number,
  padX: number,
  padTop: number,
  padBottom: number,
  reservedRows?: number,
): MasonryLayoutResult {
  const safeCols = Math.max(cols, 1)
  const positions = new Map<string, { x: number; y: number }>()

  if (!children.length && !reservedRows) {
    return { positions, groupWidth: padX * 2, groupHeight: padTop + padBottom }
  }

  // 列宽 = 全部子节点最大宽（保证列对齐、视觉整齐）；无子节点时取 0（仅 reservedRows 场景）
  const colWidth = children.length
    ? Math.max(...children.map((c) => c.width || 0), 1)
    : 1

  // 分行
  const rows: MeasuredChild[][] = []
  for (let i = 0; i < children.length; i += safeCols) {
    rows.push(children.slice(i, i + safeCols))
  }
  const rowHeights = rows.map((row) => Math.max(...row.map((c) => c.height || 0), 0))

  // 预留额外空行：高度沿用已占行的平均高（无已占行则按 colWidth 取一个方形单元高度）
  const wantRows = Math.max(reservedRows || 0, 0)
  if (wantRows > rows.length) {
    const avg = rowHeights.length
      ? rowHeights.reduce((a, b) => a + b, 0) / rowHeights.length
      : colWidth
    while (rows.length < wantRows) {
      rows.push([])
      rowHeights.push(avg)
    }
  }

  // 行优先定位
  let y = padTop
  rows.forEach((row, r) => {
    row.forEach((child, c) => {
      positions.set(child.id, {
        x: padX + c * (colWidth + gap),
        y,
      })
    })
    y += rowHeights[r] + gap
  })

  const groupWidth = padX * 2 + safeCols * colWidth + (safeCols - 1) * gap
  const groupHeight =
    padTop + padBottom + rowHeights.reduce((a, b) => a + b, 0) + Math.max(rows.length - 1, 0) * gap

  return { positions, groupWidth, groupHeight }
}

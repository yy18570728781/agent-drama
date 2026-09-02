// src/composables/flow/useGridSplitGroup.ts
//
// 用于把一张源图按 rows×cols 切分后，生成一个 grid 模式的 groupNode，
// 内含 N 个 file_input 子节点（每个对应一张切图）。不产生任何边。
//
// 与旧 batch_grid 切分流程的语义对齐：
//   - 1 个 groupNode（layoutMode:'grid'，data.gridSplit.role = 'split-input'）
//   - N 个 file_input 子节点（按 pieceIndex 行优先排布）
//   - 无 source→group 边（组节点无可连接 handle）

import type { Ref } from 'vue'
import type { useTaskQueueStore } from '@/stores/task-queue'
import { createFlowId } from '@/utils/flowId'
import {
  gridCellPosition,
  gridGroupSize,
  swapGridOrder,
  insertGridOrder,
  firstEmptyCell,
  computeNormalizedSize,
  GRID_DEFAULT_GAP,
  type GridSplitMeta,
} from '@/utils/gridGridLayout'

export interface GridSplitPiece {
  url: string
  thumbUrl: string
  mediaMeta?: { width: number; height: number; aspectRatio?: number }
  index: number
}

export interface CreateGridSplitInputGroupOptions {
  sourceNodeId: string
  pieces: GridSplitPiece[]
  rows: number
  cols: number
  sourcePos: { x: number; y: number }
  sourceSize: { width: number; height: number }
  sourceLabel: string
  gap?: number
}

export interface GridSplitInputGroupDeps {
  nodes: Ref<any[]>
  emit: (event: string, value: any) => void
}

// 与 useGroupNodes.ts 中的常量保持一致（GROUP_PADDING_X/TOP/BOTTOM）
const PAD_X = 16
const PAD_TOP = 16
const PAD_BOTTOM = 16

/**
 * 创建一个 grid 模式的 groupNode + N 个 file_input 子节点。
 *
 * 返回 { groupId, childIds }；childIds 按 pieceIndex 升序排列。
 * 不产生任何边，调用方负责 emit('update:modelNodes') 之外的同步。
 */
export function createGridSplitInputGroup(
  options: CreateGridSplitInputGroupOptions,
  deps: GridSplitInputGroupDeps,
): { groupId: string; childIds: string[] } {
  const {
    sourceNodeId,
    pieces,
    rows,
    cols,
    sourcePos,
    sourceSize,
    sourceLabel,
  } = options

  // 1. 按 index 升序，确保行优先排布
  const sorted = [...pieces].sort((a, b) => a.index - b.index)

  // 2. gap（默认走 GRID_DEFAULT_GAP；切分场景调用方可传 0 实现"无缝"效果）
  const gap = options.gap ?? GRID_DEFAULT_GAP

  // 3. 单元格尺寸（带下限保护）
  const cellW = Math.max(sourceSize.width / Math.max(cols, 1), 1)
  const cellH = Math.max(sourceSize.height / Math.max(rows, 1), 1)

  // 4. padding 常量与 useGroupNodes 保持一致
  const padX = PAD_X
  const padTop = PAD_TOP
  const padBottom = PAD_BOTTOM

  // 5. 计算组整体宽高
  const groupSize = gridGroupSize(rows, cols, cellW, cellH, gap, padX, padTop, padBottom)

  // 6. 先创建子节点（需要 childIds 写入 groupNode.data.gridOrder）
  const childIds: string[] = []
  const children: any[] = sorted.map((piece, i) => {
    const id = createFlowId('node')
    childIds.push(id)
    const pos = gridCellPosition(piece.index, cols, cellW, cellH, gap, padX, padTop)
    const padded = String(piece.index + 1).padStart(2, '0')
    return {
      id,
      type: 'file_input',
      // 子节点位置相对组左上角
      position: pos,
      // 显式钉死单元格尺寸：否则 file_input 会按默认/自然尺寸渲染，
      // 与 gridSplit.cellWidth/Height 不一致 → 组与子节点尺寸对不上、首张图被自然像素拉大
      style: { width: `${cellW}px`, height: `${cellH}px` },
      data: {
        url: piece.url,
        thumb: piece.thumbUrl,
        mediaType: 'image',
        _gridSplitChild: true,
        label: `${sourceLabel}_${padded}`,
        ...(piece.mediaMeta ? { mediaMeta: piece.mediaMeta } : {}),
      },
    }
  })

  // 7. gridOrder：长度对齐 rows*cols，缺位补 ''（与 Task 2.1 语义一致）
  const totalSlots = rows * cols
  const gridOrder = Array.from({ length: totalSlots }, () => '')
  sorted.forEach((piece, index) => {
    if (piece.index >= 0 && piece.index < totalSlots) gridOrder[piece.index] = childIds[index]
  })

  // 8. 构造 groupNode
  const groupId = createFlowId('grp')
  const gridSplit: GridSplitMeta = {
    rows,
    cols,
    gap,
    cellWidth: cellW,
    cellHeight: cellH,
    splitSource: sourceNodeId,
    role: 'split-input',
  }

  const groupNode = {
    id: groupId,
    type: 'groupNode',
    position: {
      x: sourcePos.x + sourceSize.width + 20,
      y: sourcePos.y,
    },
    style: {
      width: `${groupSize.width}px`,
      height: `${groupSize.height}px`,
    },
    zIndex: -1,
    data: {
      label: `${sourceLabel}_拆分_${rows}x${cols}`,
      mediaType: 'image',
      layoutMode: 'grid',
      gridSplit,
      gridOrder,
    },
  }

  // 9. 子节点挂到组上
  children.forEach((child) => {
    child.parentNode = groupId
    child.extent = undefined
  })

  // 10. 追加到 nodes（与现有 handleGroupSelected 风格一致：unshift group 或 push 末尾）
  deps.nodes.value = [...deps.nodes.value, groupNode, ...children]

  // 11. 同步到父组件
  deps.emit('update:modelNodes', deps.nodes.value)

  // 12. 返回
  return { groupId, childIds }
}

// ──────────────────────────────────────────────────────────────
// 组B（split-output）+ 批量生成触发
// ──────────────────────────────────────────────────────────────

export interface CreateGridSplitOutputGroupOptions {
  taskCount: number
  cols: number
  cellWidth: number
  cellHeight: number
  gap: number
  genNodeId: string
  inputGroupId: string
  basePos: { x: number; y: number }
  label: string
}

export interface GridSplitOutputGroupDeps {
  nodes: Ref<any[]>
  emit: (event: string, value: any) => void
}

/**
 * 创建组B：grid 模式的 groupNode + taskCount 个占位 aigc_result 子节点。
 * 同时回填组A 的 gridSplit.siblingGroupId = 组B id。
 */
export function createGridSplitOutputGroup(
  options: CreateGridSplitOutputGroupOptions,
  deps: GridSplitOutputGroupDeps,
): { groupId: string; placeholderIds: string[] } {
  const {
    taskCount,
    cols,
    cellWidth,
    cellHeight,
    gap,
    genNodeId,
    inputGroupId,
    basePos,
    label,
  } = options

  const safeCols = Math.max(cols, 1)
  const rows = Math.max(Math.ceil(Math.max(taskCount, 1) / safeCols), 1)
  const padX = PAD_X
  const padTop = PAD_TOP
  const padBottom = PAD_BOTTOM
  const groupSize = gridGroupSize(rows, safeCols, cellWidth, cellHeight, gap, padX, padTop, padBottom)

  const placeholderIds: string[] = []
  const placeholders: any[] = []
  for (let i = 0; i < taskCount; i += 1) {
    const id = createFlowId('node')
    placeholderIds.push(id)
    const pos = gridCellPosition(i, safeCols, cellWidth, cellHeight, gap, padX, padTop)
    placeholders.push({
      id,
      type: 'aigc_result',
      position: pos,
      // 同 input 组：钉死单元格尺寸，避免占位节点按默认尺寸渲染与组尺寸脱钩
      style: { width: `${cellWidth}px`, height: `${cellHeight}px` },
      data: {
        label: `${label}_结果_${String(i + 1).padStart(2, '0')}`,
        mediaType: 'image',
        status: 'waiting_submit',
        progress: 0,
        isGenerating: false,
      },
    })
  }

  // gridOrder：长度对齐 rows*cols，末尾空位补 ''
  const totalSlots = rows * safeCols
  const gridOrder = [...placeholderIds]
  while (gridOrder.length < totalSlots) gridOrder.push('')

  const groupId = createFlowId('grp')
  const gridSplit: GridSplitMeta = {
    rows,
    cols: safeCols,
    gap,
    cellWidth,
    cellHeight,
    batchGenNodeId: genNodeId,
    siblingGroupId: inputGroupId,
    role: 'split-output',
  }

  const groupNode = {
    id: groupId,
    type: 'groupNode',
    position: { x: basePos.x, y: basePos.y },
    style: {
      width: `${groupSize.width}px`,
      height: `${groupSize.height}px`,
    },
    zIndex: -1,
    data: {
      label: `${label}_结果_${rows}x${safeCols}`,
      mediaType: 'image',
      layoutMode: 'grid',
      gridSplit,
      gridOrder,
    },
  }

  placeholders.forEach((child) => {
    child.parentNode = groupId
    child.extent = undefined
  })

  deps.nodes.value = [...deps.nodes.value, groupNode, ...placeholders]

  // 回填组A 的 siblingGroupId
  const inputGroupIdx = deps.nodes.value.findIndex((n: any) => n.id === inputGroupId)
  if (inputGroupIdx >= 0) {
    const ig = deps.nodes.value[inputGroupIdx]
    const igSplit = ig?.data?.gridSplit && typeof ig.data.gridSplit === 'object' ? ig.data.gridSplit : {}
    deps.nodes.value[inputGroupIdx] = {
      ...ig,
      data: {
        ...(ig.data || {}),
        gridSplit: { ...igSplit, siblingGroupId: groupId },
      },
    }
  }

  deps.emit('update:modelNodes', deps.nodes.value)
  return { groupId, placeholderIds }
}

export interface GridSplitInputBatchInfo {
  inputGroupId: string
  inputs: { fileId: string; fileUrl: string; placeholderId: string }[]
  cols: number
  cellWidth: number
  cellHeight: number
  gap: number
}

/**
 * 检测一个生成节点是否处于"组A 网格批量"场景：
 * ≥2 条入边，且所有来源都是同一个 role:'split-input' grid 组的 file_input 子节点。
 * 返回的 inputs 已按组A gridOrder 顺序排好，placeholderId 先空串占位，
 * 由调用方在 createGridSplitOutputGroup 后回填真实占位 id。
 */
export function detectGridSplitInputBatch(
  genNodeId: string,
  nodes: any[],
  edges: any[],
): GridSplitInputBatchInfo | null {
  const inEdges = edges.filter((e: any) => e?.target === genNodeId)
  if (inEdges.length < 2) return null

  const nodeById = new Map(nodes.map((n: any) => [n.id, n]))
  const sourceNodes = inEdges
    .map((e: any) => nodeById.get(e.source))
    .filter((n: any) => n && n.type === 'file_input' && n.parentNode)

  if (sourceNodes.length !== inEdges.length) return null

  // 必须全部属于同一个 split-input grid 组
  const parentIds = new Set(sourceNodes.map((n: any) => n.parentNode))
  if (parentIds.size !== 1) return null
  const inputGroupId = sourceNodes[0].parentNode
  const inputGroup = nodeById.get(inputGroupId)
  if (!inputGroup || inputGroup.type !== 'groupNode') return null
  if (inputGroup.data?.layoutMode !== 'grid') return null
  const split = inputGroup.data?.gridSplit
  if (!split || split.role !== 'split-input') return null

  const gridOrder: string[] = Array.isArray(inputGroup.data?.gridOrder) ? inputGroup.data.gridOrder : []
  // 按 gridOrder 顺序整理输入（空位跳过；不在 gridOrder 里的尾部追加）
  const ordered: { fileId: string; fileUrl: string }[] = []
  const seen = new Set<string>()
  gridOrder.forEach((id: string) => {
    if (!id) return
    const node = nodeById.get(id)
    if (!node || seen.has(id)) return
    const url = String(node.data?.url || '').trim()
    if (!url) return
    seen.add(id)
    ordered.push({ fileId: id, fileUrl: url })
  })
  // 兜底：gridOrder 没覆盖到的来源节点追加到末尾
  sourceNodes.forEach((n: any) => {
    if (seen.has(n.id)) return
    const url = String(n.data?.url || '').trim()
    if (!url) return
    seen.add(n.id)
    ordered.push({ fileId: n.id, fileUrl: url })
  })

  if (ordered.length < 2) return null

  return {
    inputGroupId,
    inputs: ordered.map((item) => ({ ...item, placeholderId: '' })),
    cols: typeof split.cols === 'number' ? split.cols : Math.ceil(Math.sqrt(ordered.length)),
    cellWidth: split.cellWidth || 200,
    cellHeight: split.cellHeight || 200,
    gap: typeof split.gap === 'number' ? split.gap : GRID_DEFAULT_GAP,
  }
}

export interface EnqueueGridSplitGenerationsParams {
  requestTemplate: { capability: string; mode: string; params: Record<string, any> }
  inputs: { fileId: string; fileUrl: string; placeholderId: string }[]
  taskQueue: Pick<ReturnType<typeof useTaskQueueStore>, 'enqueueGeneration'>
  nodes: Ref<any[]>
  emit: (event: string, value: any) => void
  saveHistory: () => void
}

export interface TriggerGridSplitBatchParams {
  genNodeId: string
  nodes: Ref<any[]>
  edges: Ref<any[]>
  taskQueue: Pick<ReturnType<typeof useTaskQueueStore>, 'enqueueGeneration'>
  emit: (event: string, value: any) => void
  saveHistory: () => void
}

/**
 * 端到端编排：检测组A 网格批量场景 → 建组B → enqueue N 个独立生成。
 * 返回 true 表示识别并已派发（调用方应跳过普通 handleSend）。
 *
 * requestTemplate 从生成节点 data._genState 读取（capability/mode/modelId/prompt/params）。
 */
export function triggerGridSplitBatchGeneration(params: TriggerGridSplitBatchParams): boolean {
  const { genNodeId, nodes, edges, taskQueue, emit, saveHistory } = params

  const info = detectGridSplitInputBatch(genNodeId, nodes.value, edges.value)
  if (!info) return false

  const genNode = nodes.value.find((n: any) => n.id === genNodeId)
  if (!genNode) return false
  const gs = genNode.data?._genState && typeof genNode.data._genState === 'object' ? genNode.data._genState : {}
  const gsParams = gs.params && typeof gs.params === 'object' ? gs.params : {}
  const requestTemplate = {
    capability: String(gs.capability || genNode.data?.capability || 'image_generation'),
    mode: String(gs.mode || 'standard') || 'standard',
    params: {
      ...gsParams,
      model: String(gsParams.model || gs.modelId || '').trim(),
      prompt: String(gsParams.prompt || gs.prompt || '').trim(),
    },
  }
  if (!requestTemplate.params.model) {
    return false
  }

  const genPos = genNode.computedPosition?.x != null && genNode.computedPosition?.y != null
    ? { x: genNode.computedPosition.x, y: genNode.computedPosition.y }
    : { x: genNode.position?.x || 0, y: genNode.position?.y || 0 }
  const genW = genNode.dimensions?.width || parseFloat(String(genNode.style?.width || '')) || 320
  const basePos = { x: genPos.x + genW + 40, y: genPos.y }
  const label = String(genNode.data?.label || '批量')

  const { placeholderIds } = createGridSplitOutputGroup(
    {
      taskCount: info.inputs.length,
      cols: info.cols,
      cellWidth: info.cellWidth,
      cellHeight: info.cellHeight,
      gap: info.gap,
      genNodeId,
      inputGroupId: info.inputGroupId,
      basePos,
      label,
    },
    { nodes, emit },
  )

  // 把占位 id 按 inputs 顺序回填
  const inputs = info.inputs.map((item, i) => ({ ...item, placeholderId: placeholderIds[i] || '' }))

  enqueueGridSplitGenerations({
    requestTemplate,
    inputs,
    taskQueue,
    nodes,
    emit,
    saveHistory,
  })

  saveHistory()
  return true
}

// ──────────────────────────────────────────────────────────────
// Grid 拖拽/增删联动（从 useGroupNodes 抽出以控制单文件行数）
// ──────────────────────────────────────────────────────────────

export interface GridGroupOpsCtx {
  nodes: Ref<any[]>
  findNode: (id: string) => any
  emit: (event: string, ...args: any[]) => void
  saveHistory: () => void
  getNodeRenderedSize: (node: any) => { width: number; height: number }
  isPointInsideGroup: (x: number, y: number, groupNode: any) => boolean
  getGroupDepth: (groupNode: any) => number
  layoutGridChildren: (groupId: string) => boolean
}

const OPS_PAD_X = 16
const OPS_PAD_TOP = 16

/**
 * Grid 模式拖拽落点处理：交换 / 插入 / 占空格。
 * 返回 true 表示已处理（调用方应跳过 assignToGroupIfOverlapping）。
 */
export function handleGridDropOps(
  node: any,
  absX: number,
  absY: number,
  ctx: GridGroupOpsCtx,
): boolean {
  if (node?.type === 'groupNode') return false
  const { width: nw, height: nh } = ctx.getNodeRenderedSize(node)
  const centerX = absX + nw / 2
  const centerY = absY + nh / 2

  const groups = ctx.nodes.value
    .filter((n: any) => n?.type === 'groupNode' && n.id !== node.id)
    .sort((a: any, b: any) => ctx.getGroupDepth(b) - ctx.getGroupDepth(a))
  const targetGroup = groups.find((g: any) =>
    g?.data?.layoutMode === 'grid' && ctx.isPointInsideGroup(centerX, centerY, g),
  )
  if (!targetGroup) {
    // 拖出任何 grid 组：若该节点原本属于某个 grid 组，执行"出组"——
    // 清 gridOrder 占位、清 parentNode、写绝对坐标，避免被 layoutGridChildren 吸回
    if (node?.parentNode) {
      const currentParent = ctx.findNode(node.parentNode)
      if (currentParent?.type === 'groupNode' && currentParent?.data?.layoutMode === 'grid'
        && !ctx.isPointInsideGroup(centerX, centerY, currentParent)) {
        const order: string[] = Array.isArray(currentParent.data?.gridOrder)
          ? [...currentParent.data.gridOrder] : []
        const idx = order.indexOf(node.id)
        if (idx >= 0) {
          order[idx] = ''
          currentParent.data = { ...(currentParent.data || {}), gridOrder: order }
        }
        node.parentNode = undefined
        node.extent = undefined
        node.position = { x: absX, y: absY }
        ctx.layoutGridChildren(currentParent.id)
        ctx.nodes.value = [...ctx.nodes.value]
        ctx.emit('update:modelNodes', ctx.nodes.value)
        ctx.saveHistory()
        return true
      }
    }
    return false
  }

  const split = targetGroup.data?.gridSplit
  if (!split || typeof split.cols !== 'number') return false
  const { cols } = split
  const cellWidth = typeof split.cellWidth === 'number' ? split.cellWidth : 0
  const cellHeight = typeof split.cellHeight === 'number' ? split.cellHeight : 0
  const gap = typeof split.gap === 'number' ? split.gap : GRID_DEFAULT_GAP

  const gridOrder: string[] = Array.isArray(targetGroup.data?.gridOrder)
    ? [...targetGroup.data.gridOrder]
    : []

  // 估算落点格位；cellWidth/cellHeight 缺失（或落点超出当前 rows）时改为"追加到下一空格"
  let targetIndex = -1
  if (cellWidth > 0 && cellHeight > 0) {
    const groupX = targetGroup.computedPosition?.x ?? targetGroup.position?.x ?? 0
    const groupY = targetGroup.computedPosition?.y ?? targetGroup.position?.y ?? 0
    const relX = centerX - groupX - OPS_PAD_X
    const relY = centerY - groupY - OPS_PAD_TOP
    const col = Math.floor(relX / Math.max(cellWidth + gap, 1))
    const row = Math.floor(relY / Math.max(cellHeight + gap, 1))
    const rows = typeof split.rows === 'number' ? split.rows : 1
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      targetIndex = row * cols + col
    }
  }

  const isInternal = node.parentNode === targetGroup.id

  // 外部进入 grid 组的节点：一次性把尺寸钉到组列宽（保持宽高比），避免瀑布流列对齐时留空白。
  // 仅在 !isInternal 时做；内部拖动不重复缩放。
  function applyCellWidthNormalization() {
    const targetW = typeof split.cellWidth === 'number' ? split.cellWidth : 0
    if (!targetW || targetW < 50) return
    const { width: nW, height: nH } = ctx.getNodeRenderedSize(node)
    if (!nW || !nH) return
    const sized = computeNormalizedSize(nW, nH, targetW)
    if (!sized) return
    node.style = {
      ...(node.style || {}),
      width: `${sized.width}px`,
      height: `${sized.height}px`,
    }
  }

  // 落点不在已知格位（超出 rows / cell 尺寸未知 / 拖到组体下方空白）：追加到下一空格，必要时扩行
  if (targetIndex < 0) {
    // 组内拖到空白区：先把节点自身从原位挪走，避免占据自身的旧空格
    if (isInternal) {
      const fromIdx = gridOrder.indexOf(node.id)
      if (fromIdx >= 0) gridOrder[fromIdx] = ''
    }
    let idx = firstEmptyCell(gridOrder)
    if (idx < 0) {
      // 没有空格：在末尾扩一行
      const currentRows = typeof split.rows === 'number' ? split.rows : 0
      for (let i = 0; i < cols; i++) gridOrder.push('')
      idx = gridOrder.length - cols
      split.rows = currentRows + 1
    }
    gridOrder[idx] = node.id
    targetGroup.data = {
      ...(targetGroup.data || {}),
      gridOrder: [...gridOrder],
      gridSplit: { ...split },
    }
    if (!isInternal) {
      applyCellWidthNormalization()
      node.parentNode = targetGroup.id
      node.extent = undefined
    }
    ctx.layoutGridChildren(targetGroup.id)
    ctx.nodes.value = [...ctx.nodes.value]
    ctx.emit('update:modelNodes', ctx.nodes.value)
    ctx.saveHistory()
    return true
  }

  while (gridOrder.length <= targetIndex) gridOrder.push('')
  const occupantId = gridOrder[targetIndex]

  if (isInternal) {
    if (occupantId === node.id) {
      // 落回原位：仅修正位置，不动 gridOrder
    } else if (!occupantId) {
      const fromIdx = gridOrder.indexOf(node.id)
      if (fromIdx >= 0) gridOrder[fromIdx] = ''
      gridOrder[targetIndex] = node.id
    } else {
      const swapped = swapGridOrder(gridOrder, node.id, occupantId)
      gridOrder.splice(0, gridOrder.length, ...swapped)
    }
  } else {
    const inserted = insertGridOrder(gridOrder, node.id, targetIndex)
    gridOrder.splice(0, gridOrder.length, ...inserted)
    // 跨组迁移：从原 grid 父组的 gridOrder 里清掉自己，避免幽灵占位
    const prevParentId = node.parentNode
    if (prevParentId && prevParentId !== targetGroup.id) {
      const prevParent = ctx.findNode(prevParentId)
      if (prevParent?.type === 'groupNode' && prevParent?.data?.layoutMode === 'grid') {
        const prevOrder: string[] = Array.isArray(prevParent.data?.gridOrder)
          ? [...prevParent.data.gridOrder] : []
        const prevIdx = prevOrder.indexOf(node.id)
        if (prevIdx >= 0) {
          prevOrder[prevIdx] = ''
          prevParent.data = { ...(prevParent.data || {}), gridOrder: prevOrder }
        }
        ctx.layoutGridChildren(prevParent.id)
      }
    }
    node.parentNode = targetGroup.id
    node.extent = undefined
    applyCellWidthNormalization()
  }

  targetGroup.data = { ...(targetGroup.data || {}), gridOrder: [...gridOrder] }
  ctx.layoutGridChildren(targetGroup.id)
  ctx.nodes.value = [...ctx.nodes.value]
  ctx.emit('update:modelNodes', ctx.nodes.value)
  ctx.saveHistory()
  return true
}

/**
 * 节点删除后清理 gridOrder：把引用了已删节点 id 的格位置 ''。
 */
export function cleanupGridOrdersForDeletedNodesOps(deletedIds: Set<string>, ctx: GridGroupOpsCtx): void {
  if (!deletedIds.size) return
  const affected = new Set<string>()
  ctx.nodes.value.forEach((g: any) => {
    if (g?.type !== 'groupNode' || g?.data?.layoutMode !== 'grid') return
    const order: string[] = Array.isArray(g.data?.gridOrder) ? g.data.gridOrder : []
    if (!order.some((id: string) => id && deletedIds.has(id))) return
    const cleaned = order.map((id: string) => (id && deletedIds.has(id) ? '' : id))
    g.data = { ...(g.data || {}), gridOrder: cleaned }
    affected.add(g.id)
  })
  affected.forEach((gid: string) => ctx.layoutGridChildren(gid))
  if (affected.size) {
    ctx.nodes.value = [...ctx.nodes.value]
    ctx.emit('update:modelNodes', ctx.nodes.value)
  }
}

/**
 * 把已进入 grid 组的节点登记到该组 gridOrder 的第一个空格。
 * 用于粘贴/撤销恢复等"新增子节点"路径。无空格则扩行后追加。
 */
export function registerGridChildOps(nodeId: string, ctx: GridGroupOpsCtx): boolean {
  const node = ctx.findNode(nodeId)
  if (!node?.parentNode) return false
  const group = ctx.findNode(node.parentNode)
  if (!group || group.type !== 'groupNode' || group.data?.layoutMode !== 'grid') return false
  const split = group.data?.gridSplit
  if (!split || typeof split.cols !== 'number') return false

  let order: string[] = Array.isArray(group.data?.gridOrder) ? [...group.data.gridOrder] : []
  if (order.includes(nodeId)) return true

  let idx = firstEmptyCell(order)
  if (idx < 0) {
    const cols = split.cols
    const rows = (typeof split.rows === 'number' ? split.rows : 0) + 1
    split.rows = rows
    for (let i = 0; i < cols; i++) order.push('')
    idx = order.length - cols
  }
  order[idx] = nodeId
  group.data = { ...(group.data || {}), gridOrder: order, gridSplit: { ...split } }
  ctx.layoutGridChildren(group.id)
  ctx.nodes.value = [...ctx.nodes.value]
  ctx.emit('update:modelNodes', ctx.nodes.value)
  return true
}

function patchPlaceholderNode(
  nodes: Ref<any[]>,
  emit: (event: string, value: any) => void,
  placeholderId: string,
  patch: Record<string, any>,
): void {
  const idx = nodes.value.findIndex((n: any) => n.id === placeholderId)
  if (idx < 0) return
  const node = nodes.value[idx]
  nodes.value[idx] = { ...node, data: { ...(node.data || {}), ...patch } }
  nodes.value = [...nodes.value]
  emit('update:modelNodes', nodes.value)
}

/**
 * 把 N 个输入分别 enqueue 成 N 个独立普通生成任务，
 * 每个任务的 flowNodeId 绑定到组B 的一个占位 aigc_result 节点，
 * 回调里直接更新该占位节点（status/progress/recordId/url）—— 全是标准节点更新。
 */
export function enqueueGridSplitGenerations(params: EnqueueGridSplitGenerationsParams): void {
  const { requestTemplate, inputs, taskQueue, nodes, emit, saveHistory } = params

  inputs.forEach((input, index) => {
    const request = {
      capability: requestTemplate.capability,
      mode: requestTemplate.mode,
      params: {
        ...requestTemplate.params,
        file_urls: [input.fileUrl],
      },
    }

    patchPlaceholderNode(nodes, emit, input.placeholderId, {
      status: 'waiting_submit',
      statusText: '准备提交...',
      progress: 0,
      isGenerating: true,
      _requestIndex: index,
    })

    taskQueue.enqueueGeneration({
      request,
      prompt: String(requestTemplate.params?.prompt || ''),
      modelInfo: String(requestTemplate.params?.model || ''),
      genType: 'image',
      flowNodeId: input.placeholderId,
      requestIndex: index,
      callbacks: {
        onCreated: (_recordId, taskId) => {
          patchPlaceholderNode(nodes, emit, input.placeholderId, {
            status: 'queued',
            statusText: '排队中...',
            taskId,
            _activeTaskId: taskId,
            recordId: _recordId,
            isGenerating: true,
            progress: 0,
          })
        },
        onProgress: (_recordId, percent) => {
          patchPlaceholderNode(nodes, emit, input.placeholderId, {
            status: 'running',
            statusText: '生成中...',
            isGenerating: true,
            progress: Math.round(percent),
          })
        },
        onCompleted: (_recordId, result) => {
          const items = (result && Array.isArray(result.items)) ? result.items : []
          const first = items[0] || {}
          const url = String(first.url || first.preview || first.preview_url || result?.url || '')
          const thumb = String(first.thumb || first.thumbnail_url || first.thumb_url || url)
          const recordId = String(result?.aigc_record_id || result?.record_id || _recordId || '')
          patchPlaceholderNode(nodes, emit, input.placeholderId, {
            status: 'completed',
            statusText: '已完成',
            isGenerating: false,
            progress: 100,
            recordId,
            ...(url ? { url, preview: url, imageUrl: url } : {}),
            ...(thumb ? { thumb } : {}),
            ...(first.mediaMeta ? { mediaMeta: first.mediaMeta } : {}),
          })
          saveHistory()
        },
        onError: (_recordId, message) => {
          patchPlaceholderNode(nodes, emit, input.placeholderId, {
            status: 'failed',
            statusText: message || '生成失败',
            failReason: message || '生成失败',
            isGenerating: false,
            progress: undefined,
          })
          saveHistory()
        },
      },
    })
  })
}

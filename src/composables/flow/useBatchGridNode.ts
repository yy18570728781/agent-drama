import type { Ref } from 'vue'
import { createFlowId } from '@/utils/flowId'
import { normalizeBatchGridItems, normalizeBatchGridItemSnapshot } from '@/utils/batchGridItems'
import { buildRuntimeWorkflowNodeData } from '@/utils/workflowNodeData'
import { normalizeWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import { getFlowMediaNodeSize } from '@/composables/flow/flowMediaNodeSize'

export interface BatchGridItem {
  id: string
  type: string
  data: Record<string, any>
}

export interface BatchGridLayout {
  rows: number
  cols: number
  gap: number
}

export interface UseBatchGridNodeDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  emit: (event: string, ...args: any[]) => void
  findNode: (id: string) => any
  createConnectedAssetNode: (sourceId: string, options: any) => any
  getNodeBoxSize: (node: any) => { width: number; height: number }
  saveHistory: () => void
}

const BATCH_HEADER_H = 28
const BATCH_PADDING = 4
const BATCH_MIN_TILE_EDGE = 56
const BATCH_MAX_TILE_EDGE = 112
const SCATTER_NODE_GAP = 32

export type DownstreamTarget = { target: string; targetHandle: string; type: string }

export function collectDownstreamTargets(allEdges: any[], sourceId: string): DownstreamTarget[] {
  return allEdges
    .filter((e) => e.source === sourceId)
    .map((e) => ({ target: e.target, targetHandle: e.targetHandle, type: e.type }))
}

export function buildDownstreamEdges(sourceIds: string[], targets: DownstreamTarget[]): any[] {
  const result: any[] = []
  for (const srcId of sourceIds) {
    for (const dt of targets) {
      result.push({
        id: createFlowId('edge'),
        source: srcId,
        sourceHandle: 'image',
        target: dt.target,
        targetHandle: dt.targetHandle,
        type: dt.type,
      })
    }
  }
  return result
}

function readPositiveNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

function getAspectRatioFromSize(size?: { width?: number; height?: number }): number {
  const width = readPositiveNumber(size?.width)
  const height = readPositiveNumber(size?.height)
  return width > 0 && height > 0 ? width / height : 0
}

function parsePixelSize(value: unknown): number {
  const parsed = parseFloat(String(value || ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getScatterItemSize(itemData: Record<string, any>, fallback: { width: number; height: number }) {
  const mediaType = String(itemData.mediaType || 'image')
  const mediaMeta = normalizeWorkflowMediaMeta(itemData)
  if (mediaMeta) {
    const size = getFlowMediaNodeSize({
      mediaType,
      width: mediaMeta.width,
      height: mediaMeta.height,
      aspectRatio: mediaMeta.aspectRatio,
    })
    return { width: size.width, height: size.height }
  }
  return fallback
}

function buildScatterLayoutItems(items: BatchGridItem[], cols: number, frame: ReturnType<typeof getBatchGridScatterFrame>) {
  const sizes = items.map((item) => getScatterItemSize(item.data || {}, {
    width: parsePixelSize(item.data?.style?.width) || frame.itemW,
    height: parsePixelSize(item.data?.style?.height) || frame.itemH,
  }))
  const colWidths = Array.from({ length: cols }, () => 0)
  const rowHeights: number[] = []
  sizes.forEach((size, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    colWidths[col] = Math.max(colWidths[col] || 0, size.width)
    rowHeights[row] = Math.max(rowHeights[row] || 0, size.height)
  })
  return { sizes, colWidths, rowHeights }
}

function getScatterOffset(values: number[], index: number, gap: number): number {
  return values.slice(0, index).reduce((sum, value) => sum + value + gap, 0)
}

function getBatchGridScatterFrame(batchNode: any, batchSize: { width: number; height: number }, layout: BatchGridLayout) {
  const rows = Math.max(1, Number(layout.rows || 1))
  const cols = Math.max(1, Number(layout.cols || 1))
  const gap = Math.max(0, Number(layout.gap || 0) || 0)
  if (batchNode?.data?.seamlessSplit === true) {
    const scatterGap = Math.max(gap, SCATTER_NODE_GAP)
    return {
      baseX: 0,
      baseY: 0,
      itemW: Math.round((batchSize.width - (cols - 1) * gap) / cols),
      itemH: Math.round((batchSize.height - (rows - 1) * gap) / rows),
      gap: scatterGap,
    }
  }
  return {
    baseX: BATCH_PADDING * 2,
    baseY: BATCH_PADDING * 2,
    itemW: Math.round((batchSize.width - 16 - (cols - 1) * gap) / cols),
    itemH: Math.round((batchSize.height - 16 - BATCH_HEADER_H - (rows - 1) * gap) / rows),
    gap,
  }
}

function buildBatchGridTileFrame(rows: number, cols: number, sourceAspectRatio = 0) {
  const normalizedRows = Math.max(1, Number(rows || 1))
  const normalizedCols = Math.max(1, Number(cols || 1))
  const sourceRatio = readPositiveNumber(sourceAspectRatio)
  const tileRatio = sourceRatio > 0 ? sourceRatio * normalizedRows / normalizedCols : 1
  const ratio = Math.max(0.25, Math.min(tileRatio, 4))
  if (ratio >= 1) {
    return {
      width: BATCH_MAX_TILE_EDGE,
      height: Math.max(BATCH_MIN_TILE_EDGE, Math.round(BATCH_MAX_TILE_EDGE / ratio)),
    }
  }
  return {
    width: Math.max(BATCH_MIN_TILE_EDGE, Math.round(BATCH_MAX_TILE_EDGE * ratio)),
    height: BATCH_MAX_TILE_EDGE,
  }
}

export function buildBatchGridStyle(params: {
  rows: number
  cols: number
  gap: number
  sourceAspectRatio?: number
  sourceDisplaySize?: { width?: number; height?: number }
}): { width: string; height: string } {
  const sourceWidth = readPositiveNumber(params.sourceDisplaySize?.width)
  const sourceHeight = readPositiveNumber(params.sourceDisplaySize?.height)
  if (sourceWidth > 0 && sourceHeight > 0) {
    return { width: `${sourceWidth}px`, height: `${sourceHeight}px` }
  }
  const rows = Math.max(1, Number(params.rows || 1))
  const cols = Math.max(1, Number(params.cols || 1))
  const gap = Math.max(1, Math.min(Number(params.gap || 0) || 0, 2))
  const tileFrame = buildBatchGridTileFrame(rows, cols, params.sourceAspectRatio)
  const width = cols * tileFrame.width + (cols - 1) * gap + BATCH_PADDING * 2
  const height = rows * tileFrame.height + (rows - 1) * gap + BATCH_PADDING * 2 + BATCH_HEADER_H
  return { width: `${width}px`, height: `${height}px` }
}

function buildBatchGridNode(params: {
  id: string
  position: { x: number; y: number }
  rows: number
  cols: number
  gap: number
  items: BatchGridItem[]
  label: string
  sourceAspectRatio?: number
  sourceDisplaySize?: { width?: number; height?: number }
  seamlessSplit?: boolean
}) {
  const { id, position, rows, cols, gap, items, label, sourceAspectRatio, sourceDisplaySize, seamlessSplit } = params
  return {
    id,
    type: 'batch_grid' as const,
    position,
    style: buildBatchGridStyle({ rows, cols, gap, sourceAspectRatio, sourceDisplaySize }),
    data: {
      label,
      mediaType: 'image',
      layout: { rows, cols, gap },
      sourceAspectRatio: readPositiveNumber(sourceAspectRatio),
      ...(sourceDisplaySize ? { sourceDisplaySize } : {}),
      ...(seamlessSplit ? { seamlessSplit: true } : {}),
      items,
    },
  }
}

/**
 * 将批量节点打散为独立节点，保持网格布局位置
 */
export function scatterBatchNode(
  nodeId: string,
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes, edges, emit, findNode, getNodeBoxSize, saveHistory } = deps
  const batchNode = findNode(nodeId)
  if (!batchNode || batchNode.type !== 'batch_grid') return

  const items = normalizeBatchGridItems(batchNode.data?.items || []) as BatchGridItem[]
  const layout: BatchGridLayout = batchNode.data?.layout || { rows: 1, cols: items.length, gap: 20 }
  const { rows, cols } = layout

  const sourceEdges = edges.value.filter((e: any) => e.target === nodeId)
  const upstreamNodeId = sourceEdges[0]?.source || ''
  const downstreamTargets = collectDownstreamTargets(edges.value, nodeId)

  const batchPos = batchNode.position || { x: 0, y: 0 }
  const batchSize = getNodeBoxSize(batchNode)
  const scatterFrame = getBatchGridScatterFrame(batchNode, batchSize, layout)
  const scatterLayout = buildScatterLayoutItems(items, cols, scatterFrame)

  const createdIds: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const r = Math.floor(i / cols)
    const c = i % cols
    const itemData = item.data || {}
    const itemSize = scatterLayout.sizes[i] || { width: scatterFrame.itemW, height: scatterFrame.itemH }

    const nextNode = {
      id: item.id || createFlowId('node'),
      type: String(item.type || 'file_input'),
      position: {
        x: batchPos.x + scatterFrame.baseX + getScatterOffset(scatterLayout.colWidths, c, scatterFrame.gap),
        y: batchPos.y + scatterFrame.baseY + getScatterOffset(scatterLayout.rowHeights, r, scatterFrame.gap),
      },
      data: buildRuntimeWorkflowNodeData(itemData, String(item.type || 'file_input')),
      style: { width: `${itemSize.width}px`, height: `${itemSize.height}px` },
    }
    nodes.value = [...nodes.value, nextNode]
    const created = nodes.value[nodes.value.length - 1]
    if (created?.id) createdIds.push(created.id)
  }

  if (upstreamNodeId && createdIds.length) {
    edges.value = [
      ...edges.value,
      ...createdIds.map((targetId) => ({
        id: createFlowId('edge'),
        source: upstreamNodeId,
        sourceHandle: 'image',
        target: targetId,
        targetHandle: 'image',
      })),
    ]
  }

  nodes.value = nodes.value.filter((n: any) => n.id !== nodeId)
  edges.value = edges.value.filter((e: any) => e.target !== nodeId && e.source !== nodeId)
  if (downstreamTargets.length && createdIds.length) {
    edges.value = [...edges.value, ...buildDownstreamEdges(createdIds, downstreamTargets)]
  }
  emit('update:modelNodes', nodes.value)
  emit('update:modelEdges', edges.value)
  saveHistory()
}

export interface CreateBatchGridFromSplitOptions {
  sourceNodeId: string
  items: Array<{
    id?: string
    url: string
    thumb?: string
    mediaType: string
    label: string
    width?: number
    height?: number
    aspectRatio?: number
    mediaMeta?: Record<string, any>
  }>
  rows: number
  cols: number
  sourcePos: { x: number; y: number }
  sourceSize: { width: number; height: number }
  sourceAspectRatio?: number
  label: string
  gap?: number
}

/**
 * 从宫格拆分结果创建批量节点，上游连接源节点
 */
export function createBatchGridFromSplit(
  options: CreateBatchGridFromSplitOptions,
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes, edges, emit } = deps
  const { sourceNodeId, items, rows, cols, sourcePos, sourceSize, label } = options
  const gap = options.gap ?? 0
  const normalizedItems = normalizeBatchGridItems(items) as BatchGridItem[]
  if (!normalizedItems.length) return

  const sourceAspectRatio = readPositiveNumber(options.sourceAspectRatio) || getAspectRatioFromSize(sourceSize)
  const baseX = sourcePos.x + sourceSize.width + 20
  const newNodeId = createFlowId('node')
  const newNode = buildBatchGridNode({
    id: newNodeId,
    position: { x: baseX, y: sourcePos.y },
    rows, cols, gap, items: normalizedItems, label, sourceAspectRatio,
    sourceDisplaySize: sourceSize,
    seamlessSplit: true,
  })

  nodes.value = [...nodes.value, newNode]
  if (sourceNodeId) {
    edges.value = [...edges.value, {
      id: createFlowId('edge'),
      source: sourceNodeId,
      sourceHandle: 'image',
      target: newNodeId,
      targetHandle: 'image',
    }]
  }

  emit('update:modelNodes', nodes.value)
  emit('update:modelEdges', edges.value)
}

export function packNodesToBatch(
  selectedNodes: any[],
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes, edges, emit, saveHistory } = deps
  if (selectedNodes.length < 2) return

  const mediaNodes = selectedNodes.filter((n) => (
    n?.type === 'file_input'
    || n?.type === 'aigc_result'
    || String(n?.type || '').endsWith('_generation')
  ))
  if (mediaNodes.length < 2) return

  const count = mediaNodes.length
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  const items = mediaNodes
    .map((node) => normalizeBatchGridItemSnapshot({
      id: node.id,
      type: node.type,
      data: node.data,
    }))
    .filter(Boolean) as BatchGridItem[]

  if (!items.length) return

  const mediaIds = new Set(mediaNodes.map(n => n.id))
  const downstreamTargets: DownstreamTarget[] = []
  const seenDownstream = new Set<string>()
  for (const n of mediaNodes) {
    for (const dt of collectDownstreamTargets(edges.value, n.id)) {
      if (!seenDownstream.has(dt.target)) {
        seenDownstream.add(dt.target)
        downstreamTargets.push(dt)
      }
    }
  }

  const xs = mediaNodes.map(n => n.position?.x || 0)
  const ys = mediaNodes.map(n => n.position?.y || 0)
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2

  const upstreamEdges = edges.value.filter((e: any) =>
    mediaNodes.some(n => n.id === e.target),
  )
  const upstreamNodeId = upstreamEdges[0]?.source || ''

  const g = 4
  const firstMeta = normalizeWorkflowMediaMeta(mediaNodes[0]?.data || {})
  const sourceAspectRatio = firstMeta?.aspectRatio || getAspectRatioFromSize(mediaNodes[0]?.style)
  const newNodeId = createFlowId('node')
  const newNode = buildBatchGridNode({
    id: newNodeId,
    position: { x: centerX, y: centerY },
    rows, cols, gap: g, items,
    sourceAspectRatio,
    label: `批量节点_${rows}x${cols}`,
  })

  nodes.value = [...nodes.value.filter(n => !mediaIds.has(n.id)), newNode]
  edges.value = edges.value.filter((e: any) =>
    !mediaIds.has(e.target) && !mediaIds.has(e.source),
  )

  if (upstreamNodeId) {
    edges.value = [...edges.value, {
      id: createFlowId('edge'),
      source: upstreamNodeId,
      sourceHandle: 'image',
      target: newNodeId,
      targetHandle: 'image',
    }]
  }

  if (downstreamTargets.length) {
    edges.value = [...edges.value, ...buildDownstreamEdges([newNodeId], downstreamTargets)]
  }

  emit('update:modelNodes', nodes.value)
  emit('update:modelEdges', edges.value)
  saveHistory()
}

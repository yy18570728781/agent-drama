import { createFlowId } from '@/utils/flowId'
import { normalizeBatchGridItems } from '@/utils/batchGridItems'

type BatchGridGenerationRecord = {
  batchId: string
  outputKind: 'batch_grid' | 'group'
  sourceNodeId: string
  sourceBatchNodeId: string
  layout: { rows: number; cols: number; gap: number }
  sourceAspectRatio: number
  sourceDisplaySize: { width?: number; height?: number } | null
  items: Array<{ id: string; type: string; data: Record<string, any> }>
  outputNodeId: string | null
}

const batchGridGenerationRegistry = new Map<string, BatchGridGenerationRecord>()

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/**
 * 记录一次“单文件批量”生成的 batch_grid 批次元信息，供正式事件回写复用。
 * @param sourceNodeId 当前生成节点 id。
 * @param sourceBatchNode 上游 batch_grid 节点。
 * @returns 本次批量生成的 batchId。
 */
export function createBatchGridGenerationBatch(
  sourceNodeId: string,
  sourceBatchNode: any,
): string {
  const rawSourceDisplaySize = sourceBatchNode?.data?.sourceDisplaySize
    && typeof sourceBatchNode.data.sourceDisplaySize === 'object'
    ? sourceBatchNode.data.sourceDisplaySize
    : null
  const sourceDisplaySize = rawSourceDisplaySize
    ? {
        width: Number(rawSourceDisplaySize.width) || undefined,
        height: Number(rawSourceDisplaySize.height) || undefined,
      }
    : null
  const sourceAspectRatio = Number(sourceBatchNode?.data?.sourceAspectRatio || 0)
  const batchId = createFlowId('batch_grid_gen')
  batchGridGenerationRegistry.set(batchId, {
    batchId,
    outputKind: 'batch_grid',
    sourceNodeId,
    sourceBatchNodeId: String(sourceBatchNode?.id || '').trim(),
    layout: sourceBatchNode?.data?.layout || { rows: 1, cols: 1, gap: 4 },
    sourceAspectRatio: Number.isFinite(sourceAspectRatio) && sourceAspectRatio > 0 ? sourceAspectRatio : 0,
    sourceDisplaySize,
    items: normalizeBatchGridItems(sourceBatchNode?.data?.items || []),
    outputNodeId: null,
  })
  return batchId
}

function readGridSourceSize(sourceGroupNode: any): { width?: number; height?: number } | null {
  const width = Number(sourceGroupNode?.dimensions?.width) || parseFloat(String(sourceGroupNode?.style?.width || ''))
  const height = Number(sourceGroupNode?.dimensions?.height) || parseFloat(String(sourceGroupNode?.style?.height || ''))
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

function normalizeGroupGenerationItems(items: any[]): Array<{ id: string; type: string; data: Record<string, any> }> {
  return items.map((item: any) => ({
    id: String(item?.id || item?.sourceNodeId || createFlowId('node')).trim(),
    type: String(item?.type || 'file_input').trim() || 'file_input',
    data: {
      ...(item?.data || {}),
      url: String(item?.url || item?.data?.url || '').trim(),
      thumb: String(item?.thumb || item?.data?.thumb || '').trim(),
      mediaType: String(item?.mediaType || item?.data?.mediaType || 'image').trim() || 'image',
      label: String(item?.label || item?.data?.label || '').trim(),
    },
  })).filter((item) => !!item.data.url)
}

export function createGroupGridGenerationBatch(
  sourceNodeId: string,
  sourceGroupNode: any,
  items: any[],
): string {
  const split = sourceGroupNode?.data?.gridSplit || {}
  const layout = {
    rows: Number(split.rows || Math.ceil((items.length || 1) / Math.max(Number(split.cols || 1), 1))) || 1,
    cols: Number(split.cols || Math.max(items.length, 1)) || 1,
    gap: Number(split.gap || 0) || 0,
  }
  const cellWidth = Number(split.cellWidth || 0)
  const cellHeight = Number(split.cellHeight || 0)
  const batchId = createFlowId('group_grid_gen')
  const sourceDisplaySize = readGridSourceSize(sourceGroupNode)
  batchGridGenerationRegistry.set(batchId, {
    batchId,
    outputKind: 'group',
    sourceNodeId,
    sourceBatchNodeId: String(sourceGroupNode?.id || '').trim(),
    layout,
    sourceAspectRatio: cellWidth > 0 && cellHeight > 0 ? cellWidth / cellHeight : 0,
    sourceDisplaySize,
    items: normalizeGroupGenerationItems(items),
    outputNodeId: null,
  })
  return batchId
}

export function getBatchGridGenerationBatch(batchId: string): BatchGridGenerationRecord | undefined {
  return batchGridGenerationRegistry.get(batchId)
}

export function setBatchGridGenerationOutputNodeId(batchId: string, nodeId: string): void {
  const batch = batchGridGenerationRegistry.get(batchId)
  if (batch) batch.outputNodeId = nodeId
}

export function setBatchGridGenerationItemRequests(batchId: string, requests: Array<Record<string, any>>): void {
  const batch = batchGridGenerationRegistry.get(batchId)
  if (!batch) return
  batch.items = batch.items.map((item, index) => {
    const request = requests[index]
    if (!request || typeof request !== 'object') return item
    return {
      ...item,
      data: {
        ...(item.data || {}),
        request: cloneJson(request),
      },
    }
  })
}

export function clearBatchGridGenerationBatch(batchId: string): void {
  batchGridGenerationRegistry.delete(batchId)
}

export function listBatchGridGenerationBatches(): BatchGridGenerationRecord[] {
  return Array.from(batchGridGenerationRegistry.values())
}

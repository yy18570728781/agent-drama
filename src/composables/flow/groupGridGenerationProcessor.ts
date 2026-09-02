import { createFlowId } from '@/utils/flowId'
import { gridCellPosition, gridGroupSize } from '@/utils/gridGridLayout'
import { resolveBatchGridCompletedData } from '@/utils/batchGridSlotRegenerate'
import {
  clearBatchGridGenerationBatch,
  getBatchGridGenerationBatch,
  setBatchGridGenerationOutputNodeId,
} from '@/composables/generation/useBatchGridGenerationMeta'

const PAD_X = 16
const PAD_TOP = 16
const PAD_BOTTOM = 16

function cloneRequest(item: any): Record<string, any> | null {
  const request = item?.data?.request
  if (!request || typeof request !== 'object') return null
  return JSON.parse(JSON.stringify(request))
}

function buildGenState(request: any): Record<string, any> | undefined {
  const params = request?.params
  if (!request || typeof request !== 'object' || !params || typeof params !== 'object') return undefined
  return {
    capability: String(request.capability || '').trim(),
    mode: String(request.mode || 'standard').trim() || 'standard',
    modelId: String(params.model || '').trim(),
    prompt: String(params.prompt || '').trim(),
    params: JSON.parse(JSON.stringify(params)),
  }
}

function buildPlaceholderChild(batch: any, sourceItem: any, index: number): any {
  const rows = Number(batch.layout?.rows || 1) || 1
  const cols = Number(batch.layout?.cols || Math.max(batch.items.length, 1)) || 1
  const gap = Number(batch.layout?.gap || 0) || 0
  const cellWidth = Number(batch.sourceDisplaySize?.width || 0) > 0
    ? Math.max((Number(batch.sourceDisplaySize.width) - PAD_X * 2 - (cols - 1) * gap) / cols, 1)
    : 200
  const cellHeight = Number(batch.sourceDisplaySize?.height || 0) > 0
    ? Math.max((Number(batch.sourceDisplaySize.height) - PAD_TOP - PAD_BOTTOM - (rows - 1) * gap) / rows, 1)
    : Math.round(cellWidth / Math.max(Number(batch.sourceAspectRatio || 1), 0.01))
  const request = cloneRequest(sourceItem)
  const genState = buildGenState(request)
  return {
    id: createFlowId('node'),
    type: 'aigc_result',
    position: gridCellPosition(index, cols, cellWidth, cellHeight, gap, PAD_X, PAD_TOP),
    style: { width: `${cellWidth}px`, height: `${cellHeight}px` },
    parentNode: batch.sourceNodeId,
    extent: undefined,
    data: {
      label: String(sourceItem?.data?.label || `结果_${index + 1}`).trim(),
      mediaType: 'image',
      status: 'waiting_submit',
      statusText: '准备提交...',
      progress: 0,
      isGenerating: true,
      _requestIndex: index,
      ...(request ? { request } : {}),
      ...(genState ? { _genState: genState } : {}),
    },
  }
}

function patchNodeData(deps: any, nodeId: string, patcher: (data: any) => any): void {
  const idx = deps.nodes.value.findIndex((node: any) => node.id === nodeId)
  if (idx < 0) return
  const node = deps.nodes.value[idx]
  deps.nodes.value[idx] = { ...node, data: patcher(node.data || {}) }
  deps.nodes.value = [...deps.nodes.value]
  deps.emit('update:modelNodes', deps.nodes.value)
}

function findChildByPredicate(deps: any, groupNodeId: string, predicate: (node: any) => boolean): any | null {
  return deps.nodes.value.find((node: any) => node?.parentNode === groupNodeId && predicate(node)) || null
}

export function findGroupGridNodeByTaskId(taskId: string, nodes: any[]): any | null {
  if (!taskId) return null
  const child = nodes.find((node: any) => node?.parentNode && String(node?.data?.taskId || '').trim() === taskId)
  if (!child) return null
  const parent = nodes.find((node: any) => node.id === child.parentNode)
  return parent?.type === 'groupNode' && parent?.data?.gridSplit?.role === 'split-output' ? parent : null
}

export function ensureGroupGridOutputNode(task: any, deps: any): void {
  const batchId = task?._batchGridBatchId
  const batch = batchId ? getBatchGridGenerationBatch(batchId) : null
  if (!batch || batch.outputKind !== 'group' || batch.outputNodeId) return
  const sourceIdx = deps.nodes.value.findIndex((node: any) => node.id === batch.sourceNodeId)
  if (sourceIdx < 0) return
  const sourceNode = deps.nodes.value[sourceIdx]
  const rows = Number(batch.layout?.rows || 1) || 1
  const cols = Number(batch.layout?.cols || Math.max(batch.items.length, 1)) || 1
  const gap = Number(batch.layout?.gap || 0) || 0
  const firstChild = buildPlaceholderChild(batch, batch.items[0] || {}, 0)
  const cellWidth = parseFloat(String(firstChild.style.width || '200')) || 200
  const cellHeight = parseFloat(String(firstChild.style.height || '200')) || 200
  const groupSize = gridGroupSize(rows, cols, cellWidth, cellHeight, gap, PAD_X, PAD_TOP, PAD_BOTTOM)
  const children = batch.items.map((item: any, index: number) => buildPlaceholderChild(batch, item, index))
  deps.nodes.value[sourceIdx] = {
    ...sourceNode,
    type: 'groupNode',
    style: { ...(sourceNode.style || {}), width: `${groupSize.width}px`, height: `${groupSize.height}px` },
    data: {
      label: String(sourceNode?.data?.label || '批量结果'),
      mediaType: 'image',
      layoutMode: 'grid',
      gridSplit: { rows, cols, gap, cellWidth, cellHeight, role: 'split-output' },
      gridOrder: children.map((child: any) => child.id),
    },
  }
  deps.nodes.value = [...deps.nodes.value, ...children]
  deps.emit('update:modelNodes', deps.nodes.value)
  setBatchGridGenerationOutputNodeId(batchId, batch.sourceNodeId)
}

function maybeClearGroupBatch(batchId: string, deps: any): void {
  const batch = getBatchGridGenerationBatch(batchId)
  if (!batch?.outputNodeId || batch.outputKind !== 'group') return
  const children = deps.nodes.value.filter((node: any) => node?.parentNode === batch.outputNodeId)
  if (!children.length) return
  const done = children.every((node: any) => {
    const status = String(node?.data?.status || '').trim()
    return status === 'failed' || status === 'completed' || !!node?.data?.url
  })
  if (done) clearBatchGridGenerationBatch(batchId)
}

export async function handleGroupGridGenerationEvent(payload: any, deps: any, batchId: string, taskId: string): Promise<boolean> {
  const batch = batchId ? getBatchGridGenerationBatch(batchId) : null
  const groupNodeId = batch?.outputNodeId || findGroupGridNodeByTaskId(taskId, deps.nodes.value)?.id
  if (!groupNodeId) return true
  const requestIndex = Number(payload?._requestIndex ?? payload?.batchInfo?._requestIndex ?? -1)
  const target = payload?.type === 'created'
    ? findChildByPredicate(deps, groupNodeId, (node) => Number(node?.data?._requestIndex) === requestIndex)
    : findChildByPredicate(deps, groupNodeId, (node) => String(node?.data?.taskId || '').trim() === taskId)
      || findChildByPredicate(deps, groupNodeId, (node) => Number(node?.data?._requestIndex) === requestIndex)
  if (!target) return true

  if (payload?.type === 'created') {
    patchNodeData(deps, target.id, (data) => ({
      ...data,
      taskId: String(payload?.taskId || '').trim(),
      recordId: String(payload?.recordId || '').trim(),
      _activeTaskId: String(payload?.taskId || '').trim(),
      status: 'queued',
      statusText: '排队中...',
      isGenerating: true,
      progress: 0,
    }))
  } else if (payload?.type === 'progress') {
    patchNodeData(deps, target.id, (data) => ({
      ...data,
      status: 'running',
      statusText: '生成中...',
      isGenerating: true,
      progress: Number(payload?.percent ?? payload?.progress ?? payload?.result?.percent ?? 0) || 0,
    }))
  } else if (payload?.type === 'complete') {
    const nextData = await resolveBatchGridCompletedData(payload.result || payload, target.data || {})
    patchNodeData(deps, target.id, (data) => ({
      ...data,
      ...(nextData || {}),
      status: nextData ? 'completed' : 'failed',
      statusText: nextData ? '已完成' : '结果记录未返回可用图片',
      failReason: nextData ? undefined : '结果记录未返回可用图片',
      isGenerating: false,
      progress: nextData ? 100 : undefined,
    }))
    if (batchId) maybeClearGroupBatch(batchId, deps)
  } else if (payload?.type === 'error') {
    patchNodeData(deps, target.id, (data) => ({
      ...data,
      status: 'failed',
      statusText: String(payload?.error || '生成失败'),
      failReason: String(payload?.error || '生成失败'),
      isGenerating: false,
      progress: undefined,
    }))
    if (batchId) maybeClearGroupBatch(batchId, deps)
  }
  return true
}

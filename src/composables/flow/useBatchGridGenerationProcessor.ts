import { createFlowId } from '@/utils/flowId'
import { getBatchGridGenerationBatch, setBatchGridGenerationOutputNodeId, clearBatchGridGenerationBatch } from '@/composables/generation/useBatchGridGenerationMeta'
import { buildBatchGridStyle } from '@/composables/flow/useBatchGridNode'
import { resolveBatchGridCompletedData } from '@/utils/batchGridSlotRegenerate'
import {
  ensureGroupGridOutputNode,
  findGroupGridNodeByTaskId,
  handleGroupGridGenerationEvent,
} from './groupGridGenerationProcessor'

function buildPlaceholderItem(sourceItem: any, requestIndex: number): any {
  const request = sourceItem?.data?.request && typeof sourceItem.data.request === 'object'
    ? JSON.parse(JSON.stringify(sourceItem.data.request))
    : null
  const requestParams = request?.params && typeof request.params === 'object'
    ? JSON.parse(JSON.stringify(request.params))
    : {}
  return {
    id: createFlowId('node'),
    type: 'image_generation',
    data: {
      label: String(sourceItem?.data?.label || '生成中').trim() || '生成中',
      mediaType: 'image',
      status: 'waiting_submit',
      progress: 0,
      _requestIndex: requestIndex,
      ...(request ? { request } : {}),
      ...(request ? {
        _genState: {
          capability: String(request.capability || '').trim(),
          mode: String(request.mode || 'standard').trim() || 'standard',
          modelId: String(requestParams.model || '').trim(),
          prompt: String(requestParams.prompt || '').trim(),
          params: requestParams,
        },
      } : {}),
    },
  }
}

function readRequestIndex(payload: any): number {
  if (typeof payload?._requestIndex === 'number') return payload._requestIndex
  if (typeof payload?.batchInfo?._requestIndex === 'number') return payload.batchInfo._requestIndex
  return -1
}

function readProgressPercent(payload: any): number {
  const directPercent = Number(payload?.percent)
  if (Number.isFinite(directPercent)) return directPercent
  const resultPercent = Number(payload?.result?.percent)
  if (Number.isFinite(resultPercent)) return resultPercent
  const progressPercent = Number(payload?.progress)
  if (Number.isFinite(progressPercent)) return progressPercent
  return 0
}

function cloneRequestFromItem(item: any): Record<string, any> | null {
  const request = item?.data?.request
  if (!request || typeof request !== 'object') return null
  return JSON.parse(JSON.stringify(request))
}

function buildGenStateFromRequest(request: any): Record<string, any> | undefined {
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

function findBatchGridNodeByTaskId(taskId: string, nodes: any[]): any | null {
  if (!taskId) return null
  // 路由不能依赖批次注册表是否还活着：item.data.taskId 本身就是真相源。
  // 一旦依赖 listBatchGridGenerationBatches()，批次被清掉后剩余任务的 progress/complete/error 全会被吞。
  return nodes.find((node: any) => {
    if (node.type !== 'batch_grid') return false
    const items = Array.isArray(node.data?.items) ? node.data.items : []
    return items.some((item: any) => String(item?.data?.taskId || '').trim() === taskId)
  }) || null
}

function findBatchOutputNodeByTaskId(taskId: string, nodes: any[]): any | null {
  return findBatchGridNodeByTaskId(taskId, nodes) || findGroupGridNodeByTaskId(taskId, nodes)
}

/**
 * 仅当 batch_grid 所有格子都到终态（aigc_result / failed）时才清批次。
 * 不能在第一个 complete 就清——否则同批次剩余任务的事件会因为路由失效被静默吞掉。
 */
function maybeClearBatchGridBatch(batchId: string, deps: any): void {
  const batch = getBatchGridGenerationBatch(batchId)
  if (!batch?.outputNodeId) return
  const node = deps.nodes.value.find((n: any) => n.id === batch.outputNodeId)
  const items: any[] = Array.isArray(node?.data?.items) ? node.data.items : []
  if (!items.length) {
    clearBatchGridGenerationBatch(batchId)
    return
  }
  const allTerminal = items.every((item: any) => {
    if (item?.type === 'aigc_result') return true
    const status = String(item?.data?.status || '').trim()
    return status === 'failed' || status === 'completed'
  })
  if (allTerminal) clearBatchGridGenerationBatch(batchId)
}

function patchBatchGridItem(nodeId: string, deps: any, predicate: (item: any, index: number) => boolean, patcher: (item: any) => any): void {
  const idx = deps.nodes.value.findIndex((node: any) => node.id === nodeId)
  if (idx < 0) return
  const node = deps.nodes.value[idx]
  const items = Array.isArray(node.data?.items) ? node.data.items : []
  let touched = false
  const nextItems = items.map((item: any, index: number) => {
    if (!predicate(item, index)) return item
    touched = true
    return patcher(item)
  })
  if (!touched) return
  deps.nodes.value[idx] = { ...node, data: { ...node.data, items: nextItems } }
  deps.nodes.value = [...deps.nodes.value]
  deps.emit('update:modelNodes', deps.nodes.value)
}

function ensureBatchGridOutputNode(task: any, deps: any): void {
  const batchId = task?._batchGridBatchId
  if (!batchId) return
  const batch = getBatchGridGenerationBatch(batchId)
  if (!batch || batch.outputNodeId) return
  if (batch.outputKind === 'group') {
    ensureGroupGridOutputNode(task, deps)
    return
  }
  const sourceIdx = deps.nodes.value.findIndex((node: any) => node.id === batch.sourceNodeId)
  if (sourceIdx < 0) return
  const sourceNode = deps.nodes.value[sourceIdx]
  const rows = Number(batch.layout?.rows || 1) || 1
  const cols = Number(batch.layout?.cols || Math.max(batch.items.length, 1)) || 1
  const gap = Number(batch.layout?.gap || 4) || 4
  const style = buildBatchGridStyle({
    rows,
    cols,
    gap,
    sourceAspectRatio: batch.sourceAspectRatio,
    sourceDisplaySize: batch.sourceDisplaySize || undefined,
  })
  deps.nodes.value[sourceIdx] = {
    ...sourceNode,
    type: 'batch_grid',
    style,
    data: {
      ...(sourceNode.data || {}),
      label: '批量节点',
      mediaType: 'image',
      layout: { rows, cols, gap },
      sourceAspectRatio: batch.sourceAspectRatio || undefined,
      ...(batch.sourceDisplaySize ? { sourceDisplaySize: batch.sourceDisplaySize } : {}),
      items: batch.items.map((item, index) => buildPlaceholderItem(item, index)),
      status: undefined,
      statusText: undefined,
      progress: undefined,
      isGenerating: false,
      taskId: undefined,
      _activeTaskId: undefined,
    },
  }
  deps.nodes.value = [...deps.nodes.value]
  deps.emit('update:modelNodes', deps.nodes.value)
  setBatchGridGenerationOutputNodeId(batchId, batch.sourceNodeId)
}

/**
 * 同步预检：判断事件是否可能由 batch_grid 批处理器接管。
 * 用于避免对明确无关的事件执行 await（await 即便是 resolved Promise 也会让出微任务，
 * 期间 queue-bind 事件会插队创建 slot，导致 start 恢复后重复创建占位卡）。
 */
export function canBeBatchGridGenerationEvent(payload: any, nodes: any[]): boolean {
  const batchId = payload?._batchGridBatchId || payload?.result?._batchGridBatchId || payload?.batchInfo?._batchGridBatchId || payload?.task?._batchGridBatchId
  if (batchId) return true
  const taskId = String(payload?.taskId || '').trim()
  if (!taskId) return false
  return !!findBatchOutputNodeByTaskId(taskId, nodes)
}

/**
 * 处理单文件批量模式的正式事件，把结果原地写回下游 batch_grid。
 * @param payload 生成事件。
 * @param deps Flow 事件处理依赖。
 * @returns 是否已由 batch_grid 批处理器接管。
 */
export async function handleBatchGridGenerationEvent(payload: any, deps: any): Promise<boolean> {
  const batchId = payload?._batchGridBatchId || payload?.result?._batchGridBatchId || payload?.batchInfo?._batchGridBatchId || payload?.task?._batchGridBatchId
  const taskId = String(payload?.taskId || '').trim()
  if (!batchId && !findBatchOutputNodeByTaskId(taskId, deps.nodes.value)) return false

  if (payload?.type === 'start') {
    ensureBatchGridOutputNode(payload.task, deps)
    return true
  }

  const batch = batchId ? getBatchGridGenerationBatch(batchId) : null
  if (batch?.outputKind === 'group' || (!batch && findGroupGridNodeByTaskId(taskId, deps.nodes.value))) {
    return handleGroupGridGenerationEvent(payload, deps, batchId, taskId)
  }
  const nodeId = batch?.outputNodeId || findBatchGridNodeByTaskId(taskId, deps.nodes.value)?.id
  if (!nodeId) return true

  if (payload?.type === 'queue-bind') {
    return true
  }

  if (payload?.type === 'created') {
    const requestIndex = readRequestIndex(payload)
    patchBatchGridItem(
      nodeId,
      deps,
      (_item, index) => requestIndex >= 0 && index === requestIndex,
      (item) => ({
        ...item,
        type: 'image_generation',
        data: {
          ...(item.data || {}),
          ...(cloneRequestFromItem(item) ? { request: cloneRequestFromItem(item) } : {}),
          ...(buildGenStateFromRequest(cloneRequestFromItem(item)) ? { _genState: buildGenStateFromRequest(cloneRequestFromItem(item)) } : {}),
          taskId: String(payload?.taskId || '').trim(),
          recordId: String(payload?.recordId || '').trim(),
          _activeTaskId: String(payload?.taskId || '').trim(),
          status: 'queued',
          statusText: '排队中...',
          isGenerating: true,
          progress: 0,
          modelDisplayName: String(payload?.modelDisplayName || '').trim(),
          prompt: String(payload?.prompt || '').trim(),
        },
      }),
    )
    return true
  }

  if (payload?.type === 'progress') {
    const percent = readProgressPercent(payload)
    patchBatchGridItem(
      nodeId,
      deps,
      (item) => String(item?.data?.taskId || '').trim() === taskId,
      (item) => ({
        ...item,
        type: 'image_generation',
        data: {
          ...(item.data || {}),
          ...(cloneRequestFromItem(item) ? { request: cloneRequestFromItem(item) } : {}),
          ...(buildGenStateFromRequest(cloneRequestFromItem(item)) ? { _genState: buildGenStateFromRequest(cloneRequestFromItem(item)) } : {}),
          taskId: taskId || String(item?.data?.taskId || '').trim(),
          _activeTaskId: taskId || String(item?.data?._activeTaskId || '').trim(),
          status: 'running',
          statusText: '生成中...',
          isGenerating: true,
          progress: percent,
        },
      }),
    )
    return true
  }

  if (payload?.type === 'complete') {
    const requestIndex = readRequestIndex(payload)
    const idx = deps.nodes.value.findIndex((node: any) => node.id === nodeId)
    if (idx >= 0) {
      const node = deps.nodes.value[idx]
      const items = Array.isArray(node.data?.items) ? node.data.items : []
      const nextItems = await Promise.all(items.map(async (item: any) => {
        const itemTaskId = String(item?.data?.taskId || '').trim()
        const itemRequestIndex = Number(item?.data?._requestIndex)
        const matchesTaskId = !!taskId && itemTaskId === taskId
        const matchesRequestIndex = requestIndex >= 0 && Number.isFinite(itemRequestIndex) && itemRequestIndex === requestIndex
        if (!matchesTaskId && !matchesRequestIndex) return item
        const nextData = await resolveBatchGridCompletedData(payload.result || payload, item.data || {})
        if (!nextData) {
          return {
            ...item,
            data: {
              ...(item.data || {}),
              status: 'failed',
              statusText: '结果记录未返回可用图片',
              failReason: '结果记录未返回可用图片',
              isGenerating: false,
              progress: undefined,
            },
          }
        }
        return {
          ...item,
          type: 'aigc_result',
          data: {
            ...nextData,
            _requestIndex: item?.data?._requestIndex,
          },
        }
      }))
      deps.nodes.value[idx] = { ...node, data: { ...node.data, items: nextItems } }
      deps.nodes.value = [...deps.nodes.value]
      deps.emit('update:modelNodes', deps.nodes.value)
    }
    if (batchId) maybeClearBatchGridBatch(batchId, deps)
    return true
  }

  if (payload?.type === 'error') {
    const requestIndex = typeof payload?.batchInfo?._requestIndex === 'number' ? payload.batchInfo._requestIndex : -1
    patchBatchGridItem(
      nodeId,
      deps,
      (item, index) => (
        String(item?.data?.taskId || '').trim() === taskId
        || (taskId ? false : index === requestIndex)
      ),
      (item) => ({
        ...item,
        type: 'image_generation',
        data: {
          ...(item.data || {}),
          ...(cloneRequestFromItem(item) ? { request: cloneRequestFromItem(item) } : {}),
          ...(buildGenStateFromRequest(cloneRequestFromItem(item)) ? { _genState: buildGenStateFromRequest(cloneRequestFromItem(item)) } : {}),
          status: 'failed',
          statusText: String(payload?.error || '生成失败'),
          failReason: String(payload?.error || '生成失败'),
          isGenerating: false,
          progress: undefined,
        },
      }),
    )
    if (batchId) maybeClearBatchGridBatch(batchId, deps)
    return true
  }

  return true
}

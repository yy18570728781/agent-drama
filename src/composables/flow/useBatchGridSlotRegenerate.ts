import { inject } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { ElMessage } from 'element-plus'
import type { GenerationRequestPayload } from '@/api/generation'
import { normalizeBatchGridItems } from '@/utils/batchGridItems'
import {
  buildBatchGridGenerationStatusData,
  buildBatchGridRegenerateRequestFromRecord,
  cloneBatchGridRegenerateRequest,
  createBatchGridSlotKey,
} from '@/utils/batchGridSlotRegenerate'
import { createBatchGridSlotQueueCallbacks } from '@/utils/batchGridSlotRegenerateCallbacks'
import { useTaskQueueStore } from '@/stores/task-queue'

const activeBatchGridSlotRequests = new Set<string>()
const activeBatchGridSlotStreams = new Map<string, () => void>()

type BatchGridItem = {
  id: string
  type: string
  data: Record<string, any>
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/**
 * 为 batch_grid 的单格结果提供正式队列重生能力。
 * @returns 当前格子是否可重生，以及触发原地重生的方法。
 * @throws 不主动抛出；失败时通过消息提示并恢复原格子。
 */
export function useBatchGridSlotRegenerate(): {
  canRegenerateBatchGridSlot: (nodeId: string, itemId: string) => boolean
  regenerateBatchGridSlot: (nodeId: string, itemId: string) => Promise<void>
} {
  const { findNode, updateNodeData } = useVueFlow()
  const saveHistory = inject<() => void>('flowSaveHistory', () => {})
  const taskQueueStore = useTaskQueueStore()

  function updateItem(nodeId: string, itemId: string, updater: (item: BatchGridItem) => BatchGridItem): BatchGridItem | null {
    const node = findNode(nodeId)
    if (!node?.data) return null
    const items = normalizeBatchGridItems(node.data.items || [])
    const index = items.findIndex((item) => item.id === itemId)
    if (index < 0) return null
    const nextItems = [...items]
    nextItems[index] = updater(nextItems[index] as BatchGridItem)
    updateNodeData(nodeId, { items: nextItems })
    return nextItems[index] as BatchGridItem
  }

  function findItem(nodeId: string, itemId: string): BatchGridItem | null {
    const node = findNode(nodeId)
    if (!node?.data) return null
    const items = normalizeBatchGridItems(node.data.items || [])
    return (items.find((item) => item.id === itemId) as BatchGridItem) || null
  }

  function canRegenerateBatchGridSlot(nodeId: string, itemId: string): boolean {
    if (!nodeId || !itemId) return false
    const item = findItem(nodeId, itemId)
    const status = normalizeString(item?.data?.status)
    if (!item) return false
    if (status === 'waiting_submit' || status === 'queued' || status === 'running') return false
    return !!(item.data?.recordId || item.data?.request || item.data?._genState?.params)
  }

  async function resolveRegenerateRequest(nodeId: string, itemId: string): Promise<GenerationRequestPayload | null> {
    const item = findItem(nodeId, itemId)
    const request = cloneBatchGridRegenerateRequest(item?.data?.request)
    if (request) return request
    const genStateCapability = normalizeString(item?.data?._genState?.capability)
    const genStateParams = item?.data?._genState?.params
    if (genStateCapability && genStateParams && typeof genStateParams === 'object' && !Array.isArray(genStateParams)) {
      return {
        capability: genStateCapability,
        mode: normalizeString(item?.data?._genState?.mode) || 'standard',
        params: cloneJson(genStateParams),
      }
    }
    const recordId = normalizeString(item?.data?.recordId)
    if (!recordId) return null
    return buildBatchGridRegenerateRequestFromRecord(recordId)
  }

  async function regenerateBatchGridSlot(nodeId: string, itemId: string): Promise<void> {
    if (!nodeId || !itemId) {
      ElMessage.warning('当前格子缺少可重试信息')
      return
    }
    const currentItem = findItem(nodeId, itemId)
    if (!currentItem) {
      ElMessage.warning('未找到当前格子')
      return
    }
    const currentStatus = normalizeString(currentItem.data?.status)
    if (currentStatus === 'waiting_submit' || currentStatus === 'queued' || currentStatus === 'running') {
      ElMessage.info('当前格子仍在生成中')
      return
    }
    const request = await resolveRegenerateRequest(nodeId, itemId)
    if (!request) {
      ElMessage.warning('当前格子缺少可复用的生成参数')
      return
    }
    const slotKey = createBatchGridSlotKey(nodeId, itemId)
    if (activeBatchGridSlotRequests.has(slotKey)) return
    activeBatchGridSlotRequests.add(slotKey)
    activeBatchGridSlotStreams.get(slotKey)?.()
    activeBatchGridSlotStreams.delete(slotKey)

    const previousItem = currentItem
    updateItem(nodeId, itemId, (item) => ({
      ...item,
      type: 'image_generation',
      data: buildBatchGridGenerationStatusData(request, item.data || {}, 'waiting_submit', { progress: 0 }),
    }))
    saveHistory()

    try {
      taskQueueStore.enqueueGeneration({
        request,
        prompt: normalizeString(request.params?.prompt) || normalizeString(previousItem?.data?.label) || '批量重生',
        modelInfo: normalizeString(request.params?.model || previousItem?.data?.model || ''),
        modelDisplayName: normalizeString(previousItem?.data?.modelDisplayName || previousItem?.data?.model || request.params?.model || ''),
        genType: 'image',
        flowNodeId: nodeId,
        callbacks: createBatchGridSlotQueueCallbacks({
          request,
          previousData: previousItem?.data || {},
          setStream: (close) => activeBatchGridSlotStreams.set(slotKey, close),
          closeStream: () => {
            activeBatchGridSlotStreams.get(slotKey)?.()
            activeBatchGridSlotStreams.delete(slotKey)
          },
          finish: () => {
            activeBatchGridSlotRequests.delete(slotKey)
          },
          updateItem: (updater) => {
            updateItem(nodeId, itemId, updater)
          },
        }),
      })
    } catch (error: any) {
      activeBatchGridSlotRequests.delete(slotKey)
      activeBatchGridSlotStreams.get(slotKey)?.()
      activeBatchGridSlotStreams.delete(slotKey)
      if (previousItem) updateItem(nodeId, itemId, () => previousItem)
      ElMessage.error(error?.message || '原地重新生成失败')
    }
  }

  return {
    canRegenerateBatchGridSlot,
    regenerateBatchGridSlot,
  }
}

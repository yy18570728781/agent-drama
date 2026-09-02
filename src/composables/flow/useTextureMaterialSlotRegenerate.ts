import { inject } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { ElMessage } from 'element-plus'
import type { GenerationRequestPayload } from '@/api/generation'
import { buildTextureMaterialGenerationItem } from '@/composables/flow/textureMaterialGenerationItems'
import { normalizeTextureMaterialItems } from '@/utils/textureMaterialItems'
import {
  buildTextureGenerationStatusData,
  buildTextureRegenerateRequestFromRecord,
  cloneTextureRegenerateRequest,
  createTextureSlotKey,
} from '@/utils/textureMaterialSlotRegenerate'
import { createTextureSlotQueueCallbacks } from '@/utils/textureMaterialSlotRegenerateCallbacks'
import type { PBRChannel } from '@/types/pbr.types'
import { useTaskQueueStore } from '@/stores/task-queue'

const activeTextureSlotRequests = new Set<string>()
const activeTextureSlotStreams = new Map<string, () => void>()

/**
 * 让 3D 材质格子按正式队列链路原地重新生成。
 * @returns 提供槽位是否可重生与触发重生的方法。
 * @throws 不主动抛出；提交失败时会通过消息提示用户。
 */
export function useTextureMaterialSlotRegenerate(): {
  canRegenerateTextureSlot: (nodeId: string, channel: string) => boolean
  regenerateTextureSlot: (nodeId: string, channel: PBRChannel) => Promise<void>
} {
  const { findNode, updateNodeData } = useVueFlow()
  const saveHistory = inject<() => void>('flowSaveHistory', () => {})
  const taskQueueStore = useTaskQueueStore()

  function updateSlot(nodeId: string, channel: PBRChannel, updater: (item: any) => any): any | null {
    const node = findNode(nodeId)
    if (!node?.data) return null
    const items = normalizeTextureMaterialItems(node.data.items || [])
    const index = items.findIndex((item) => item.pbrChannel === channel)
    if (index < 0) return null
    const nextItems = [...items]
    nextItems[index] = updater(nextItems[index])
    updateNodeData(nodeId, { items: nextItems })
    return nextItems[index]
  }

  function findRequestSource(nodeId: string, channel: PBRChannel): any | null {
    const node = findNode(nodeId)
    if (!node?.data) return null
    const items = normalizeTextureMaterialItems(node.data.items || [])
    return items.find((item) => item.pbrChannel === channel) || null
  }

  function canRegenerateTextureSlot(nodeId: string, channel: string): boolean {
    if (!nodeId || !channel || channel === 'albedo') return false
    const item = findRequestSource(nodeId, channel as PBRChannel)
    const status = String(item?.data?.status || '').trim()
    if (!item) return false
    if (status === 'waiting_submit' || status === 'queued' || status === 'running') return false
    return !!(item.data?.recordId || item.data?.request)
  }

  async function resolveRegenerateRequest(nodeId: string, channel: PBRChannel): Promise<GenerationRequestPayload | null> {
    const item = findRequestSource(nodeId, channel)
    const request = cloneTextureRegenerateRequest(item?.data?.request)
    if (request) return request
    const recordId = String(item?.data?.recordId || '').trim()
    if (!recordId) return null
    return buildTextureRegenerateRequestFromRecord(recordId)
  }

  async function regenerateTextureSlot(nodeId: string, channel: PBRChannel): Promise<void> {
    if (!canRegenerateTextureSlot(nodeId, channel)) return
    const request = await resolveRegenerateRequest(nodeId, channel)
    if (!request) {
      ElMessage.warning('当前通道缺少可复用的生成参数')
      return
    }

    const slotKey = createTextureSlotKey(nodeId, channel)
    if (activeTextureSlotRequests.has(slotKey)) return
    activeTextureSlotRequests.add(slotKey)
    activeTextureSlotStreams.get(slotKey)?.()
    activeTextureSlotStreams.delete(slotKey)

    const previousItem = findRequestSource(nodeId, channel)
    const placeholder = buildTextureMaterialGenerationItem(channel)
    updateSlot(nodeId, channel, () => ({
      ...placeholder,
      data: buildTextureGenerationStatusData(request, placeholder.data || {}, 'waiting_submit', { progress: 0 }),
    }))
    saveHistory()

    try {
      taskQueueStore.enqueueGeneration({
        request,
        prompt: String(request.params?.prompt || channel).trim(),
        modelInfo: String(request.params?.model || previousItem?.data?.model || '').trim(),
        modelDisplayName: String(previousItem?.data?.modelDisplayName || previousItem?.data?.model || request.params?.model || '').trim(),
        genType: 'image',
        flowNodeId: nodeId,
        callbacks: createTextureSlotQueueCallbacks({
          channel,
          request,
          previousData: previousItem?.data || {},
          setStream: (close) => activeTextureSlotStreams.set(slotKey, close),
          closeStream: () => {
            activeTextureSlotStreams.get(slotKey)?.()
            activeTextureSlotStreams.delete(slotKey)
          },
          finish: () => {
            activeTextureSlotRequests.delete(slotKey)
          },
          updateSlot: (updater) => {
            updateSlot(nodeId, channel, updater)
          },
        }),
      })
    } catch (error: any) {
      activeTextureSlotRequests.delete(slotKey)
      activeTextureSlotStreams.get(slotKey)?.()
      activeTextureSlotStreams.delete(slotKey)
      if (previousItem) {
        updateSlot(nodeId, channel, () => previousItem)
      }
      ElMessage.error(error?.message || '原地重新生成失败')
    }
  }

  return {
    canRegenerateTextureSlot,
    regenerateTextureSlot,
  }
}

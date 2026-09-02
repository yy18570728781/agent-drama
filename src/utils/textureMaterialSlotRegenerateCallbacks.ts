import { subscribeTaskEvents, type GenerationRequestPayload } from '@/api/generation'
import type { GenerationCallbacks } from '@/stores/task-queue/taskQueue.types'
import {
  buildTextureGenerationStatusData,
  resolveTextureCompletedData,
} from '@/utils/textureMaterialSlotRegenerate'

type TextureSlotItem = {
  type?: string
  data?: Record<string, any>
}

type TextureSlotUpdater = (item: TextureSlotItem) => TextureSlotItem

type TextureSlotQueueCallbackOptions = {
  channel: string
  request: GenerationRequestPayload
  previousData: Record<string, any>
  setStream: (close: () => void) => void
  closeStream: () => void
  finish: () => void
  updateSlot: (updater: TextureSlotUpdater) => void
}

function buildFailedUpdater(
  request: GenerationRequestPayload,
  taskId: string,
  message: string,
): TextureSlotUpdater {
  return (item) => ({
    ...item,
    data: buildTextureGenerationStatusData(request, item.data || {}, 'failed', {
      taskId,
      failReason: message,
      statusText: message,
    }),
  })
}

async function applyCompletedState(
  options: TextureSlotQueueCallbackOptions,
  result: unknown,
  fallbackMessage: string,
): Promise<void> {
  const nextData = await resolveTextureCompletedData(result, options.previousData)
  if (!nextData) {
    options.updateSlot(buildFailedUpdater(options.request, '', fallbackMessage))
    options.closeStream()
    options.finish()
    return
  }
  options.updateSlot((item) => ({ ...item, type: 'aigc_result', data: nextData }))
  options.closeStream()
  options.finish()
}

function createStreamCallbacks(
  options: TextureSlotQueueCallbackOptions,
  taskId: string,
  createdRecordId: string,
): Parameters<typeof subscribeTaskEvents>[1] {
  const patchRecordId = createdRecordId ? { recordId: createdRecordId } : {}
  return {
    onStatus: (event) => {
      options.updateSlot((item) => ({
        ...item,
        data: buildTextureGenerationStatusData(options.request, item.data || {}, event?.status || 'queued', {
          taskId,
          ...patchRecordId,
        }),
      }))
    },
    onProgress: (event) => {
      options.updateSlot((item) => ({
        ...item,
        data: buildTextureGenerationStatusData(options.request, item.data || {}, 'running', {
          taskId,
          progress: typeof event?.percent === 'number' ? event.percent : 0,
          ...patchRecordId,
        }),
      }))
    },
    onCompleted: async (event) => {
      await applyCompletedState(options, event, '结果记录未返回可用图片')
    },
    onTaskError: (event) => {
      options.updateSlot(buildFailedUpdater(options.request, taskId, String(event?.message || '生成失败')))
      options.closeStream()
      options.finish()
    },
    onConnectionError: (message) => {
      options.updateSlot(buildFailedUpdater(options.request, taskId, String(message || '生成连接失败')))
      options.closeStream()
      options.finish()
    },
  }
}

/**
 * 为材质槽位原地重生创建与正式任务队列一致的回调集合。
 * @param options 槽位更新、流控制与历史结果所需的上下文。
 * @returns 传给队列 enqueueGeneration 的 callbacks 对象。
 * @throws 不主动抛出；异步完成阶段的异常会由调用链处理。
 */
export function createTextureSlotQueueCallbacks(options: TextureSlotQueueCallbackOptions): GenerationCallbacks {
  return {
    onCreated: (_recordId, taskId, result) => {
      const createdRecordId = String(result?.record_id || result?.aigc_record_id || '').trim()
      options.updateSlot((item) => ({
        ...item,
        data: buildTextureGenerationStatusData(options.request, item.data || {}, 'queued', {
          taskId,
          progress: 0,
          ...(createdRecordId ? { recordId: createdRecordId } : {}),
        }),
      }))
      options.setStream(subscribeTaskEvents(taskId, createStreamCallbacks(options, taskId, createdRecordId)))
    },
    onProgress: (_recordId, percent, data) => {
      const taskId = String(data?.task_id || data?.taskId || '').trim()
      options.updateSlot((item) => ({
        ...item,
        data: buildTextureGenerationStatusData(options.request, item.data || {}, 'running', {
          taskId,
          progress: percent,
        }),
      }))
    },
    onCompleted: async (_recordId, result) => {
      await applyCompletedState(options, result, '结果记录未返回可用图片')
    },
    onError: (_recordId, message) => {
      options.updateSlot(buildFailedUpdater(options.request, '', String(message || '生成失败')))
      options.closeStream()
      options.finish()
    },
  }
}

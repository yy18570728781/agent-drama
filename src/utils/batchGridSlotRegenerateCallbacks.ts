import { subscribeTaskEvents, type GenerationRequestPayload } from '@/api/generation'
import type { GenerationCallbacks } from '@/stores/task-queue/taskQueue.types'
import {
  buildBatchGridGenerationStatusData,
  resolveBatchGridCompletedData,
} from '@/utils/batchGridSlotRegenerate'

type BatchGridItem = {
  id: string
  type: string
  data: Record<string, any>
}

type BatchGridItemUpdater = (item: BatchGridItem) => BatchGridItem

type BatchGridSlotQueueCallbackOptions = {
  request: GenerationRequestPayload
  previousData: Record<string, any>
  setStream: (close: () => void) => void
  closeStream: () => void
  finish: () => void
  updateItem: (updater: BatchGridItemUpdater) => void
}

function buildFailedUpdater(
  request: GenerationRequestPayload,
  taskId: string,
  message: string,
): BatchGridItemUpdater {
  return (item) => ({
    ...item,
    data: buildBatchGridGenerationStatusData(request, item.data || {}, 'failed', {
      taskId,
      failReason: message,
      statusText: message,
    }),
  })
}

async function applyCompletedState(
  options: BatchGridSlotQueueCallbackOptions,
  result: unknown,
  fallbackMessage: string,
): Promise<void> {
  const nextData = await resolveBatchGridCompletedData(result, options.previousData)
  if (!nextData) {
    options.updateItem(buildFailedUpdater(options.request, '', fallbackMessage))
    options.closeStream()
    options.finish()
    return
  }
  options.updateItem((item) => ({ ...item, type: 'aigc_result', data: nextData }))
  options.closeStream()
  options.finish()
}

function createStreamCallbacks(
  options: BatchGridSlotQueueCallbackOptions,
  taskId: string,
  createdRecordId: string,
): Parameters<typeof subscribeTaskEvents>[1] {
  const patchRecordId = createdRecordId ? { recordId: createdRecordId } : {}
  return {
    onStatus: (event) => {
      options.updateItem((item) => ({
        ...item,
        data: buildBatchGridGenerationStatusData(options.request, item.data || {}, event?.status || 'queued', {
          taskId,
          ...patchRecordId,
        }),
      }))
    },
    onProgress: (event) => {
      options.updateItem((item) => ({
        ...item,
        data: buildBatchGridGenerationStatusData(options.request, item.data || {}, 'running', {
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
      options.updateItem(buildFailedUpdater(options.request, taskId, String(event?.message || '生成失败')))
      options.closeStream()
      options.finish()
    },
    onConnectionError: (message) => {
      options.updateItem(buildFailedUpdater(options.request, taskId, String(message || '生成连接失败')))
      options.closeStream()
      options.finish()
    },
  }
}

/**
 * 为 batch_grid 的单格原地重生创建正式任务队列回调。
 * @param options 当前格子写回、SSE 连接与旧数据解析所需的上下文。
 * @returns 传给 enqueueGeneration 的 callbacks。
 * @throws 不主动抛出；失败时通过格子状态反馈。
 */
export function createBatchGridSlotQueueCallbacks(options: BatchGridSlotQueueCallbackOptions): GenerationCallbacks {
  return {
    onCreated: (_recordId, taskId, result) => {
      const createdRecordId = String(result?.record_id || result?.aigc_record_id || '').trim()
      options.updateItem((item) => ({
        ...item,
        data: buildBatchGridGenerationStatusData(options.request, item.data || {}, 'queued', {
          taskId,
          progress: 0,
          ...(createdRecordId ? { recordId: createdRecordId } : {}),
        }),
      }))
      options.setStream(subscribeTaskEvents(taskId, createStreamCallbacks(options, taskId, createdRecordId)))
    },
    onProgress: (_recordId, percent, data) => {
      const taskId = String(data?.task_id || data?.taskId || '').trim()
      options.updateItem((item) => ({
        ...item,
        data: buildBatchGridGenerationStatusData(options.request, item.data || {}, 'running', {
          taskId,
          progress: percent,
        }),
      }))
    },
    onCompleted: async (_recordId, result) => {
      await applyCompletedState(options, result, '结果记录未返回可用图片')
    },
    onError: (_recordId, message) => {
      options.updateItem(buildFailedUpdater(options.request, '', String(message || '生成失败')))
      options.closeStream()
      options.finish()
    },
  }
}

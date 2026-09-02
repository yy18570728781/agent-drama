import { nextTick } from 'vue'
import type { UseBatchGridNodeDeps } from '@/composables/flow/useBatchGridNode'
import type { PBRChannel } from '@/types/pbr.types'
import {
  getBatch,
  markChannelCollected,
  isBatchComplete,
  clearBatch,
} from '@/composables/generation/useTextureBatchMeta'

export interface BatchProcessorDeps extends UseBatchGridNodeDeps {}

/**
 * 标记某通道已收齐（items 聚合模式下：item 自身已写完成态，容器无需额外动作）。
 * 批次完成后仅清理 batch meta（不再清孤儿子卡，因为不存在独立子卡）。
 */
export function markBatchChannelComplete(
  batchId: string,
  channel: PBRChannel,
  deps: BatchProcessorDeps,
): void {
  void deps
  const batch = getBatch(batchId)
  if (!batch) return
  markChannelCollected(batchId, channel)
  if (isBatchComplete(batchId)) clearBatch(batchId)
}

export function handleBatchChannelFailed(
  batchId: string,
  channel: PBRChannel,
  deps: BatchProcessorDeps,
): void {
  markBatchChannelComplete(batchId, channel, deps)
}

export function scheduleMarkBatchChannelComplete(
  batchId: string,
  channel: PBRChannel,
  deps: BatchProcessorDeps,
): void {
  nextTick(() => markBatchChannelComplete(batchId, channel, deps))
}

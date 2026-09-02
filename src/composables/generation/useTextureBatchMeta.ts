import type { PBRChannel } from '@/types/pbr.types'
import { createFlowId } from '@/utils/flowId'

interface BatchRecord {
  batchId: string
  channels: PBRChannel[]
  sourceNodeId: string | null
  tmNodeId: string | null
  collectedChannels: Set<PBRChannel>
}

const batchRegistry = new Map<string, BatchRecord>()
let currentBatchId: string | null = null

function normalizeBatchChannels(channels: PBRChannel[]): PBRChannel[] {
  const seen = new Set<PBRChannel>()
  return channels.filter((channel) => {
    if (channel === 'albedo' || seen.has(channel)) return false
    seen.add(channel)
    return true
  })
}

export function createTextureBatch(
  channels: PBRChannel[],
  sourceNodeId?: string,
): string {
  const batchId = createFlowId('pbr_batch')
  batchRegistry.set(batchId, {
    batchId,
    channels: normalizeBatchChannels(channels),
    sourceNodeId: sourceNodeId || null,
    tmNodeId: null,
    collectedChannels: new Set(),
  })
  currentBatchId = batchId
  return batchId
}

export function getCurrentBatchId(): string | null {
  return currentBatchId
}

export function clearCurrentBatchId(): void {
  currentBatchId = null
}

export function getBatch(batchId: string): BatchRecord | undefined {
  return batchRegistry.get(batchId)
}

export function setBatchTmNodeId(batchId: string, tmNodeId: string): void {
  const batch = batchRegistry.get(batchId)
  if (batch) batch.tmNodeId = tmNodeId
}

export function markChannelCollected(batchId: string, channel: PBRChannel): void {
  const batch = batchRegistry.get(batchId)
  if (batch) batch.collectedChannels.add(channel)
}

export function removeFailedChannel(batchId: string, channel: PBRChannel): void {
  const batch = batchRegistry.get(batchId)
  if (!batch) return
  batch.channels = batch.channels.filter((c) => c !== channel)
}

export function isBatchComplete(batchId: string): boolean {
  const batch = batchRegistry.get(batchId)
  if (!batch) return false
  return batch.collectedChannels.size >= batch.channels.length
}

export function clearBatch(batchId: string): void {
  batchRegistry.delete(batchId)
}

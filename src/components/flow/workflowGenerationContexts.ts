import {
  createBatchGridGenerationBatch,
  createGroupGridGenerationBatch,
} from '@/composables/generation/useBatchGridGenerationMeta'
import { resolveStoredUpstreamInputs } from '@/utils/workflowUpstreamMedia'

type FindNode = (id: string) => any

function normalizeMediaItem(item: any): any {
  return {
    ...item,
    url: String(item?.url || item?.data?.url || '').trim(),
    thumb: String(item?.thumb || item?.data?.thumb || '').trim(),
    mediaType: String(item?.mediaType || item?.data?.mediaType || 'image').trim() || 'image',
    label: String(item?.label || item?.data?.label || '').trim(),
    sourceNodeId: String(item?.sourceNodeId || item?.nodeId || item?.id || '').trim(),
  }
}

function resolveBatchGridContext(node: any, findNode: FindNode, upstreamImages: any[]): any | null {
  const firstSourceNodeId = String(upstreamImages[0]?.nodeId || '').trim()
  const upstreamNode = firstSourceNodeId ? findNode(firstSourceNodeId) : null
  if (upstreamNode?.type !== 'batch_grid') return null
  const items = Array.isArray(upstreamNode?.data?.items) ? upstreamNode.data.items : []
  const normalizedItems = items.map(normalizeMediaItem).filter((item: any) => !!item.url)
  if (!normalizedItems.length) return null
  return {
    batchId: createBatchGridGenerationBatch(String(node?.id || ''), upstreamNode),
    items: normalizedItems,
  }
}

function resolveGroupGridContext(node: any, findNode: FindNode, upstreamImages: any[]): any | null {
  const firstGroupNodeId = String(upstreamImages.find((item: any) => item?.groupAggregate)?.groupNodeId || '').trim()
  const groupNode = firstGroupNodeId ? findNode(firstGroupNodeId) : null
  if (groupNode?.type !== 'groupNode') return null
  const items = upstreamImages
    .filter((item: any) => String(item?.groupNodeId || '').trim() === firstGroupNodeId)
    .sort((a: any, b: any) => Number(a?.groupOrder ?? 0) - Number(b?.groupOrder ?? 0))
    .map(normalizeMediaItem)
    .filter((item: any) => !!item.url)
  if (!items.length) return null
  return {
    batchId: createGroupGridGenerationBatch(String(node?.id || ''), groupNode, items),
    items,
  }
}

export function resolveWorkflowBatchContext(node: any, findNode: FindNode): any | null {
  const upstreamImages = resolveStoredUpstreamInputs(node?.data?._upstreamInputs, findNode).images
  return resolveGroupGridContext(node, findNode, upstreamImages)
    || resolveBatchGridContext(node, findNode, upstreamImages)
}

export function resolveWorkflowOrdinaryContext(node: any, findNode: FindNode): any | null {
  const resolvedInputs = resolveStoredUpstreamInputs(node?.data?._upstreamInputs, findNode)
  const upstreamImages = resolvedInputs.images
  const upstreamVideos = resolvedInputs.videos
  const upstreamAudios = resolvedInputs.audios
  const firstSourceNodeId = String(upstreamImages[0]?.nodeId || upstreamVideos[0]?.nodeId || upstreamAudios[0]?.nodeId || '').trim()
  if (!firstSourceNodeId) return null
  const upstreamNode = findNode(firstSourceNodeId)
  if (!upstreamNode || upstreamNode.type === 'batch_grid') return null
  if (upstreamImages.some((item: any) => item?.groupAggregate)) return null
  const items = [
    ...upstreamImages.map((item: any) => normalizeMediaItem({ ...item, mediaType: 'image' })),
    ...upstreamVideos.map((item: any) => normalizeMediaItem({ ...item, mediaType: 'video' })),
    ...upstreamAudios.map((item: any) => normalizeMediaItem({ ...item, mediaType: 'audio' })),
  ].filter((item: any) => !!item.url)
  return items.length ? { items } : null
}

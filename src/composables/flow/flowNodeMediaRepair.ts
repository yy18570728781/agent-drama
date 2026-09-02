import { getMediaUrlMetrics } from '@/utils/mediaMetrics'
import {
  normalizeWorkflowMediaMeta,
  type WorkflowMediaMeta,
} from '@/utils/workflowNodeMediaMeta'
import { getFlowMediaNodeSize } from './flowMediaNodeSize'
import type { FlowNode } from './flowCore.types'

type FlowMediaType = 'image' | 'video' | 'audio'

interface FlowMediaRecordItem {
  type?: string
  origin_url?: string
  url?: string
  thumb?: string
  width?: number
  height?: number
}

export interface FlowMediaRecord extends FlowMediaRecordItem {
  media?: FlowMediaRecordItem[]
}

function getDisplayedNodeSize(node: FlowNode): { width: number; height: number } | null {
  const styleWidth = Number.parseFloat(String(node?.style?.width || ''))
  const styleHeight = Number.parseFloat(String(node?.style?.height || ''))
  const width = styleWidth > 0 ? styleWidth : Number(node?.dimensions?.width || 0)
  const height = styleHeight > 0 ? styleHeight : Number(node?.dimensions?.height || 0)
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * Resolve a node's effective media category from persisted record and runtime data.
 * @param node Flow node being inspected.
 * @param record Optional backend media record.
 * @returns Normalized media category.
 */
export function resolveFlowNodeMediaType(
  node: FlowNode,
  record?: FlowMediaRecord | null,
): FlowMediaType {
  const candidates = [
    record?.media?.[0]?.type,
    record?.type,
    node?.data?.mediaType,
    node?.type === 'video_generation' ? 'video' : '',
    node?.type === 'audio_generation' ? 'audio' : '',
    node?.data?.videoUrl ? 'video' : '',
    node?.data?.imageUrl ? 'image' : '',
    node?.data?.audioUrl ? 'audio' : '',
  ]
  const mediaType = String(candidates.find(Boolean) || 'image').trim().toLowerCase()
  if (mediaType.includes('video')) return 'video'
  if (mediaType.includes('audio')) return 'audio'
  return 'image'
}

function getNodeMediaMeta(node: FlowNode): WorkflowMediaMeta | undefined {
  return normalizeWorkflowMediaMeta(node?.data)
}

function getRepairMediaUrl(node: FlowNode, record?: FlowMediaRecord | null): string {
  const media = record?.media?.[0]
  return String(
    media?.origin_url
    || media?.url
    || media?.thumb
    || record?.url
    || record?.origin_url
    || node?.data?.videoUrl
    || node?.data?.imageUrl
    || node?.data?.url
    || node?.data?.preview
    || '',
  ).trim()
}

function getRecordMediaMetrics(record?: FlowMediaRecord | null): WorkflowMediaMeta | undefined {
  const media = record?.media?.[0]
  const width = Number(media?.width || record?.width || 0)
  const height = Number(media?.height || record?.height || 0)
  if (!(width > 0) || !(height > 0)) return undefined
  return { width, height, aspectRatio: width / height }
}

function hasRatioMismatch(
  node: FlowNode,
  mediaType: FlowMediaType,
  mediaMeta: WorkflowMediaMeta,
): boolean {
  const displayedSize = getDisplayedNodeSize(node)
  if (!displayedSize || node?.data?._manualSize) return false
  const expectedSize = getFlowMediaNodeSize({
    mediaType,
    width: mediaMeta.width,
    height: mediaMeta.height,
    aspectRatio: mediaMeta.aspectRatio,
  })
  return Math.abs(displayedSize.width - expectedSize.width) > 1 || Math.abs(displayedSize.height - expectedSize.height) > 1
}

/**
 * Check whether a node has a usable media URL but lacks persisted dimensions.
 * @param node Flow node being inspected.
 * @returns Whether media metrics should be fetched.
 */
export function shouldRefreshFlowMediaMetrics(node: FlowNode): boolean {
  const mediaType = resolveFlowNodeMediaType(node)
  if (!['image', 'video'].includes(mediaType)) return false
  if (!String(getRepairMediaUrl(node) || '').trim()) return false
  if (node?.data?._manualSize) return false
  return !getNodeMediaMeta(node)
}

/**
 * Check whether a media node is missing metrics or renders at the wrong ratio.
 * @param node Flow node being inspected.
 * @returns Whether the displayed size needs repair.
 */
export function hasSuspiciousFlowMediaSize(node: FlowNode): boolean {
  const mediaType = resolveFlowNodeMediaType(node)
  if (!['image', 'video'].includes(mediaType)) return false
  const mediaMeta = getNodeMediaMeta(node)
  if (!mediaMeta) return true
  return hasRatioMismatch(node, mediaType, mediaMeta)
}

/**
 * Check whether an image or video node has no thumbnail.
 * @param node Flow node being inspected.
 * @returns Whether the thumbnail is missing.
 */
export function hasMissingFlowMediaThumb(node: FlowNode): boolean {
  const mediaType = resolveFlowNodeMediaType(node)
  if (!['image', 'video'].includes(mediaType)) return false
  return !String(node?.data?.thumb || '').trim()
}

/**
 * Restore a local image input thumbnail from its existing media URL.
 * @param node Flow node being repaired.
 * @returns Whether the node was changed.
 */
export function restoreLocalFlowFileInputThumb(node: FlowNode): boolean {
  if (String(node?.type || '') !== 'file_input') return false
  if (resolveFlowNodeMediaType(node) !== 'image') return false
  if (!hasMissingFlowMediaThumb(node)) return false
  const url = String(node?.data?.imageUrl || node?.data?.url || node?.data?.preview || '').trim()
  if (!url) return false
  node.data.thumb = url
  return true
}

/**
 * Apply normalized media metadata and ratio-preserving dimensions to a node.
 * @param node Flow node being repaired.
 * @param record Optional backend media record.
 * @returns Whether persisted node data changed.
 */
export async function applyFlowRecordMediaSize(
  node: FlowNode,
  record: FlowMediaRecord | null,
): Promise<boolean> {
  const mediaType = resolveFlowNodeMediaType(node, record)
  const currentMeta = getNodeMediaMeta(node)
  const metrics = currentMeta
    || getRecordMediaMetrics(record)
    || await getMediaUrlMetrics(getRepairMediaUrl(node, record), mediaType)
  if (!metrics) return false
  const size = getFlowMediaNodeSize({
    mediaType,
    width: metrics.width,
    height: metrics.height,
    aspectRatio: metrics.aspectRatio || metrics.width / metrics.height,
  })
  const displayedSize = getDisplayedNodeSize(node)
  const nextWidth = displayedSize?.width || size.width
  const nextHeight = displayedSize?.width
    ? Math.round(nextWidth / (metrics.aspectRatio || metrics.width / metrics.height))
    : (displayedSize?.height || size.height)
  const before = JSON.stringify({
    mediaMeta: node?.data?.mediaMeta || null,
    width: node?.style?.width || '',
    height: node?.style?.height || '',
  })
  node.data.mediaMeta = {
    width: metrics.width,
    height: metrics.height,
    aspectRatio: metrics.aspectRatio || metrics.width / metrics.height,
  }
  node.style = {
    ...(node.style || {}),
    width: `${nextWidth}px`,
    height: `${nextHeight}px`,
  }
  const after = JSON.stringify({
    mediaMeta: node?.data?.mediaMeta || null,
    width: node?.style?.width || '',
    height: node?.style?.height || '',
  })
  return before !== after
}

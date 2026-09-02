import type { Ref } from 'vue'
import { getMediaUrlMetrics } from '@/utils/mediaMetrics'
import { getFlowMediaNodeSize } from './flowMediaNodeSize'
import { buildWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import { useTheme } from '@/styles/theme/composables/useTheme'
import type { buildPortsForNode as buildPortsForNodeContract } from '@/utils/workflowNodeData'

export interface FlowExposeDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  createRuntimeId: (prefix: string) => string
  buildPortsForNode: typeof buildPortsForNodeContract
  fixedSizeTypes: Record<string, any>
  assignToGroupIfOverlapping: (node: any, x: number, y: number) => void
  propagateDataFlow: () => void
  saveHistory: () => void
  edgeStyle: Ref<string>
  isImageLikeNode: (node: any) => boolean
  isVideoLikeNode: (node: any) => boolean
  project: (pos: { x: number; y: number }) => { x: number; y: number }
  setViewport: (vp: any) => void
  emit: (event: string, ...args: any[]) => void
  clearGenerationPanel: (nodeId?: string) => void
  selectedPanelNode: Ref<any>
}

function getDroppedAssetStyle(assetInfo: any, mediaType: string): { width: string; height: string } | undefined {
  const width = Number(assetInfo?.mediaMeta?.width || assetInfo?.width || 0)
  const height = Number(assetInfo?.mediaMeta?.height || assetInfo?.height || 0)
  const aspectRatio = Number(assetInfo?.mediaMeta?.aspectRatio || assetInfo?.aspect_ratio || assetInfo?.aspectRatio || 0)
  if (!(width > 0 && height > 0) && !(aspectRatio > 0)) return undefined
  const size = getFlowMediaNodeSize({ mediaType, width, height, aspectRatio })
  return { width: `${size.width}px`, height: `${size.height}px` }
}

function applyDroppedAssetMetrics(node: any, mediaType: string, metrics: any) {
  const size = getFlowMediaNodeSize({ mediaType, width: metrics.width, height: metrics.height, aspectRatio: metrics.aspectRatio })
  node.data.mediaMeta = buildWorkflowMediaMeta(metrics.width, metrics.height, metrics.aspectRatio)
  node.style = { ...(node.style || {}), width: `${size.width}px`, height: `${size.height}px` }
}

export function useFlowExpose(deps: FlowExposeDeps) {
  const { flowDropDirection } = useTheme()

  function getDropBasePosition(screenX: number, screenY: number, canvasX: number, canvasY: number) {
    if (canvasX != null && canvasY != null) {
      return { x: canvasX, y: canvasY }
    }
    const { left, top } = document.querySelector('.flow-canvas-wrapper')?.getBoundingClientRect() || { left: 0, top: 0 }
    return deps.project({ x: screenX - left, y: screenY - top })
  }

  function getDropNodePosition(basePosition: { x: number; y: number }, index: number, style: { width?: string; height?: string } | undefined) {
    const width = parseInt(String(style?.width || '320'), 10) || 320
    const height = parseInt(String(style?.height || '180'), 10) || 180
    const gap = 28
    if (flowDropDirection.value === 'horizontal') {
      return { x: basePosition.x - 80 + index * (width + gap), y: basePosition.y - 20 }
    }
    return { x: basePosition.x - 80, y: basePosition.y - 20 + index * (height + gap) }
  }

  function createDroppedAssetNode(assetInfo: any, basePosition: { x: number; y: number }, index: number) {
    const assetType = String(assetInfo.type || '').toLowerCase()
    const nodeType = 'aigc_result'
    const assetRecordId = assetInfo.recordId || assetInfo.id
    const assetThumb = String(assetInfo.thumb || '').trim()
    const assetModel = String(assetInfo.model || '').trim()
    const nodeId = deps.createRuntimeId('node')
    const shortId = assetRecordId ? String(assetRecordId).slice(-6) : nodeId.slice(-6)
    const mediaType = assetType === 'video' ? 'video' : assetType === 'audio' ? 'audio' : assetType === 'text' ? 'text' : 'image'
    const nodeStyle = getDroppedAssetStyle(assetInfo, mediaType)
    const labelPrefix = assetModel || (assetType === 'video' ? '视频生成' : assetType === 'audio' ? '音频生成' : assetType === 'text' ? '文本结果' : '图片生成')
    const position = getDropNodePosition(basePosition, index, nodeStyle || deps.fixedSizeTypes[nodeType])
    const pbrChannel = mediaType === 'image' ? String(assetInfo.pbrChannel || '').trim() : ''
    return {
      id: nodeId,
      type: nodeType,
      position,
      data: {
        label: `${labelPrefix} #${shortId}`,
        url: assetInfo.url,
        ...(assetThumb ? { thumb: assetThumb } : {}),
        status: 'completed',
        isGenerating: false,
        progress: undefined,
        mediaType,
        nodeKind: 'aigc_result',
        ports: deps.buildPortsForNode('aigc_result', mediaType),
        ...(pbrChannel ? { pbrChannel } : {}),
        ...(assetModel ? { model: assetModel } : {}),
        ...(assetRecordId ? { recordId: assetRecordId } : {}),
        ...(buildWorkflowMediaMeta(
          assetInfo?.mediaMeta?.width || assetInfo?.width,
          assetInfo?.mediaMeta?.height || assetInfo?.height,
          assetInfo?.mediaMeta?.aspectRatio || assetInfo?.aspect_ratio || assetInfo?.aspectRatio,
        ) ? {
          mediaMeta: buildWorkflowMediaMeta(
            assetInfo?.mediaMeta?.width || assetInfo?.width,
            assetInfo?.mediaMeta?.height || assetInfo?.height,
            assetInfo?.mediaMeta?.aspectRatio || assetInfo?.aspect_ratio || assetInfo?.aspectRatio,
          ),
        } : {}),
      },
      ...(nodeStyle ? { style: nodeStyle } : deps.fixedSizeTypes[nodeType] ? { style: deps.fixedSizeTypes[nodeType] } : {}),
    }
  }

  function hydrateDroppedAssetMetrics(assetInfo: any, nodeId: string, mediaType: string, hasResolvedMetrics: boolean) {
    if (!hasResolvedMetrics && (mediaType === 'image' || mediaType === 'video') && assetInfo.url) {
      void getMediaUrlMetrics(assetInfo.url, mediaType).then((metrics) => {
        if (!metrics) return
        const target = deps.nodes.value.find((node: any) => node.id === nodeId)
        if (!target) return
        applyDroppedAssetMetrics(target, mediaType, metrics)
        deps.emit('update:modelNodes', deps.nodes.value)
      })
    }
  }

  function dropAssetAt(assetInfo: any, screenX: number, screenY: number, canvasX: number, canvasY: number) {
    const droppedAssets = Array.isArray(assetInfo) ? assetInfo : [assetInfo]
    const basePosition = getDropBasePosition(screenX, screenY, canvasX, canvasY)
    const newNodes = droppedAssets
      .map((asset, index) => createDroppedAssetNode(asset, basePosition, index))
      .filter(Boolean)

    newNodes.forEach((node: any) => {
      deps.assignToGroupIfOverlapping(node, node.position.x, node.position.y)
    })
    deps.nodes.value = [...deps.nodes.value, ...newNodes]
    newNodes.forEach((node: any, index: number) => {
      const asset = droppedAssets[index]
      const mediaType = String(node?.data?.mediaType || 'image')
      hydrateDroppedAssetMetrics(asset, node.id, mediaType, !!node.data?.mediaMeta)
    })
    setTimeout(deps.saveHistory, 50)
  }

  function connectToMatchingNodes(targetNodeId: string, urls: string[]) {
    const normUrl = (u: string) => {
      if (!u) return ''
      try {
        return new URL(u).pathname.split('/').pop() || u
      } catch { return u.split('/').pop() || u }
    }
    const matchedSourceIds: string[] = []
    for (const rawUrl of urls) {
      const key = normUrl(rawUrl)
      if (!key) continue
      const found = deps.nodes.value.find((n: any) => {
        if (!(deps.isImageLikeNode(n) || deps.isVideoLikeNode(n))) return false
        return normUrl(n.data?.preview || n.data?.imageUrl || n.data?.videoUrl || '') === key
      })
      if (found && found.id !== targetNodeId) {
        matchedSourceIds.push(found.id)
      }
    }
    for (const sourceId of matchedSourceIds) {
      const exists = deps.edges.value.some((e: any) => e.source === sourceId && e.target === targetNodeId)
      if (!exists) {
        deps.edges.value = [...deps.edges.value, { id: deps.createRuntimeId('edge'), source: sourceId, target: targetNodeId, type: deps.edgeStyle.value }]
      }
    }
    deps.propagateDataFlow()
    return matchedSourceIds
  }

  return { dropAssetAt, connectToMatchingNodes }
}

import { ref } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { useFlowNodeClassification } from './useFlowNodeClassification'
import { getOrphanedUploadLikeFileInputNodeIds, getUploadLikeFileInputNodeIdsForTarget, isUploadLikeFileInputNode } from './flowReferenceNodes'
import { GROUP_AGGREGATE_SOURCE_HANDLE } from '@/composables/flow/groupConnection.constants'
import { sanitizeStoredUpstreamInputs } from '@/utils/workflowUpstreamMedia'
import type { inferMediaTypeFromUrl as inferMediaTypeFromUrlContract } from '@/utils/workflowNodeData'
import { inferMediaType as inferWorkflowMediaType } from '@/utils/workflowNodeData'

export interface DataFlowDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  shouldSuspendHeavyCanvasWork: ComputedRef<boolean>
  selectedPanelNode: () => any
  classification: Pick<
    ReturnType<typeof useFlowNodeClassification>,
    | 'isImageLikeNode'
    | 'isVideoLikeNode'
    | 'getNodeMediaReferenceKey'
    | 'normalizeReferenceUrlKey'
  >
  inferMediaTypeFromUrl: typeof inferMediaTypeFromUrlContract
  emit: {
    (e: 'update:modelNodes', value: any[]): void
    (e: 'update:modelEdges', value: any[]): void
  }
  saveHistory: () => void
}

export function useDataFlow(deps: DataFlowDeps) {
  const {
    nodes,
    edges,
    findNode,
    shouldSuspendHeavyCanvasWork,
    selectedPanelNode,
    classification,
    inferMediaTypeFromUrl,
    emit,
    saveHistory,
  } = deps

  const { isImageLikeNode, isVideoLikeNode, getNodeMediaReferenceKey, normalizeReferenceUrlKey } = classification

  let pendingPropagateDataFlow = false

  type MediaResult = { images: any[]; videos: any[]; audios: any[]; models3d: any[] }

  function pushMediaByType(
    result: MediaResult,
    url: string,
    mediaType: string,
    nodeId: string,
    label: string,
    extra: Record<string, any> = {},
  ) {
    const fallback = ['image', 'video', 'audio', 'text', '3d_model'].includes(mediaType)
      ? mediaType as Parameters<typeof inferMediaTypeFromUrlContract>[1]
      : 'image'
    const inferred = inferMediaTypeFromUrl(String(url || ''), fallback)
    if (inferred === 'video') {
      result.videos.push({ url, nodeId, label: label || '视频', ...extra })
    } else if (inferred === 'audio') {
      result.audios.push({ url, nodeId, label: label || '音频', ...extra })
    } else if (inferred === '3d_model') {
      result.models3d.push({ url, nodeId, label: label || '3D模型', ...extra })
    } else {
      result.images.push({ url, nodeId, label: label || '图片', ...extra })
    }
  }

  function getOrderedGroupChildren(groupNode: any): any[] {
    const children = nodes.value.filter((node: any) => node?.parentNode === groupNode.id)
    const order = Array.isArray(groupNode?.data?.gridOrder) ? groupNode.data.gridOrder : []
    const byId = new Map(children.map((node: any) => [node.id, node]))
    const ordered = order.map((id: string) => byId.get(id)).filter(Boolean)
    const orderedIds = new Set(ordered.map((node: any) => node.id))
    return [...ordered, ...children.filter((node: any) => !orderedIds.has(node.id))]
  }

  function pushGroupAggregateMedia(result: MediaResult, groupNode: any): void {
    getOrderedGroupChildren(groupNode).forEach((child: any, index: number) => {
      const data = child?.data || {}
      const url = String(data.url || '').trim()
      if (!url) return
      pushMediaByType(result, url, data.mediaType, child.id, data.label || child.data?.label || '图片', {
        thumb: String(data.thumb || '').trim(),
        sourceNodeId: child.id,
        groupNodeId: groupNode.id,
        groupAggregate: true,
        groupOrder: index,
      })
    })
  }

  // 取一个节点在其所属 grid 组 gridOrder 中的位置；不在 grid 组里返回 Infinity（保持原相对顺序）。
  // 用于让下游生成节点的上游参考按用户在分组里看到的从左到右顺序排列。
  function getGridOrderIndex(nodeId: string): number {
    const node = findNode(nodeId)
    if (!node?.parentNode) return Number.POSITIVE_INFINITY
    const group = findNode(node.parentNode)
    if (!group || group.type !== 'groupNode' || group.data?.layoutMode !== 'grid') return Number.POSITIVE_INFINITY
    const order: string[] = Array.isArray(group.data?.gridOrder) ? group.data.gridOrder : []
    const idx = order.indexOf(nodeId)
    return idx >= 0 ? idx : Number.POSITIVE_INFINITY
  }

  function getUpstreamMedia(nodeId: string, visited = new Set<string>()) {
    const result: { images: any[]; videos: any[]; audios: any[]; models3d: any[] } = { images: [], videos: [], audios: [], models3d: [] }
    if (visited.has(nodeId)) return result
    visited.add(nodeId)

    const incomingEdges = edges.value.filter((e: any) => e.target === nodeId)

    for (const edge of incomingEdges) {
      const sourceNode = findNode(edge.source)
      if (!sourceNode) continue

      if (sourceNode.type === 'waypoint') {
        const upstream = getUpstreamMedia(sourceNode.id, visited)
        result.images.push(...upstream.images)
        result.videos.push(...upstream.videos)
        result.audios.push(...upstream.audios)
        continue
      }

      if (sourceNode.type === 'groupNode' && edge.sourceHandle === GROUP_AGGREGATE_SOURCE_HANDLE) {
        pushGroupAggregateMedia(result, sourceNode)
        continue
      }

      if (sourceNode.type === 'batch_grid') {
        const items = sourceNode.data?.items || []
        for (const item of items) {
          const itemData = item?.data || {}
          const itemUrl = String(itemData.url || '').trim()
          if (itemUrl) {
            pushMediaByType(result, itemUrl, itemData.mediaType, sourceNode.id, itemData.label, {
              thumb: String(itemData.thumb || '').trim(),
            })
          }
        }
        continue
      }

      const nodeData = sourceNode.data || {}
      const mediaUrl = nodeData.url
      if (!mediaUrl) continue

      const isImgNode = isImageLikeNode(sourceNode)
      const isVidNode = isVideoLikeNode(sourceNode)
      const inferredMediaType = inferMediaTypeFromUrl(
        String(mediaUrl || ''),
        inferWorkflowMediaType(nodeData.mediaType),
      )

      if (isVidNode || inferredMediaType === 'video') {
        result.videos.push({ url: mediaUrl, nodeId: sourceNode.id, label: nodeData.label || sourceNode.data?.label || '视频' })
        continue
      }

      if (inferredMediaType === 'audio') {
        result.audios.push({ url: mediaUrl, nodeId: sourceNode.id, label: nodeData.label || sourceNode.data?.label || '音频' })
        continue
      }

      if (inferredMediaType === '3d_model') {
        result.models3d.push({ url: mediaUrl, nodeId: sourceNode.id, label: nodeData.label || sourceNode.data?.label || '3D模型' })
        continue
      }

      if (isImgNode || inferredMediaType === 'image') {
        result.images.push({ url: mediaUrl, nodeId: sourceNode.id, label: nodeData.label || sourceNode.data?.label || '图片' })
      }
    }

    // Dedup by URL
    const seenImg = new Set<string>()
    result.images = result.images.filter((img: any) => {
      if (seenImg.has(img.url)) return false
      seenImg.add(img.url)
      return true
    })
    const seenVid = new Set<string>()
    result.videos = result.videos.filter((vid: any) => {
      if (seenVid.has(vid.url)) return false
      seenVid.add(vid.url)
      return true
    })
    const seenAud = new Set<string>()
    result.audios = result.audios.filter((audio: any) => {
      if (seenAud.has(audio.url)) return false
      seenAud.add(audio.url)
      return true
    })
    const seen3d = new Set<string>()
    result.models3d = result.models3d.filter((m: any) => {
      if (seen3d.has(m.url)) return false
      seen3d.add(m.url)
      return true
    })

    // 按 grid 分组里的视觉顺序（gridOrder）排序，让下游面板刷新参考时以用户重排后的顺序为准
    const byGrid = (a: any, b: any) => getGridOrderIndex(a.nodeId) - getGridOrderIndex(b.nodeId)
    result.images.sort(byGrid)
    result.videos.sort(byGrid)
    result.audios.sort(byGrid)
    result.models3d.sort(byGrid)

    return result
  }

  function propagateDataFlow() {
    if (shouldSuspendHeavyCanvasWork.value) {
      pendingPropagateDataFlow = true
      return
    }
    pendingPropagateDataFlow = false
    let promptChanged = false
    nodes.value.forEach((node: any) => {
      if (node.type === 'groupNode') return

      const upstreamMedia = getUpstreamMedia(node.id)
      if (!node.data) node.data = {}

      const prevInputs = node.data._upstreamInputs
      const newInputs = sanitizeStoredUpstreamInputs({
        images: upstreamMedia.images,
        videos: upstreamMedia.videos,
        audios: upstreamMedia.audios,
        models3d: upstreamMedia.models3d,
      })

      if (JSON.stringify(prevInputs) !== JSON.stringify(newInputs)) {
        node.data._upstreamInputs = newInputs

        const imgCount = newInputs.totalImageCount
        const vidCount = newInputs.totalVideoCount

        if (isImageLikeNode(node)) {
          if (imgCount >= 3) {
            node.data._inferredMode = '多参模式'
          } else if (imgCount === 2) {
            node.data._inferredMode = '图生图首尾帧'
          } else if (imgCount === 1) {
            node.data._inferredMode = '图生图'
          } else {
            node.data._inferredMode = '文生图'
          }
        } else if (isVideoLikeNode(node)) {
          if (imgCount >= 3) {
            node.data._inferredMode = '视频多参模式'
          } else if (imgCount === 2) {
            node.data._inferredMode = '视频首尾帧'
          } else if (imgCount === 1 || vidCount >= 1) {
            node.data._inferredMode = '图生视频'
          } else {
            node.data._inferredMode = '文生视频'
          }
        }
      }
      if (syncTargetNodePrompt(node.id)) promptChanged = true
    })
    if (promptChanged) emit('update:modelNodes', nodes.value)
  }

  function getUpstreamPrompt(nodeId: string, visited = new Set<string>()): string {
    if (visited.has(nodeId)) return ''
    visited.add(nodeId)

    const prompts: string[] = []
    const incomingEdges = edges.value.filter((e: any) => e.target === nodeId)

    for (const edge of incomingEdges) {
      const sourceNode = findNode(edge.source)
      if (!sourceNode) continue

      if (sourceNode.type === 'waypoint') {
        const upstream = getUpstreamPrompt(sourceNode.id, visited)
        if (upstream) prompts.push(upstream)
        continue
      }

      const content =
        sourceNode.data?.params?.value
        || sourceNode.data?.params?.prompt
        || sourceNode.data?._genState?.params?.prompt
        || sourceNode.data?.content
        || ''
      if (content) {
        prompts.push(content)
      }
    }

    const allPrompts = prompts.map((prompt) => String(prompt).trim()).filter(Boolean)
    return [...new Set(allPrompts)].join('\n')
  }

  function syncTargetNodePrompt(targetNodeId: string): boolean {
    const node = findNode(targetNodeId)
    if (!node) return false
    const upstreamPrompt = getUpstreamPrompt(targetNodeId)
    if (!node.data) node.data = {}
    const previousPrompt = String(node.data._upstreamPrompt || '')
    if (previousPrompt === upstreamPrompt) return false
    node.data._upstreamPrompt = upstreamPrompt
    if (!node.data._genState) node.data._genState = {}
    if (upstreamPrompt || node.data._genState.prompt === previousPrompt) {
      node.data._genState.prompt = upstreamPrompt
    }
    const requestParams = node.data.request?.params
    if (requestParams && typeof requestParams === 'object') {
      if (upstreamPrompt || requestParams.prompt === previousPrompt) {
        requestParams.prompt = upstreamPrompt
      }
    }
    return true
  }

  function isValidFlowEdge(edge: any) {
    return !!edge?.source && !!edge?.target && edge.source !== edge.target
  }

  function nodeSupportsFileUrls(nodeData: any) {
    const upstreamImageCount = Array.isArray(nodeData?._upstreamInputs?.images) ? nodeData._upstreamInputs.images.length : 0
    const upstreamVideoCount = Array.isArray(nodeData?._upstreamInputs?.videos) ? nodeData._upstreamInputs.videos.length : 0
    const upstreamAudioCount = Array.isArray(nodeData?._upstreamInputs?.audios) ? nodeData._upstreamInputs.audios.length : 0
    return (upstreamImageCount + upstreamVideoCount + upstreamAudioCount) > 0
  }

  function disconnectUpstreamEdges(nodeId: string) {
    if (!nodeId) return false
    const removedEdges = edges.value.filter((edge: any) => edge.target === nodeId)
    const nextEdges = edges.value.filter((edge: any) => edge.target !== nodeId)
    if (nextEdges.length === edges.value.length) return false
    edges.value = nextEdges
    emit('update:modelEdges', edges.value)
    propagateDataFlow()
    return true
  }

  function handleRemoveUpstream(payloadOrNodeId: any) {
    const upstreamNodeId = typeof payloadOrNodeId === 'string' ? payloadOrNodeId : payloadOrNodeId?.sourceNodeId
    const targetNodeId = typeof payloadOrNodeId === 'string'
      ? (null as any)
      : payloadOrNodeId?.targetNodeId || (null as any)
    if (!targetNodeId!) return

    const upstreamNode = nodes.value.find((n: any) => n.id === upstreamNodeId)
    const upstreamReferenceKey = upstreamNode ? getNodeMediaReferenceKey(upstreamNode) : ''

    const immediateEdges = edges.value.filter((e: any) => e.target === targetNodeId)
    const edgeIdsToRemove: string[] = []

    for (const edge of immediateEdges) {
      if (edge.source === upstreamNodeId) {
        edgeIdsToRemove.push(edge.id)
        continue
      }
      const checkPath = (currentSourceId: string, visited: Set<string>): boolean => {
        if (currentSourceId === upstreamNodeId) return true
        if (visited.has(currentSourceId)) return false
        visited.add(currentSourceId)
        const srcNode = nodes.value.find((n: any) => n.id === currentSourceId)
        if (srcNode && srcNode.type === 'waypoint') {
          const upEdges = edges.value.filter((e: any) => e.target === currentSourceId)
          for (const ue of upEdges) {
            if (checkPath(ue.source, visited)) return true
          }
        }
        return false
      }

      if (checkPath(edge.source, new Set())) {
        edgeIdsToRemove.push(edge.id)
      }
    }

    const directUploadLikeNodeIds = getUploadLikeFileInputNodeIdsForTarget(targetNodeId, nodes.value, edges.value)
    const syntheticReferenceNodeIds = directUploadLikeNodeIds.filter((nodeId) => {
      if (!upstreamReferenceKey) return false
      const node = nodes.value.find((item: any) => item.id === nodeId)
      return isUploadLikeFileInputNode(node) && getNodeMediaReferenceKey(node) === upstreamReferenceKey
    })

    const uniqueEdgeIdsToRemove = Array.from(new Set(edgeIdsToRemove))
    if (!uniqueEdgeIdsToRemove.length) {
      return
    }

    if (uniqueEdgeIdsToRemove.length) {
      edges.value = edges.value.filter((edge: any) => !uniqueEdgeIdsToRemove.includes(edge.id))
    }
    const targetNode = nodes.value.find((node: any) => node.id === targetNodeId)
    if (targetNode?.data?._upstreamInputs) {
      const prevInputs = targetNode.data._upstreamInputs
      targetNode.data._upstreamInputs = sanitizeStoredUpstreamInputs({
        ...prevInputs,
        images: Array.isArray(prevInputs.images) ? prevInputs.images.filter((item: any) => item?.nodeId !== upstreamNodeId) : [],
        videos: Array.isArray(prevInputs.videos) ? prevInputs.videos.filter((item: any) => item?.nodeId !== upstreamNodeId) : [],
        audios: Array.isArray(prevInputs.audios) ? prevInputs.audios.filter((item: any) => item?.nodeId !== upstreamNodeId) : [],
      })
    }
    emit('update:modelNodes', nodes.value)
    emit('update:modelEdges', edges.value)
    propagateDataFlow()
    saveHistory()
  }

  return {
    getUpstreamMedia,
    propagateDataFlow,
    getUpstreamPrompt,
    syncTargetNodePrompt,
    isValidFlowEdge,
    nodeSupportsFileUrls,
    disconnectUpstreamEdges,
    handleRemoveUpstream,
  }
}

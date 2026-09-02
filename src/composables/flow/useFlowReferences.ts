import { nextTick } from 'vue'
import type { Ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { useFlowNodeClassification } from './useFlowNodeClassification'
import type { useNodeFactory } from './useNodeFactory'
import type { useDataFlow } from './useDataFlow'
import { getOrphanedUploadLikeFileInputNodeIds, getUploadLikeFileInputNodeIdsForTarget, isUploadLikeFileInputNode } from './flowReferenceNodes'
import { getMediaCacheByUrl } from '@/api/mediaCache'
import { resolveStoredUpstreamInputs } from '@/utils/workflowUpstreamMedia'
import type { inferMediaTypeFromUrl as inferMediaTypeFromUrlContract } from '@/utils/workflowNodeData'

export interface FlowReferencesDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  getSelectedNodes: Ref<any[]>
  emit: {
    (e: 'update:modelNodes', value: any[]): void
    (e: 'update:modelEdges', value: any[]): void
  }
  selectedPanelNode: () => any
  generationPanelRef: () => any
  edgeStyle: Ref<string>
  contextMenu: Ref<{ visible: boolean; x: number; y: number }>
  skipEdgesChange: { value: boolean }
  skipNodesChange: { value: boolean }
  classification: Pick<
    ReturnType<typeof useFlowNodeClassification>,
    | 'normalizeReferenceUrlKey'
    | 'getNodeMediaReferenceKey'
    | 'isImageLikeNode'
    | 'isVideoLikeNode'
    | 'getReferenceMediaType'
    | 'getReferenceLabelByMediaType'
    | 'getReferenceNodeType'
  >
  factory: Pick<
    ReturnType<typeof useNodeFactory>,
    | 'createRuntimeId'
    | 'createEdgeId'
    | 'getPrimaryPortId'
    | 'syncNodeEdgeHandles'
  >
  dataFlow: Pick<ReturnType<typeof useDataFlow>, 'propagateDataFlow' | 'isValidFlowEdge'>
  buildRuntimeAssetNodeData: (options: any) => any
  fixedSizeTypes: Record<string, any>
  createUploadNodesFromFiles: (files: File[], position: { x: number; y: number }, loadingText?: string, options?: any) => Promise<any[]>
  refreshOpenGenerationPanelForNode: (nodeId: string) => void
  saveHistory: () => void
  updateNodeInternals: (ids: string[]) => void
  inferMediaTypeFromUrl: typeof inferMediaTypeFromUrlContract
  getReferenceUrls: (record: any) => string[]
  findTeamonesAigcRecord: (id: string) => Promise<any>
}

export function useFlowReferences(deps: FlowReferencesDeps) {
  const {
    nodes,
    edges,
    findNode,
    getSelectedNodes,
    emit,
    selectedPanelNode,
    generationPanelRef,
    edgeStyle,
    contextMenu,
    skipEdgesChange,
    skipNodesChange,
    classification,
    factory,
    dataFlow,
    buildRuntimeAssetNodeData,
    fixedSizeTypes,
    createUploadNodesFromFiles,
    refreshOpenGenerationPanelForNode,
    saveHistory,
    updateNodeInternals,
    inferMediaTypeFromUrl,
    getReferenceUrls,
    findTeamonesAigcRecord,
  } = deps

  const {
    normalizeReferenceUrlKey,
    getNodeMediaReferenceKey,
    isImageLikeNode,
    isVideoLikeNode,
    getReferenceMediaType,
    getReferenceLabelByMediaType,
    getReferenceNodeType,
  } = classification

  const {
    createRuntimeId,
    createEdgeId,
    getPrimaryPortId,
    syncNodeEdgeHandles,
  } = factory

  const { propagateDataFlow, isValidFlowEdge } = dataFlow

  function getPanelReferenceItemsForNode(nodeId: string): any[] {
    const panelNode = selectedPanelNode()
    const generatorRef = generationPanelRef()?.generatorRef
    if (!panelNode || panelNode.id !== nodeId || !generatorRef) return []
    const refImages = Array.isArray(generatorRef.refImages) ? generatorRef.refImages : []
    return refImages
      .map((item: any) => ({
        url: item?.sourceUrl || item?.url || '',
        referenceName: item?.referenceName || '',
        isVideo: !!item?.isVideo,
        mediaType: item?.mediaType || inferMediaTypeFromUrl(String(item?.sourceUrl || item?.url || ''), 'image'),
        sourceNodeId: item?.sourceNodeId || '',
      }))
      .filter((item: any) => !!item.url)
  }

  // ==================== 查 media-cache 补 thumb ====================

  async function enrichReferencesWithThumb(items: any[]) {
    if (!Array.isArray(items) || !items.length) return items
    const settled = await Promise.allSettled(
      items.map((it: any) => (it?.url ? getMediaCacheByUrl(it.url) : Promise.resolve(null))),
    )
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value?.thumb) {
        items[idx].thumb = res.value.thumb
      }
    })
    return items
  }

  // ==================== 连接参考资源到节点 ====================

  function connectReferenceItemsToNode(nodeId: string, references: any[] = []) {
    if (!nodeId || !Array.isArray(references) || !references.length) return { connected: 0, created: 0 }

    const targetNode = nodes.value.find((n: any) => n.id === nodeId)
    if (!targetNode) return { connected: 0, created: 0 }

    const targetX = targetNode.position?.x || 0
    const targetY = targetNode.position?.y || 0
    const targetHandleId = getPrimaryPortId(targetNode.data, 'input')
    const newNodes: any[] = []
    const newEdges: any[] = []
    let connectedCount = 0
    let createdCount = 0

    references.forEach((refImg: any, index: number) => {
      const rawUrl = refImg.sourceUrl || refImg.url || ''
      if (!rawUrl.trim()) return

      const key = normalizeReferenceUrlKey(rawUrl)
      if (!key) return

      const alreadyConnected = edges.value
        .filter((e: any) => e.target === nodeId && e.source !== nodeId)
        .some((e: any) => {
          const src = findNode(e.source)
          if (!src) return false
          return getNodeMediaReferenceKey(src) === key
        })
      if (alreadyConnected) return

      const matchedNodes = nodes.value.filter((n: any) => {
        if (!(isImageLikeNode(n) || isVideoLikeNode(n))) return false
        if (n.id === nodeId) return false
        return getNodeMediaReferenceKey(n) === key
      })

      if (matchedNodes.length > 0) {
        const closest = matchedNodes
          .sort((a: any, b: any) => (b.position?.x ?? 0) - (a.position?.x ?? 0))[0]
        if (refImg.referenceName && closest.data) {
          closest.data.referenceName = refImg.referenceName
        }
        const hasEdge = edges.value.some((e: any) => e.source === closest.id && e.target === nodeId)
        if (!hasEdge) {
          const nextEdge = {
            id: createRuntimeId('edge'),
            source: closest.id,
            sourceHandle: getPrimaryPortId(closest.data, 'output'),
            target: nodeId,
            targetHandle: targetHandleId,
            type: edgeStyle.value,
          }
          if (isValidFlowEdge(nextEdge)) {
            newEdges.push(nextEdge)
            connectedCount += 1
          }
        }
        return
      }

      const mediaType = getReferenceMediaType(refImg)
      const isVideo = mediaType === 'video'
      const nodeType = 'file_input'
      const refNodeId = createRuntimeId('ref')
      const refNodeData = {
        ...buildRuntimeAssetNodeData({
          label: refImg.referenceName || getReferenceLabelByMediaType(mediaType),
          nodeType,
          url: rawUrl,
          mediaType,
          ...(refImg.thumb ? { thumb: refImg.thumb } : {}),
        }),
        ...(refImg.referenceName ? { referenceName: refImg.referenceName } : {}),
      }
      const refNode = {
        id: refNodeId,
        type: nodeType,
        position: {
          x: targetX - 380,
          y: targetY + newNodes.length * 210,
        },
        data: refNodeData,
        ...(fixedSizeTypes[nodeType] ? { style: fixedSizeTypes[nodeType] } : {}),
      }
      newNodes.push(refNode)
      createdCount += 1

      const nextEdge = {
        id: createRuntimeId('edge'),
        source: refNodeId,
        sourceHandle: getPrimaryPortId(refNodeData, 'output'),
        target: nodeId,
        targetHandle: targetHandleId,
        type: edgeStyle.value,
      }
      if (isValidFlowEdge(nextEdge)) {
        newEdges.push(nextEdge)
      }
    })

    if (!newNodes.length && !newEdges.length) return { connected: connectedCount, created: createdCount }

    if (newNodes.length) nodes.value = [...nodes.value, ...newNodes]
    if (newEdges.length) edges.value = [...edges.value, ...newEdges]
    emit('update:modelNodes', nodes.value)
    emit('update:modelEdges', edges.value)
    propagateDataFlow()
    nextTick(() => {
      updateNodeInternals([nodeId, ...newNodes.map((node: any) => node.id)])
      if (nodeId) syncNodeEdgeHandles(nodeId)
      newNodes.forEach((node: any) => syncNodeEdgeHandles(node.id))
    })
    setTimeout(saveHistory, 50)
    return { connected: connectedCount, created: createdCount }
  }

  // ==================== 反推上游 ====================

  async function handleInferUpstream(references: any[] = []) {
    const panelNode = selectedPanelNode()
    if (!panelNode) return
    const nodeId = panelNode.id
    const gen = generationPanelRef()?.generatorRef

    const referenceItems = Array.isArray(references) && references.length
      ? references
      : (gen?.refImages || []).map((refImg: any) => ({
          url: refImg.sourceUrl || refImg.url || '',
          isVideo: !!refImg.isVideo,
          mediaType: refImg.mediaType,
          sourceNodeId: refImg.sourceNodeId,
        }))
    if (!referenceItems.length) return

    await enrichReferencesWithThumb(referenceItems)
    connectReferenceItemsToNode(nodeId, referenceItems)
  }

  // ==================== 从剪贴板粘贴参考 ====================

  async function handleClipboardReferencePasted(payload: any = {}) {
    const nodeId = typeof payload?.nodeId === 'string' && payload.nodeId
      ? payload.nodeId
      : selectedPanelNode()?.id
    const files = Array.isArray(payload?.files)
      ? payload.files.filter((file: any) => file instanceof File && file.type.startsWith('image/'))
      : []

    if (!nodeId || !files.length) return

    const targetNode = findNode(nodeId)
    const position = targetNode?.position || { x: 0, y: 0 }
    await createUploadNodesFromFiles(
      files,
      position,
      `正在上传 ${files.length} 张截图并创建引用节点...`,
      { targetNodeId: nodeId },
    )
  }

  // ==================== 从工作流面板拖放参考 ====================

  async function handleWorkflowReferenceDropped(payload: any = {}) {
    const nodeId = typeof payload?.nodeId === 'string' && payload.nodeId
      ? payload.nodeId
      : selectedPanelNode()?.id
    if (!nodeId) return

    const files = Array.isArray(payload?.files)
      ? payload.files.filter((file: any) => file instanceof File)
      : []
    const urls = Array.isArray(payload?.urls)
      ? payload.urls.filter((url: any) => typeof url === 'string' && !!String(url).trim())
      : []
    const fallbackUrl = typeof payload?.assetInfo?.url === 'string' && payload.assetInfo.url.trim()
      ? payload.assetInfo.url.trim()
      : ''
    const resolvedUrls = urls.length ? urls : (fallbackUrl ? [fallbackUrl] : [])
    const referenceNames = Array.isArray(payload?.referenceNames) ? payload.referenceNames : []

    const targetNode = findNode(nodeId)
    const position = targetNode?.position || { x: 0, y: 0 }
    const rawReplaceIndex = Number.isFinite(Number(payload?.replaceIndex)) ? Number(payload.replaceIndex) : -1
    const displayedReferenceItems = getPanelReferenceItemsForNode(nodeId)
    const storedReferenceItems = displayedReferenceItems.length ? displayedReferenceItems : getNodeStoredReferenceItems(targetNode)
    const replaceIndex = rawReplaceIndex >= 0
      && rawReplaceIndex < storedReferenceItems.length
      && !!storedReferenceItems[rawReplaceIndex]?.url
      ? rawReplaceIndex
      : -1
    const targetEdgeIndex = replaceIndex >= 0 ? detachReferenceAtIndex(nodeId, replaceIndex) : -1
    if (files.length) {
      await createUploadNodesFromFiles(
        files,
        position,
        `正在上传 ${files.length} 个参考并创建上游节点...`,
        { targetNodeId: nodeId, targetEdgeIndex },
      )
    }

    if (resolvedUrls.length) {
      const referenceItems = resolvedUrls.map((url: string, index: number) => {
        const mediaType = inferMediaTypeFromUrl(String(url || ''), 'image')
        const referenceName = typeof referenceNames[index] === 'string' ? referenceNames[index].trim() : ''
        return { url, referenceName, mediaType, isVideo: mediaType === 'video' }
      })
      await enrichReferencesWithThumb(referenceItems)
      connectReferenceItemsToNode(nodeId, referenceItems)
      if (targetEdgeIndex >= 0) {
        referenceItems.forEach((item: any, index: number) => {
          const sourceNodeId = findIncomingSourceIdByUrl(nodeId, item.url)
          if (sourceNodeId) moveIncomingEdgeToIndex(nodeId, sourceNodeId, targetEdgeIndex + index)
        })
      }
      propagateDataFlow()
      refreshOpenGenerationPanelForNode(nodeId)
      saveHistory()
    }
  }

  // ==================== 获取节点存储的参考项 ====================

  function detachReferenceAtIndex(nodeId: string, replaceIndex: number): number {
    const targetNode = findNode(nodeId)
    const displayedReferenceItems = getPanelReferenceItemsForNode(nodeId)
    const storedReferenceItems = displayedReferenceItems.length ? displayedReferenceItems : getNodeStoredReferenceItems(targetNode)
    const sourceNodeId = storedReferenceItems[replaceIndex]?.sourceNodeId
    if (!sourceNodeId) return -1
    const edgeIndex = edges.value.findIndex((edge: any) => edge.source === sourceNodeId && edge.target === nodeId)
    if (edgeIndex < 0) return -1
    edges.value = edges.value.filter((edge: any) => !(edge.source === sourceNodeId && edge.target === nodeId))
    emit('update:modelEdges', edges.value)
    propagateDataFlow()
    return edgeIndex
  }

  function moveIncomingEdgeToIndex(nodeId: string, sourceNodeId: string, targetIndex: number): void {
    const currentIndex = edges.value.findIndex((edge: any) => edge.source === sourceNodeId && edge.target === nodeId)
    if (currentIndex < 0) return
    const nextEdges = [...edges.value]
    const [edge] = nextEdges.splice(currentIndex, 1)
    nextEdges.splice(Math.max(0, Math.min(targetIndex, nextEdges.length)), 0, edge)
    edges.value = nextEdges
    emit('update:modelEdges', edges.value)
  }

  function findIncomingSourceIdByUrl(nodeId: string, url: string): string {
    const key = normalizeReferenceUrlKey(url)
    if (!key) return ''
    const edge = edges.value.find((item: any) => {
      if (item.target !== nodeId) return false
      const sourceNode = findNode(item.source)
      return getNodeMediaReferenceKey(sourceNode) === key
    })
    return edge?.source || ''
  }

  function getNodeStoredReferenceItems(node: any) {
    if (!node?.data) return []
    const resolvedInputs = resolveStoredUpstreamInputs(node.data?._upstreamInputs, findNode)
    const upstreamImages = resolvedInputs.images
    const upstreamVideos = resolvedInputs.videos
    const upstreamAudios = resolvedInputs.audios

    return [
      ...upstreamImages.map((item: any) => ({ url: item?.url || '', isVideo: false, mediaType: 'image', sourceNodeId: item?.sourceNodeId || item?.nodeId })),
      ...upstreamVideos.map((item: any) => ({ url: item?.url || '', isVideo: true, mediaType: 'video', sourceNodeId: item?.sourceNodeId || item?.nodeId })),
      ...upstreamAudios.map((item: any) => ({ url: item?.url || '', isVideo: false, mediaType: 'audio', sourceNodeId: item?.sourceNodeId || item?.nodeId })),
    ].filter((item: any) => item.url)
  }

  // ==================== 解析节点参考项（含远程记录） ====================

  async function resolveNodeReferenceItems(node: any) {
    const recordId = node?.data?.recordId
    let items: any[] = []
    if (recordId) {
      try {
        const record = await findTeamonesAigcRecord(recordId)
        if (record) {
          const fileUrls = record?.param?.params?.file_urls || []
          if (Array.isArray(fileUrls) && fileUrls.length) {
            items = fileUrls.filter(Boolean).map((url: any) => ({
              url,
              mediaType: inferMediaTypeFromUrl(String(url || ''), 'image'),
              isVideo: inferMediaTypeFromUrl(String(url || ''), 'image') === 'video',
            }))
          }
        }
      } catch (error) {
        console.warn('[FlowCanvas] infer upstream from aigc record failed:', error)
      }
    }

    if (!items.length) items = getNodeStoredReferenceItems(node)
    if (!items.length) return items

    await enrichReferencesWithThumb(items)
    return items
  }

  // ==================== 反推上游（单节点触发） ====================

  async function triggerNodeInferUpstream(nodeId: string) {
    if (!nodeId) return
    const node = nodes.value.find((n: any) => n.id === nodeId)
    if (!node) return

    const loadingMessage = ElMessage({
      type: 'info',
      message: '正在重建上游节点...',
      duration: 0,
    })

    const referenceItems = await resolveNodeReferenceItems(node)
    if (!referenceItems.length) {
      loadingMessage.close()
      return
    }

    const result = connectReferenceItemsToNode(nodeId, referenceItems)
    loadingMessage.close()

    if (!result || (result.connected + result.created) <= 0) {
      ElMessage.info('没有新增可重建的上游节点')
      return
    }

    ElMessage.success(`上游重建完成：新增 ${result.created} 个参考节点，连接 ${result.connected} 条引用`)
  }

  // ==================== 批量反推上游 ====================

  async function handleBatchInferUpstream() {
    const selected = getSelectedNodes.value
    if (!selected.length) return

    contextMenu.value.visible = false
    const loadingMessage = ElMessage({
      type: 'info',
      message: `正在批量反推 ${selected.length} 个节点的上游...`,
      duration: 0,
    })

    let totalCreated = 0
    let totalConnected = 0

    for (const node of selected) {
      const referenceItems = await resolveNodeReferenceItems(node)
      if (!referenceItems.length) continue
      const result = connectReferenceItemsToNode(node.id, referenceItems)
      if (result) {
        totalCreated += result.created
        totalConnected += result.connected
      }
    }

    loadingMessage.close()

    if (totalCreated + totalConnected <= 0) {
      ElMessage.info('选中的节点没有可反推的上游')
      return
    }

    ElMessage.success(`批量反推完成：新增 ${totalCreated} 个参考节点，连接 ${totalConnected} 条引用`)
  }

  // ==================== 参考排序键归一化 ====================

  function normalizeReferenceOrderKey(item: any) {
    const nodeId = typeof item?.sourceNodeId === 'string' && item.sourceNodeId.trim()
      ? item.sourceNodeId.trim()
      : (typeof item?.nodeId === 'string' ? item.nodeId.trim() : '')
    if (nodeId) return `node:${nodeId}`
    const url = typeof item?.url === 'string' ? item.url.trim() : ''
    return url ? `url:${url}` : ''
  }

  // ==================== 从节点和URL构建参考排序 ====================

  function buildReferenceOrderFromNodeAndUrls(sourceNode: any, fileUrls: any[] = []) {
    const cleanedUrls = Array.isArray(fileUrls)
      ? fileUrls.filter((item: any) => typeof item === 'string' && !!item.trim()).map((item: any) => item.trim())
      : []
    if (!cleanedUrls.length || !sourceNode?.id) return []

    const incomingSourceNodes = edges.value
      .filter((edge: any) => edge.target === sourceNode.id && isValidFlowEdge(edge))
      .map((edge: any) => findNode(edge.source))
      .filter(Boolean)
    const sourceNodeByUrl = new Map()
    incomingSourceNodes.forEach((node: any) => {
      const url = getNodeMediaReferenceKey(node)
      if (!url) return
      const existing = sourceNodeByUrl.get(url) || []
      existing.push(node)
      sourceNodeByUrl.set(url, existing)
    })

    const storedItems = getNodeStoredReferenceItems(sourceNode)
    const storedNodeIdByUrl = new Map()
    storedItems.forEach((item: any) => {
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      const sourceNodeId = typeof item?.sourceNodeId === 'string' ? item.sourceNodeId.trim() : ''
      if (!url || !sourceNodeId || storedNodeIdByUrl.has(url)) return
      storedNodeIdByUrl.set(url, sourceNodeId)
    })

    const consumedNodeIds = new Set()
    return cleanedUrls.map((url: string) => {
      const matchedNodes = sourceNodeByUrl.get(url) || []
      const matchedNode = matchedNodes.find((node: any) => !consumedNodeIds.has(node.id))
      if (matchedNode?.id) {
        consumedNodeIds.add(matchedNode.id)
        return normalizeReferenceOrderKey({ sourceNodeId: matchedNode.id, url })
      }
      const storedNodeId = storedNodeIdByUrl.get(url)
      if (storedNodeId) {
        return normalizeReferenceOrderKey({ sourceNodeId: storedNodeId, url })
      }
      return normalizeReferenceOrderKey({ url })
    }).filter(Boolean)
  }

  // ==================== 确保节点的参考卡存在 ====================

  function ensureReferenceCardsForNode(nodeId: string, references: any[] = []) {
    const targetNode = nodes.value.find((n: any) => n.id === nodeId)
    if (!targetNode || !Array.isArray(references)) return
    let hasChanges = false

    const newNodes: any[] = []
    const newEdges: any[] = []
    const processedReferenceUrls = new Set()
    let didRemoveStaleReferences = false
    const activeReferenceKeys = new Set(
      references
        .map((reference: any) => normalizeReferenceUrlKey(reference?.url))
        .filter(Boolean)
    )
    const activeSourceNodeIds = new Set(
      references
        .map((reference: any) => reference?.sourceNodeId)
        .filter(Boolean)
    )

    const directUploadLikeNodeIds = new Set(
      getUploadLikeFileInputNodeIdsForTarget(nodeId, nodes.value, edges.value),
    )
    const staleIncomingEdgeIds = new Set()
    const staleUploadLikeNodeIds = new Set<string>()
    edges.value.forEach((edge: any) => {
      if (edge.target !== nodeId) return
      const sourceNode = nodes.value.find((node: any) => node.id === edge.source)
      if (directUploadLikeNodeIds.has(edge.source) && isUploadLikeFileInputNode(sourceNode)) {
        const sourceKey = getNodeMediaReferenceKey(sourceNode)
        if (sourceKey && !activeReferenceKeys.has(sourceKey) && !activeSourceNodeIds.has(edge.source)) {
          staleIncomingEdgeIds.add(edge.id)
          staleUploadLikeNodeIds.add(edge.source)
        }
      }
    })

    let staleReferenceNodeIds = new Set<string>()
    if (staleIncomingEdgeIds.size) {
      edges.value = edges.value.filter((edge: any) => !staleIncomingEdgeIds.has(edge.id))
      staleReferenceNodeIds = new Set(
        getOrphanedUploadLikeFileInputNodeIds([...staleUploadLikeNodeIds], edges.value),
      )
    }

    if (staleReferenceNodeIds.size || staleIncomingEdgeIds.size) {
      didRemoveStaleReferences = true
      if (staleReferenceNodeIds.size) {
        nodes.value = nodes.value.filter((node: any) => !staleReferenceNodeIds.has(node.id))
      }
      edges.value = edges.value.filter((edge: any) =>
        !staleReferenceNodeIds.has(edge.source)
        && !staleReferenceNodeIds.has(edge.target)
      )
    }

    references.forEach((reference: any, index: number) => {
      const url = String(reference?.url || '').trim()
      const key = normalizeReferenceUrlKey(url)
      if (!url || !key || processedReferenceUrls.has(key)) return
      processedReferenceUrls.add(key)

      if (reference.sourceNodeId) {
        const sourceNode = nodes.value.find((node: any) => node.id === reference.sourceNodeId)
        if (sourceNode) {
          const hasEdge = edges.value.some((edge: any) => edge.source === sourceNode.id && edge.target === nodeId)
          if (!hasEdge) {
            const nextEdge = {
              id: createEdgeId(),
              source: sourceNode.id,
              target: nodeId,
              type: 'smoothstep',
            }
            if (isValidFlowEdge(nextEdge)) {
              newEdges.push(nextEdge)
            }
          }
          return
        }
      }

      const existingReferenceNode = nodes.value.find((node: any) =>
        getNodeMediaReferenceKey(node) === key && node.type === getReferenceNodeType(reference)
      )
      if (existingReferenceNode) {
        const hasEdge = edges.value.some(
          (edge: any) =>
            edge.source === existingReferenceNode.id && edge.target === nodeId
        )
        if (!hasEdge) {
          const nextEdge = {
            id: createEdgeId(),
            source: existingReferenceNode.id,
            target: nodeId,
            type: edgeStyle.value,
          }
          if (isValidFlowEdge(nextEdge)) {
            newEdges.push(nextEdge)
          }
        }
        return
      }

      const nodeType = getReferenceNodeType(reference)
      const referenceNodeId = createRuntimeId('ref')
      const mediaType = getReferenceMediaType(reference)
      const referenceNode = {
        id: referenceNodeId,
        type: nodeType,
        position: {
          x: targetNode.position?.x - 380,
          y: targetNode.position?.y + index * 210,
        },
        data: {
          ...buildRuntimeAssetNodeData({
            label: getReferenceLabelByMediaType(mediaType),
            nodeType,
            url,
            mediaType,
          }),
        },
        ...(fixedSizeTypes[nodeType] ? { style: fixedSizeTypes[nodeType] } : {}),
      }

      newNodes.push(referenceNode)
      const nextEdge = {
        id: createRuntimeId('edge'),
        source: referenceNodeId,
        target: nodeId,
        type: edgeStyle.value,
      }
      if (isValidFlowEdge(nextEdge)) {
        newEdges.push(nextEdge)
      }
    })

    if (!hasChanges && !didRemoveStaleReferences && !newNodes.length && !newEdges.length) {
      nextTick(() => {
        skipEdgesChange.value = false
        skipNodesChange.value = false
      })
      return
    }
    if (newNodes.length) {
      nodes.value = [...nodes.value, ...newNodes]
      skipNodesChange.value = true
    }
    if (newEdges.length) {
      edges.value = [...edges.value, ...newEdges]
      skipEdgesChange.value = true
    }
    propagateDataFlow()
    emit('update:modelNodes', nodes.value)
    emit('update:modelEdges', edges.value)
    nextTick(() => {
      skipEdgesChange.value = false
      skipNodesChange.value = false
    })
    setTimeout(saveHistory, 50)
  }

  // ==================== 参考URL更新处理 ====================

  function handleReferenceUrlUpdated(oldUrl: string, newUrl: string) {
    let updated = false
    const oldKey = normalizeReferenceUrlKey(oldUrl)
    nodes.value.forEach((n: any) => {
      if (isUploadLikeFileInputNode(n) && getNodeMediaReferenceKey(n) === oldKey) {
        n.data.url = newUrl
        n.data.preview = newUrl
        if (n.data.imageUrl) n.data.imageUrl = newUrl
        if (n.data.videoUrl) n.data.videoUrl = newUrl
        if (n.data.audioUrl) n.data.audioUrl = newUrl
        updated = true
      }
    })
    if (updated) {
      propagateDataFlow()
      emit('update:modelNodes', nodes.value)
    }
  }

  // ==================== 匹配连接 ====================

  function handleConnectMatching(targetNodeId: string, urls: string[]) {
    const targetNode = nodes.value.find((n: any) => n.id === targetNodeId)
    const targetX = targetNode?.position?.x ?? Infinity
    const matchedIds: any[] = []
    for (const rawUrl of urls) {
      const key = normalizeReferenceUrlKey(rawUrl)
      if (!key) continue
      const found = nodes.value.find((n: any) => {
        if (!(isImageLikeNode(n) || isVideoLikeNode(n))) return false
        if (n.id === targetNodeId) return false
        if ((n.position?.x ?? 0) >= targetX) return false
        const nodeKey = getNodeMediaReferenceKey(n)
        return nodeKey === key
      })
      if (found) {
        matchedIds.push({ sourceId: found.id, url: rawUrl })
      }
    }
    for (const { sourceId } of matchedIds) {
      const exists = edges.value.some((e: any) => e.source === sourceId && e.target === targetNodeId)
      if (!exists) {
        const nextEdge = { id: createRuntimeId('edge'), source: sourceId, target: targetNodeId }
        if (isValidFlowEdge(nextEdge)) {
          edges.value = [...edges.value, nextEdge]
        }
      }
    }
    if (matchedIds.length) {
      propagateDataFlow()
    }
  }

  return {
    connectReferenceItemsToNode,
    handleInferUpstream,
    handleClipboardReferencePasted,
    handleWorkflowReferenceDropped,
    getNodeStoredReferenceItems,
    resolveNodeReferenceItems,
    triggerNodeInferUpstream,
    handleBatchInferUpstream,
    normalizeReferenceOrderKey,
    buildReferenceOrderFromNodeAndUrls,
    ensureReferenceCardsForNode,
    handleReferenceUrlUpdated,
    handleConnectMatching,
  }
}

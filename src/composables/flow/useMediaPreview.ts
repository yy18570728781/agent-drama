import { computed, ref } from 'vue'
import { createFlowId } from '@/utils/flowId'
import type { Ref } from 'vue'
import type { NodeDropDirection } from './useGenerationPipelineRegenerate'
import { findTeamonesAigcRecord, findTeamonesAigcRecordsByIds } from '@/api/assets'
import { assetToHistoryRecord, getReferenceUrls } from '@/components/generation/generationResultAdapters'
import { uploadFileToCosUrl, getUploadErrorMessage } from '@/api/uploadHelpers'
import { createThumbnailFileIfNeeded } from '@/utils/imageThumbnail'
import { useAssetStore } from '@/stores/assets.store'
import { toggleAigcRecordFavorite } from '@/services/assets/aigcRecord.service'
import { resolveStoredUpstreamInputs } from '@/utils/workflowUpstreamMedia'
import { getNodeUrl } from '@/utils/workflowNodeData'

export interface MediaPreviewDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  emit: {
    (e: 'update:modelNodes', value: any[]): void
  }
  findNode: (id: string) => any
  saveHistory: () => void
  isImageLikeNode: (node: any) => boolean
  isVideoLikeNode: (node: any) => boolean
  getNodeMediaType: (node: any) => string
  hasNodeResultUrl: (data: any) => boolean
  getNodeDataRecordId: (data: any) => string
  removeSelection: (options?: any) => void
  triggerNodeRegenerate: (nodeId: string, direction?: NodeDropDirection) => Promise<void>
  focusReeditNode: (node: any) => Promise<void>
  triggerNodeReEdit: (nodeId: string, direction?: NodeDropDirection) => Promise<void>
  createConnectedAssetNode: (sourceNodeId: string, options: any) => any
  getAssetNodePositionBelow: (sourceNodeId: string, size: any) => { x: number; y: number }
  getNodeBoxSize: (node: any, style?: { width?: string; height?: string }) => { width: number; height: number }
}

export function useMediaPreview(deps: MediaPreviewDeps) {
  const {
    nodes,
    edges,
    emit,
    findNode,
    triggerNodeReEdit,
    triggerNodeRegenerate,
    createConnectedAssetNode,
    getAssetNodePositionBelow,
    getNodeBoxSize,
  } = deps

  // 图片/视频细节面板
  const detailModalVisible = ref(false)
  const detailImages = ref<any[]>([])
  const detailImageInfo = ref<any>(null)
  const detailIsVideo = ref(false)
  const detailIs360 = ref(false)
  const detailNodeData = ref<any>(null)
  const detailNodeId = ref<string | null>(null)
  const detailRecordId = ref<string | null>(null)
  const detailHistoryOverride = ref<any[]>([])
  const detailFavoriteState = ref<boolean | null>(null)
  const detailIsFavorited = computed(() => {
    if (detailFavoriteState.value !== null) return detailFavoriteState.value
    if (detailRecordId.value) return false
    return Boolean(getDetailFavoriteSource()?.is_favorites)
  })

  let _lastDetailOpenNodeId: string | null = null
  let _lastDetailOpenTime = 0

  const editingImageUrl = ref<string | null>(null)
  const editingImageFile = ref<File | null>(null)
  const editingVideoUrl = ref<string | null>(null)
  const editingVideoFile = ref<File | null>(null)
  const referenceEditSourceNodeId = ref<string | null>(null)
  let videoCaptureOffsets = new Map<string, number>()

  const resolveRawMediaUrl = (url: string): string => {
    return String(url || '').trim()
  }

  const resolveEditorMediaUrl = (url: string): string => {
    return resolveRawMediaUrl(url)
  }

  const fetchMediaBlob = async (url: string, fallbackName: string, fallbackType: string): Promise<File | null> => {
    const rawUrl = resolveRawMediaUrl(url)
    if (!rawUrl) return null
    try {
      const response = await fetch(rawUrl)
      if (!response.ok) return null
      const blob = await response.blob()
      return new File([blob], fallbackName, { type: blob.type || fallbackType })
    } catch {
      return null
    }
  }

  const openEditorForNode = async ({ nodeId, imageUrl, nodeType, mediaType, referenceSourceNodeId }: any) => {
    detailNodeId.value = nodeId || null
    detailNodeData.value = detailNodeData.value?.nodeId === nodeId ? detailNodeData.value : { nodeId }
    referenceEditSourceNodeId.value = referenceSourceNodeId || null
    const rawUrl = String(imageUrl || '').trim()
    const editorUrl = resolveEditorMediaUrl(rawUrl)
    const resolvedMediaType = String(mediaType || '').trim()
    const shouldOpenVideoEditor = resolvedMediaType === 'video' || nodeType === 'video_input'
    if (shouldOpenVideoEditor) {
      editingVideoFile.value = await fetchMediaBlob(rawUrl, 'video.mp4', 'video/mp4')
      editingVideoUrl.value = editorUrl
    } else {
      editingImageFile.value = await fetchMediaBlob(rawUrl, 'image.jpg', 'image/jpeg')
      editingImageUrl.value = editorUrl
    }
  }

  // 打开细节面板
  const openDetailModal = async (data: any) => {
    const now = Date.now()
    if (data.nodeId && data.nodeId === _lastDetailOpenNodeId && now - _lastDetailOpenTime < 500) {
      return
    }
    _lastDetailOpenNodeId = data.nodeId || null
    _lastDetailOpenTime = now
    // 单条载入：清空多选详情留下的历史 override，避免左侧面板残留
    detailHistoryOverride.value = []
    const { imageUrl, nodeData, isVideo, is360 } = data
    detailImages.value = [imageUrl]
    detailIsVideo.value = isVideo || false
    detailIs360.value = is360 || false
    detailNodeData.value = nodeData
    detailNodeId.value = data.nodeId || nodeData?.nodeId || null

    detailFavoriteState.value = null
    const recordId = data.recordId ?? nodeData?.recordId
    detailRecordId.value = recordId || null
    if (recordId) {
      detailModalVisible.value = true
      try {
        const fullRecord = await findTeamonesAigcRecord(recordId)
        if (fullRecord) {
          syncDetailFavoriteState(Boolean(fullRecord.is_favorites), String(recordId))
          const record = assetToHistoryRecord(fullRecord, imageUrl)
          detailImageInfo.value = {
            prompt: record.prompt,
            model: record.modelInfo,
            modelDisplayName: record.modelInfo,
            modelVendor: record.modelVendor,
            capability: record.capability,
            mode: record.mode,
            recordId,
            createTime: record.date,
            referenceUrls: getReferenceUrls(record),
            paramsDisplay: record.params_display || [],
            generateParams: record.param || null,
          }
          return
        }
      } catch (e) { /* ignore */ }
    }

    const genState = nodeData?._genState || {}
    const params = nodeData?.params || genState.params || {}
    const referenceUrls = resolveStoredUpstreamInputs(nodeData?._upstreamInputs, findNode).images
      .map((item: any) => item.url)
      .filter(Boolean)
    const paramsDisplay: any[] = []
    if (nodeData?.paramDefs) {
      nodeData.paramDefs.forEach((p: any) => {
        if (p.name === 'prompt') return
        const val = params[p.name]
        if (val !== undefined && val !== null && val !== '') {
          paramsDisplay.push({ label: p.label || p.name, key: p.name, value: val })
        }
      })
    }

    detailImageInfo.value = {
      prompt: nodeData?.prompt || genState.prompt || params.prompt || '',
      model: nodeData?.model || genState.modelId || params.model || '',
      modelDisplayName: nodeData?.model || nodeData?.modelDisplayName || genState.modelId || '',
      modelVendor: nodeData?.modelVendor || genState.modelInfo?.publisher || params.vendor || '',
      capability: nodeData?.capability || genState.capability || '',
      mode: nodeData?.mode || genState.mode || '',
      recordId: nodeData?.recordId || '',
      createTime: nodeData?.createTime || '',
      referenceUrls,
      paramsDisplay,
      generateParams: JSON.parse(JSON.stringify(params)),
    }
    detailModalVisible.value = true
  }

  const handleSelectHistoryFromPreview = (id: string) => {
    const assetStore = useAssetStore()
    const target = assetStore.items.find((asset: any) => String(asset.id) === String(id))
    if (!target) return
    openDetailModal({
      imageUrl: target.url,
      nodeData: {
        ...(detailNodeData.value || {}),
        recordId: target.record_id || '',
        prompt: target.prompt || '',
        model: target.model || '',
        modelDisplayName: target.model || '',
        modelVendor: target.vendor || '',
      },
      isVideo: target.type === 'video',
      is360: false,
    })
  }

  /**
   * 多选入口：根据一组节点载入多条记录到细节面板。
   * 只要传入 ≥2 个节点就按多记录模式打开（带 recordId 的会拉取完整数据，
   * 其余用 url 兜底），左侧 单独浏览/历史对比 面板会自动出现。
   */
  const openDetailModalForNodes = async (nodesData: any[]) => {
    if (!Array.isArray(nodesData) || nodesData.length === 0) return

    const enriched: any[] = [] // 与 nodesData 顺序对齐的最终历史项
    const pendingIds: number[] = [] // 待批量拉取的 recordId
    const idToNodeIndex = new Map<number, number[]>()

    nodesData.forEach((n, idx) => {
      const rawId = n?.recordId ?? n?.nodeData?.recordId ?? ''
      const num = Number(rawId)
      if (rawId && Number.isFinite(num) && num > 0) {
        pendingIds.push(num)
        const arr = idToNodeIndex.get(num) || []
        arr.push(idx)
        idToNodeIndex.set(num, arr)
      }
    })

    const fetchedMap = new Map<number, any>()
    if (pendingIds.length > 0) {
      try {
        const records = await findTeamonesAigcRecordsByIds(pendingIds)
        if (Array.isArray(records)) {
          for (const r of records) {
            if (r && Number.isFinite(Number(r.id))) fetchedMap.set(Number(r.id), r)
          }
        }
      } catch (e) { /* ignore */ }
    }

    // 按 nodesData 顺序构造历史项
    for (const n of nodesData) {
      const rawId = n?.recordId ?? n?.nodeData?.recordId ?? ''
      const num = Number(rawId)
      const record = rawId && Number.isFinite(num) && num > 0 ? fetchedMap.get(num) : null
      const url = String(n?.imageUrl || n?.url || record?.url || record?.source_url || '').trim()
      if (record) {
        const rec = assetToHistoryRecord(record, url)
        enriched.push({
          id: record.id,
          thumbnail: record.thumbnail_url || record.url || record.source_url || url,
          source: record.source_url || record.url || record.thumbnail_url || url,
          isModel: record.type === 'model',
          isVideo: record.type === 'video',
          title: rec.prompt ? String(rec.prompt).slice(0, 24) : `资产 ${record.id}`,
          subtitle: record.model_display_name || record.model || '',
          width: Number(record.width || record.param?.width) || undefined,
          height: Number(record.height || record.param?.height) || undefined,
          asset: record,
        })
      } else if (url) {
        enriched.push({
          id: `node-${n?.nodeId || Math.random().toString(36).slice(2)}`,
          thumbnail: url,
          source: url,
          title: n?.nodeData?.label || `节点 ${n?.nodeId || ''}`,
          subtitle: '',
        })
      }
    }

    if (enriched.length === 0) return

    // 用第一项作为当前展示主体
    const first = nodesData[0] || {}
    const firstEnriched = enriched[0]
    detailNodeId.value = first.nodeId || null
    detailNodeData.value = { nodeId: first.nodeId, ...(first.nodeData || {}) }
    detailIsVideo.value = !!first.isVideo
    detailIs360.value = !!first.is360
    detailRecordId.value = first.recordId ? String(first.recordId) : null
    detailImages.value = enriched.map((it) => it.source || it.thumbnail || '').filter(Boolean)
    detailHistoryOverride.value = enriched

    const firstAsset = firstEnriched?.asset
    if (firstAsset) {
      const rec = assetToHistoryRecord(firstAsset, firstEnriched?.source || '')
      detailImageInfo.value = {
        prompt: rec.prompt,
        model: rec.modelInfo,
        modelDisplayName: rec.modelInfo,
        modelVendor: rec.modelVendor,
        capability: rec.capability,
        mode: rec.mode,
        recordId: firstAsset.id,
        createTime: rec.date,
        referenceUrls: getReferenceUrls(rec),
        paramsDisplay: rec.params_display || [],
        generateParams: rec.param || null,
      }
    } else {
      detailImageInfo.value = {
        prompt: first.nodeData?.prompt || '',
        model: first.nodeData?.model || first.nodeData?.modelDisplayName || '',
        modelDisplayName: first.nodeData?.model || first.nodeData?.modelDisplayName || '',
        modelVendor: first.nodeData?.modelVendor || '',
        capability: first.nodeData?.capability || '',
        mode: first.nodeData?.mode || '',
        recordId: first.recordId || '',
        createTime: first.nodeData?.createTime || '',
        referenceUrls: [],
        paramsDisplay: [],
        generateParams: null,
      }
    }

    detailModalVisible.value = true
  }

  // 重新编辑
  const handleDetailReEdit = () => {
    detailModalVisible.value = false
    const targetNodeId = detailNodeId.value || detailNodeData.value?.nodeId
    if (targetNodeId) {
      triggerNodeReEdit(targetNodeId)
    }
  }

  // 再次生成
  const handleDetailRegenerate = () => {
    // 关闭细节面板并触发生成
    detailModalVisible.value = false
    // TODO: 实现再次生成逻辑
  }

  // 删除节点内容
  const handleDetailDelete = () => {
    const targetNodeId = detailNodeId.value || detailNodeData.value?.nodeId
    if (targetNodeId) {
      // 清除节点的预览/媒体内容
      const node = nodes.value.find((n: any) => n.id === targetNodeId)
      if (node) {
        node.data.preview = null
        node.data.imageUrl = ''
        node.data.videoUrl = ''
        node.data.url = ''
      }
    }
    detailModalVisible.value = false
  }

  function getDetailFavoriteSource(): any {
    const targetNodeId = detailNodeId.value || detailNodeData.value?.nodeId
    const node = targetNodeId ? nodes.value.find((n: any) => n.id === targetNodeId) : null
    return node?.data || detailNodeData.value || null
  }

  function syncFavoriteNodes(recordId: string, isFavorited: boolean): void {
    if (!recordId) return
    nodes.value = nodes.value.map((node: any) => {
      const nodeRecordId = String(node?.data?.recordId || '').trim()
      if (nodeRecordId !== recordId) return node
      return {
        ...node,
        data: {
          ...node.data,
          is_favorites: isFavorited,
        },
      }
    })
  }

  function syncDetailFavoriteState(isFavorited: boolean, recordId?: string): void {
    detailFavoriteState.value = isFavorited
    if (recordId) syncFavoriteNodes(recordId, isFavorited)
    const source = getDetailFavoriteSource()
    if (source) source.is_favorites = isFavorited
  }

  async function handleDetailFavorite(_payload?: unknown): Promise<void> {
    const source = getDetailFavoriteSource()
    // 注意：modal 抛出的 favorite 事件 payload 是图片 URL，不能当 recordId 用。
    // 真正的 recordId 始终取 detailRecordId.value（详情面板当前载入的记录）。
    const recordId = String(detailRecordId.value || '').trim()
    if (!recordId) return
    const currentFavorite = detailFavoriteState.value ?? Boolean(source?.is_favorites)
    const result = await toggleAigcRecordFavorite(recordId, currentFavorite)
    syncDetailFavoriteState(result.is_favorites, recordId)
    emit('update:modelNodes', nodes.value)
  }

  const handleDetailEditImage = async () => {
    if (!detailImages.value.length) return
    editingImageFile.value = null
    const rawUrl = String(detailImages.value[0] || '').trim()
    editingImageFile.value = await fetchMediaBlob(rawUrl, 'image.jpg', 'image/jpeg')
    editingImageUrl.value = resolveEditorMediaUrl(rawUrl)
    detailModalVisible.value = false
  }

  const handleDetailEditVideo = async () => {
    if (!detailImages.value.length) return
    editingVideoFile.value = null
    const rawUrl = String(detailImages.value[0] || '').trim()
    editingVideoFile.value = await fetchMediaBlob(rawUrl, 'video.mp4', 'video/mp4')
    editingVideoUrl.value = resolveEditorMediaUrl(rawUrl)
    detailModalVisible.value = false
  }

  const closeImageEditor = () => {
    editingImageUrl.value = null
    editingImageFile.value = null
    referenceEditSourceNodeId.value = null
  }
  const closeVideoEditor = () => {
    editingVideoUrl.value = null
    editingVideoFile.value = null
    videoCaptureOffsets = new Map()
  }

  const onDetailImageEditApply = (data: any) => {
    const targetNodeId = detailNodeId.value || detailNodeData.value?.nodeId
    if (targetNodeId) {
      const node = nodes.value.find((n: any) => n.id === targetNodeId)
      if (node) {
        const created = createConnectedAssetNode(targetNodeId, {
          label: `${node.data?.label || '图片'} - 编辑`,
          url: data.url,
          mediaType: 'image',
          style: { width: '320px', height: '180px' },
          position: getAssetNodePositionBelow(targetNodeId, { width: '320px', height: '180px' }),
        })
        const createdNodeId = created?.id
        if (createdNodeId) {
          const createdNode = nodes.value.find((n: any) => n.id === createdNodeId)
          if (createdNode?.data) {
            createdNode.data.disableInferUpstream = true
            createdNode.data.uploadStatus = 'uploading'
            createdNode.data.uploadError = ''
          }
          emit('update:modelNodes', nodes.value)

          uploadFileToCosUrl(data.file, data.file.name).then((uploadedUrl: string) => {
            const currentNode = nodes.value.find((n: any) => n.id === createdNodeId)
            if (!currentNode?.data) return
            const previousUrl = currentNode.data.url
            if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
            currentNode.data.url = uploadedUrl
            currentNode.data.preview = uploadedUrl
            currentNode.data.imageUrl = uploadedUrl
            currentNode.data.sourceUrl = uploadedUrl
            currentNode.data.uploadStatus = 'uploaded'
            currentNode.data.uploadError = ''
            emit('update:modelNodes', nodes.value)
          }).catch((error: any) => {
            console.warn('[FlowCanvas] failed to upload edited image result:', error)
            const currentNode = nodes.value.find((n: any) => n.id === createdNodeId)
            if (!currentNode?.data) return
            currentNode.data.uploadStatus = 'local'
            currentNode.data.uploadError = getUploadErrorMessage(error)
            emit('update:modelNodes', nodes.value)
          })
          createThumbnailFileIfNeeded(data.file).then((thumbFile: File | null) => {
            if (!thumbFile) return null
            return uploadFileToCosUrl(thumbFile, thumbFile.name)
          }).then((thumbUrl: string | null) => {
            if (!thumbUrl) return
            const currentNode = nodes.value.find((n: any) => n.id === createdNodeId)
            if (!currentNode?.data) return
            currentNode.data.thumb = thumbUrl
            emit('update:modelNodes', nodes.value)
          }).catch(() => {})
        }
      }
    }
    closeImageEditor()
  }

  const onDetailVideoEditApply = (data: any) => {
    const targetNodeId = detailNodeId.value || detailNodeData.value?.nodeId
    const firstTrack = Array.isArray(data?.tracks) ? data.tracks[0] : null
    const fallbackUrl = firstTrack?.url || editingVideoUrl.value
    if (targetNodeId) {
      const node = nodes.value.find((n: any) => n.id === targetNodeId)
      if (node) {
        node.data.url = fallbackUrl
        node.data.preview = fallbackUrl
        node.data.videoUrl = fallbackUrl
        node.data.mediaType = 'video'
        node.data.videoTracks = data?.tracks || []
        node.data.videoOptions = data?.options || {}
      }
    }
    closeVideoEditor()
    emit('update:modelNodes', nodes.value)
  }

  const onVideoEditorCaptureFrame = ({ url }: { url: string }) => {
    const sourceNodeId = detailNodeId.value || detailNodeData.value?.nodeId
    const sourceNode = sourceNodeId ? findNode(sourceNodeId) : null
    const label = sourceNode?.data?.label || '视频'
    const offset = sourceNodeId ? (videoCaptureOffsets.get(sourceNodeId) || 0) : 0
    const sourceX = Number(sourceNode?.position?.x || 0)
    const sourceY = Number(sourceNode?.position?.y || 0)
    const sourceSize = sourceNode ? getNodeBoxSize(sourceNode) : { width: 0, height: 0 }
    const baseX = sourceX + sourceSize.width + 48
    const baseY = sourceY
    const created = createConnectedAssetNode(sourceNodeId, {
      id: createFlowId('node'),
      label: `${label} - 帧截图`,
      url,
      thumb: url,
      mediaType: 'image',
      style: { width: '320px', height: '180px' },
      position: {
        x: baseX,
        y: baseY + offset * (180 + 28),
      },
    })
    const newNodeId = created.id
    if (sourceNodeId) {
      videoCaptureOffsets.set(sourceNodeId, offset + 1)
    }
    if (sourceNode && !sourceNode.data.markers) sourceNode.data.markers = []
    if (sourceNode) {
      sourceNode.data.markers.push({
        id: newNodeId,
        percentage: 0,
        time: 0,
      })
    }
  }

  // --- 工作流内记录导航（上一条 / 下一条）---
  // 收集画布上所有带 recordId 的节点，按 recordId 数值升序排序去重。
  // 依赖 nodes（响应式），实时反映节点增删。
  interface RecordEntry { nodeId: string; recordId: number; node: any }

  const collectWorkflowRecordNodes = (): RecordEntry[] => {
    const seen = new Map<number, RecordEntry>()
    for (const node of nodes.value || []) {
      const rawId = String(node?.data?.recordId || '').trim()
      const num = Number(rawId)
      if (!rawId || !Number.isFinite(num) || num <= 0) continue
      if (seen.has(num)) continue
      seen.set(num, { nodeId: node.id, recordId: num, node })
    }
    return Array.from(seen.values()).sort((a, b) => a.recordId - b.recordId)
  }

  // 当前记录在排序列表中的位置（找不到返回 -1）。
  const currentRecordIndex = computed(() => {
    const cur = Number(String(detailRecordId.value || '').trim())
    if (!Number.isFinite(cur) || cur <= 0) return -1
    const list = collectWorkflowRecordNodes()
    return list.findIndex((e) => e.recordId === cur)
  })

  const hasPrevRecord = computed(() => currentRecordIndex.value > 0)
  const hasNextRecord = computed(() => {
    const idx = currentRecordIndex.value
    if (idx < 0) return false
    return idx < collectWorkflowRecordNodes().length - 1
  })

  // 切换到目标记录节点并重新打开详情。
  const goToRecordByOffset = (offset: number): void => {
    const list = collectWorkflowRecordNodes()
    const idx = currentRecordIndex.value
    if (idx < 0) return
    const target = list[idx + offset]
    if (!target) return
    const data = target.node?.data
    if (!data) return
    openDetailModal({
      nodeId: target.nodeId,
      imageUrl: getNodeUrl(data),
      nodeData: data,
      isVideo: deps.isVideoLikeNode(target.node),
      recordId: String(target.recordId),
    })
  }

  const goToPrevRecord = () => goToRecordByOffset(-1)
  const goToNextRecord = () => goToRecordByOffset(1)

  return {
    detailModalVisible,
    detailImages,
    detailImageInfo,
    detailIsVideo,
    detailIs360,
    detailNodeData,
    detailNodeId,
    detailRecordId,
    detailIsFavorited,
    detailHistoryOverride,
    referenceEditSourceNodeId,
    editingImageUrl,
    editingImageFile,
    editingVideoUrl,
    editingVideoFile,
    openEditorForNode,
    openDetailModal,
    openDetailModalForNodes,
    handleSelectHistoryFromPreview,
    handleDetailReEdit,
    handleDetailRegenerate,
    handleDetailDelete,
    handleDetailFavorite,
    handleDetailEditImage,
    handleDetailEditVideo,
    closeImageEditor,
    closeVideoEditor,
    onDetailImageEditApply,
    onDetailVideoEditApply,
    onVideoEditorCaptureFrame,
    hasPrevRecord,
    hasNextRecord,
    goToPrevRecord,
    goToNextRecord,
  }
}

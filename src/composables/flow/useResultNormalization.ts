import { nextTick } from 'vue'
import type { Ref } from 'vue'
import { getStorage, getStorageKeys } from '@/utils/storage'
import { buildGenerationStateFromRequest, inferMediaType as inferWorkflowMediaType } from '@/utils/workflowNodeData'
import type { WorkflowMediaType } from '@/utils/workflowNodeData'
import { buildWorkflowMediaMeta } from '@/utils/workflowNodeMediaMeta'
import { getWorkflowNodeTaskId } from './workflowTaskState'
import type { buildPortsForNode as buildPortsForNodeContract } from '@/utils/workflowNodeData'
import type { FlowNode } from './flowCore.types'

// ==================== Pure utility functions (no external deps) ====================

function extractUrl(raw: any): string {
  if (!raw) return ''
  if (typeof raw === 'object') {
    return (
      raw.origin_url
      || raw.source_url
      || raw.preview_url
      || raw.url
      || raw.proxy_url
      || raw.thumb
      || raw.cover_url
      || raw.file_url
      || raw.src
      || ''
    )
  }
  return raw
}

function extractPreviewUrl(item: any): string | null {
  const url = extractUrl(
    item?.url
    || item?.source_url
    || item?.preview_url
    || item?.thumb
    || item?.cover_url
    || item?.file_url
    || item?.image_url
    || item?.video_url
  )
  if (url) return url
  return extractUrl(item?.thumb || item?.source_url || item?.preview_url) || null
}

function extractThumbUrl(item: any): string | null {
  return extractUrl(
    item?.thumb
    || item?.preview_url
    || item?.cover_url
    || item?.media?.[0]?.thumb
  ) || null
}

function extractResultMediaMeta(item: any): { width: number; height: number; aspectRatio: number } | undefined {
  const media = item?.media?.[0]
  const width = Number(media?.width || item?.width || 0)
  const height = Number(media?.height || item?.height || 0)
  const aspectRatio = Number(media?.aspect_ratio || media?.aspectRatio || item?.aspect_ratio || item?.aspectRatio || 0)
  return buildWorkflowMediaMeta(width, height, aspectRatio)
}

function cloneGenerationState(state: any): any | null {
  if (!state) return null
  return {
    modelId: state.modelId,
    modelInfo: state.modelInfo ? { ...state.modelInfo } : undefined,
    capability: state.capability,
    mode: state.mode,
    prompt: state.prompt,
    params: state.params ? { ...state.params } : undefined,
    fileUrls: Array.isArray(state.fileUrls) ? [...state.fileUrls] : undefined,
    referenceItems: Array.isArray(state.referenceItems) ? state.referenceItems.map((item: any) => ({ ...item })) : undefined,
    referenceOrder: Array.isArray(state.referenceOrder) ? [...state.referenceOrder] : undefined,
    taskId: state.taskId || state.task_id || '',
    task_id: state.task_id || state.taskId || '',
  }
}

function normalizePublisher(modelInfo: any): string {
  if (!modelInfo) return ''
  return modelInfo.publisher || modelInfo.vendor || modelInfo.vendor_id || ''
}

function tryParseJsonPayload(value: any): any {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text || (text[0] !== '{' && text[0] !== '[')) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

function unwrapCompletedResultPayload(result: any): Record<string, any> {
  const rawResult = tryParseJsonPayload(result)
  const rawData = tryParseJsonPayload(rawResult?.data)
  const nestedData = tryParseJsonPayload(rawData?.data)
  const rawInnerResult = tryParseJsonPayload(rawResult?.result)
  return {
    rawResult,
    data: rawData,
    nestedData,
    innerResult: rawInnerResult,
  }
}

function normalizeResultItems(result: any): any[] {
  const { rawResult, data, nestedData, innerResult } = unwrapCompletedResultPayload(result)
  if (Array.isArray(rawResult?.items)) return rawResult.items
  if (Array.isArray(innerResult?.items)) return innerResult.items
  if (Array.isArray(data)) return data
  if (Array.isArray(nestedData)) return nestedData
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(nestedData?.items)) return nestedData.items
  const mediaContainer = data?.media_info
    ? data
    : nestedData?.media_info
      ? nestedData
      : innerResult?.data?.media_info
        ? innerResult.data
        : innerResult?.media_info
          ? innerResult
          : null
  if (mediaContainer?.media_info) {
    const media = mediaContainer.media_info
    return [{
      asset_id: media.id,
      id: media.id,
      task_id: rawResult?.task_id || data?.task_id || nestedData?.task_id || innerResult?.task_id || '',
      origin_url: media.origin_url,
      thumb: media.thumb,
      url: media.origin_url || media.param?.base_url || media.url || media.thumb,
      type: media.type,
      aigc_record_info: mediaContainer.aigc_record_info || innerResult?.aigc_record_info,
    }]
  }
  if (data?.url || data?.thumb) return [data]
  if (nestedData?.url || nestedData?.thumb) return [nestedData]
  if (innerResult?.url || innerResult?.thumb) return [innerResult]
  return []
}

function getResultItemNodeType(item: any, fallbackType?: string): string {
  return 'aigc_result'
}

function getResultRecordId(result: any, item: any, index: number): string | null {
  const eventRecordId = result?.aigc_record_id || result?.data?.aigc_record_id || result?.data?.aigc_record_info?.id || result?.aigc_record_info?.id
  const ids = Array.isArray(result?.aigcRecordIds) ? result.aigcRecordIds : []
  return eventRecordId
    || ids[index]
    || item?.aigc_record_info?.id
    || item?.aigc_record_id
    || item?.record_id
    || (index === 0 ? result?.recordId : null)
}

function getCompletedResultLabel(recordId: string, modelName: string = ''): string {
  return buildResultCardLabel(recordId, modelName)
}

function getNodeDataRecordId(data: any): string {
  return String(data?.recordId || '').trim()
}

function getNodeRepairRecordId(data: any): string {
  return String(
    data?.recordId
    || '',
  ).trim()
}

function nodeHasResolvedResult(data: any): boolean {
  if (!data) return false
  return !!(
    getNodeDataRecordId(data)
    || data.preview
    || data.url
    || data.imageUrl
    || data.videoUrl
    || data.audioUrl
  )
}

function extractGenerateFailReason(error: any): string {
  if (!error) return '生成失败'
  if (typeof error === 'string') return error
  return error?.fail_reason?.error_message
    || error?.fail_reason?.message
    || error?.detail
    || error?.message
    || error?.error_message
    || '生成失败'
}

function extractEventRecordId(payload: any): string {
  const result = payload?.result
  const camelIds = Array.isArray(payload?.aigcRecordIds) ? payload.aigcRecordIds : []
  return String(
    payload?.aigcRecordId
    || (camelIds.length ? camelIds[0] : '')
    || payload?.aigc_record_id
    || payload?.recordId
    || payload?.record_id
    || payload?.data?.aigc_record_id
    || payload?.data?.record_id
    || result?.recordId
    || result?.record_id
    || result?.aigc_record_id
    || result?.data?.record_id
    || result?.data?.aigc_record_id
    || result?.data?.aigc_record_info?.id
    || result?.aigc_record_info?.id
    || '',
  ).trim()
}

function getCachedAllowGenerateCountSchema(modelId: string, mode: string, capability?: string): any | null {
  if (!modelId || !mode) return null
  try {
    const exactPrefix = `model_cache_params_${modelId}_${mode}_${capability || ''}_`
    const fallbackPrefix = `model_cache_params_${modelId}_${mode}_`
    let cached = ''
    for (const key of getStorageKeys()) {
      if (key.startsWith(exactPrefix) || key.startsWith(fallbackPrefix)) {
        cached = (getStorage<string>(key) || '')
        if (cached) break
      }
    }
    if (!cached) return null
    const parsed = JSON.parse(cached)
    const payload = parsed?.d || parsed
    const schema = payload?.params?.allow_generate_count || payload?.allow_generate_count
    return schema && schema.type === 'integer' ? schema : null
  } catch {
    return null
  }
}

function getRememberedGenerateCount(modelId: string, capability?: string): number | null {
  const normalizeCount = (value: any): number | null => {
    const num = Math.floor(Number(value))
    return Number.isFinite(num) && num > 0 ? num : null
  }

  try {
    const parsed = getStorage<Record<string, any>>('infinite_canvas_workflow_cap_model_remember')
    if (parsed && capability) {
      const rememberedByCap = parsed?.[capability]
      if (!modelId || rememberedByCap?.modelId === modelId) {
        const remembered = normalizeCount(rememberedByCap?.params?.allow_generate_count)
        if (remembered) return remembered
      }
    }
  } catch {}

  return null
}

function inferRegenerateType(capability: string, nodeType?: string): string {
  if (capability === 'video_generation' || nodeType === 'video_generation') return 'video'
  if (capability === 'audio_generation' || nodeType === 'audio_generation') return 'audio'
  if (capability === 'model_generation') return 'model'
  return 'image'
}

function inferNodeOutputMediaType(nodeType: string, data: any = {}): WorkflowMediaType {
  if (data?.mediaType) return inferWorkflowMediaType(data.mediaType, nodeType)
  if (nodeType === 'video_generation') return 'video'
  if (nodeType === 'audio_generation') return 'audio'
  if (nodeType === 'text_generation') return 'text'
  if (nodeType === 'model_generation') return '3d_model'
  return 'image'
}

function nodeHasGenerationContext(nodeData: any): boolean {
  if (!nodeData) return false
  if (nodeData.recordId) return true
  const request = nodeData.request
  if (request && typeof request === 'object') {
    if (request.capability || request.mode) return true
    if (request.params && typeof request.params === 'object' && Object.keys(request.params).length > 0) return true
  }
  return false
}

function buildDetachedCopyLabel(sourceLabel: string, nodeType: string): string {
  const fallbackLabel = nodeType === 'audio_generation'
    ? '音频生成'
    : nodeType === 'text_generation'
      ? '文本生成'
      : nodeType === 'video_generation'
        ? '视频生成'
        : nodeType === 'model_generation'
          ? '模型生成'
          : nodeType === 'image_generation'
            ? '图片生成'
            : nodeType === 'file_input'
              ? '文件输入'
              : '生成节点'
  const baseLabel = String(sourceLabel || fallbackLabel)
    .replace(/\s*副本$/, '')
    .replace(/\s*#\w+$/, '')
    .trim()
  return `${baseLabel || fallbackLabel} 副本`
}

function resolveResultModelDisplayName(baseData: any, result: any, item: any): string {
  return String(
    result?.model
    || result?.modelId
    || result?.model_info?.id
    || item?.model
    || item?.model_info?.id
    || baseData?.model
    || baseData?.modelDisplayName
    || baseData?._genState?.modelId
    || '',
  ).trim()
}

function extractResultLabelPrefix(label: string): string {
  return String(label || '').replace(/\s*#\w+$/, '').trim()
}

function isGenericResultLabelPrefix(label: string): boolean {
  const prefix = extractResultLabelPrefix(label)
  return !prefix || ['模型', '图片生成', '视频生成', '音频生成', '模型生成', '文本结果'].includes(prefix)
}

function shouldOverwriteResultLabel(label: string): boolean {
  const rawLabel = String(label || '').trim()
  if (!rawLabel) return true
  if (rawLabel.includes('生成中')) return true
  return isGenericResultLabelPrefix(rawLabel)
}

function resolveLockedResultLabelName(baseData: any, result: any, item: any): string {
  const explicitName = resolveResultModelDisplayName(baseData, result, item)
  if (explicitName) return explicitName
  return ''
}

function getNodeStoredModelDisplayName(data: any): string {
  return String(
    data?.model
    || data?.modelDisplayName
    || data?._genState?.modelId
    || '',
  ).trim()
}

function buildResultCardLabel(recordId: string, modelName: string = ''): string {
  const shortId = String(recordId || '').trim()
    ? String(recordId).trim().slice(-6)
    : Date.now().toString(36).slice(-6)
  const prefix = String(modelName || '').trim() || '模型'
  return `${prefix} #${shortId}`
}

function ensureResolvedResultTitle(data: any, recordId?: string): any {
  const nextData = { ...(data || {}) }
  const resolvedRecordId = String(recordId || getNodeDataRecordId(nextData) || '').trim()
  const modelName = String(nextData.model || '').trim()
  if (!resolvedRecordId || !modelName) return nextData
  const targetLabel = buildResultCardLabel(resolvedRecordId, modelName)
  if (String(nextData.label || '').trim() !== targetLabel) {
    nextData.label = targetLabel
  }
  return nextData
}

function isBlankGenerationNodeData(nodeType: string, nodeData?: any): boolean {
  const generationTypes = new Set([
    'text_generation',
    'image_generation',
    'video_generation',
    'model_generation',
    'audio_generation',
  ])
  if (!generationTypes.has(nodeType)) return false
  const data = nodeData || {}
  const hasAigcRecord = !!data.recordId
  const hasInputContent = !!(
    data.content ||
    data.preview ||
    data.imageUrl ||
    data.videoUrl ||
    data.audioUrl
  )
  return !hasAigcRecord && !hasInputContent
}

// ==================== Deps interface ====================

export interface ResultNormalizationDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  emit: (event: string, ...args: any[]) => void
  saveHistory: () => void
  // Composable dependencies
  findNode: (id: string) => any
  buildBaseNodeRuntimeData: (opts: any) => any
  getDefaultCapabilityByNodeType: (type: string) => string
  GENERATION_PANEL_CAPABILITIES: any
  NO_RESULT_CAPABILITIES?: string[]
  getNodeGenerationCapability: (node: any) => string
  getWorkflowRememberedRequest: (node: any) => any
  applyWorkflowRememberedRequest: (data: any, item: any) => any
  applyPresetData: (data: any, item: any) => any
  isFileInputNodeType: (type: string) => boolean
  hasNodeResultUrl: (node: any) => boolean
  canOpenGenerationPanel: (node: any) => boolean
  // Additional dependencies needed by extracted functions
  selectedPanelNode: Ref<any>
  buildWorkflowRequestFromNodeData: (data: any) => any
  buildRuntimeAssetNodeData: (opts: any) => any
  inferMediaType: (...args: any[]) => string
  buildPortsForNode: typeof buildPortsForNodeContract
  getReferenceUrls: (recordOrData: any) => string[]
  sanitizeWorkflowRequestParams: (params: any) => any
  taskQueueStore: any
  REPAIRABLE_GENERATION_NODE_TYPES: Set<string>
  getNodeUrl: (data: any) => string
  resolveOriginalNodeId: (nodeId: string) => string
  fixedSizeTypes: Record<string, any>
  assignToGroupIfOverlapping: (node: any, x: number, y: number) => void
  propagateDataFlow: () => void
  isValidFlowEdge: (edge: any) => boolean
  createEdgeId: (prefix: string) => string
  createRuntimeId: (prefix: string) => string
  updateNodeInternals: (ids: string[]) => void
  syncNodeEdgeHandles: (nodeId: string) => void
  buildReferenceOrderFromNodeAndUrls: (node: any, urls: string[]) => string[]
}

// ==================== Composable ====================

export function useResultNormalization(deps: ResultNormalizationDeps) {
  const {
    nodes, edges, emit, saveHistory,
    selectedPanelNode,
    buildWorkflowRequestFromNodeData,
    buildRuntimeAssetNodeData,
    inferMediaType,
    buildPortsForNode,
    getReferenceUrls,
    sanitizeWorkflowRequestParams,
    taskQueueStore,
    REPAIRABLE_GENERATION_NODE_TYPES,
    getNodeUrl,
    resolveOriginalNodeId,
    fixedSizeTypes,
    assignToGroupIfOverlapping,
    propagateDataFlow,
    isValidFlowEdge,
    createEdgeId,
    createRuntimeId,
    updateNodeInternals,
    syncNodeEdgeHandles,
    buildReferenceOrderFromNodeAndUrls,
  } = deps

  // ==================== Functions requiring deps ====================

  function updateWorkflowNodeState(nodeId: string, state: any): boolean {
    const idx = nodes.value.findIndex((n: any) => n.id === nodeId)
    if (idx < 0) return false

    const nextState = cloneGenerationState(state)
    const currentNode = nodes.value[idx]
    const currentData = currentNode.data || {}
    const modelInfo = nextState?.modelInfo || {}
    const modelId = nextState?.modelId || currentData.model || ''
    const modelVendor = normalizePublisher(modelInfo) || currentData.modelVendor || ''
    const nextParams = nextState?.params ? { ...nextState.params } : {}
    delete nextParams.allow_generate_count
    delete nextParams.file_urls
    delete nextParams.reference_urls
    delete nextParams.reference_files
    delete nextParams.files
    delete nextParams.file_url
    delete nextParams.image_urls
    delete nextParams.image_first_frame
    delete nextParams.image_last_frame
    if (!nextParams.model && modelId) {
      nextParams.model = modelId
    }
    if (typeof nextState?.prompt === 'string') {
      nextParams.prompt = nextState.prompt
    }
    const nextRequest = nextState?.capability
      ? {
          capability: nextState.capability,
          mode: nextState.mode || 'standard',
          params: { ...nextParams },
        }
      : buildWorkflowRequestFromNodeData(currentData)

    nodes.value[idx] = {
      ...currentNode,
      data: {
        ...currentData,
        request: nextRequest || undefined,
        _genState: nextState,
        ...(nextState?.capability ? { defaultCapability: nextState.capability } : {}),
        ...(modelId ? { model: modelId } : {}),
        ...(modelVendor ? { modelVendor } : {}),
        fileUrls: [],
        referenceUrls: [],
        referenceItems: [],
      },
    }

    nodes.value = [...nodes.value]
    if (selectedPanelNode.value?.id === nodeId) {
      selectedPanelNode.value = nodes.value[idx]
    }
    emit('update:modelNodes', nodes.value)
    return true
  }

  function buildRegenerateContextFromRecord(record: any, node: any): Record<string, any> | null {
    const rawParams = record?.param && typeof record.param === 'object' ? { ...record.param } : {}
    const nestedParams = rawParams.params && typeof rawParams.params === 'object' ? { ...rawParams.params } : {}

    const modelId =
      record?.model
      || record?.model_info?.id
      || rawParams.model
      || nestedParams.model
      || rawParams.model_id
      || nestedParams.model_id
      || ''

    const capability =
      record?.capability
      || rawParams.capability
      || nestedParams.capability
      || ''

    const mode =
      rawParams.mode
      || nestedParams.mode
      || 'standard'

    const prompt =
      record?.prompt
      || rawParams.prompt
      || nestedParams.prompt
      || ''

    const requestParams = sanitizeWorkflowRequestParams({
      ...rawParams,
      ...nestedParams,
      ...(modelId ? { model: modelId } : {}),
      ...(prompt ? { prompt } : {}),
    })

    delete requestParams.params
    delete requestParams.capability
    delete requestParams.mode

    return {
      modelId,
      capability,
      mode,
      prompt,
      vendor:
        record?.vendor
        || normalizePublisher(record?.model_info)
        || requestParams.vendor
        || '',
      model:
        record?.model
        || record?.model_info?.id
        || '',
      requestParams,
      numImagesPerRequest: Number(requestParams.num_images || requestParams.batch_size || 1) || 1,
      referenceUrls: getReferenceUrls(record),
      genType: inferRegenerateType(capability, node?.type),
    }
  }

  function buildResultNodeData(baseData: any, item: any, result: any, index: number): any {
    const preview = extractPreviewUrl(item)
    const thumb = extractThumbUrl(item)
    const recordId = getResultRecordId(result, item, index) || ''
    const request = buildWorkflowRequestFromNodeData(baseData || {})
    const nodeType = getResultItemNodeType(item, baseData?.mediaType === 'video' ? 'file_input' : undefined)
    const mediaType = inferMediaType(item?.mediaType || item?.type, nodeType)
    const modelDisplayName = resolveLockedResultLabelName(baseData, result, item)
    const runtimeNodeData = buildRuntimeAssetNodeData({
      label: buildResultCardLabel(recordId || `${Date.now().toString(36)}${index}`, modelDisplayName),
      nodeType,
      url: preview,
      thumb,
      recordId,
      request,
      model: modelDisplayName,
    })
    const nextNodeData = {
      ...runtimeNodeData,
      ...(extractResultMediaMeta(item) ? { mediaMeta: extractResultMediaMeta(item) } : {}),
      _upstreamInputs: baseData?._upstreamInputs
        ? JSON.parse(JSON.stringify(baseData._upstreamInputs))
        : undefined,
      _blockedUpstreamNodeIds: Array.isArray(baseData?._blockedUpstreamNodeIds)
        ? [...baseData._blockedUpstreamNodeIds]
        : undefined,
      _reeditSourceNodeId: baseData?._reeditSourceNodeId,
      _regenFromNodeId: baseData?._regenFromNodeId,
      pbrChannel: baseData?.pbrChannel,
      _textureMaterialConsumerNodeId: baseData?._textureMaterialConsumerNodeId,
    }
    const persistedTaskId = getWorkflowNodeTaskId(baseData)
    if (persistedTaskId) {
      nextNodeData.taskId = persistedTaskId
      nextNodeData._genState = { ...(nextNodeData._genState || {}), task_id: persistedTaskId, taskId: persistedTaskId }
    }
    const preservedPrompt = String(
      request?.params?.prompt
      || baseData?.prompt
      || baseData?._genState?.prompt
      || result?.prompt
      || '',
    ).trim()
    if (preservedPrompt) {
      nextNodeData.prompt = preservedPrompt
    }
    return applyResolvedAssetToNodeData(nextNodeData, { recordId, preview, record: null })
  }

  function applyResolvedAssetToNodeData(nodeData: any, resolved: any): any {
    const nextData = { ...nodeData }
    const recordId = resolved?.recordId ? String(resolved.recordId) : getNodeDataRecordId(nextData)
    const preview = resolved?.preview || nextData.preview || nextData.url || ''
    const thumb = resolved?.thumb || nextData.thumb || ''
    const mediaType = nextData.mediaType || inferMediaType(undefined, 'aigc_result', preview)
    const portNodeType = recordId || nextData.nodeKind === 'aigc_result' ? 'aigc_result' : 'file_input'

    if (recordId) {
      nextData.recordId = recordId
      nextData.nodeKind = 'aigc_result'
    }
    if (resolved?.record && typeof resolved.record === 'object') {
      nextData.is_favorites = Boolean(resolved.record.is_favorites ?? resolved.record.is_favorite)
    }

    const lockedLabelName = nextData.model || resolveLockedResultLabelName(nextData, resolved?.record, null)
    if (lockedLabelName) {
      nextData.model = nextData.model || lockedLabelName
    }
    if (recordId && lockedLabelName) {
      nextData.label = getCompletedResultLabel(recordId, lockedLabelName)
    } else if (!String(nextData.label || '').trim()) {
      nextData.label = getCompletedResultLabel(recordId, lockedLabelName)
    }
    nextData.mediaType = mediaType
    nextData.ports = buildPortsForNode(portNodeType, mediaType)
    if (thumb) {
      nextData.thumb = thumb
    }

    if (!preview) return nextData

    nextData.url = preview
    nextData.preview = preview

    if (mediaType === 'video') {
      nextData.videoUrl = preview
    } else if (mediaType === 'audio') {
      nextData.audioUrl = preview
    } else {
      nextData.imageUrl = preview
    }

    return nextData
  }

  function applyRecordIdToNodeData(data: any, recordId: string): any {
    const nextRecordId = String(recordId || '').trim()
    if (!nextRecordId) return data
    const nextData = {
      ...data,
      recordId: nextRecordId,
    }
    const lockedLabelName = nextData.model || resolveLockedResultLabelName(nextData, null, null)
    if (lockedLabelName) {
      nextData.model = nextData.model || lockedLabelName
      const targetLabel = getCompletedResultLabel(nextRecordId, lockedLabelName)
      if (String(nextData.label || '').trim() !== targetLabel) {
        nextData.label = targetLabel
      }
    }
    return nextData
  }

  function removeGeneratingPlaceholderNodes(nodeId: string): void {
    const canRemovePlaceholder = (node: any): boolean => {
      const data = node?.data || {}
      const status = String(data.status || '').trim()
      if (data._managedGenerationSlot) return false
      if (Number.isFinite(Number(data._requestIndex))) return false
      if (status === 'waiting_submit' || status === 'queued' || status === 'running') return false
      if (data.isGenerating || data._activeTaskId || data.taskId) return false
      return true
    }
    const placeholderIds = nodes.value
      .filter((node: any) => node.data?._resultPlaceholderForNodeId === nodeId)
      .filter(canRemovePlaceholder)
      .map((node: any) => node.id)
    if (!placeholderIds.length) return
    nodes.value = nodes.value.filter((node: any) => !placeholderIds.includes(node.id))
    edges.value = edges.value.filter((edge: any) => !placeholderIds.includes(edge.source) && !placeholderIds.includes(edge.target))
    emit('update:modelNodes', nodes.value)
    emit('update:modelEdges', edges.value)
  }

  function nodeHasActiveGenerationTask(node: any): boolean {
    const taskId = String(node?.data?._activeTaskId || '').trim()
    if (!taskId) return false
    return taskQueueStore.tasks.some((task: any) => task.taskId === taskId && task.isGenerating)
  }

  function isRepairableGeneratingNode(node: any): boolean {
    if (!node || !REPAIRABLE_GENERATION_NODE_TYPES.has(String(node.type || ''))) return false
    const data = node.data || {}
    if (!getNodeRepairRecordId(data)) return false
    if (getNodeUrl(data)) return false
    if (nodeHasActiveGenerationTask(node)) return false
    return true
  }

  function isRepairableResultThumbnailNode(node: any): boolean {
    if (!node || String(node.type || '') !== 'aigc_result') return false
    const data = node.data || {}
    if (!getNodeRepairRecordId(data)) return false
    if (!getNodeUrl(data)) return false
    if (String(data.thumb || '').trim()) return false
    if (nodeHasActiveGenerationTask(node)) return false
    return true
  }

  function isRepairableMissingResultNode(node: any): boolean {
    if (!node) return false
    const nodeType = String(node.type || '')
    if (nodeType !== 'aigc_result' && !REPAIRABLE_GENERATION_NODE_TYPES.has(nodeType)) return false
    const data = node.data || {}
    if (!getNodeRepairRecordId(data)) return false
    if (getNodeUrl(data)) return false
    if (nodeHasActiveGenerationTask(node)) return false
    return true
  }

  function resolveNodeModelDisplayName(nodeId: string, data: any): string {
    const direct = getNodeStoredModelDisplayName(data)
    if (direct) return direct
    const originalNodeId = resolveOriginalNodeId(nodeId)
    if (!originalNodeId) return ''
    const originalNode = nodes.value.find((node: any) => node.id === originalNodeId)
    return getNodeStoredModelDisplayName(originalNode?.data || {})
  }

  function getDetachedCopyPosition(sourceNode: any): { x: number; y: number } {
    const baseX = sourceNode?.computedPosition?.x ?? sourceNode?.position?.x ?? 0
    const baseY = sourceNode?.computedPosition?.y ?? sourceNode?.position?.y ?? 0
    const sourceWidth = sourceNode?.dimensions?.width || parseInt(sourceNode?.style?.width) || 320
    const sourceHeight = sourceNode?.dimensions?.height || parseInt(sourceNode?.style?.height) || 180
    const siblings = nodes.value.filter((node: any) => node.data?._reeditSourceNodeId === sourceNode?.id)
    const index = siblings.length
    const horizontalStep = Math.min(56, Math.max(32, Math.round(sourceWidth * 0.16)))
    const verticalGap = 92
    const verticalStep = 36
    return {
      x: baseX + Math.min(index, 4) * horizontalStep,
      y: baseY + sourceHeight + verticalGap + index * verticalStep,
    }
  }

  function createDetachedGenerationNode(sourceNode: any): any | null {
    if (!sourceNode) return null
    const sourceData = sourceNode.data || {}
    const sourceRequest = buildWorkflowRequestFromNodeData(sourceData)
    if (!sourceRequest) return null
    const sourceParams = sanitizeWorkflowRequestParams(sourceRequest.params)
    const sourcePrompt = String(sourceRequest.params?.prompt || '').trim()
    const nextState = cloneGenerationState(
      buildGenerationStateFromRequest(sourceRequest, sourceData._genState) || {
        modelId: sourceRequest.params?.model || '',
        modelInfo: sourceData.modelInfo || undefined,
        capability: sourceRequest.capability || '',
        mode: sourceRequest.mode || '',
        prompt: sourcePrompt,
        params: { ...sourceParams },
      }
    )
    if (nextState && !nextState.prompt && sourcePrompt) {
      nextState.prompt = sourcePrompt
    }
    if (nextState?.params && sourcePrompt && !nextState.params.prompt) {
      nextState.params = { ...nextState.params, prompt: sourcePrompt }
    }

    const nodeId = createRuntimeId('node')
    const clonedData = JSON.parse(JSON.stringify(sourceData))
    delete clonedData.preview
    delete clonedData.imageUrl
    delete clonedData.videoUrl
    delete clonedData.audioUrl
    delete clonedData.url
    delete clonedData.status
    delete clonedData.statusText
    delete clonedData.failReason
    delete clonedData.fail_reason
    delete clonedData.progress
    delete clonedData.recordId
    delete clonedData.queryId
    delete clonedData.taskId
    delete clonedData._activeTaskId
    delete clonedData.nodeKind
    delete clonedData._generatedFromNodeId
    delete clonedData._resultPlaceholderForNodeId
    delete clonedData._managedGenerationSlot
    delete clonedData._requestIndex
    delete clonedData._generatingForExistingResult
    delete clonedData._sourceGenerationSlotForNodeId
    delete clonedData._generatedIndex
    delete clonedData._generatedResultCount
    delete clonedData._multiResultForNodeId
    delete clonedData._multiResultCount
    delete clonedData._totalExpectedItems
    delete clonedData._hadResultsBefore
    const sourceFileUrls = Array.isArray(sourceParams.file_urls) ? sourceParams.file_urls : []
    if (nextState) {
      delete nextState.taskId
      delete nextState.task_id
    }
    const nextReferenceOrder = Array.isArray(nextState?.referenceOrder) && nextState.referenceOrder.length
      ? [...nextState.referenceOrder]
      : buildReferenceOrderFromNodeAndUrls(sourceNode, sourceFileUrls)
    if (nextReferenceOrder.length) {
      nextState.referenceOrder = [...nextReferenceOrder]
      clonedData.referenceOrder = [...nextReferenceOrder]
    } else {
      delete clonedData.referenceOrder
    }

    const detachedPosition = getDetachedCopyPosition(sourceNode)
    const cap = nextState?.capability || sourceRequest.capability || ''
    const resolvedType = cap === 'video_generation' ? 'video_generation'
      : cap === 'audio_generation' ? 'audio_generation'
      : cap === 'model_generation' ? 'model_generation'
      : cap === 'text_generation' ? 'text_generation'
      : (sourceNode.type !== 'aigc_result' ? sourceNode.type : 'image_generation')
    const newNode: FlowNode = {
      id: nodeId,
      type: resolvedType,
      position: detachedPosition,
      data: {
        ...clonedData,
        _genState: nextState,
        request: sourceRequest,
        ...(nextReferenceOrder.length ? { referenceOrder: [...nextReferenceOrder] } : {}),
        label: buildDetachedCopyLabel(sourceData.label, sourceNode.type),
        preview: '',
        imageUrl: '',
        videoUrl: '',
        audioUrl: '',
        isGenerating: false,
        progress: undefined,
        status: undefined,
        recordId: '',
        _reeditSourceNodeId: sourceNode.id,
        _multiResultForNodeId: undefined,
      },
    }

    const newNodeType = String(newNode.type || '')
    if (fixedSizeTypes[newNodeType]) {
      newNode.style = { ...fixedSizeTypes[newNodeType] }
    } else if (sourceNode.style) {
      newNode.style = { ...sourceNode.style }
    }

    assignToGroupIfOverlapping(newNode, newNode.position.x, newNode.position.y)
    const incomingEdges = edges.value.filter((edge: any) => edge.target === sourceNode.id && isValidFlowEdge(edge))
    const clonedIncomingEdges = incomingEdges
      .map((edge: any, index: number) => ({
        ...edge,
        id: createEdgeId('e'),
        target: nodeId,
      }))
      .filter(isValidFlowEdge)
    nodes.value = [...nodes.value, newNode]
    emit('update:modelNodes', nodes.value)
    if (clonedIncomingEdges.length) {
      edges.value = [...edges.value, ...clonedIncomingEdges]
      emit('update:modelEdges', edges.value)
    }
    nextTick(() => {
      updateNodeInternals([sourceNode.id, nodeId])
      syncNodeEdgeHandles(sourceNode.id)
      syncNodeEdgeHandles(nodeId)
    })
    setTimeout(saveHistory, 50)
    return newNode
  }

  function markRegenerateSubmitCooldown(taskCount: number): void {
    if (typeof taskQueueStore.markSubmitCooldown === 'function') {
      taskQueueStore.markSubmitCooldown(taskCount)
    }
  }

  // ==================== Return ====================

  return {
    // Pure utility functions
    extractUrl,
    extractPreviewUrl,
    extractThumbUrl,
    cloneGenerationState,
    normalizePublisher,
    tryParseJsonPayload,
    unwrapCompletedResultPayload,
    normalizeResultItems,
    getResultItemNodeType,
    getResultRecordId,
    getCompletedResultLabel,
    getNodeDataRecordId,
    getNodeRepairRecordId,
    nodeHasResolvedResult,
    extractGenerateFailReason,
    extractEventRecordId,
    getCachedAllowGenerateCountSchema,
    getRememberedGenerateCount,
    inferRegenerateType,
    inferNodeOutputMediaType,
    nodeHasGenerationContext,
    buildDetachedCopyLabel,
    resolveResultModelDisplayName,
    extractResultLabelPrefix,
    isGenericResultLabelPrefix,
    shouldOverwriteResultLabel,
    resolveLockedResultLabelName,
    getNodeStoredModelDisplayName,
    resolveNodeModelDisplayName,
    buildResultCardLabel,
    ensureResolvedResultTitle,
    isBlankGenerationNodeData,
    getDetachedCopyPosition,
    createDetachedGenerationNode,
    // Functions requiring deps
    updateWorkflowNodeState,
    buildRegenerateContextFromRecord,
    buildResultNodeData,
    applyResolvedAssetToNodeData,
    applyRecordIdToNodeData,
    removeGeneratingPlaceholderNodes,
    nodeHasActiveGenerationTask,
    isRepairableGeneratingNode,
    isRepairableResultThumbnailNode,
    isRepairableMissingResultNode,
    markRegenerateSubmitCooldown,
  }
}

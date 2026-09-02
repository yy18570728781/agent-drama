import { ref, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue'
import { findTeamonesAigcRecord } from '@/api/assets'
import { getReferenceUrls } from '@/components/generation/generationResultAdapters'
import { buildGenerationStateFromRequest, normalizeWorkflowRequest } from '@/utils/workflowNodeData'
import { getWorkflowGenerationRecordId, isWorkflowGenerationResultNode } from '@/utils/workflowGenerationResultNode'
import { getStorage, setStorage } from '@/utils/storage'
import { resolveStoredUpstreamInputs } from '@/utils/workflowUpstreamMedia'
import { buildGeneratorReferenceMedia } from '@/utils/workflowReferenceMedia'
import type { WorkflowGenerationPanelProps, WorkflowGenerationPanelEmits } from './workflowGenerationPanel/types'
import { useWorkflowGenerationPanelEvents } from './useWorkflowGenerationPanelEvents'

export function useWorkflowGenerationPanelSetup(
  props: WorkflowGenerationPanelProps,
  emit: WorkflowGenerationPanelEmits,
  findNode?: (id: string) => any,
) {
const generatorRef = ref<any>(null)
const panelRootRef = ref<HTMLElement | null>(null)
let _suppressRefCount = 0
let _resizeObserver: ResizeObserver | null = null
let _focusRaf = 0
let _lastEmittedStateSignature = ''

function getGeneratorApi(): any { return generatorRef.value || null }

function closeFloatingOverlays() {
  getGeneratorApi()?.closeFloatingOverlays?.()
}

function normalizeWorkflowReferenceUrl(url: string) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    return `${parsed.origin}${parsed.pathname}${parsed.search}`
  } catch {
    return raw
  }
}

function getActiveUpstreamReferenceItems() {
  const upstreamInputs = resolveStoredUpstreamInputs(props.node?.data?._upstreamInputs, findNode)
  const blockedNodeIds = new Set<string>(props.node?.data?._blockedUpstreamNodeIds || [])
  if (!upstreamInputs) return []

  return [
    ...(Array.isArray(upstreamInputs.images) ? upstreamInputs.images : []).map((item: any) => ({
      url: item?.url || '',
      sourceUrl: item?.url || '',
      isVideo: false,
      mediaType: 'image',
      sourceNodeId: item?.nodeId,
    })),
    ...(Array.isArray(upstreamInputs.videos) ? upstreamInputs.videos : []).map((item: any) => ({
      url: item?.url || '',
      sourceUrl: item?.url || '',
      isVideo: true,
      mediaType: 'video',
      sourceNodeId: item?.nodeId,
    })),
    ...(Array.isArray(upstreamInputs.audios) ? upstreamInputs.audios : []).map((item: any) => ({
      url: item?.url || '',
      sourceUrl: item?.url || '',
      isVideo: false,
      mediaType: 'audio',
      sourceNodeId: item?.nodeId,
    })),
  ].filter((item: any) => item.url && item.sourceNodeId && !blockedNodeIds.has(item.sourceNodeId))
}

function filterReferencesToActiveUpstream(references: Array<Record<string, any>> = []): Array<Record<string, any>> {
  const upstreamItems = getActiveUpstreamReferenceItems()
  if (!references.length || !upstreamItems.length) return []

  const upstreamByNodeId = new Map(
    upstreamItems
      .filter((item: any) => item.sourceNodeId)
      .map((item: any) => [item.sourceNodeId, item])
  )
  const upstreamUrlKeys = new Map(
    upstreamItems
      .map((item: any) => [normalizeWorkflowReferenceUrl(item.url), item] as const)
      .filter(([key]) => !!key)
  )

  const result: Array<Record<string, any>> = []
  for (const reference of references) {
    const byNodeId = reference.sourceNodeId ? upstreamByNodeId.get(reference.sourceNodeId) : null
    const byUrl = upstreamUrlKeys.get(normalizeWorkflowReferenceUrl(reference.url || reference.sourceUrl || ''))
    const matched = byNodeId || byUrl
    if (!matched?.sourceNodeId || !matched.url) continue
    const duplicate = result.some((item) => (
      item.sourceNodeId === matched.sourceNodeId && item.url === matched.url
    ))
    if (duplicate) continue
    result.push({
      url: matched.url,
      sourceUrl: matched.url,
      isVideo: Boolean(matched.isVideo),
      mediaType: matched.mediaType || (matched.isVideo ? 'video' : 'image'),
      sourceNodeId: matched.sourceNodeId,
    })
  }
  return result
}

function buildStateSignature(state: NodeGenerationState | null | undefined) {
  if (!state) return ''
  try {
    return JSON.stringify(state)
  } catch {
    return `${Date.now()}`
  }
}

function emitStateChange(nodeId: string | undefined, state: NodeGenerationState | null | undefined) {
  if (!nodeId || !state) return
  const signature = buildStateSignature(state)
  if (signature === _lastEmittedStateSignature) return
  _lastEmittedStateSignature = signature
  emit('generate', {
    type: 'state-change',
    nodeId,
    state,
  })
}

function schedulePanelFocus() {
  if (_focusRaf) cancelAnimationFrame(_focusRaf)
  _focusRaf = requestAnimationFrame(() => {
    _focusRaf = 0
    emit('focus-panel')
  })
}

function toggleTextExpanded() {
  getGeneratorApi()?.toggleTextExpanded?.()
  nextTick(() => {
    schedulePanelFocus()
  })
}

function syncNodeReferenceStateFromGenerator() {
  const nodeData = props.node?.data
  const nodeId = props.node?.id
  if (!nodeData || !nodeId) return
  const syncParams = (params: Record<string, any> | null | undefined) => {
    if (!params || typeof params !== 'object') return params
    return sanitizeWorkflowRememberParams(params)
  }

  if (nodeData.request && typeof nodeData.request === 'object') {
    nodeData.request = {
      ...nodeData.request,
      params: syncParams(nodeData.request.params) || {},
    }
  }

  if (nodeData.params && typeof nodeData.params === 'object') {
    nodeData.params = syncParams(nodeData.params) || {}
  }

  nodeData.referenceUrls = []
  nodeData.referenceItems = []

  const currentGenState = nodeData._genState && typeof nodeData._genState === 'object'
    ? nodeData._genState
    : {}
  nodeData._genState = sanitizeNodeState({
    ...currentGenState,
    params: syncParams(currentGenState.params) || {},
  })

  emitStateChange(nodeId, nodeData._genState)
}

function removeGeneratorReferenceItem(removed: any) {
  const gen = getGeneratorApi()
  const imagesRef = gen?.refImages
  if (!Array.isArray(imagesRef?.value)) return

  const removedSourceNodeId = String(removed?.sourceNodeId || '').trim()
  const removedUrl = normalizeWorkflowReferenceUrl(removed?.sourceUrl || removed?.url || '')
  imagesRef.value = imagesRef.value.filter((item: any) => {
    const sameNode = removedSourceNodeId && item?.sourceNodeId === removedSourceNodeId
    const sameUrl = removedUrl && normalizeWorkflowReferenceUrl(item?.sourceUrl || item?.url || '') === removedUrl
    return !(sameNode || sameUrl)
  })
}

function handleRemoveUpstream(sourceNodeId: string) {
  const targetNodeId = props.node?.id || ''
  syncNodeReferenceStateFromGenerator()
  emit('remove-upstream', { sourceNodeId, targetNodeId })
}

function onBeforeRemoveReference(removed: any) {
  const nodeData = props.node?.data
  if (!nodeData) return

  // 璁板綍鐢ㄦ埛涓诲姩鍒犻櫎鐨?sourceNodeId锛岄槻姝?injectUpstreamMedia 閲嶆柊娉ㄥ叆
  const sourceNodeId = removed?.sourceNodeId
  removeGeneratorReferenceItem(removed)
  if (!sourceNodeId) {
    syncNodeReferenceStateFromGenerator()
    return
  }

  const blocked = nodeData._blockedUpstreamNodeIds
  if (Array.isArray(blocked)) {
    if (!blocked.includes(sourceNodeId)) blocked.push(sourceNodeId)
  } else {
    nodeData._blockedUpstreamNodeIds = [sourceNodeId]
  }

  syncNodeReferenceStateFromGenerator()
  emitStateChange(props.node?.id || '', nodeData._genState)
  const targetNodeId = props.node?.id || ''
  emit('remove-upstream', { sourceNodeId, targetNodeId })
}

type NodeGenerationState = {
  modelId?: string
  modelInfo?: Record<string, any>
  capability?: string
  mode?: string
  params?: Record<string, any>
  prompt?: string
  referenceOrder?: string[]
  fileUrls?: string[]
  referenceItems?: Array<Record<string, any>>
  _restoredAigcRecordId?: string
}

const WORKFLOW_CAP_MODEL_KEY = 'infinite_canvas_workflow_cap_model_remember'

function reconcileBlockedUpstreamNodeIdsWithCurrentInputs() {
  const nodeData = props.node?.data
  if (!nodeData) return []

  const currentInputNodeIds = new Set<string>([
    ...(Array.isArray(nodeData._upstreamInputs?.images) ? nodeData._upstreamInputs.images : []),
    ...(Array.isArray(nodeData._upstreamInputs?.videos) ? nodeData._upstreamInputs.videos : []),
    ...(Array.isArray(nodeData._upstreamInputs?.audios) ? nodeData._upstreamInputs.audios : []),
  ]
    .map((item: any) => item?.nodeId)
    .filter(Boolean))

  const blocked = Array.isArray(nodeData._blockedUpstreamNodeIds)
    ? nodeData._blockedUpstreamNodeIds
    : []

  if (!blocked.length || !currentInputNodeIds.size) {
    return blocked
  }

  const nextBlocked = blocked.filter((nodeId: string) => !currentInputNodeIds.has(nodeId))
  if (nextBlocked.length) {
    nodeData._blockedUpstreamNodeIds = nextBlocked
  } else {
    delete nodeData._blockedUpstreamNodeIds
  }
  return nextBlocked
}

function cloneNodeState(state: NodeGenerationState | null | undefined): NodeGenerationState | null {
  if (!state) return null
  return sanitizeNodeState({
    modelId: state.modelId,
    modelInfo: state.modelInfo ? { ...state.modelInfo } : undefined,
    capability: state.capability,
    mode: state.mode,
    prompt: state.prompt,
    referenceOrder: Array.isArray(state.referenceOrder) ? [...state.referenceOrder] : undefined,
    params: state.params ? { ...state.params } : undefined,
    fileUrls: Array.isArray(state.fileUrls) ? [...state.fileUrls] : undefined,
    referenceItems: Array.isArray(state.referenceItems) ? state.referenceItems.map((item) => ({ ...item })) : undefined,
    _restoredAigcRecordId: state._restoredAigcRecordId,
  })
}

function hasMeaningfulNodeState(state: NodeGenerationState | null | undefined): boolean {
  if (!state) return false
  if (state.modelId || state.mode || state.capability || state.prompt) return true
  if (state.params && Object.keys(state.params).length > 0) return true
  return false
}

function mergeNodeStateWithRememberFallback(
  state: NodeGenerationState | null | undefined,
  rememberedState: NodeGenerationState | null | undefined,
): NodeGenerationState | null {
  if (!state) return rememberedState ? cloneNodeState(rememberedState) : null
  if (!rememberedState) return cloneNodeState(state)

  const nextState = cloneNodeState(state) || {}
  const rememberedParams = sanitizeWorkflowRememberParams(rememberedState.params)
  const requestParams = sanitizeWorkflowRememberParams(nextState.params)
  const stateModelId = String(nextState.modelId || '').trim()
  const rememberedModelId = String(rememberedState.modelId || '').trim()
  const canUseRememberedModelIdentity = !stateModelId
  const canUseRememberedModelDetails = !!stateModelId && !!rememberedModelId && stateModelId === rememberedModelId

  nextState.modelId = nextState.modelId || rememberedState.modelId
  nextState.modelInfo = nextState.modelInfo || (canUseRememberedModelIdentity || canUseRememberedModelDetails ? rememberedState.modelInfo : undefined)
  nextState.capability = nextState.capability || rememberedState.capability
  nextState.mode = nextState.mode || (canUseRememberedModelDetails ? rememberedState.mode : undefined)
  nextState.prompt = nextState.prompt || (canUseRememberedModelDetails ? rememberedState.prompt : '') || ''
  nextState.params = {
    ...(canUseRememberedModelDetails ? rememberedParams : {}),
    ...requestParams,
  }

  return nextState
}

function getNodeState(): NodeGenerationState | null {
  const request = normalizeWorkflowRequest(props.node?.data?.request)
  const requestState = request ? sanitizeNodeState(buildGenerationStateFromRequest(request, props.node?.data?._genState)) : null
  const runtimeState = cloneNodeState(props.node?.data?._genState)
  if (!requestState) return null
  return sanitizeNodeState({
    ...requestState,
    modelInfo: requestState.modelInfo || runtimeState?.modelInfo,
    prompt: runtimeState?.prompt || requestState.prompt || '',
    params: requestState.params,
    _restoredAigcRecordId: runtimeState?._restoredAigcRecordId,
    referenceOrder: Array.isArray(runtimeState?.referenceOrder) ? [...runtimeState.referenceOrder] : requestState.referenceOrder,
  })
}

function buildNodeState(targetNode?: any): NodeGenerationState | null {
  const gen = getGeneratorApi()
  if (!gen?.getCurrentState) return null
  const state = sanitizeNodeState(cloneNodeState(gen.getCurrentState()))
  // disable-reference-remember=true 瀵艰嚧 buildRememberState 涓嶈繑鍥?referenceOrder锛?
  // 闇€瑕佷粠鐩爣鑺傜偣宸叉湁鐘舵€佷腑淇濈暀
  const node = targetNode || props.node
  if (state && !Array.isArray(state.referenceOrder)) {
    const existing = node?.data?._genState?.referenceOrder
    if (Array.isArray(existing) && existing.length) {
      state.referenceOrder = [...existing]
    }
  }
  return state
}

function resetWorkflowGeneratorPanelState(capability?: string | null) {
  const gen = getGeneratorApi()
  if (!gen) return
  gen.resetForRestore?.(capability)
}

function reapplyNodeRequestParams() {
  const gen = getGeneratorApi()
  const request = normalizeWorkflowRequest(props.node?.data?.request)
  if (!gen || !request) return null

  const currentState = buildNodeState() || cloneNodeState(props.node?.data?._genState) || null
  const params = sanitizeWorkflowRememberParams(request.params)
  const upstreamPrompt = String(props.node?.data?._upstreamPrompt || '')
  const prompt = upstreamPrompt || (typeof params.prompt === 'string' ? params.prompt : '')
  if (upstreamPrompt) params.prompt = upstreamPrompt
  gen.applyRequestState?.({
    capability: request.capability,
    mode: request.mode,
    prompt,
    params,
  })

  return {
    capability: request.capability,
    mode: request.mode,
    modelId: params.model || undefined,
    prompt,
    referenceOrder: Array.isArray(currentState?.referenceOrder) ? [...currentState.referenceOrder] : undefined,
    params,
  } as NodeGenerationState
}

function buildNodeStateFromRequestPayload(payload: any): NodeGenerationState | null {
  if (!payload || typeof payload !== 'object') return null
  const currentState = buildNodeState() || getNodeState() || {}
  const params = payload?.params && typeof payload.params === 'object' ? { ...payload.params } : {}
  delete params.allow_generate_count
  if (!params.model && currentState.modelId) {
    params.model = currentState.modelId
  }
  const hasPayloadReferenceOrder = Array.isArray(payload.referenceOrder)
  const referenceOrder = hasPayloadReferenceOrder
    ? payload.referenceOrder.filter((item: any): item is string => typeof item === 'string' && !!item.trim())
    : currentState.referenceOrder
  return sanitizeNodeState({
    ...currentState,
    capability: payload.capability || currentState.capability || undefined,
    mode: payload.mode || currentState.mode || 'standard',
    modelId: params.model || currentState.modelId || undefined,
    prompt: typeof params.prompt === 'string' ? params.prompt : '',
    referenceOrder,
    params,
  })
}

function saveNodeState(targetNode?: any) {
  if (!generatorRef.value) return
  const node = targetNode || props.node
  if (node?.data?._skipPanelStateSaveOnce) {
    delete node.data._skipPanelStateSaveOnce
    return
  }
  const state = buildNodeState(node)
  if (!node?.data || !state) return
  const restoredRecordId = node.data._genState?._restoredAigcRecordId
  const nextState = {
    ...state,
    prompt: typeof state.prompt === 'string' ? state.prompt : (node.data._genState?.prompt || ''),
    ...(restoredRecordId ? { _restoredAigcRecordId: restoredRecordId } : {}),
  }
  node.data._genState = sanitizeNodeState(nextState)
  if (Array.isArray(node.data._genState?.referenceOrder) && node.data._genState.referenceOrder.length) {
    node.data.referenceOrder = [...node.data._genState.referenceOrder]
  } else {
    delete node.data.referenceOrder
  }
  saveWorkflowCapabilityRemember(node.data._genState)
  emitStateChange(node.id || props.node?.id, node.data._genState)
}

function getNodeDefaultCapability() {
  const explicit = props.node?.data?.defaultCapability
  if (explicit) return explicit

  const nodeType = props.node?.type || ''
  const capMap: Record<string, string> = {
    file_input: 'image_generation',
    output_gallery: 'image_generation',
    text_generation: 'chat',
    image_generation: 'image_generation',
    video_generation: 'video_generation',
    model_generation: 'model_generation',
    audio_generation: 'audio_generation',
  }
  if (nodeType === 'file_input' || nodeType === 'aigc_result') {
    const mediaType = props.node?.data?.mediaType
    if (mediaType === 'text') return 'chat'
    if (mediaType === 'video') return 'video_generation'
    if (mediaType === '3d_model') return 'model_generation'
    if (mediaType === 'audio') return 'audio_generation'
    return 'image_generation'
  }
  return capMap[nodeType] || null
}

const nodeStateByIdCache = new Map<string, NodeGenerationState>()

function saveNodeStateById(nodeId: string) {
  if (!generatorRef.value) return
  if (props.node?.id !== nodeId) return
  const state = buildNodeState(props.node)
  if (!state) return
  const restoredRecordId = props.node?.data?._genState?._restoredAigcRecordId
  const sanitizedState = sanitizeNodeState({
    ...state,
    ...(restoredRecordId ? { _restoredAigcRecordId: restoredRecordId } : {}),
  })
  if (sanitizedState) nodeStateByIdCache.set(nodeId, sanitizedState)
}

function sanitizeWorkflowRememberParams(params: Record<string, any> | undefined) {
  if (!params || typeof params !== 'object') return {}
  const nextParams = { ...params }
  delete nextParams.allow_generate_count
  delete nextParams.file_urls
  delete nextParams.reference_urls
  delete nextParams.reference_files
  delete nextParams.files
  delete nextParams.file_url
  delete nextParams.image_urls
  delete nextParams.image_first_frame
  delete nextParams.image_last_frame
  return nextParams
}

function sanitizeNodeState(state: NodeGenerationState | null | undefined): NodeGenerationState | null {
  if (!state) return null
  return {
    ...state,
    params: sanitizeWorkflowRememberParams(state.params),
    fileUrls: undefined,
    referenceItems: undefined,
    referenceOrder: Array.isArray(state.referenceOrder)
      ? state.referenceOrder.filter((item): item is string => typeof item === 'string' && !!item.trim())
      : undefined,
  }
}

function saveWorkflowCapabilityRemember(state: NodeGenerationState | null | undefined) {
  if (!state?.capability) return
  const nextState = cloneNodeState(state)
  if (!nextState) return
  nextState.params = sanitizeWorkflowRememberParams(nextState.params)
  if (!hasMeaningfulNodeState(nextState)) return

  try {
    const store: Record<string, any> = getStorage<Record<string, any>>(WORKFLOW_CAP_MODEL_KEY) || {}
    store[state.capability] = {
      capability: state.capability,
      modelId: nextState.modelId || '',
      mode: nextState.mode || 'standard',
      params: nextState.params || {},
      prompt: nextState.prompt || '',
      ...(nextState.modelInfo ? { modelInfo: { ...nextState.modelInfo } } : {}),
    }
    setStorage(WORKFLOW_CAP_MODEL_KEY, store)
  } catch {}
}

function savePromptToState(promptText: string) {
  if (!props.node?.data) return
  if (!props.node.data._genState) {
    props.node.data._genState = {}
  }
  props.node.data._genState.prompt = promptText
}

function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getNodeAigcRecordId() {
  return getWorkflowGenerationRecordId(props.node)
}

function findCachedModelInfo(modelId: string) {
  if (!modelId) return undefined
  try {
    const cached = getStorage<any>('model_cache_models_generations__')
    if (!cached) return undefined
    const models = cached.d?.models || []
    const found = models.find((m: any) => m.id === modelId || m.name === modelId)
    if (!found) return undefined
    return {
      id: found.id,
      name: found.name,
      display_name: found.display_name || found.name || found.id,
      capabilities: found.capabilities || [],
      modes: found.modes || [],
      publisher: found.publisher,
      vendor: found.vendor,
    }
  } catch {
    return undefined
  }
}

function getWorkflowCapabilityRememberedState(capability: string): NodeGenerationState | null {
  if (!capability) return null
  try {
    const store = getStorage<Record<string, any>>(WORKFLOW_CAP_MODEL_KEY)
    if (!store) return null
    const remembered = store?.[capability]
    if (!remembered) return null
    return {
      modelId: remembered.modelId || '',
      modelInfo: remembered.modelInfo ? { ...remembered.modelInfo } : undefined,
      capability: remembered.capability || capability,
      mode: remembered.mode || 'standard',
      params: sanitizeWorkflowRememberParams(remembered.params),
      prompt: typeof remembered.prompt === 'string' ? remembered.prompt : '',
    } as NodeGenerationState
  } catch {
    return null
  }
}

function buildRecordParams(record: any) {
  const rawParams = isPlainObject(record?.param) ? record.param : {}
  const nestedParams = isPlainObject(rawParams.params) ? rawParams.params : {}
  const params = {
    ...rawParams,
    ...nestedParams,
  }

  delete params.params
  delete params.file_urls
  delete params.reference_urls
  delete params.reference_files
  delete params.files
  delete params.file_url
  delete params.image_urls
  delete params.image_first_frame
  delete params.image_last_frame

  return { rawParams, nestedParams, params }
}

function buildStateFromAigcRecord(record: any, recordId: string): NodeGenerationState | null {
  if (!record) return null

  const { rawParams, nestedParams, params } = buildRecordParams(record)
  const modelId = record.model
    || record.model_info?.id
    || rawParams.model
    || nestedParams.model
    || rawParams.model_id
    || nestedParams.model_id
    || ''
  const capability = record.capability || rawParams.capability || nestedParams.capability || ''
  const mode = rawParams.mode || nestedParams.mode || 'standard'
  const prompt = record.prompt || rawParams.prompt || nestedParams.prompt || ''

  let modelInfo: Record<string, any> | undefined
  if (modelId) {
    try {
      const cached = getStorage<any>('model_cache_models_generations__')
      if (cached) {
        const models = cached.d?.models || []
        const found = models.find((m: any) => m.id === modelId || m.name === modelId)
        if (found) {
          modelInfo = {
            id: found.id,
            name: found.display_name || found.name || found.id,
            display_name: found.display_name,
            vendor: found.vendor || null,
            publisher: found.publisher,
            capabilities: found.capabilities || [],
            vendors: found.vendors || [],
            params: found.params,
          }
        }
      }
    } catch {}
  }

  return sanitizeNodeState({
    modelId: modelId ? String(modelId) : undefined,
    modelInfo,
    capability: capability ? String(capability) : undefined,
    mode: mode ? String(mode) : undefined,
    prompt: prompt ? String(prompt) : '',
    params,
    _restoredAigcRecordId: recordId,
  })
}

async function restoreStateFromAigcRecord(state: NodeGenerationState | null, runId: number, expectedNodeId: string) {
  const recordId = getNodeAigcRecordId()
  const gen = getGeneratorApi()
  if (!recordId || state?._restoredAigcRecordId === recordId || !gen || !isPanelRunActive(runId, expectedNodeId)) return false

  try {
    const record = await findTeamonesAigcRecord(recordId)
    if (!isPanelRunActive(runId, expectedNodeId)) return false
    const recordState = buildStateFromAigcRecord(record, recordId)
    if (!recordState) return false

    if (props.node?.data) {
      props.node.data._genState = recordState
      props.node.data.referenceUrls = getReferenceUrls(record)
    }
    await gen.restoreState?.(recordState)
    return true
  } catch (e) {
    console.warn('[WorkflowGenerationPanel] restore aigc record params failed:', e)
    return false
  }
}

async function restoreNodeState(runId: number) {
  if (!props.node?.id || !getGeneratorApi()) return
  const expectedNodeId = props.node.id
  const defaultCap = getNodeDefaultCapability()
  const requestState = getNodeState()
  const hasRequestState = !!normalizeWorkflowRequest(props.node?.data?.request) && hasMeaningfulNodeState(requestState)
  const capabilityRememberedState = defaultCap ? getWorkflowCapabilityRememberedState(defaultCap) : null
  const rawState = requestState || nodeStateByIdCache.get(props.node.id)
  const state = rawState
    ? {
        ...rawState,
        capability: rawState.capability || defaultCap || undefined,
      }
    : null
  const nodeHasOwnState = hasMeaningfulNodeState(state)
  const requestPreferredState = mergeNodeStateWithRememberFallback(state, capabilityRememberedState)
  const gen = getGeneratorApi()
  resetWorkflowGeneratorPanelState(defaultCap)

  if (await restoreStateFromAigcRecord(requestPreferredState, runId, expectedNodeId)) {
    if (!isPanelRunActive(runId, expectedNodeId)) return
    nodeStateByIdCache.delete(props.node.id)
    return
  }

  if (hasRequestState && requestPreferredState) {
    await gen.restoreState(requestPreferredState as any)
    if (!isPanelRunActive(runId, expectedNodeId)) return
    const finalRequestState = reapplyNodeRequestParams()
    if (finalRequestState && props.node?.data) {
      const restoredRecordId = props.node.data._genState?._restoredAigcRecordId
      props.node.data._genState = {
        ...finalRequestState,
        ...(restoredRecordId ? { _restoredAigcRecordId: restoredRecordId } : {}),
      }
    }
    nodeStateByIdCache.delete(props.node.id)
    return
  }

  if (!nodeHasOwnState) {
    const hasRememberedParams = !!capabilityRememberedState?.params && Object.keys(capabilityRememberedState.params).length > 0

    if (capabilityRememberedState?.modelId || capabilityRememberedState?.prompt || hasRememberedParams) {
      await gen.restoreState(capabilityRememberedState as any)
      if (!isPanelRunActive(runId, expectedNodeId)) return
      nodeStateByIdCache.delete(props.node.id)
      return
    }

    if (defaultCap && gen.selectedCapability !== defaultCap) {
      try {
        await gen.setCapability(defaultCap)
      } catch {
        gen.selectedCapability = defaultCap
      }
    }
    return
  }

  if (state?.modelInfo) {
    try {
      await gen.onModelSelect({
        model: state.modelInfo,
        capability: state.capability,
        mode: state.mode || 'standard',
      })
      if (!isPanelRunActive(runId, expectedNodeId)) return
    } catch {
      if (state.capability) gen.selectedCapability = state.capability
      if (state.modelId) gen.selectedModelId = state.modelId
    }
  } else {
    const cachedModelInfo = state?.modelId ? findCachedModelInfo(state.modelId) : undefined
    if (cachedModelInfo) {
      try {
        await gen.onModelSelect({
          model: cachedModelInfo,
          capability: state?.capability,
          mode: state?.mode || 'standard',
        })
        if (!isPanelRunActive(runId, expectedNodeId)) return
      } catch {
        if (state?.capability) gen.selectedCapability = state.capability
        if (state?.modelId) gen.selectedModelId = state.modelId
        if (state?.mode) gen.selectedMode = state.mode
      }
    } else {
      if (state?.capability) gen.selectedCapability = state.capability
      if (state?.modelId) gen.selectedModelId = state.modelId
      if (state?.mode) gen.selectedMode = state.mode
    }
  }

  if (!isPanelRunActive(runId, expectedNodeId)) return
  if (state?.params) {
    gen.onParamChange(state.params)
  }

  if (state?.prompt) {
    gen.setPrompt(state.prompt)
  }

  nodeStateByIdCache.delete(props.node.id)
}

async function injectUpstreamMedia() {
  const gen = getGeneratorApi()
  if (!gen) return

  const recordReferenceUrls = isWorkflowGenerationResultNode(props.node)
    ? getReferenceUrls(props.node?.data)
    : []
  if (recordReferenceUrls.length) {
    await gen.setReferenceMedia?.(recordReferenceUrls.map((url) => ({ url })))
    return
  }

  const resolvedInputs = resolveStoredUpstreamInputs(props.node?.data?._upstreamInputs, findNode)
  const blockedNodeIds = new Set<string>(reconcileBlockedUpstreamNodeIdsWithCurrentInputs())
  const savedReferenceOrder = Array.isArray(props.node?.data?._genState?.referenceOrder)
    ? props.node.data._genState.referenceOrder
    : (Array.isArray(props.node?.data?.referenceOrder) ? props.node.data.referenceOrder : [])
  const references = buildGeneratorReferenceMedia({
    upstreamInputs: resolvedInputs,
    currentNodeId: props.node?.id,
    blockedNodeIds,
    referenceOrder: savedReferenceOrder,
  })
  await gen.setReferenceMedia?.(references)
}

function getCurrentGeneratorReferenceItems() {
  const payload = getGeneratorApi()?.buildCurrentRequestPayload?.()
  return Array.isArray(payload?.referenceItems) ? payload.referenceItems : []
}

async function ensureInjectedUpstreamMediaVisible() {
  const upstreamItems = getActiveUpstreamReferenceItems()
  await injectUpstreamMedia()
  if (!upstreamItems.length) return
  await nextTick()
  const currentReferenceItems = getCurrentGeneratorReferenceItems()
  const activeUpstreamReferences = filterReferencesToActiveUpstream(currentReferenceItems)
  if (activeUpstreamReferences.length || !props.node?.id) return
  await new Promise((resolve) => setTimeout(resolve, 0))
  if (!props.node?.id) return
  await injectUpstreamMedia()
}

let autoSaveTimer: ReturnType<typeof setInterval> | null = null
let _initRunId = 0
let _isInitializingPanel = false

function isPanelRunActive(runId: number, nodeId: string): boolean {
  return runId === _initRunId && props.node?.id === nodeId && !!getGeneratorApi()
}

function startAutoSave() {
  stopAutoSave()
  autoSaveTimer = setInterval(() => {
    if (!props.node?.id || !getGeneratorApi()) return
    const currentState = buildNodeState()
    if (!currentState) return
    const state = {
      ...currentState,
      prompt: currentState.prompt || props.node.data?._genState?.prompt || '',
    }
    if (props.node.data) {
      props.node.data._genState = state
    }
    saveWorkflowCapabilityRemember(state)
  }, 500)
}
function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}

async function initializePanelForNode() {
  if (!props.node?.id) return
  const runId = ++_initRunId
  _isInitializingPanel = true
  _suppressRefCount++
  try {
    await restoreNodeState(runId)
    if (runId !== _initRunId) return
    await ensureInjectedUpstreamMediaVisible()
    if (runId !== _initRunId) return
    await nextTick()
    if (runId !== _initRunId) return
    const currentReferenceItems = getCurrentGeneratorReferenceItems()
    const activeUpstreamReferences = filterReferencesToActiveUpstream(currentReferenceItems)
    _lastRefCount = activeUpstreamReferences.length
    saveNodeState()
    startAutoSave()
    schedulePanelFocus()
  } finally {
    _isInitializingPanel = false
    if (runId === _initRunId) {
      _suppressRefCount--
    }
  }
}

watch(
  () => props.node?.id,
  (newId, oldId) => {
    if (oldId) {
      saveNodeStateById(oldId)
    }
    if (newId) {
      _lastEmittedStateSignature = ''
      nextTick(async () => {
        await initializePanelForNode()
      })
    }
  },
  { immediate: false }
)

watch(
  () => props.node?.data?._upstreamInputs,
  () => {
    _suppressRefCount++
    _isInitializingPanel = true
    nextTick(async () => {
      try {
        await ensureInjectedUpstreamMediaVisible()
        await nextTick()
      } finally {
        _isInitializingPanel = false
        _suppressRefCount--
      }
    })
  },
  { deep: true }
)

let _lastRefCount = 0

onMounted(() => {
  nextTick(async () => {
    await initializePanelForNode()
  })
  if (panelRootRef.value && typeof ResizeObserver !== 'undefined') {
    _resizeObserver = new ResizeObserver(() => {
      schedulePanelFocus()
    })
    _resizeObserver.observe(panelRootRef.value)
  }
})

onBeforeUnmount(() => {
  saveNodeState()
  stopAutoSave()
  _resizeObserver?.disconnect()
  _resizeObserver = null
  if (_focusRaf) {
    cancelAnimationFrame(_focusRaf)
    _focusRaf = 0
  }
})

onUnmounted(() => {
})

const exposed = {
  restoreNodeState,
  saveNodeState,
  savePromptToState,
  closeFloatingOverlays,
  generatorRef,
  injectUpstreamMedia,
}

// ==================== 鐢熸垚闃熷垪闆嗘垚 ====================

let _capturedNodeId: string | null = null
let _completedViaMainPath = false
const eventState = {
  get isInitializingPanel() { return _isInitializingPanel },
  set isInitializingPanel(value: boolean) { _isInitializingPanel = value },
  get lastRefCount() { return _lastRefCount },
  set lastRefCount(value: number) { _lastRefCount = value },
  get capturedNodeId() { return _capturedNodeId },
  set capturedNodeId(value: string | null) { _capturedNodeId = value },
  get completedViaMainPath() { return _completedViaMainPath },
  set completedViaMainPath(value: boolean) { _completedViaMainPath = value },
}

function extractCompletedItems(result: any): any[] {
  const data = result?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(result?.items)) return result.items
  if (data?.media_info) {
    const media = data.media_info
    return [{
      asset_id: media.id,
      id: media.id,
      task_id: result?.task_id || data?.task_id || '',
      origin_url: media.origin_url,
      thumb: media.thumb,
      thumbnail_url: media.thumbnail_url || media.thumb,
      url: media.origin_url || media.param?.base_url || media.url || media.thumb,
      type: media.type,
      aigc_record_info: data.aigc_record_info,
    }]
  }
  if (data?.url || data?.thumb || data?.thumbnail_url) return [data]
  return []
}

function extractCompletedAigcRecordIds(result: any, items: any[] = []): string[] {
  const out: string[] = []
  const append = (value: any) => {
    if (value === undefined || value === null || value === '') return
    const id = String(value)
    if (!out.includes(id)) out.push(id)
  }

  append(result?.data?.aigc_record_info?.id)
  append(result?.aigc_record_info?.id)
  append(result?.data?.aigc_record_id)
  append(result?.aigc_record_id)
  append(result?.data?.record_id)
  append(result?.record_id)
  append(result?.data?.query_id)
  append(result?.query_id)

  items.forEach(item => {
    append(item?.aigc_record_info?.id)
    append(item?.aigc_record_id)
    append(item?.record_id)
    append(item?.query_id)
  })

  return out
}

const {
  onGenerateStart,
  onQueueTaskAssigned,
  onGenerateCreated,
  onGenerateProgress,
  onGenerateComplete,
  onGenerateError,
  onCapabilityChange,
  onRequestPayloadChange,
  onClipboardReferencePasted,
  onFilesDropped,
} = useWorkflowGenerationPanelEvents({
  props,
  emit,
  state: eventState,
  saveNodeState,
  extractCompletedItems,
  extractCompletedAigcRecordIds,
  filterReferencesToActiveUpstream,
  buildNodeStateFromRequestPayload,
  saveWorkflowCapabilityRemember,
  emitStateChange,
})

return {
  generatorRef,
  panelRootRef,
  closeFloatingOverlays,
  toggleTextExpanded,
  handleRemoveUpstream,
  onBeforeRemoveReference,
  onGenerateStart,
  onQueueTaskAssigned,
  onGenerateCreated,
  onGenerateProgress,
  onGenerateComplete,
  onGenerateError,
  onCapabilityChange,
  onRequestPayloadChange,
  onClipboardReferencePasted,
  onFilesDropped,
  exposed,
}
}

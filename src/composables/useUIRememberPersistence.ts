import type { ReferenceMediaType } from '@/composables/generation/useReferenceManager'
import { getStorage, setStorageDeferred } from '@/utils/storage'
import type {
  RememberDebugLog,
  UIRememberPersistenceTools,
  UIRememberReferenceTools,
  UIRequestPayload,
  UseUIRememberOptions,
} from './uiRemember.types'

interface PersistenceContext {
  options: UseUIRememberOptions
  references: UIRememberReferenceTools
  logDebug: RememberDebugLog
}

function buildModelInfo(model: any): Record<string, any> | null {
  if (!model) return null
  return {
    id: model.id || model.name,
    name: model.display_name || model.name || model.id,
    display_name: model.display_name,
    publisher: model.publisher,
    vendors: model.vendors,
    capabilities: model.capabilities,
  }
}

function appendReferenceState(context: PersistenceContext, target: Record<string, any>): void {
  const { options, references } = context
  if (!references.shouldRememberReferences()) return
  const fileUrls = references.getCurrentReferenceUrls()
  const referenceOrder = options.getReferenceOrder(options.refImages.value)
  const referenceItems = options.refImages.value.map((item) => ({
    url: item.url,
    sourceUrl: item.sourceUrl || item.url,
    isVideo: !!item.isVideo,
    mediaType: item.mediaType || (item.isVideo ? 'video' : 'image'),
    sourceNodeId: item.sourceNodeId,
    uploaded: !!item.uploaded,
  }))
  if (fileUrls.length) target.fileUrls = fileUrls
  if (referenceItems.length) target.referenceItems = referenceItems
  if (referenceOrder.length) target.referenceOrder = referenceOrder
}

function buildRememberState(context: PersistenceContext): Record<string, any> {
  const { options } = context
  options.syncPromptFromDom(true)
  const state: Record<string, any> = {
    modelId: options.selectedModelId.value,
    capability: options.selectedCapability.value,
    mode: options.selectedMode.value,
    params: options.sanitizeRememberedParams(options.paramValues.value),
    prompt: options.prompt.value,
  }
  appendReferenceState(context, state)
  const modelInfo = buildModelInfo(options.selectedModelInfo.value)
  if (modelInfo) state.modelInfo = modelInfo
  return state
}

function saveCapModelRemember(
  context: PersistenceContext,
  rememberedState?: Record<string, any>,
): void {
  const { options, logDebug } = context
  const capability = options.selectedCapability.value
  const modelId = options.selectedModelId.value
  if (!capability || !modelId) return
  const capabilities = options.selectedModelInfo.value?.capabilities
  if (capabilities?.length && !options.capListIncludes(capabilities, capability)) return
  try {
    const store = getStorage<Record<string, any>>(options.capModelRememberKey) || {}
    const remembered = rememberedState || buildRememberState(context)
    const previous = store[capability] && typeof store[capability] === 'object' ? store[capability] : {}
    const models = previous.models && typeof previous.models === 'object' ? { ...previous.models } : {}
    models[modelId] = remembered
    store[capability] = { ...remembered, models }
    setStorageDeferred(options.capModelRememberKey, store)
    logDebug('saveCapModelRemember', {
      key: options.capModelRememberKey,
      capability,
      remembered: store[capability],
    })
  } catch {
    // 浏览器存储不可用时保留当前内存状态。
  }
}

function buildRequestPayload(options: UseUIRememberOptions): UIRequestPayload {
  options.syncPromptFromDom(true)
  const itemMap = new Map<string, {
    url: string
    isVideo: boolean
    mediaType?: ReferenceMediaType
    sourceNodeId?: string
  }>()
  options.refImages.value.forEach((image) => {
    const url = String(image.sourceUrl || image.url || '').trim()
    if (!url || itemMap.has(url)) return
    itemMap.set(url, {
      url: image.sourceUrl || image.url,
      isVideo: !!image.isVideo,
      mediaType: image.mediaType || (image.isVideo ? 'video' : 'image'),
      sourceNodeId: image.sourceNodeId,
    })
  })
  const referenceItems = Array.from(itemMap.values())
  const requestParams = { ...options.paramValues.value }
  delete requestParams.allow_generate_count
  return {
    capability: options.selectedCapability.value,
    mode: options.selectedMode.value || 'standard',
    params: {
      model: options.selectedModelId.value,
      prompt: (options.prompt.value || '').trim(),
      ...requestParams,
      ...(referenceItems.length ? { file_urls: referenceItems.map((item) => item.url) } : {}),
    },
    referenceItems,
    referenceOrder: options.getReferenceOrder(options.refImages.value),
  }
}

function applyRequestState(
  context: PersistenceContext,
  data: Record<string, any> | null | undefined,
): null {
  if (!data) return null
  const { options, references } = context
  const params = options.sanitizeRememberedParams(data.params)
  const rememberReferences = references.shouldRememberReferences()
  const urls = rememberReferences ? references.collectRememberedReferenceUrls(data) : []
  const items = rememberReferences ? references.collectRememberedReferenceItems(data) : []
  const order = rememberReferences ? references.collectRememberedReferenceOrder(data) : []
  if (data.capability) options.selectedCapability.value = data.capability
  if (data.mode) options.selectedMode.value = data.mode
  if (params.model) options.selectedModelId.value = params.model
  options.applyRestoredParamValues(params)
  if (typeof params.prompt === 'string') options.setPrompt(params.prompt)
  else if (typeof data.prompt === 'string') options.setPrompt(data.prompt)
  const restoredItems = items.length
    ? options.dedupeReferenceImages(items).images
    : urls.map(options.buildRememberedReferenceImage)
  options.refImages.value = references.sortReferenceImagesByOrder(restoredItems, order)
  return null
}

/**
 * 管理生成 UI 状态的延迟持久化、请求载荷构建和外部状态应用。
 * @param options 生成 UI 状态与业务回调。
 * @param references 引用资源工具。
 * @param logDebug 可选调试记录器。
 * @returns UI 状态持久化与请求载荷方法。
 */
export function useUIRememberPersistence(
  options: UseUIRememberOptions,
  references: UIRememberReferenceTools,
  logDebug: RememberDebugLog,
): UIRememberPersistenceTools {
  const context = { options, references, logDebug }
  const saveCapabilityState = (): void => saveCapModelRemember(context)
  const buildState = (): Record<string, any> => buildRememberState(context)
  const saveUIRemember = (): void => {
    if (options.skipUIRemember.value) {
      saveCapabilityState()
      return
    }
    const state = buildState()
    setStorageDeferred(options.uiRememberKey, state)
    logDebug('saveUIRemember', { key: options.uiRememberKey, remembered: state })
    saveCapModelRemember(context, state)
  }
  return {
    saveCapModelRemember: saveCapabilityState,
    getCapModelRemember: (capability) => {
      try {
        return (getStorage<Record<string, any>>(options.capModelRememberKey) || {})[capability] || null
      } catch {
        return null
      }
    },
    buildRememberState: buildState,
    saveUIRemember,
    buildCurrentRequestPayloadCustom: () => buildRequestPayload(options),
    applyRequestState: (data) => applyRequestState(context, data),
  }
}

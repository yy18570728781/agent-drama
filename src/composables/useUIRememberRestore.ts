import { nextTick } from 'vue'
import { getStorage } from '@/utils/storage'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'
import type {
  RememberDebugLog,
  UIRememberPersistenceTools,
  UIRememberReferenceTools,
  UIRememberRestoreTools,
  UseUIRememberOptions,
} from './uiRemember.types'

interface RememberedReferences {
  items: ReferenceImage[]
  order: string[]
  urls: string[]
}

interface RestoreContext {
  options: UseUIRememberOptions
  references: UIRememberReferenceTools
  persistence: UIRememberPersistenceTools
  logDebug: RememberDebugLog
  applyVersion: number
  loaded: boolean
}

function collectReferences(context: RestoreContext, data: Record<string, any>): RememberedReferences {
  if (!context.references.shouldRememberReferences()) return { items: [], order: [], urls: [] }
  return {
    items: context.references.collectRememberedReferenceItems(data),
    order: context.references.collectRememberedReferenceOrder(data),
    urls: context.references.collectRememberedReferenceUrls(data),
  }
}

function applyReferences(context: RestoreContext, remembered: RememberedReferences): void {
  const { options, references } = context
  const restored = remembered.items.length
    ? options.dedupeReferenceImages(remembered.items).images
    : remembered.urls.map(options.buildRememberedReferenceImage)
  options.refImages.value = references.sortReferenceImagesByOrder(restored, remembered.order)
}

function applyInlineModelInfo(context: RestoreContext, data: Record<string, any>): boolean {
  if (!data.modelInfo) return false
  const { options } = context
  options.selectedModelInfo.value = {
    ...data.modelInfo,
    name: data.modelInfo.display_name || data.modelInfo.name || data.modelInfo.id,
  }
  if (data.modelId) options.sharedModelDetailCache.set(data.modelId, options.selectedModelInfo.value)
  return true
}

async function resolveModelInfo(
  context: RestoreContext,
  data: Record<string, any>,
  version: number,
): Promise<boolean> {
  const { options } = context
  if (applyInlineModelInfo(context, data) || !data.modelId) return true
  try {
    const modelInfo = await options.getCachedModelDetail(data.modelId)
    if (version !== context.applyVersion) return false
    options.selectedModelInfo.value = modelInfo
  } catch (error) {
    if (version !== context.applyVersion) return false
    console.warn('[GeneratorInput] 加载模型详情失败', error)
    options.selectedModelInfo.value = {
      id: data.modelId,
      name: data.modelId,
      display_name: data.modelId,
      vendor: null,
      publisher: null,
      capabilities: data.capability ? [data.capability] : [],
      vendors: [],
      params: null,
    }
  }
  return version === context.applyVersion
}

async function restoreModeAndParams(
  context: RestoreContext,
  data: Record<string, any>,
  rememberedMode: string,
  rememberedParams: Record<string, any>,
  remembered: RememberedReferences,
  version: number,
): Promise<boolean> {
  const { options } = context
  const capabilities = options.selectedModelInfo.value?.capabilities
  if (capabilities?.length && !options.capListIncludes(capabilities, options.selectedCapability.value)) {
    options.selectedCapability.value = options.getCapId(capabilities[0])
  }
  options.availableModes.value = await options.fetchModelModes(data.modelId, options.selectedCapability.value)
  if (version !== context.applyVersion) return false
  options.selectedMode.value = options.resolveModeId(options.availableModes.value, rememberedMode)
  options.selectedMode.value = await options.ensureModeParamsLoaded(
    data.modelId,
    options.selectedCapability.value,
    options.selectedMode.value,
    rememberedParams,
  )
  if (version !== context.applyVersion) return false
  options.applyRestoredParamValues(rememberedParams)
  if ((!remembered.urls.length && !options.shouldPreferFileUploadMode()) || options.hasFileParam.value) return true
  const switched = await options.ensureFileUploadMode({ silent: true })
  if (version !== context.applyVersion || !switched) return version === context.applyVersion
  await options.ensureModeParamsLoaded(
    data.modelId,
    options.selectedCapability.value,
    options.selectedMode.value,
    rememberedParams,
  )
  if (version !== context.applyVersion) return false
  options.applyRestoredParamValues(rememberedParams)
  return true
}

async function applyRememberedState(
  context: RestoreContext,
  data: Record<string, any> | null | undefined,
  applyOptions: { restorePrompt?: boolean } = {},
): Promise<void> {
  if (!data) return
  const { options, persistence, logDebug } = context
  const version = ++context.applyVersion
  const params = options.sanitizeRememberedParams(data.params)
  const rememberedMode = data.mode || data.params?.mode
  const remembered = collectReferences(context, data)
  logDebug('applyRememberedState:start', { remembered: data })
  if (data.modelId) options.selectedModelId.value = data.modelId
  if (data.capability) options.selectedCapability.value = data.capability
  if (rememberedMode) options.selectedMode.value = rememberedMode
  if (!await resolveModelInfo(context, data, version)) return
  if (applyOptions.restorePrompt && typeof data.prompt === 'string') options.setPrompt(data.prompt)
  if (!data.modelId) {
    options.paramValues.value = { ...params }
  } else if (!await restoreModeAndParams(context, data, rememberedMode, params, remembered, version)) {
    return
  }
  applyReferences(context, remembered)
  nextTick(options.renderPromptEditorFromState)
  logDebug('applyRememberedState:done', {
    request: persistence.buildCurrentRequestPayloadCustom(),
    state: persistence.buildRememberState(),
  })
}

async function loadUIRemember(context: RestoreContext): Promise<void> {
  const { options, persistence, logDebug } = context
  try {
    const raw = getStorage<Record<string, any> | string>(options.uiRememberKey)
    logDebug('loadUIRemember:raw', { key: options.uiRememberKey, raw })
    if (!raw) return
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    logDebug('loadUIRemember:parsed', { key: options.uiRememberKey, remembered: data })
    await applyRememberedState(context, data, { restorePrompt: true })
    logDebug('loadUIRemember:applied', {
      key: options.uiRememberKey,
      request: persistence.buildCurrentRequestPayloadCustom(),
      state: persistence.buildRememberState(),
    })
    persistence.saveCapModelRemember()
  } catch {
    // 读取 UI 记忆失败时保持默认状态。
  } finally {
    context.loaded = true
  }
}

/**
 * 恢复 UI 记忆中的模型、模式、参数和引用资源，并处理异步应用竞态。
 * @param options UI 状态与模型查询依赖。
 * @param references 引用资源工具。
 * @param persistence 状态构建与保存工具。
 * @param logDebug 可选调试记录器。
 * @returns UI 记忆加载和应用方法。
 */
export function useUIRememberRestore(
  options: UseUIRememberOptions,
  references: UIRememberReferenceTools,
  persistence: UIRememberPersistenceTools,
  logDebug: RememberDebugLog,
): UIRememberRestoreTools {
  const context: RestoreContext = {
    options,
    references,
    persistence,
    logDebug,
    applyVersion: 0,
    loaded: options.skipUIRemember.value,
  }
  return {
    applyRememberedState: (data, applyOptions) => applyRememberedState(context, data, applyOptions),
    loadUIRemember: () => loadUIRemember(context),
    isLoaded: () => context.loaded,
  }
}

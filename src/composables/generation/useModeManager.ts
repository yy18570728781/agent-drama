import { ref, computed, type Ref } from 'vue'
import type { BackendModelInfo, ModelParamSchema } from '@/api/models'
import { clearModelCache } from '@/api/models'
import { useGenerationStore } from '@/stores/generation.store'
import { getModeId, getModeLabel, normalizeModeKey } from '@/utils/modeLabels'
import { getStorage, setStorage } from '@/utils/storage'
import { isVirtualModel, getVirtualModelParams } from '@/services/generation/topaz.constants'
import {
  getCachedModelDetail,
  getCachedModelModes,
  getCachedModeParams,
  sharedModelDetailCache,
  capListIncludes,
  getCapId,
} from '@/composables/generation/useGenerationRunner'

type BatchItem = { id: string; image: string | null; prompt: string; params: Record<string, any> }

// ── Capability name map ────────────────────────────────────
const capabilityNames: Record<string, string> = {
  'image_generation': '图片生成',
  'video_generation': '视频生成',
  'model_generation': '模型生成',
  'audio_generation': '音频生成',
  'chat': '对话',
}

const MODEL_ALLOW_GENERATE_COUNT_KEY = 'infinite_canvas_model_allow_generate_count_remember'

export interface UseModeManagerOptions {
  emit: {
    (e: 'model-change', payload: any): void
    (e: 'capability-change', capId: string): void
    (e: 'batch-mode-change', isBatch: boolean): void
  }
  props: {
    disableQueue?: boolean
    flowNodeId?: string
  }
  /** Save UI remember state (from useUIRemember) */
  saveUIRemember?: () => void
  /** Get remembered cap→model mapping */
  getCapModelRemember?: (capId: string) => Record<string, any> | null
  /** Fetch models by capability */
  getAllModels?: typeof import('@/api/models').getAllModels
  /** Optional mode popover ref for auto-hide after selection */
  modePopoverRef?: Ref<any>
  /** Optional capability popover ref for auto-hide after selection */
  capabilityPopoverRef?: Ref<any>
}

export function useModeManager(options: UseModeManagerOptions) {
  const { emit, props } = options
  const generationStore = useGenerationStore()
  const _saveUIRemember = options.saveUIRemember
  const _getCapModelRemember = options.getCapModelRemember
  const _getAllModels = options.getAllModels
  const _modePopoverRef = options.modePopoverRef
  const _capabilityPopoverRef = options.capabilityPopoverRef

  // ── Core selection state ──────────────────────────────────
  const selectedModelId = ref<string>('')
  const selectedModelInfo = ref<BackendModelInfo | null>(null)
  const selectedCapability = ref<string>('image_generation')

  // ── Smart / agent mode ────────────────────────────────────
  const isSmartMode = ref(false)
  const selectedSkillId = ref<string | null>(null)
  const showSkillDropdown = ref(false)

  // ── Batch mode ────────────────────────────────────────────
  const isBatchMode = ref(false)
  const batchItems = ref<BatchItem[]>([{ id: '1', image: null, prompt: '', params: {} }])
  const multilineBatchMode = ref(false)

  // ── Param state ───────────────────────────────────────────
  const modelParams = ref<ModelParamSchema[]>([])
  const promptParamSchema = ref<ModelParamSchema | null>(null)
  const allowGenerateCountSchema = ref<ModelParamSchema | null>(null)
  const paramValues = ref<Record<string, any>>({})
  const isRestoringModelSelection = ref(false)

  // ── Mode state ────────────────────────────────────────────
  const selectedMode = ref<string>('standard')
  const availableModes = ref<any[]>([])
  let modelSelectionVersion = 0
  let modeParamsLoadVersion = 0

  // ── Computed ─────────────────────────────────────────────
  const multilinePrompts = computed(() => {
    if (!multilineBatchMode.value) return []
    // This needs prompt from the caller, but since it's a simple split,
    // we compute based on an external ref that will be set up in the .vue file
    return []
  })

  const hasSendableContent = computed(() => {
    // Will be computed in .vue with access to prompt
    return true
  })

  const canClickGenerateButton = computed(() => hasSendableContent.value)

  const modelCapabilities = computed(() => {
    const caps = selectedModelInfo.value?.capabilities || []
    return caps.map((cap: any) => {
      if (typeof cap === 'string') return { id: cap, name: capabilityNames[cap] || cap }
      return { id: cap.name || cap.id || '', name: cap.label || cap.name || capabilityNames[cap.name || cap.id] || cap.name || cap.id }
    })
  })

  const currentCapabilityName = computed(() => {
    const cap = modelCapabilities.value.find((c: { id: string; name: string }) => c.id === selectedCapability.value)
    return cap?.name || '请选择'
  })

  const currentModeName = computed(() => {
    const mode = availableModes.value.find((item: any) => getModeId(item) === selectedMode.value)
    return getModeLabel(mode || selectedMode.value)
  })

  const showModeDropdown = computed(() => availableModes.value.length > 1)

  const hasFileParam = computed(() => modelParams.value.some(p =>
    p.name === 'file_urls' && (p.type === 'file' || p.type === 'file_list' || p.type === 'files' || p.type === 'images')
  ))

  const fileParamMaxItems = computed(() => {
    const fileParam = modelParams.value.find(p => p.name === 'file_urls')
    if (!fileParam) return 0
    if (fileParam.type === 'file') return 1
    return fileParam.max_items || 0
  })

  const refMaxItemsWarning = computed(() => {
    const max = fileParamMaxItems.value
    if (!max) return ''
    const modelName = selectedModelInfo.value?.display_name || ''
    return `模型${modelName ? ' ' + modelName : ''}在${currentModeName.value ? ' ' + currentModeName.value : ''}模式下只支持${max}个参考`
  })

  const fileParamDef = computed<ModelParamSchema | null>(() => {
    const fp = modelParams.value.find(p => p.name === 'file_urls') || null
    if (!fp) return null
    if (getStorage<string>('mock_multi_view') === 'true' && (!fp.sub_params || fp.sub_params.length <= 1)) {
      return {
        ...fp,
        type: 'file_list',
        max_items: 6,
        min_items: 2,
        sub_params: [
          { name: 'front', label: '前视图', required: true },
          { name: 'back', label: '后视图', required: true },
          { name: 'left', label: '左视图' },
          { name: 'right', label: '右视图' },
          { name: 'top', label: '顶视图' },
          { name: 'bottom', label: '底视图' },
        ]
      }
    }
    return fp
  })

  const hasPromptParam = computed(() => promptParamSchema.value?.hidden !== true && !!promptParamSchema.value)

  const showAllowGenerateCount = computed(() => !!allowGenerateCountSchema.value)
  const allowGenerateCountLabel = computed(() => allowGenerateCountSchema.value?.label ?? '生成数量')
  const allowGenerateCountMin = computed(() => Math.floor(allowGenerateCountSchema.value?.min ?? 1))
  const allowGenerateCountMax = computed(() => {
    const rawMax = allowGenerateCountSchema.value?.max
    const normalizedMax = Number(rawMax)
    return Number.isFinite(normalizedMax) ? Math.floor(normalizedMax) : undefined
  })
  const allowGenerateCountValue = computed(() => normalizeAllowGenerateCountValue(paramValues.value.allow_generate_count))

  function getModelAllowGenerateCountRemember(modelId: string): number | null {
    if (!modelId) return null
    const store = getStorage<Record<string, number>>(MODEL_ALLOW_GENERATE_COUNT_KEY) || {}
    const value = store[modelId]
    return Number.isFinite(Number(value)) ? Math.floor(Number(value)) : null
  }

  function saveModelAllowGenerateCountRemember(modelId = selectedModelId.value): void {
    if (!modelId || !allowGenerateCountSchema.value) return
    const next = normalizeAllowGenerateCountValue(paramValues.value.allow_generate_count)
    const store = getStorage<Record<string, number>>(MODEL_ALLOW_GENERATE_COUNT_KEY) || {}
    if (store[modelId] === next) return
    setStorage(MODEL_ALLOW_GENERATE_COUNT_KEY, { ...store, [modelId]: next })
  }

  function applyRememberedAllowGenerateCount(modelId = selectedModelId.value): void {
    if (!modelId || !allowGenerateCountSchema.value) return
    const remembered = getModelAllowGenerateCountRemember(modelId)
    if (remembered === null) return
    paramValues.value = {
      ...paramValues.value,
      allow_generate_count: normalizeAllowGenerateCountValue(remembered),
    }
  }

  // ── Vendor / Publisher icon mappings ─────────────────────
  const vendorIcons: Record<string, string> = {
    '字节跳动': '/icons/vendors/bytedance.png',
    'ByteDance': '/icons/vendors/bytedance.png',
    '智谱AI': '/icons/vendors/zhipu.png',
    'Zhipu': '/icons/vendors/zhipu.png',
    '神漫': '/icons/vendors/shenman.png',
    'Shenman': '/icons/vendors/shenman.png',
    'Google': '/icons/vendors/google.png',
  }

  const PUBLISHER_ICON_MAP: Record<string, string> = {
    bytedance: 'bytedance.png', volcengine: 'bytedance.png',
    google: 'google.png', gemini: 'google.png',
    smwh: 'smwh.png', comfyui: 'smwh.png', 'comfyui-local': 'smwh.png',
    zhipu: 'zhipu.png', bigmodel: 'zhipu.png', 'bigmodel-plan': 'zhipu.png',
    anthropic: 'anthropic.png',
    openai: 'openai.png',
  }

  function getVendorIcon(vendor: string | null): string {
    if (!vendor) return '/icons/vendors/default.svg'
    return vendorIcons[vendor] || `/icons/vendors/${vendor.toLowerCase().replace(/\s+/g, '-')}.png`
  }

  function getPublisherIcon(publisher: any): string {
    if (!publisher) return '/icons/publishers/default.svg'
    if (typeof publisher === 'string') {
      const lower = publisher.toLowerCase()
      for (const [key, icon] of Object.entries(PUBLISHER_ICON_MAP)) {
        if (lower.includes(key)) return `/icons/publishers/${icon}`
      }
      return '/icons/publishers/default.svg'
    }
    const pubId = publisher.id || publisher.name || ''
    const lower = pubId.toLowerCase()
    for (const [key, icon] of Object.entries(PUBLISHER_ICON_MAP)) {
      if (lower.includes(key)) return `/icons/publishers/${icon}`
    }
    return '/icons/publishers/default.svg'
  }

  function onIconError(e: Event) {
    const target = e.target as HTMLImageElement
    target.src = '/icons/publishers/default.svg'
  }

  // ── Allow-generate-count helpers ─────────────────────────
  function normalizeAllowGenerateCountValue(rawValue: any) {
    if (!allowGenerateCountSchema.value) return 1
    const min = allowGenerateCountMin.value
    const max = allowGenerateCountMax.value
    const fallback = Math.floor(allowGenerateCountSchema.value.default ?? min)
    let next = Number.isFinite(Number(rawValue)) ? Math.floor(Number(rawValue)) : fallback
    next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    return next
  }

  function onAllowGenerateCountUpdate(value: number | undefined) {
    const next = normalizeAllowGenerateCountValue(value)
    paramValues.value = { ...paramValues.value, allow_generate_count: next }
    saveModelAllowGenerateCountRemember()
  }

  function stepAllowGenerateCount(delta: number) {
    onAllowGenerateCountUpdate(allowGenerateCountValue.value + delta)
  }

  // ── Param normalization ──────────────────────────────────
  function normalizeModelParams(paramsData: Record<string, ModelParamSchema> | null | undefined) {
    const allParams = Object.entries(paramsData || {})
      .map(([name, schema]) => ({ ...schema, name }))
    const defaults: Record<string, any> = {}
    allParams.forEach(param => {
      if (param.default !== undefined) defaults[param.name] = param.default
    })
    return { allParams, defaults }
  }

  function isAllowGenerateCountParam(param: ModelParamSchema) {
    return param.name === 'allow_generate_count'
  }

  function applySpecialModelParams(params: ModelParamSchema[]) {
    promptParamSchema.value = params.find(param => param.name === 'prompt') || null
    allowGenerateCountSchema.value = params.find(isAllowGenerateCountParam) || null
    modelParams.value = params.filter(
      param => !param.hidden && param.name !== 'prompt' && param.name !== 'allow_generate_count'
    )
  }

  function applySpecialParamDefaults(values: Record<string, any>) {
    if (!allowGenerateCountSchema.value) return values
    return { ...values, allow_generate_count: normalizeAllowGenerateCountValue(values.allow_generate_count) }
  }

  function resetModelParamState(): void {
    promptParamSchema.value = null
    allowGenerateCountSchema.value = null
    modelParams.value = []
    paramValues.value = {}
  }

  function applyRestoredParamValues(values: Record<string, any>) {
    const restored = sanitizeRememberedParams(values)
    if (!Object.keys(restored).length) return
    paramValues.value = { ...paramValues.value, ...restored }
  }

  function buildSameCapabilityParamSource(
    previousModelId: string,
    previousCapability: string,
    targetCapability: string,
    previousValues: Record<string, any>,
  ): Record<string, any> | null {
    if (!previousModelId || !previousCapability || previousCapability !== targetCapability) return null
    // 同能力换模型保留当前配置；新模型不存在的字段会在 schema 过滤时回到默认值。
    return { ...previousValues }
  }

  // ── Mode fetching ────────────────────────────────────────
  function resolveModeId(modes: any[], preferredMode?: string | null) {
    if (preferredMode && modes.some(mode => getModeId(mode) === preferredMode)) return preferredMode
    return getModeId(modes[0]) || preferredMode || 'standard'
  }

  function resolveCompatibleModeId(
    modes: any[],
    preferredMode?: string | null,
    rememberedMode?: string | null,
  ) {
    const exactModeId = resolveModeId(modes, preferredMode || rememberedMode)
    if (preferredMode && modes.some(mode => getModeId(mode) === preferredMode)) return exactModeId

    const preferredLabelKey = preferredMode
      ? normalizeModeKey(getModeLabel(preferredMode, preferredMode))
      : ''
    if (preferredLabelKey) {
      const compatibleMode = modes.find((mode: any) =>
        normalizeModeKey(getModeLabel(mode, getModeId(mode))) === preferredLabelKey,
      )
      if (compatibleMode) return getModeId(compatibleMode)
    }

    return exactModeId
  }

  async function fetchModelModes(modelId: string, capabilityId?: string) {
    try {
      return await getCachedModelModes(modelId, capabilityId)
    } catch (e) {
      console.error('Failed to load model modes:', e)
      return []
    }
  }

  async function loadModeParams(
    modelId: string,
    modeId: string,
    capabilityId: string,
    rememberedValues?: Record<string, any>
  ) {
    if (isVirtualModel(modelId)) {
      const virtualParams = getVirtualModelParams(modelId)
      const defaults: Record<string, any> = {}
      virtualParams.forEach(p => { if (p.default !== undefined) defaults[p.name] = p.default })
      const validParamNames = new Set(virtualParams.map(p => p.name))
      const restoredValues = Object.fromEntries(
        Object.entries(rememberedValues || {}).filter(([name]) => validParamNames.has(name))
      )
      applySpecialModelParams(virtualParams)
      paramValues.value = applySpecialParamDefaults(
        rememberedValues ? { ...defaults, ...restoredValues } : defaults
      )
      applyRememberedAllowGenerateCount(modelId)
      return true
    }

    const loadVersion = ++modeParamsLoadVersion
    try {
      const paramsData = await getCachedModeParams(modelId, modeId, capabilityId)
      if (loadVersion !== modeParamsLoadVersion) return false
      const { allParams, defaults } = normalizeModelParams(paramsData)
      const validParamNames = new Set(allParams.map(param => param.name))
      const restoredValues = Object.fromEntries(
        Object.entries(rememberedValues || {}).filter(([name]) => validParamNames.has(name))
      )
      applySpecialModelParams(allParams)
      const mergedValues = rememberedValues ? { ...defaults, ...restoredValues } : defaults
      paramValues.value = applySpecialParamDefaults(mergedValues)
      applyRememberedAllowGenerateCount(modelId)
      return true
    } catch (e) {
      if (loadVersion !== modeParamsLoadVersion) return false
      console.error('Failed to load model params:', e)
      promptParamSchema.value = null
      allowGenerateCountSchema.value = null
      modelParams.value = []
      paramValues.value = {}
      return false
    }
  }

  async function ensureModeParamsLoaded(
    modelId: string,
    capabilityId: string,
    preferredMode: string,
    rememberedValues?: Record<string, any>
  ) {
    const preferredLoaded = await loadModeParams(modelId, preferredMode, capabilityId, rememberedValues)
    if (preferredLoaded) return preferredMode
    for (const mode of availableModes.value) {
      const fallbackModeId = getModeId(mode)
      if (!fallbackModeId || fallbackModeId === preferredMode) continue
      const loaded = await loadModeParams(modelId, fallbackModeId, capabilityId, rememberedValues)
      if (loaded) {
        selectedMode.value = fallbackModeId
        return fallbackModeId
      }
    }
    return preferredMode
  }

  // ── File-upload mode switching ────────────────────────────
  function shouldPreferFileUploadMode() {
    return selectedCapability.value === 'model_generation'
  }

  async function autoSwitchToFileMode(silent = false): Promise<boolean> {
    if (!selectedModelId.value) return false
    for (const mode of availableModes.value) {
      const modeId = getModeId(mode)
      if (modeId === selectedMode.value) continue
      try {
        const paramsData = await getCachedModeParams(selectedModelId.value, modeId, selectedCapability.value)
        const fileParam = paramsData?.file_urls
        const hasFile = !!fileParam && ['file', 'file_list', 'files', 'images'].includes(String(fileParam.type || ''))
        if (hasFile) {
          selectedMode.value = modeId
          await loadModeParams(selectedModelId.value, modeId, selectedCapability.value)
          if (!silent) {
            const { ElMessage } = await import('element-plus')
            ElMessage.success(`已自动切换到「${getModeLabel(mode)}」模式`)
          }
          return true
        }
      } catch { /* ignore */ }
    }
    return false
  }

  async function ensureFileUploadMode(options: {
    silent?: boolean
    warnOnFailure?: boolean
    warningMessage?: string
  } = {}): Promise<boolean> {
    if (hasFileParam.value) return true
    const switched = await autoSwitchToFileMode(options.silent ?? true)
    if (switched) return true
    if (options.warnOnFailure) {
      const { ElMessage } = await import('element-plus')
      ElMessage.warning(
        options.warningMessage
        || `当前模式${currentModeName.value ? `（${currentModeName.value}）` : ''}不支持文件上传`
      )
    }
    return false
  }

  // ── Selection handlers ────────────────────────────────────
  const onModelSelect = async (data: {
    model: BackendModelInfo
    capability?: string
    mode?: string
    modes?: any[]
    params?: ModelParamSchema[]
  }) => {
    isRestoringModelSelection.value = true
    try {
    const { model, capability, mode, modes, params } = data
    const selectionVersion = ++modelSelectionVersion
    modeParamsLoadVersion += 1
    const modelId = model.id || model.name || ''
    const previousModelId = selectedModelId.value
    const prevCap = selectedCapability.value
    const previousParams = sanitizeRememberedParams(paramValues.value)
    selectedModelId.value = modelId
    selectedModelInfo.value = model
    if (selectedModelId.value) sharedModelDetailCache.set(selectedModelId.value, model)

    clearModelCache(selectedModelId.value, capability || selectedCapability.value)

    if (capability && capListIncludes(model.capabilities, capability)) {
      selectedCapability.value = capability
    }
    resetModelParamState()

    if (model.capabilities && model.capabilities.length > 0) {
      if (!capListIncludes(model.capabilities, selectedCapability.value)) {
        selectedCapability.value = getCapId(model.capabilities[0])
      }
    }

    const targetCapability = selectedCapability.value
    const rememberedForModel = resolveRememberedModelState(targetCapability, modelId)
    const currentParamSource = buildSameCapabilityParamSource(previousModelId, prevCap, targetCapability, previousParams)
    const rememberedParams = currentParamSource || rememberedForModel?.params
    const rememberedMode = rememberedForModel?.mode
    const nextModes = modes?.length
      ? modes
      : await fetchModelModes(modelId, targetCapability)
    if (
      selectionVersion !== modelSelectionVersion
      || selectedModelId.value !== modelId
      || selectedCapability.value !== targetCapability
    ) return
    availableModes.value = nextModes
    const currentMode = selectedMode.value
    const preferredMode = mode || currentMode || rememberedMode
    selectedMode.value = resolveCompatibleModeId(
      availableModes.value,
      preferredMode,
      rememberedMode,
    )

    if (selectedCapability.value !== prevCap) {
      emit('capability-change', selectedCapability.value)
    }

    if (params && params.length > 0) {
      const defaults: Record<string, any> = {}
      params.forEach(p => { if (p.default !== undefined) defaults[p.name] = p.default })
      const validParamNames = new Set(params.map(p => p.name))
      const restoredValues = Object.fromEntries(
        Object.entries(rememberedParams || {}).filter(([name]) => validParamNames.has(name))
      )
      applySpecialModelParams(params)
      paramValues.value = applySpecialParamDefaults(
        rememberedParams ? { ...defaults, ...restoredValues } : defaults
      )
      applyRememberedAllowGenerateCount(modelId)
      return // caller should call saveUIRemember
    }

    const loadedMode = await ensureModeParamsLoaded(
      modelId,
      selectedCapability.value,
      selectedMode.value,
      rememberedParams
    )
    if (selectionVersion !== modelSelectionVersion || selectedModelId.value !== modelId) return
    selectedMode.value = loadedMode

    if (shouldPreferFileUploadMode() && !hasFileParam.value) {
      await ensureFileUploadMode({ silent: true })
    }
    } finally {
      isRestoringModelSelection.value = false
    }
  }

  const onModeSelect = async (modeId: string) => {
    if (!selectedModelId.value || modeId === selectedMode.value) return
    selectedMode.value = modeId
    await loadModeParams(selectedModelId.value, selectedMode.value, selectedCapability.value)
  }

  const onCapabilitySelect = (capabilityId: string) => {
    selectedCapability.value = capabilityId
  }

  const onCapabilityBarChange = (capId: string) => {
    selectedCapability.value = capId
    emit('capability-change', capId)
  }

  const onReloadCurrentModel = (capId: string) => {
    if (selectedModelInfo.value) {
      onModelSelect({ model: selectedModelInfo.value, capability: capId, mode: selectedMode.value })
    }
  }

  const onParamChange = (data: Record<string, any>) => {
    paramValues.value = { ...paramValues.value, ...data }
  }

  // ── Reset / restore ──────────────────────────────────────
  function resetForRestore(capability?: string | null) {
    selectedModelId.value = ''
    selectedModelInfo.value = null
    selectedMode.value = 'standard'
    availableModes.value = []
    modelParams.value = []
    paramValues.value = {}
    if (capability) selectedCapability.value = capability
  }

  // ── Sanitize helpers (shared with useUIRemember) ─────────
  function sanitizeRememberedParams(params: Record<string, any> | null | undefined): Record<string, any> {
    if (!params) return {}
    const next = { ...params }
    delete next.allow_generate_count
    delete next.model
    delete next.prompt
    delete next.mode
    delete next.capability
    delete next.file_urls
    delete next.reference_urls
    delete next.reference_files
    delete next.files
    delete next.file_url
    delete next.image_urls
    delete next.image_first_frame
    delete next.image_last_frame
    return next
  }

  function normalizeValueByParamSchema(param: ModelParamSchema | undefined, value: any) {
    if (!param) return value
    if (value === undefined || value === null || value === '') return value
    if (param.type === 'integer' || param.type === 'number' || param.type === 'float') {
      const next = Number(value)
      return Number.isFinite(next) ? next : value
    }
    if (param.type === 'boolean') {
      if (typeof value === 'string') {
        const lowered = value.trim().toLowerCase()
        if (lowered === 'true' || lowered === '1') return true
        if (lowered === 'false' || lowered === '0' || lowered === '') return false
      }
      return Boolean(value)
    }
    return value
  }

  function normalizeParamValuesBySchema(values: Record<string, any>) {
    if (!Object.keys(values).length) return values
    const schemaMap = new Map(modelParams.value.map(param => [param.name, param]))
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, normalizeValueByParamSchema(schemaMap.get(key), value)])
    )
  }

  function resolveRememberedModelState(capabilityId: string, modelId: string): Record<string, any> | null {
    if (!capabilityId || !modelId) return null
    const remembered = _getCapModelRemember?.(capabilityId)
    if (!remembered || typeof remembered !== 'object') return null
    const rememberedByModel =
      remembered.models && typeof remembered.models === 'object'
        ? remembered.models[modelId]
        : null
    if (rememberedByModel && typeof rememberedByModel === 'object') return rememberedByModel
    if (remembered.modelId === modelId) return remembered
    return null
  }

  function buildCurrentRequestPayload() {
    const { allow_generate_count, ...requestParamValues } = paramValues.value
    return {
      capability: selectedCapability.value,
      mode: selectedMode.value || 'standard',
      params: {
        model: selectedModelId.value,
        ...requestParamValues,
      },
    }
  }

  // ── High-level operations (moved from .vue) ────────────
  async function setModelCapability(
    model: BackendModelInfo,
    capability?: string,
    mode?: string,
    params?: ModelParamSchema[]
  ) {
    await onModelSelect({ model, capability, mode: mode || 'standard', params })
    if (capability && capListIncludes(model.capabilities, capability)) {
      selectedCapability.value = capability
      _saveUIRemember?.()
    }
  }

  async function setCapability(capId: string) {
    selectedCapability.value = capId
    _saveUIRemember?.()
    if (!_getAllModels) return
    try {
      const res = await _getAllModels('generations', [capId])
      const list: BackendModelInfo[] = res.models || []
      if (list.length > 0) {
        const remembered = _getCapModelRemember?.(capId)
        const picked = (remembered?.modelId && list.find(m => (m.id || m.name) === remembered.modelId)) || list[0]
        const rememberedForModel = resolveRememberedModelState(capId, picked.id || picked.name || '')
        await onModelSelect({
          model: picked,
          capability: capId,
          mode: rememberedForModel?.mode || remembered?.mode || 'standard',
        })
        if (rememberedForModel?.params && Object.keys(rememberedForModel.params).length > 0) {
          applyRestoredParamValues(rememberedForModel.params)
          _saveUIRemember?.()
        }
      }
    } catch (e) {
      console.warn('setCapability: 加载模型失败', e)
    }
  }

  function enterBatchMode() {
    isBatchMode.value = true
    emit('batch-mode-change', true)
  }

  function exitBatchMode() {
    isBatchMode.value = false
    emit('batch-mode-change', false)
  }

  function toggleBatchMode() {
    if (isBatchMode.value) {
      exitBatchMode()
    } else {
      enterBatchMode()
    }
  }

  // ── Wrapper methods (with saveUIRemember + popover hide) ──
  async function onModeSelectWrapper(modeId: string) {
    await onModeSelect(modeId)
    _modePopoverRef?.value?.hide()
    _saveUIRemember?.()
  }

  function onCapabilitySelectWrapper(capabilityId: string) {
    onCapabilitySelect(capabilityId)
    _capabilityPopoverRef?.value?.hide()
    _saveUIRemember?.()
  }

  function onCapabilityBarChangeWrapper(capId: string) {
    onCapabilityBarChange(capId)
    _saveUIRemember?.()
  }

  function onReloadCurrentModelWrapper(capId: string) {
    if (selectedModelInfo.value) {
      onReloadCurrentModel(capId)
    }
  }

  function onParamChangeWrapper(data: Record<string, any>) {
    onParamChange(data)
    _saveUIRemember?.()
  }

  function onAllowGenerateCountUpdateWrapper(value: number | undefined) {
    onAllowGenerateCountUpdate(value)
    _saveUIRemember?.()
  }

  return {
    // State
    selectedModelId,
    selectedModelInfo,
    selectedCapability,
    isSmartMode,
    selectedSkillId,
    showSkillDropdown,
    isBatchMode,
    batchItems,
    multilineBatchMode,
    modelParams,
    promptParamSchema,
    allowGenerateCountSchema,
    paramValues,
    selectedMode,
    availableModes,
    isRestoringModelSelection,
    // Computed
    modelCapabilities,
    currentCapabilityName,
    currentModeName,
    showModeDropdown,
    hasFileParam,
    fileParamMaxItems,
    refMaxItemsWarning,
    fileParamDef,
    hasPromptParam,
    showAllowGenerateCount,
    allowGenerateCountLabel,
    allowGenerateCountMin,
    allowGenerateCountMax,
    allowGenerateCountValue,
    canClickGenerateButton,
    // Methods
    onModelSelect,
    onModeSelect,
    onCapabilitySelect,
    onCapabilityBarChange,
    onReloadCurrentModel,
    onParamChange,
    resetForRestore,
    autoSwitchToFileMode,
    ensureFileUploadMode,
    getVendorIcon,
    getPublisherIcon,
    onIconError,
    normalizeAllowGenerateCountValue,
    onAllowGenerateCountUpdate,
    stepAllowGenerateCount,
    applyRestoredParamValues,
    sanitizeRememberedParams,
    normalizeValueByParamSchema,
    normalizeParamValuesBySchema,
    buildCurrentRequestPayload,
    resolveModeId,
    fetchModelModes,
    loadModeParams,
    ensureModeParamsLoaded,
    // High-level operations
    setModelCapability,
    setCapability,
    enterBatchMode,
    exitBatchMode,
    toggleBatchMode,
    // Wrapper methods (saveUIRemember + popover hide)
    onModeSelectWrapper,
    onCapabilitySelectWrapper,
    onCapabilityBarChangeWrapper,
    onReloadCurrentModelWrapper,
    onParamChangeWrapper,
    onAllowGenerateCountUpdateWrapper,
    selectedSkillName: computed(() => {
      // Stub - needs skills list from parent
      return '自动'
    }),
  }
}

import { computed } from 'vue'
import type { BackendModelInfo } from '@/api/models'
import { getModelDetail, getModelModes, getModelParamsByMode, getCachedGenerationModels } from '@/api/models'
import { createGeneration, subscribeTaskEvents } from '@/api/generation'
import { runAgentStream } from '@/api/agent'
import { useGenerationStore } from '@/stores/generation.store'
import { useTaskQueueStore } from '@/stores/task-queue'
import { getAsset, findTeamonesAigcRecord } from '@/api/assets'
import { getModeId, getModeLabel } from '@/utils/modeLabels'

// ── Shared caches ────────────────────────────────────────────
export const sharedModelDetailCache = new Map<string, BackendModelInfo>()
const sharedModelModesCache = new Map<string, any[]>()
const sharedModelModesPromiseCache = new Map<string, Promise<any[]>>()
const sharedModeParamsCache = new Map<string, any>()
const sharedModeParamsPromiseCache = new Map<string, Promise<any>>()

function getModelModesCacheKey(modelId: string, capabilityId?: string) {
  return `${modelId || ''}::${capabilityId || ''}`
}

function getModeParamsCacheKey(modelId: string, modeId: string, capabilityId?: string) {
  return `${modelId || ''}::${capabilityId || ''}::${modeId || ''}`
}

export async function getCachedModelDetail(modelId: string) {
  const cached = sharedModelDetailCache.get(modelId)
  if (cached) return cached

  const models = await getCachedGenerationModels()
  const matched = models.find((model: BackendModelInfo) => (model.id || model.name) === modelId)
  if (matched) {
    sharedModelDetailCache.set(modelId, matched)
    return matched
  }

  const modelDetail = await getModelDetail(modelId)
  const normalized = {
    id: modelDetail.id,
    name: modelDetail.display_name || modelDetail.id,
    display_name: modelDetail.display_name,
    vendor: null,
    publisher: modelDetail.publisher,
    capabilities: modelDetail.capabilities || [],
    vendors: modelDetail.vendors || [],
    params: modelDetail.params,
  } as BackendModelInfo
  sharedModelDetailCache.set(modelId, normalized)
  return normalized
}

export async function getCachedModelModes(modelId: string, capabilityId?: string) {
  const cacheKey = getModelModesCacheKey(modelId, capabilityId)
  if (sharedModelModesCache.has(cacheKey)) return sharedModelModesCache.get(cacheKey) || []
  if (!sharedModelModesPromiseCache.has(cacheKey)) {
    sharedModelModesPromiseCache.set(
      cacheKey,
      getModelModes(modelId, capabilityId)
        .then((modesData: any) => {
          const modes = modesData.modes || []
          sharedModelModesCache.set(cacheKey, modes)
          return modes
        })
        .finally(() => {
          sharedModelModesPromiseCache.delete(cacheKey)
        })
    )
  }
  return sharedModelModesPromiseCache.get(cacheKey) || []
}

export async function getCachedModeParams(modelId: string, modeId: string, capabilityId?: string) {
  const cacheKey = getModeParamsCacheKey(modelId, modeId, capabilityId)
  if (sharedModeParamsCache.has(cacheKey)) return sharedModeParamsCache.get(cacheKey)
  if (!sharedModeParamsPromiseCache.has(cacheKey)) {
    sharedModeParamsPromiseCache.set(
      cacheKey,
      getModelParamsByMode(modelId, modeId, capabilityId)
        .then((paramsData: any) => {
          sharedModeParamsCache.set(cacheKey, paramsData)
          return paramsData
        })
        .finally(() => {
          sharedModeParamsPromiseCache.delete(cacheKey)
        })
    )
  }
  return sharedModeParamsPromiseCache.get(cacheKey)
}

// ── URL / Asset helpers ──────────────────────────────────────

/** 从 API 返回的 URL 字段中提取可用地址（兼容新对象结构和旧字符串结构） */
export function extractUrl(raw: any): string {
  if (!raw) return ''
  if (typeof raw === 'object') return raw.origin_url || raw.url || raw.proxy_url || ''
  return raw as string
}

export function extractPreviewUrl(item: any): string | null {
  const previewUrl = extractUrl(item?.thumbnail_url || item?.url)
  return previewUrl || null
}

export type DroppedAssetInfo = {
  id?: string | number
  recordId?: string | number
  url?: string
  type?: string
  prompt?: string
  model?: string
}

export function parseDroppedAssetInfo(raw: string): DroppedAssetInfo | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as DroppedAssetInfo) : null
  } catch {
    return null
  }
}

export async function resolveDroppedAssetUrl(e: DragEvent, fallbackUrl: string): Promise<string> {
  const assetInfo = parseDroppedAssetInfo(e.dataTransfer?.getData('application/x-asset-info') || '')
  if (!assetInfo) return fallbackUrl

  try {
    if (assetInfo.recordId !== undefined && assetInfo.recordId !== null && assetInfo.recordId !== '') {
      const record = await findTeamonesAigcRecord(assetInfo.recordId)
      const recordUrl = extractUrl(record?.url)
      if (recordUrl) return recordUrl
    }

    if (assetInfo.id !== undefined && assetInfo.id !== null && assetInfo.id !== '') {
      const assetDetail = await getAsset(String(assetInfo.id))
      const detailUrl = extractUrl(assetDetail?.url)
      if (detailUrl) return detailUrl
    }
  } catch (error) {
    console.warn('[GeneratorInput] failed to resolve dropped asset detail url:', error)
  }

  return fallbackUrl || assetInfo.url || ''
}

// ── API result normalisation ─────────────────────────────────

/** 兼容字符串和对象两种能力格式 */
export function normalizeCompletedItems(result: any): any[] {
  const data = result?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(result?.items)) return result.items
  if (data?.media_info) {
    const media = data.media_info
    return [{
      asset_id: media.id,
      id: media.id,
      thumb: media.thumb,
      url: media.param?.base_url || media.url || media.thumb,
      type: media.type,
      aigc_record_info: data.aigc_record_info,
    }]
  }
  if (data?.url || data?.thumb || data?.thumbnail_url) return [data]
  return []
}

export function extractAigcRecordIds(result: any, items: any[] = []): string[] {
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

export function getCapId(cap: any): string {
  if (typeof cap === 'string') return cap
  return cap?.name || cap?.id || ''
}

export function capListIncludes(capabilities: any[] | undefined, target: string): boolean {
  if (!capabilities) return false
  return capabilities.some((cap: any) => getCapId(cap) === target)
}

export function extractCreatedAigcRecordId(result: any): string {
  return String(
    result?.aigc_record_id
    || result?.data?.aigc_record_id
    || result?.aigc_record_info?.id
    || result?.data?.aigc_record_info?.id
    || ''
  ).trim()
}

// ── Composable ───────────────────────────────────────────────

export interface UseGenerationRunnerOptions {
  props: {
    disableQueue?: boolean
    flowNodeId?: string
  }
  emit: {
    (e: 'generate-start', payload: any): void
    (e: 'generate-created', payload: any): void
    (e: 'generate-progress', payload: any): void
    (e: 'generate-complete', payload: any): void
    (e: 'generate-error', payload: any, batchInfo?: any): void
    (e: 'queue-task-assigned', payload: any): void
  }
  selectedModelId: { value: string }
  selectedModelInfo: { value: BackendModelInfo | null }
}

export function useGenerationRunner(options: UseGenerationRunnerOptions) {
  const { props, emit, selectedModelId, selectedModelInfo } = options
  const generationStore = useGenerationStore()
  const taskQueueStore = useTaskQueueStore()

  let closeSSE: (() => void) | null = null

  const shouldUseDirectGeneration = computed(
    () => !!props.disableQueue && !props.flowNodeId,
  )

  async function ensureQueueCapacity(requiredCount: number) {
    return taskQueueStore
  }

  async function ensureCanStartSubmission(requiredCount: number) {
    const storeAny = taskQueueStore as any
    if (typeof storeAny.assertCanEnqueue === 'function') {
      storeAny.assertCanEnqueue(requiredCount)
    }
  }

  function markSubmissionRateWindow(taskCount: number) {
    const storeAny = taskQueueStore as any
    if (typeof storeAny.markSubmitCooldown === 'function') {
      storeAny.markSubmitCooldown(taskCount)
    }
  }

  function emitGenerateStart(task: {
    model_id: string
    modelDisplayName?: string
    publisher?: any
    vendor?: string | null
    reference_urls?: string[]
    prompt?: string
    genType?: string
    totalExpectedItems?: number
    _textureMaterialChannels?: string[]
  }) {
    emit('generate-start', {
      model_id: task.model_id,
      modelDisplayName: task.modelDisplayName,
      publisher: task.publisher,
      vendor: task.vendor ?? null,
      reference_urls: task.reference_urls || [],
      prompt: task.prompt || '',
      genType: task.genType || 'image',
      totalExpectedItems: task.totalExpectedItems || 1,
      queueManaged: !shouldUseDirectGeneration.value,
      flowNodeId: props.flowNodeId || '',
      ...(task._textureMaterialChannels?.length ? { _textureMaterialChannels: task._textureMaterialChannels } : {}),
    })
  }

  async function startDirectGenerationTask(opts: {
    request: any
    promptText: string
    modelId: string
    genType: string
    requestIndex: number
    numImagesPerRequest: number
    totalExpectedItems: number
    onProgress?: (percent: number, data: any) => void
    onCompleted?: (result: any) => void
    onError?: (message: string) => void
  }) {
    const created = await createGeneration(opts.request)
    const taskId = created?.task_id || created?.id || ''
    const recordId = created?.record_id || ''
    emit('generate-created', {
      recordId,
      taskId,
      prompt: opts.promptText,
      _requestIndex: opts.requestIndex,
      modelDisplayName: opts.request?.modelDisplayName || selectedModelInfo.value?.display_name || '',
      rawResult: created,
      formattedData: created?.formatted_data || null,
    })
    if (!taskId) throw new Error('创建生成任务失败：缺少 task_id')
    return subscribeTaskEvents(taskId, {
      onProgress: (event) => {
        opts.onProgress?.(event?.percent ?? 0, event)
        emit('generate-progress', {
          ...event,
          _requestIndex: opts.requestIndex,
        })
      },
      onCompleted: (event) => {
        const completedPayload = event?.data && typeof event.data === 'object'
          ? {
              ...(event?.raw && typeof event.raw === 'object' ? event.raw : {}),
              ...event.data,
              task_id: event?.task_id || event?.data?.task_id || taskId,
              aigc_record_id: event?.aigc_record_id || event?.data?.aigc_record_id,
              query_id: event?.query_id || event?.data?.query_id,
              batch_id: event?.batch_id || event?.data?.batch_id,
            }
          : event
        const items = normalizeCompletedItems(completedPayload)
        const aigcRecordIds = extractAigcRecordIds(completedPayload, items)
        const completedResult = {
          model_id: opts.modelId,
          prompt: opts.promptText,
          items,
          taskId: completedPayload?.taskId || completedPayload?.task_id || event?.task_id || taskId,
          recordId: aigcRecordIds[0] || '',
          aigcRecordId: aigcRecordIds[0],
          aigcRecordIds,
          timestamp: Date.now(),
          requestIndex: opts.requestIndex,
          _requestIndex: opts.requestIndex,
          numImagesPerRequest: opts.numImagesPerRequest,
          totalExpectedItems: opts.totalExpectedItems,
          rawResult: completedPayload,
        }
        opts.onCompleted?.(completedResult)
        emit('generate-complete', completedResult)
      },
      onTaskError: (event) => {
        const message = event?.message || '生成失败'
        opts.onError?.(message)
        emit('generate-error', message, {
          _requestIndex: opts.requestIndex,
        })
      },
      onConnectionError: (message) => {
        opts.onError?.(message)
        emit('generate-error', message)
      },
    })
  }

  async function runGenerationRequests(opts: {
    request: any
    requestCount: number
    numImagesPerRequest: number
    promptText: string
    modelId: string
    baseTaskPayload: any
    generatingCards: { value: { url: string | null; done: boolean }[] }
    getCurrentReferenceUrls: () => string[]
    hasFileParam: boolean
  }) {
    const { request, requestCount, numImagesPerRequest, promptText, modelId, baseTaskPayload, generatingCards, getCurrentReferenceUrls, hasFileParam } = opts

    if (shouldUseDirectGeneration.value) {
      for (let requestIndex = 0; requestIndex < requestCount; requestIndex += 1) {
        await startDirectGenerationTask({
          request,
          promptText,
          modelId,
          genType: baseTaskPayload.genType,
          requestIndex,
          numImagesPerRequest,
          totalExpectedItems: baseTaskPayload.totalExpectedItems || requestCount * numImagesPerRequest,
          onProgress: (percent, data) => {
            generationStore.progress = Math.round(percent)
          },
          onCompleted: (completedResult) => {
            generationStore.isGenerating = false
            generationStore.progress = 100
            const items = completedResult.items || []
            items.forEach((item: any, idx: number) => {
              if (idx < generatingCards.value.length) {
                generatingCards.value[idx] = { url: extractPreviewUrl(item), done: true }
              }
            })
            generationStore.completeTask(completedResult)
            setTimeout(() => { generatingCards.value = [] }, 800)
          },
          onError: (message) => {
            console.error('[SSE] 错误:', message)
            generationStore.isGenerating = false
            generatingCards.value = []
          },
        })
      }
      return
    }

    const taskQueue = await ensureQueueCapacity(requestCount)

    for (let requestIndex = 0; requestIndex < requestCount; requestIndex += 1) {
      const queueRecordId = taskQueue.enqueueGeneration({
        request,
        prompt: promptText,
        modelInfo: modelId,
        modelDisplayName: selectedModelInfo.value?.display_name || '',
        genType: baseTaskPayload.genType,
        flowNodeId: props.flowNodeId,
        requestIndex,
        reference_urls: hasFileParam ? getCurrentReferenceUrls() : [],
        callbacks: {
          onCreated: (_recordId: number, taskId: string, result: any) => {
            emit('generate-created', {
              recordId: extractCreatedAigcRecordId(result),
              queueRecordId: _recordId,
              taskId,
              prompt: promptText,
              _requestIndex: requestIndex,
              rawResult: result,
              formattedData: result?.formatted_data || null,
            })
          },
          onProgress: (_recordId: number, percent: number, data: any) => {
            generationStore.progress = Math.round(percent)
            emit('generate-progress', {
              ...data,
              queueRecordId: _recordId,
              _requestIndex: requestIndex,
            })
          },
          onCompleted: (_recordId: number, result: any) => {
            generationStore.isGenerating = false
            generationStore.progress = 100
            const items = normalizeCompletedItems(result)
            const aigcRecordIds = extractAigcRecordIds(result, items)
            items.forEach((item: any, idx: number) => {
              if (idx < generatingCards.value.length) {
                generatingCards.value[idx] = { url: extractPreviewUrl(item), done: true }
              }
            })
            const completedResult = {
              model_id: modelId,
              prompt: promptText,
              items,
              taskId: result?.taskId || result?.task_id || '',
              queueRecordId: _recordId,
              recordId: aigcRecordIds[0] || '',
              aigcRecordId: aigcRecordIds[0],
              aigcRecordIds,
              timestamp: Date.now(),
              requestIndex,
              _requestIndex: requestIndex,
              numImagesPerRequest,
              totalExpectedItems: baseTaskPayload.totalExpectedItems,
            }
            generationStore.completeTask(completedResult)
            emit('generate-complete', completedResult)
            setTimeout(() => { generatingCards.value = [] }, 800)
          },
          onError: (_recordId: number, message: string) => {
            console.error('[SSE] 错误:', message)
            generationStore.isGenerating = false
            generatingCards.value = []
            emit('generate-error', message, {
              queueRecordId: _recordId,
              _requestIndex: requestIndex,
            })
          },
        },
      })
      emit('queue-task-assigned', {
        queueRecordId,
        _requestIndex: requestIndex,
      })
    }
  }

  /** Run smart/agent mode generation */
  async function runSmartGeneration(opts: {
    prompt: string
    selectedSkillId: string | null
    getCurrentReferenceUrls: () => string[]
    generatingCards: { value: { url: string | null; done: boolean }[] }
  }) {
    const smartPrompt = opts.prompt.trim()
    generationStore.isGenerating = true
    generationStore.progress = 0
    opts.generatingCards.value = [{ url: null, done: false }]

    emit('generate-start', {
      model_id: selectedModelId.value || 'agent',
      reference_urls: opts.getCurrentReferenceUrls(),
      prompt: smartPrompt,
      genType: 'smart',
    })

    const cancelStream = runAgentStream(
      { input: smartPrompt, stream: true, ...(opts.selectedSkillId ? { skill_id: opts.selectedSkillId } : {}) },
      {
        onIntent: (data: any) => {
          emit('generate-progress', { type: 'intent', message: `意图识别: ${data?.skill_id || data?.route_type || '分析中'}`, percent: 10 })
          generationStore.progress = 10
        },
        onProgress: (step: number, total: number, message: string) => {
          const percent = total > 0 ? Math.round((step / total) * 100) : 50
          generationStore.progress = percent
          emit('generate-progress', { type: 'progress', percent, message })
        },
        onResult: (data: any) => {
          generationStore.isGenerating = false
          generationStore.progress = 100

          const resultType = data?.result_type || data?.type || ''
          const items = data?.data || data?.items || []
          if (items.length) {
            items.forEach((item: any, idx: number) => {
              const previewUrl = extractPreviewUrl(item)
              if (idx < opts.generatingCards.value.length) {
                opts.generatingCards.value[idx] = { url: previewUrl, done: true }
              } else {
                opts.generatingCards.value.push({ url: previewUrl, done: true })
              }
            })
          }

          const completedResult = {
            model_id: data?.model || selectedModelId.value || 'agent',
            prompt: smartPrompt,
            items,
            timestamp: Date.now(),
            resultType,
            message: data?.message || '',
            assetIds: data?.asset_ids || [],
          }
          generationStore.completeTask(completedResult)
          emit('generate-complete', completedResult)
          setTimeout(() => { opts.generatingCards.value = [] }, 800)
        },
        onError: (message: string) => {
          generationStore.isGenerating = false
          opts.generatingCards.value = []
          emit('generate-error', message)
        },
        onDone: () => {
          if (generationStore.isGenerating) {
            generationStore.isGenerating = false
          }
        },
      }
    )
    closeSSE = cancelStream
  }

  function destroySSE() {
    if (closeSSE) {
      closeSSE()
      closeSSE = null
    }
  }

  return {
    // Cache helpers
    getCachedModelDetail,
    getCachedModelModes,
    getCachedModeParams,
    // URL / Asset helpers
    extractUrl,
    extractPreviewUrl,
    normalizeCompletedItems,
    extractAigcRecordIds,
    extractCreatedAigcRecordId,
    getCapId,
    capListIncludes,
    // DroppedAsset
    parseDroppedAssetInfo,
    resolveDroppedAssetUrl,
    // Generation lifecycle
    shouldUseDirectGeneration,
    ensureQueueCapacity,
    ensureCanStartSubmission,
    markSubmissionRateWindow,
    emitGenerateStart,
    startDirectGenerationTask,
    runGenerationRequests,
    runSmartGeneration,
    destroySSE,
    // Cache access (for useModeManager)
    sharedModelDetailCache,
  }
}

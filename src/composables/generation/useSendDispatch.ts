/**
 * useSendDispatch — orchestrates generation submission for GeneratorInput.
 *
 * Wraps useGenerationRunner and adds the high-level `handleSend` /
 * `handleMultilineBatchGenerate` decision logic that ties together queue
 * capacity checks, URL resolution, smart-mode / batch-mode routing, etc.
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'
import {
  useGenerationRunner,
  normalizeCompletedItems,
  extractAigcRecordIds,
  capListIncludes,
  extractCreatedAigcRecordId,
  extractPreviewUrl,
} from '@/composables/generation/useGenerationRunner'
import type { BackendModelInfo } from '@/api/models'
import { isVirtualModel, transformVirtualModelParams } from '@/services/generation/topaz.constants'
import { buildIndexedCompletePayload, buildIndexedCreatedPayload } from './workflowIndexedGenerationEvents'
import { appendDebugFileLog } from '@/utils/debugFileLog'
import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'
import { extractRequestErrorMessage } from '@/utils/requestErrorMessage'
import type { PBRChannel } from '@/types/pbr.types'

export interface UseSendDispatchOptions {
  emit: {
    (e: 'generate-start', payload: any): void
    (e: 'generate-created', payload: any): void
    (e: 'generate-progress', payload: any): void
    (e: 'generate-complete', payload: any): void
    (e: 'generate-error', payload: any, batchInfo?: any): void
    (e: 'queue-task-assigned', payload: any): void
  }
  props: {
    disableQueue?: boolean
    flowNodeId?: string
    embedded?: boolean
  }
  selectedModelId: Ref<string>
  selectedModelInfo: Ref<BackendModelInfo | null>
  selectedCapability: Ref<string>
  selectedMode: Ref<string>
  isSmartMode: Ref<boolean>
  selectedSkillId: Ref<string | null>
  prompt: Ref<string>
  refImages: Ref<any[]>
  paramValues: Ref<Record<string, any>>
  hasFileParam: Ref<boolean>
  fileParamDef: ComputedRef<any>
  hasPromptParam: Ref<boolean>
  allowGenerateCountValue: ComputedRef<number>
  multilineBatchMode: Ref<boolean>
  multilinePrompts: ComputedRef<string[]>
  buildMultilinePromptTasks: () => Array<{ prompt: string; refs: any[]; pbrChannel?: PBRChannel }>
  pendingPbrChannel: Ref<PBRChannel | ''>
  isBatchMode: Ref<boolean>
  batchItems: Ref<any[]>
  isExpanded: Ref<boolean>
  smartMultiFrameEnabled: Ref<boolean>
  buildSmartMultiFrameTasks: (uploadedUrls: string[]) => Array<{ prompt: string; file_urls: string[]; params: Record<string, unknown> }>
  autoSwitchToFileMode: (silent?: boolean) => Promise<boolean>
  ensureFileUploadMode: (opts?: any) => Promise<boolean>
  getCurrentReferenceUrls: () => string[]
  resolveRefImageUrls: () => Promise<string[]>
  resolveReferenceImageGroupUrls: (images: any[]) => Promise<string[]>
  resolveDataUrlToUpload: (dataUrl: string, index: number) => Promise<string>
  normalizeAllowGenerateCountValue: (v: any) => number
  saveUIRemember: () => void
  syncPromptFromDom?: (preserveWhenEmpty?: boolean) => void
}

export function useSendDispatch(options: UseSendDispatchOptions) {
  const {
    emit, props, selectedModelId, selectedModelInfo,
    selectedCapability, selectedMode, isSmartMode, selectedSkillId,
    prompt, refImages, paramValues, hasFileParam, fileParamDef, hasPromptParam,
    allowGenerateCountValue, multilineBatchMode, multilinePrompts,
    buildMultilinePromptTasks, pendingPbrChannel, isBatchMode, batchItems, isExpanded, smartMultiFrameEnabled, buildSmartMultiFrameTasks,
    autoSwitchToFileMode, ensureFileUploadMode,
    getCurrentReferenceUrls, resolveRefImageUrls, resolveReferenceImageGroupUrls, resolveDataUrlToUpload,
    normalizeAllowGenerateCountValue, saveUIRemember, syncPromptFromDom,
  } = options

  // ── runner instance ──────────────────────────────────────────
  const runner = useGenerationRunner({
    props,
    emit,
    selectedModelId,
    selectedModelInfo,
  })

  // ── generating card state ────────────────────────────────────
  const generatingCards = ref<{ url: string | null; done: boolean }[]>([])
  const generatingTotal = ref(0)

  function buildTextureMaterialChannels(tasks: Array<{ pbrChannel?: PBRChannel }>): string[] {
    return tasks.map((task) => task.pbrChannel || '')
  }

  function hasTextureMaterialChannels(channels: string[]): boolean {
    return channels.some(Boolean)
  }

  function inferTaskPbrChannel(input: any): PBRChannel | undefined {
    return inferTextureMaterialChannel(input) || undefined
  }

  function normalizeTaskPbrChannel(task: any, extra: any = {}): PBRChannel | undefined {
    return task?.pbrChannel || inferTaskPbrChannel({
      ...extra,
      ...task,
      params: { ...(extra?.params || {}), ...(task?.params || {}) },
    })
  }

  function buildFileParamPayload(urls: string[]): Record<string, unknown> {
    if (!urls.length) return {}
    const schema = fileParamDef.value
    const paramName = schema?.name || 'file_urls'
    if (schema?.type === 'file') {
      return { [paramName]: urls[0] }
    }
    return { [paramName]: urls }
  }

  function stripManagedParams(values: Record<string, any>) {
    const { file_urls: _fileUrls, file_url: _fileUrl, prompt: _prompt, allow_generate_count: _allowGenerateCount, ...rest } = values
    return rest
  }

  // ── Multiline batch generation ───────────────────────────────
  async function handleMultilineBatchGenerate(tasks: Array<{ prompt: string; refs: any[]; pbrChannel?: PBRChannel }>) {
    const generationStore = (await import('@/stores/generation.store')).useGenerationStore()
    generationStore.isGenerating = true
    generationStore.progress = 0
    generatingCards.value = tasks.map(() => ({ url: null, done: false }))
    generatingTotal.value = tasks.length

    appendDebugFileLog('send-dispatch', 'multiline-start', {
      flowNodeId: props.flowNodeId,
      taskCount: tasks.length,
    })

    const capabilities = selectedModelInfo.value?.capabilities || []
    let genType: any = 'image'
    if (capListIncludes(capabilities, 'video_generation')) genType = 'video'
    else if (capListIncludes(capabilities, 'audio_generation')) genType = 'audio'
    else if (capListIncludes(capabilities, 'model_generation')) genType = 'model'

    try {
      let fallbackUrls: string[] = []
      if (refImages.value.length && !tasks.some((task) => task.refs.length)) {
        try {
          fallbackUrls = await resolveRefImageUrls()
        } catch (upErr: any) {
          ElMessage.error('参考图上传失败: ' + (upErr.message || '未知错误'))
          generationStore.isGenerating = false
          generatingCards.value = []
          return
        }
      }

      let completedCount = 0
      let aggregateFailed = false

      const { allow_generate_count, ...rawRequestParamValues } = paramValues.value
      const requestParamValues = stripManagedParams(rawRequestParamValues)
      const normalizedTasks = tasks.map((task) => ({
        ...task,
        pbrChannel: normalizeTaskPbrChannel(task, { params: requestParamValues }),
      }))
      const textureChannels = buildTextureMaterialChannels(normalizedTasks)

      runner.emitGenerateStart({
        model_id: selectedModelId.value,
        modelDisplayName: selectedModelInfo.value?.display_name || '',
        publisher: selectedModelInfo.value?.publisher,
        reference_urls: hasFileParam.value ? getCurrentReferenceUrls() : [],
        prompt: normalizedTasks.map((task) => task.prompt).join('\n'),
        genType,
        totalExpectedItems: normalizedTasks.length,
        ...(hasTextureMaterialChannels(textureChannels) ? { _textureMaterialChannels: textureChannels } : {}),
      })

      if (runner.shouldUseDirectGeneration.value) {
        for (let i = 0; i < normalizedTasks.length; i++) {
          const promptText = normalizedTasks[i].prompt
          const taskUrls = await resolveMultilineTaskReferenceUrls(normalizedTasks[i], fallbackUrls)
          const request = {
            capability: selectedCapability.value,
            mode: selectedMode.value || 'standard',
            params: {
              model: selectedModelId.value,
              prompt: promptText,
              ...requestParamValues,
              ...buildFileParamPayload(taskUrls),
              ...(requestParamValues.num_images !== undefined ? { num_images: 1 } : {}),
              ...(requestParamValues.batch_size !== undefined ? { batch_size: 1 } : {}),
            },
          }
          const requestIndex = i
          await runner.startDirectGenerationTask({
            request,
            promptText,
            modelId: selectedModelId.value,
            genType,
            requestIndex,
            numImagesPerRequest: 1,
            totalExpectedItems: normalizedTasks.length,
            onProgress: (percent, _data) => {
              const overallProgress = (completedCount * 100 + percent) / normalizedTasks.length
              generationStore.progress = Math.round(overallProgress)
            },
            onCompleted: (completedResult) => {
              if (aggregateFailed) return
              const items = completedResult.items || []
              if (requestIndex < generatingCards.value.length) {
                generatingCards.value[requestIndex] = { url: extractPreviewUrl(items[0]), done: true }
              }
              generationStore.completeTask(completedResult)
              completedCount++
              if (completedCount >= normalizedTasks.length) {
                generationStore.isGenerating = false
                generationStore.progress = 100
                setTimeout(() => { generatingCards.value = [] }, 800)
              }
            },
            onError: (_message) => {
              aggregateFailed = true
              generationStore.isGenerating = false
              generatingCards.value = []
            },
          })
        }
        return
      }

      const taskQueueStore = await runner.ensureQueueCapacity(normalizedTasks.length)

      for (let i = 0; i < normalizedTasks.length; i++) {
        const promptText = normalizedTasks[i].prompt
        const taskUrls = await resolveMultilineTaskReferenceUrls(normalizedTasks[i], fallbackUrls)
        const request = {
          capability: selectedCapability.value,
          mode: selectedMode.value || 'standard',
          params: {
            model: selectedModelId.value,
            prompt: promptText,
            ...requestParamValues,
            ...buildFileParamPayload(taskUrls),
            ...(requestParamValues.num_images !== undefined ? { num_images: 1 } : {}),
            ...(requestParamValues.batch_size !== undefined ? { batch_size: 1 } : {}),
          },
        }
        const requestIndex = i
        let capturedTaskId = ''
        const queueRecordId = taskQueueStore.enqueueGeneration({
          request,
          prompt: promptText,
          modelInfo: selectedModelId.value,
          modelDisplayName: selectedModelInfo.value?.display_name || '',
          genType,
          flowNodeId: props.flowNodeId,
          requestIndex,
          callbacks: {
            onCreated: (_recordId, taskId, result) => {
              capturedTaskId = taskId || ''
              appendDebugFileLog('send-dispatch', 'queue-created', {
                flowNodeId: props.flowNodeId,
                requestIndex,
                taskId,
              })
              emit('generate-created', {
                ...buildIndexedCreatedPayload({
                  result,
                taskId,
                prompt: promptText,
                requestIndex,
                modelDisplayName: selectedModelInfo.value?.display_name || '',
              }),
                queueRecordId: _recordId,
              })
            },
            onProgress: (_recordId, percent, data) => {
              const overallProgress = (completedCount * 100 + percent) / normalizedTasks.length
              generationStore.progress = Math.round(overallProgress)
              if (data) {
                emit('generate-progress', {
                  ...data,
                  percent: generationStore.progress,
                  taskId: capturedTaskId,
                  queueRecordId: _recordId,
                  _requestIndex: requestIndex,
                })
              }
            },
            onCompleted: (_recordId, result) => {
              if (aggregateFailed) return
              const items = normalizeCompletedItems(result)
              const aigcRecordIds = extractAigcRecordIds(result, items)
              if (requestIndex < generatingCards.value.length) {
                generatingCards.value[requestIndex] = { url: extractPreviewUrl(items[0]), done: true }
              }
              const completedResult = {
                model_id: selectedModelId.value,
                prompt: promptText,
                items,
                taskId: result?.taskId || result?.task_id || capturedTaskId || '',
                queueRecordId: _recordId,
                recordId: aigcRecordIds[0] || '',
                aigcRecordId: aigcRecordIds[0],
                aigcRecordIds,
                timestamp: Date.now(),
                requestIndex,
                _requestIndex: requestIndex,
                numImagesPerRequest: 1,
                totalExpectedItems: normalizedTasks.length,
              }
              generationStore.completeTask(completedResult)
              appendDebugFileLog('send-dispatch', 'queue-complete', {
                flowNodeId: props.flowNodeId,
                requestIndex,
                taskId: completedResult.taskId,
                recordId: completedResult.recordId,
              })
              emit('generate-complete', completedResult)
              completedCount++
              if (completedCount >= normalizedTasks.length) {
                generationStore.isGenerating = false
                generationStore.progress = 100
                setTimeout(() => { generatingCards.value = [] }, 800)
              }
            },
            onError: (_recordId, message) => {
              aggregateFailed = true
              generationStore.isGenerating = false
              generatingCards.value = []
              emit('generate-error', message, {
                _requestIndex: requestIndex,
                queueRecordId: _recordId,
              })
            },
          },
        })
        emit('queue-task-assigned', {
          queueRecordId,
          _requestIndex: requestIndex,
        })
      }
    } catch (e: any) {
      console.error('[GeneratorInput] 多行批量生成失败:', e)
      const generationStore = (await import('@/stores/generation.store')).useGenerationStore()
      generationStore.isGenerating = false
      generatingCards.value = []
      ElMessage.error('多行批量生成失败: ' + (e.message || '未知错误'))
    }
  }

  async function resolveMultilineTaskReferenceUrls(
    task: { prompt: string; refs: any[] } | undefined,
    fallbackUrls: string[],
  ): Promise<string[]> {
    if (!task?.refs?.length) return fallbackUrls
    return resolveReferenceImageGroupUrls(task.refs)
  }

  async function handleSmartMultiFrameGenerate() {
    const generationStore = (await import('@/stores/generation.store')).useGenerationStore()
    const promptRequired = hasPromptParam.value
    const requestedGenerateCount = normalizeAllowGenerateCountValue(paramValues.value.allow_generate_count)
    const numImagesPerRequest = Number(paramValues.value.num_images || paramValues.value.batch_size || 1) || 1

    let uploadedUrls: string[] = []
    if (refImages.value.length) {
      try {
        uploadedUrls = await resolveRefImageUrls()
      } catch (upErr: any) {
        ElMessage.error('参考图上传失败: ' + (upErr.message || '未知错误'))
        return
      }
    }

    const pairTasks = buildSmartMultiFrameTasks(uploadedUrls)
      .filter((task) => task.file_urls.length === 2 && (!promptRequired || !!task.prompt.trim()))
    if (!pairTasks.length) {
      ElMessage.warning(promptRequired ? '请至少准备一段有效的首尾帧和提示词' : '请至少上传两张参考图')
      if (!isExpanded.value) isExpanded.value = true
      return
    }

    const totalRequests = pairTasks.length * requestedGenerateCount
    const totalExpectedItems = totalRequests * numImagesPerRequest
    const { allow_generate_count, ...rawRequestParamValues } = paramValues.value
    const requestParamValues = stripManagedParams(rawRequestParamValues)
    const genType = capListIncludes(selectedModelInfo.value?.capabilities || [], 'video_generation') ? 'video' : 'image'

    try {
      await runner.ensureCanStartSubmission(totalRequests)
      runner.markSubmissionRateWindow(totalRequests)
    } catch (e: any) {
      ElMessage.warning(e.message || '当前无法提交生成任务')
      return
    }

    generationStore.isGenerating = true
    generationStore.progress = 0
    generatingCards.value = Array.from({ length: totalExpectedItems }, () => ({ url: null, done: false }))
    generatingTotal.value = totalExpectedItems
    let completedCount = 0
    let requestFailed = false
    const closers: Array<() => void> = []
    const resultItems: any[][] = Array.from({ length: totalRequests }, () => [])
    const aigcRecordIds: string[][] = Array.from({ length: totalRequests }, () => [])

    runner.emitGenerateStart({
      model_id: selectedModelId.value,
      modelDisplayName: selectedModelInfo.value?.display_name || '',
      publisher: selectedModelInfo.value?.publisher,
      reference_urls: hasFileParam.value ? getCurrentReferenceUrls() : [],
      prompt: pairTasks.map((task) => task.prompt).join('\n'),
      genType,
      totalExpectedItems,
    })

    const finalizeIfReady = () => {
      if (requestFailed || completedCount < totalRequests) return
      generationStore.isGenerating = false
      generationStore.progress = 100
      if (!props.flowNodeId) {
        emit('generate-complete', {
          model_id: selectedModelId.value,
          prompt: pairTasks.map((task) => task.prompt).join('\n'),
          items: resultItems.flat(),
          aigcRecordId: aigcRecordIds.flat()[0],
          aigcRecordIds: aigcRecordIds.flat().filter(Boolean),
          timestamp: Date.now(),
        })
      }
      setTimeout(() => { generatingCards.value = [] }, 800)
      closers.splice(0).forEach((close) => { try { close() } catch {} })
    }

    const updateCardRange = (requestIndex: number, items: any[]) => {
      const start = requestIndex * numImagesPerRequest
      items.forEach((item, itemIndex) => {
        const cardIndex = start + itemIndex
        if (cardIndex < generatingCards.value.length) {
          generatingCards.value[cardIndex] = { url: extractPreviewUrl(item), done: true }
        }
      })
    }

    try {
      let requestIndex = 0
      const taskQueueStore = runner.shouldUseDirectGeneration.value
        ? null
        : await runner.ensureQueueCapacity(totalRequests)
      for (const task of pairTasks) {
        for (let repeatIndex = 0; repeatIndex < requestedGenerateCount; repeatIndex += 1) {
          const currentRequestIndex = requestIndex
          const request = {
            capability: selectedCapability.value,
            mode: selectedMode.value || 'standard',
            params: {
              model: selectedModelId.value,
              ...requestParamValues,
              ...(task.params || {}),
              ...(hasPromptParam.value ? { prompt: task.prompt } : {}),
              ...buildFileParamPayload(task.file_urls),
            },
          }

          if (runner.shouldUseDirectGeneration.value) {
            const close = await runner.startDirectGenerationTask({
              request,
              promptText: task.prompt,
              modelId: selectedModelId.value,
              genType,
              requestIndex: currentRequestIndex,
              numImagesPerRequest,
              totalExpectedItems,
              onProgress: (percent) => {
                generationStore.progress = Math.round((completedCount * 100 + percent) / totalRequests)
              },
              onCompleted: (completedResult) => {
                const items = completedResult.items || []
                resultItems[currentRequestIndex] = items
                aigcRecordIds[currentRequestIndex] = completedResult.aigcRecordIds || []
                updateCardRange(currentRequestIndex, items)
                generationStore.completeTask(completedResult)
                completedCount += 1
                finalizeIfReady()
              },
              onError: (message) => {
                requestFailed = true
                generationStore.isGenerating = false
                generatingCards.value = []
                emit('generate-error', message)
              },
            })
            closers.push(close)
          } else {
            const queueRecordId = taskQueueStore!.enqueueGeneration({
              request,
              prompt: task.prompt,
              modelInfo: selectedModelId.value,
              modelDisplayName: selectedModelInfo.value?.display_name || '',
              genType,
              flowNodeId: props.flowNodeId,
              requestIndex: currentRequestIndex,
              callbacks: {
                onCreated: (_recordId, taskId, result) => {
                  emit('generate-created', {
                    ...buildIndexedCreatedPayload({
                      result,
                      taskId,
                      prompt: task.prompt,
                      requestIndex: currentRequestIndex,
                    }),
                    queueRecordId: _recordId,
                  })
                },
                onProgress: (_recordId, percent, data) => {
                  generationStore.progress = Math.round((completedCount * 100 + percent) / totalRequests)
                  emit('generate-progress', { ...data, queueRecordId: _recordId, _requestIndex: currentRequestIndex })
                },
                onCompleted: (_recordId, result) => {
                  const items = normalizeCompletedItems(result)
                  resultItems[currentRequestIndex] = items
                  aigcRecordIds[currentRequestIndex] = extractAigcRecordIds(result, items)
                  updateCardRange(currentRequestIndex, items)
                  completedCount += 1
                  emit('generate-complete', {
                    ...buildIndexedCompletePayload({
                      modelId: selectedModelId.value,
                      prompt: task.prompt,
                      items,
                      result,
                    aigcRecordIds: aigcRecordIds[currentRequestIndex] || [],
                    requestIndex: currentRequestIndex,
                    numImagesPerRequest,
                    totalExpectedItems,
                  }),
                    queueRecordId: _recordId,
                  })
                  finalizeIfReady()
                },
                onError: (_recordId, message) => {
                  requestFailed = true
                  generationStore.isGenerating = false
                  generatingCards.value = []
                  emit('generate-error', message, { queueRecordId: _recordId, _requestIndex: currentRequestIndex })
                },
              },
            })
            emit('queue-task-assigned', {
              queueRecordId,
              _requestIndex: currentRequestIndex,
            })
          }
          requestIndex += 1
        }
      }
    } catch (e: any) {
      requestFailed = true
      generationStore.isGenerating = false
      generatingCards.value = []
      emit('generate-error', extractRequestErrorMessage(e, '智能多帧生成失败'))
    }
  }

  // ── Main handleSend ─────────────────────────────────────────
  const handleSend = async () => {
    syncPromptFromDom?.(true)
    const generationStore = (await import('@/stores/generation.store')).useGenerationStore()

    // 智能模式不强制选模型
    if (!isSmartMode.value && !selectedModelId.value) {
      ElMessage.warning('请先选择模型')
      return
    }

    // ── 多行批量模式 ──
    if (multilineBatchMode.value && !smartMultiFrameEnabled.value) {
      const tasks = buildMultilinePromptTasks().filter((task) => task.prompt.trim())
      if (!tasks.length) {
        if (!isExpanded.value) isExpanded.value = true
        return
      }
      try {
        await runner.ensureCanStartSubmission(tasks.length)
        runner.markSubmissionRateWindow(tasks.length)
      } catch (e: any) {
        ElMessage.warning(e.message || '当前无法提交生成任务')
        return
      }
      await handleMultilineBatchGenerate(tasks)
      return
    }

    // ── 批量模式 ──
    if (isBatchMode.value) {
      const validItems = batchItems.value.filter((item: any) => item.prompt.trim() || item.image)
      if (validItems.length === 0) {
        if (!isExpanded.value) isExpanded.value = true
        return
      }
      try {
        await runner.ensureCanStartSubmission(validItems.length)
        runner.markSubmissionRateWindow(validItems.length)
      } catch (e: any) {
        ElMessage.warning(e.message || '当前无法提交生成任务')
        return
      }

      // 上传批量任务中的图片
      let batchUploadedImages: (string | null)[] = validItems.map(() => null as any)
      try {
        batchUploadedImages = await Promise.all(
          validItems.map((item: any, idx: number) =>
            item.image ? resolveDataUrlToUpload(item.image, idx) : Promise.resolve(null)
          )
        )
      } catch (upErr: any) {
        ElMessage.error('批量图片上传失败: ' + (upErr.message || '未知错误'))
        return
      }

      // 初始化批量生成卡片
      generatingCards.value = validItems.map(() => ({ url: null, done: false }))
      generatingTotal.value = validItems.length
      let batchCompletedCount = 0

      const batchSseClosers: Array<() => void> = []
      const batchResultItems: any[][] = validItems.map(() => [])
      const batchAigcRecordIds: string[][] = validItems.map(() => [])
      let batchFailed = false
      const batchPbrChannels = validItems
        .map((item: any) => normalizeTaskPbrChannel(item, { params: paramValues.value }) || '')

      runner.emitGenerateStart({
        model_id: selectedModelId.value,
        modelDisplayName: selectedModelInfo.value?.display_name || '',
        publisher: selectedModelInfo.value?.publisher,
        reference_urls: hasFileParam.value ? getCurrentReferenceUrls() : [],
        prompt: validItems.map((item: any) => item.prompt).filter(Boolean).join('\n'),
        genType: 'image',
        totalExpectedItems: validItems.length,
        ...(hasTextureMaterialChannels(batchPbrChannels) ? { _textureMaterialChannels: batchPbrChannels } : {}),
      })

      const emitBatchCompleteIfReady = () => {
        if (batchFailed || batchCompletedCount < validItems.length) return
        const items = batchResultItems.flat()
        const aigcRecordIds = batchAigcRecordIds.flat()
          .filter((id, index, all) => id && all.indexOf(id) === index)
          .map(String)
        if (!props.flowNodeId) {
          emit('generate-complete', {
            model_id: selectedModelId.value,
            prompt: validItems.map((item: any) => item.prompt).filter(Boolean).join('\n'),
            items,
            aigcRecordId: aigcRecordIds[0],
            aigcRecordIds,
            timestamp: Date.now(),
          })
        }
        setTimeout(() => { generatingCards.value = [] }, 800)
        batchSseClosers.splice(0).forEach(close => { try { close() } catch {} })
      }

      try {
        if (runner.shouldUseDirectGeneration.value) {
          for (let idx = 0; idx < validItems.length; idx++) {
            const item = validItems[idx]
            const request = {
              capability: selectedCapability.value,
              mode: selectedMode.value || 'standard',
              params: {
                model: selectedModelId.value,
                prompt: item.prompt,
                ...stripManagedParams(paramValues.value),
                ...(item.params || {}),
                ...buildFileParamPayload(
                  [batchUploadedImages[idx]].filter((url): url is string => typeof url === 'string' && !!url),
                ),
              },
            }
            const requestIndex = idx
            const close = await runner.startDirectGenerationTask({
              request,
              promptText: item.prompt,
              modelId: selectedModelId.value,
              genType: 'image',
              requestIndex,
              numImagesPerRequest: 1,
              totalExpectedItems: validItems.length,
              onCompleted: (completedResult) => {
                const items = completedResult.items || []
                batchResultItems[requestIndex] = items
                batchAigcRecordIds[requestIndex] = completedResult.aigcRecordIds || []
                if (items.length && requestIndex < generatingCards.value.length) {
                  generatingCards.value[requestIndex] = { url: extractPreviewUrl(items[0]), done: true }
                }
                batchCompletedCount++
                emitBatchCompleteIfReady()
              },
              onError: (_message) => {
                batchFailed = true
                generatingCards.value = []
              },
            })
            batchSseClosers.push(close)
          }
        } else {
          const taskQueueStore = await runner.ensureQueueCapacity(validItems.length)
          for (let idx = 0; idx < validItems.length; idx++) {
            const item = validItems[idx]
            const request = {
              capability: selectedCapability.value,
              mode: selectedMode.value || 'standard',
              params: {
                model: selectedModelId.value,
                prompt: item.prompt,
                ...stripManagedParams(paramValues.value),
                ...(item.params || {}),
                ...buildFileParamPayload(
                  [batchUploadedImages[idx]].filter((url): url is string => typeof url === 'string' && !!url),
                ),
              },
            }
            const requestIndex = idx
            const queueRecordId = taskQueueStore.enqueueGeneration({
              request,
              prompt: item.prompt,
              modelInfo: selectedModelId.value,
              modelDisplayName: selectedModelInfo.value?.display_name || '',
              genType: 'image',
              flowNodeId: props.flowNodeId,
              requestIndex,
              callbacks: {
                onCreated: (_recordId, taskId, result) => {
                  emit('generate-created', {
                    ...buildIndexedCreatedPayload({
                      result,
                      taskId,
                      prompt: item.prompt,
                      requestIndex,
                    }),
                    queueRecordId: _recordId,
                  })
                },
                onProgress: (_recordId, _percent, data) => {
                  emit('generate-progress', { ...data, queueRecordId: _recordId, _requestIndex: requestIndex })
                },
                onCompleted: (_recordId, result) => {
                  const items = normalizeCompletedItems(result)
                  batchResultItems[requestIndex] = items
                  batchAigcRecordIds[requestIndex] = extractAigcRecordIds(result, items)
                  emit('generate-complete', {
                    ...buildIndexedCompletePayload({
                      modelId: selectedModelId.value,
                      prompt: item.prompt,
                      items,
                      result,
                      aigcRecordIds: batchAigcRecordIds[requestIndex] || [],
                      requestIndex,
                      numImagesPerRequest: 1,
                      totalExpectedItems: validItems.length,
                    }),
                    queueRecordId: _recordId,
                  })
                  if (items.length && requestIndex < generatingCards.value.length) {
                    generatingCards.value[requestIndex] = { url: extractPreviewUrl(items[0]), done: true }
                  }
                  batchCompletedCount++
                  emitBatchCompleteIfReady()
                },
                onError: (_recordId, message) => {
                  batchFailed = true
                  generatingCards.value = []
                  emit('generate-error', message, { queueRecordId: _recordId, _requestIndex: requestIndex })
                },
              },
            })
            emit('queue-task-assigned', {
              queueRecordId,
              _requestIndex: requestIndex,
            })
          }
        }
      } catch (e: any) {
        batchFailed = true
        emit('generate-error', extractRequestErrorMessage(e, '批量生成失败'))
      }

      // 重置批量状态
      isBatchMode.value = false
      batchItems.value = [{ id: Math.random().toString(36).substring(2, 9), image: null, prompt: '', params: { ...paramValues.value } }]
      return
    }

    if (smartMultiFrameEnabled.value) {
      await handleSmartMultiFrameGenerate()
      return
    }

    // ── 智能模式（Agent） ──
    if (isSmartMode.value) {
      if (!prompt.value.trim()) {
        if (!isExpanded.value) isExpanded.value = true
        return
      }
      try {
        await runner.ensureCanStartSubmission(1)
        runner.markSubmissionRateWindow(1)
      } catch (e: any) {
        ElMessage.warning(e.message || '当前无法提交生成任务')
        return
      }

      generatingCards.value = [{ url: null, done: false }]
      generatingTotal.value = 1

      await runner.runSmartGeneration({
        prompt: prompt.value,
        selectedSkillId: selectedSkillId.value,
        getCurrentReferenceUrls: getCurrentReferenceUrls,
        generatingCards: generatingCards,
      })
      return
    }

    // ── 单次生成 ──
    if (hasPromptParam.value && !prompt.value.trim()) {
      if (!isExpanded.value) isExpanded.value = true
      return
    }

    const promptText = prompt.value.trim()
    const requestPrompt = hasPromptParam.value ? promptText : undefined

    // 验证文件参数的 min_items / max_items
    const fileParam = fileParamDef.value
    if (fileParam && !smartMultiFrameEnabled.value) {
      const count = refImages.value.length
      if ((fileParam as any).min_items && count < (fileParam as any).min_items) {
        ElMessage.warning(`至少需要上传 ${(fileParam as any).min_items} 张参考图`)
        if (!isExpanded.value) isExpanded.value = true
        return
      }
      if ((fileParam as any).max_items && count > (fileParam as any).max_items) {
        const modelName = selectedModelInfo.value?.display_name || ''
        ElMessage.warning(`模型${modelName ? ' ' + modelName : ''}在${selectedMode.value ? ' ' + selectedMode.value : ''}模式下只支持${(fileParam as any).max_items}个参考`)
        if (!isExpanded.value) isExpanded.value = true
        return
      }
      if ((fileParam as any).sub_params && (fileParam as any).sub_params.length > 1) {
        for (let i = 0; i < (fileParam as any).sub_params.length; i++) {
          const sp = (fileParam as any).sub_params[i]
          if (sp.required && !refImages.value[i]) {
            ElMessage.warning(`请上传${sp.label}`)
            if (!isExpanded.value) isExpanded.value = true
            return
          }
        }
      }
    }

    generationStore.isGenerating = true
    generationStore.progress = 0

    const requestedGenerateCount = normalizeAllowGenerateCountValue(paramValues.value.allow_generate_count)
    const numImagesPerRequest = Number(paramValues.value.num_images || paramValues.value.batch_size || 1) || 1
    const totalExpectedItems = requestedGenerateCount * numImagesPerRequest
    try {
      await runner.ensureCanStartSubmission(requestedGenerateCount)
      runner.markSubmissionRateWindow(requestedGenerateCount)
    } catch (e: any) {
      generationStore.isGenerating = false
      ElMessage.warning(e.message || '当前无法提交生成任务')
      return
    }
    generatingCards.value = Array.from({ length: totalExpectedItems }, () => ({ url: null, done: false }))
    generatingTotal.value = totalExpectedItems

    const capabilities = selectedModelInfo.value?.capabilities || []
    let genType: any = 'image'
    if (capListIncludes(capabilities, 'video_generation')) genType = 'video'
    else if (capListIncludes(capabilities, 'audio_generation')) genType = 'audio'
    else if (capListIncludes(capabilities, 'model_generation')) genType = 'model'

    try {
      let uploadedUrls: string[] = []
      if (hasFileParam.value && refImages.value.length) {
        try {
          uploadedUrls = await resolveRefImageUrls()
        } catch (upErr: any) {
          ElMessage.error('参考图上传失败: ' + (upErr.message || '未知错误'))
          generationStore.isGenerating = false
          generatingCards.value = []
          return
        }
      }

      const { allow_generate_count, ...rawRequestParamValues } = paramValues.value
      const requestParamValues = stripManagedParams(rawRequestParamValues)
      const finalParams = isVirtualModel(selectedModelId.value)
        ? transformVirtualModelParams(selectedModelId.value, requestParamValues)
        : requestParamValues
      const inferredPbrChannel = pendingPbrChannel.value || inferTaskPbrChannel({
        prompt: promptText,
        params: { ...requestParamValues, ...(requestPrompt !== undefined ? { prompt: requestPrompt } : {}) },
      })
      const baseTaskPayload = {
        model_id: selectedModelId.value,
        modelDisplayName: selectedModelInfo.value?.display_name || undefined,
        publisher: selectedModelInfo.value?.publisher as any,
        reference_urls: hasFileParam.value ? getCurrentReferenceUrls() : [],
        prompt: promptText,
        genType,
        totalExpectedItems,
        ...(inferredPbrChannel ? { _textureMaterialChannels: [inferredPbrChannel] } : {}),
      }

      runner.emitGenerateStart(baseTaskPayload)

      const request = {
        capability: selectedCapability.value,
        mode: selectedMode.value || 'standard',
        params: {
          model: selectedModelId.value,
          ...(requestPrompt !== undefined ? { prompt: requestPrompt } : {}),
          ...finalParams,
          ...buildFileParamPayload(uploadedUrls),
        },
      }

      await runner.runGenerationRequests({
        request,
        requestCount: requestedGenerateCount,
        numImagesPerRequest,
        promptText,
        modelId: selectedModelId.value,
        baseTaskPayload,
        generatingCards,
        getCurrentReferenceUrls,
        hasFileParam: hasFileParam.value,
      })
    } catch (e: any) {
      console.error('[GeneratorInput] 生成失败:', e)
      generationStore.isGenerating = false
      const errMsg = extractRequestErrorMessage(e, '生成失败')
      const looksLikeQueueFull =
        (errMsg || '').includes('生成队列') || (errMsg || '').includes('队列已满') || (errMsg || '').includes('只能有')
      if (looksLikeQueueFull) {
        ElMessage.warning(errMsg)
      } else {
        ElMessage.error('生成失败: ' + errMsg)
      }
      emit('generate-error', errMsg)
    }
  }

  function destroySSE() {
    runner.destroySSE()
  }

  /** 生成中卡片的扇形排列样式 */
  function getGenCardStyle(i: number, total: number) {
    const rotations = [-12, -6, 0, 8, 15, -10, 12]
    const rot = rotations[i % rotations.length]
    const offsetY = (total - 1 - i) * 0.75
    const offsetX = rot * 0.15
    return {
      transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rot}deg)`,
      zIndex: i + 1,
      transition: `transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${(total - 1 - i) * 0.04}s`,
    }
  }

  return {
    handleSend,
    handleMultilineBatchGenerate,
    generatingCards,
    generatingTotal,
    getGenCardStyle,
    shouldUseDirectGeneration: runner.shouldUseDirectGeneration,
    ensureQueueCapacity: runner.ensureQueueCapacity,
    ensureCanStartSubmission: runner.ensureCanStartSubmission,
    markSubmissionRateWindow: runner.markSubmissionRateWindow,
    emitGenerateStart: runner.emitGenerateStart,
    startDirectGenerationTask: runner.startDirectGenerationTask,
    runGenerationRequests: runner.runGenerationRequests,
    destroySSE,
    // Re-export helpers that vue file needs
    extractCreatedAigcRecordId: runner.extractCreatedAigcRecordId,
  }
}

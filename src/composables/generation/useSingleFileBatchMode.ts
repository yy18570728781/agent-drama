import { computed, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskQueueStore } from '@/stores/task-queue'
import { setBatchGridGenerationItemRequests } from '@/composables/generation/useBatchGridGenerationMeta'

function resolveGenType(capability: string): string {
  if (capability === 'video_generation') return 'video'
  if (capability === 'audio_generation') return 'audio'
  if (capability === 'model_generation') return 'model'
  return 'image'
}

function cloneRequestPayload(payload: any): any {
  return JSON.parse(JSON.stringify(payload || {}))
}

function collectSourceItems(payload: any): any[] {
  const referenceItems = Array.isArray(payload?.referenceItems) ? payload.referenceItems : []
  return referenceItems
    .map((item: any) => ({
      ...item,
      url: String(item?.url || '').trim(),
      thumb: String(item?.thumb || '').trim(),
      mediaType: String(item?.mediaType || '').trim() || 'image',
      label: String(item?.label || '').trim(),
    }))
    .filter((item: any) => !!item.url)
}

function getSourceItemKey(item: any): string {
  const sourceNodeId = String(item?.sourceNodeId || '').trim()
  if (sourceNodeId) return `node:${sourceNodeId}`
  const url = String(item?.url || '').trim()
  return url ? `url:${url}` : ''
}

function filterReferenceItems(referenceItems: any[], sourceItems: any[]): any[] {
  const sourceKeys = new Set(sourceItems.map(getSourceItemKey).filter(Boolean))
  return referenceItems.filter((item: any) => {
    const key = getSourceItemKey(item)
    return !key || !sourceKeys.has(key)
  })
}

function filterReferenceOrder(order: any, referenceItems: any[]): string[] {
  const keepKeys = new Set(referenceItems.map(getSourceItemKey).filter(Boolean))
  const rawOrder = Array.isArray(order) ? order : []
  return rawOrder
    .map((item: any) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item: string) => !!item && keepKeys.has(item))
}

/**
 * 普通生成面板里的单文件批量模式：多张文件按同一套参数拆成多个独立任务。
 */
export function useSingleFileBatchMode(deps: {
  inputRef: Ref<any>
  onGenerateStart: (task: any) => void
  onQueueTaskAssigned?: (payload: any) => void
  onGenerateCreated: (payload: any) => void
  onGenerateProgress: (payload: any) => void
  onGenerateComplete: (payload: any) => void
  onGenerateError: (message: string, batchInfo?: any) => void
  flowNodeId?: string
  resolveBatchContext?: (() => { batchId?: string; items: any[] } | null) | null
  resolveOrdinaryContext?: (() => { items: any[] } | null) | null
  shouldBlockSend?: (() => boolean) | null
}) {
  const taskQueueStore = useTaskQueueStore()
  const enabled = ref(false)
  const isSubmitting = ref(false)
  const sourceItems = ref<any[]>([])

  const canUse = computed(() => sourceItems.value.length > 1)

  function syncRequestPayload(payload: any): void {
    const batchContext = deps.resolveBatchContext?.() || null
    const ordinaryContext = !batchContext ? (deps.resolveOrdinaryContext?.() || null) : null
    sourceItems.value = batchContext?.items?.length
      ? batchContext.items
      : ordinaryContext?.items?.length
        ? ordinaryContext.items
        : collectSourceItems(payload)
  }

  function handleModeRowStateChange(state: { multilineBatchMode: boolean; smartMultiFrameEnabled: boolean }): void {
    if (state.multilineBatchMode || state.smartMultiFrameEnabled) enabled.value = false
  }

  function toggle(multilineBatchMode: boolean, smartMultiFrameEnabled: boolean, setMultilineBatchMode: (enabled: boolean) => void, setSmartMultiFrameEnabled: (enabled: boolean) => void): void {
    const nextEnabled = !enabled.value
    if (nextEnabled) {
      if (multilineBatchMode) setMultilineBatchMode(false)
      if (smartMultiFrameEnabled) setSmartMultiFrameEnabled(false)
    }
    enabled.value = nextEnabled
  }

  function handleSendCapture(event: MouseEvent): void {
    if (!enabled.value || !canUse.value || isSubmitting.value) return
    const target = event.target instanceof Element ? event.target : null
    const trigger = target?.closest('.generator-send-btn, .collapsed-send-btn')
    if (!trigger) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation?.()
    void send()
  }

  async function send(): Promise<void> {
    if (!canUse.value || isSubmitting.value) return
    if (deps.shouldBlockSend?.()) {
      return
    }
    const generator = deps.inputRef.value
    const requestPayload = generator?.buildCurrentRequestPayload?.()
    if (!requestPayload?.capability || !requestPayload?.params?.model) {
      ElMessage.warning('当前生成参数不完整')
      return
    }

    const batchContext = deps.resolveBatchContext?.() || null
    const ordinaryContext = !batchContext ? (deps.resolveOrdinaryContext?.() || null) : null
    const liveItems = collectSourceItems(requestPayload)
    if (!batchContext?.items?.length && !ordinaryContext?.items?.length) {
      sourceItems.value = liveItems
    }
    const currentItems = batchContext?.items?.length
      ? batchContext.items
      : ordinaryContext?.items?.length
        ? ordinaryContext.items
        : liveItems
    if (!currentItems.length) {
      ElMessage.warning('当前没有可用文件')
      return
    }
    const batchId = String(batchContext?.batchId || '').trim()
    const sharedReferenceItems = filterReferenceItems(liveItems, currentItems)
    const sharedReferenceOrder = filterReferenceOrder(requestPayload?.referenceOrder, sharedReferenceItems)

    const prompt = String(requestPayload?.params?.prompt || '').trim()
    const modelId = String(requestPayload?.params?.model || '').trim()
    const modelDisplayName = String(generator?.selectedModelInfo?.value?.display_name || generator?.selectedModelInfo?.display_name || modelId).trim()
    const genType = resolveGenType(String(requestPayload.capability || '').trim())
    const preparedRequests = currentItems.map((sourceItem: any) => {
      const request = cloneRequestPayload(requestPayload)
      request.referenceItems = sharedReferenceItems.map((item: any) => ({ ...item }))
      if (sharedReferenceOrder.length) {
        request.referenceOrder = [...sharedReferenceOrder]
      } else {
        delete request.referenceOrder
      }
      request.params = {
        ...(request.params || {}),
        file_urls: [String(sourceItem?.url || '').trim()],
      }
      return request
    })
    if (batchId) setBatchGridGenerationItemRequests(batchId, preparedRequests)

    isSubmitting.value = true
    deps.onGenerateStart({
      model_id: modelId,
      modelDisplayName,
      publisher: generator?.selectedModelInfo?.value?.publisher || generator?.selectedModelInfo?.publisher,
      reference_urls: currentItems.map((item: any) => item.url),
      sourceNodeIds: currentItems.map((item: any) => String(item?.sourceNodeId || '').trim()),
      prompt,
      genType,
      totalExpectedItems: currentItems.length,
      ...(batchId ? { _batchGridBatchId: batchId } : {}),
    })

    try {
      for (let index = 0; index < currentItems.length; index += 1) {
        const request = preparedRequests[index]
        const queueRecordId = taskQueueStore.enqueueGeneration({
          request,
          prompt,
          modelInfo: modelId,
          modelDisplayName,
          genType,
          flowNodeId: deps.flowNodeId,
          requestIndex: index,
          callbacks: {
            onCreated: (_recordId, taskId, result) => {
              deps.onGenerateCreated({
                recordId: String(result?.aigc_record_id || result?.record_id || '').trim(),
                taskId,
                queueRecordId: _recordId,
                prompt,
                _requestIndex: index,
                ...(batchId ? { _batchGridBatchId: batchId } : {}),
                modelDisplayName,
                rawResult: result,
                formattedData: result?.formatted_data || null,
              })
            },
            onProgress: (_recordId, _percent, data) => {
              deps.onGenerateProgress({
                ...data,
                queueRecordId: _recordId,
                _requestIndex: index,
                ...(batchId ? { _batchGridBatchId: batchId } : {}),
              })
            },
            onCompleted: (_recordId, result) => {
              deps.onGenerateComplete({
                ...result,
                queueRecordId: _recordId,
                _requestIndex: index,
                ...(batchId ? { _batchGridBatchId: batchId } : {}),
                taskId: result?.taskId || result?.task_id || '',
              })
            },
            onError: (_recordId, message) => {
              deps.onGenerateError(
                message,
                {
                  queueRecordId: _recordId,
                  _requestIndex: index,
                  ...(batchId ? { _batchGridBatchId: batchId } : {}),
                },
              )
            },
          },
        })
        deps.onQueueTaskAssigned?.({
          queueRecordId,
          nodeId: deps.flowNodeId,
          _requestIndex: index,
          ...(batchId ? { _batchGridBatchId: batchId } : {}),
        })
      }
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    enabled,
    canUse,
    isSubmitting,
    syncRequestPayload,
    handleModeRowStateChange,
    toggle,
    handleSendCapture,
    send,
  }
}

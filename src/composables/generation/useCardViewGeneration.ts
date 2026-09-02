import { ref, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskQueueStore } from '@/stores/task-queue'
import { useAssetStore } from '@/stores/assets.store'
import { useGenerationStore } from '@/stores/generation.store'

function normalizeGenerationErrorMessage(error: string): string {
  const message = String(error || '').trim()
  if (message.toLowerCase() === 'insufficient balance') return '积分余额不足，生成失败'
  return message || '生成失败'
}

/**
 * 管理卡片结果页的生成任务状态、结果刷新和用户反馈。
 * @param params 生成输入组件和结果滚动容器引用。
 * @returns 页面生成事件处理器与批量模式桥接状态。
 * @throws 不主动抛出任务错误；生成失败通过任务状态和消息提示反馈。
 */
export function useCardViewGeneration(params: {
  inputRef: ReturnType<typeof ref<any>>
  containerRef: ReturnType<typeof ref<HTMLElement | null>>
}) {
  const taskQueueStore = useTaskQueueStore()
  const assetStore = useAssetStore()
  const generationStore = useGenerationStore()
  const { inputRef, containerRef } = params

  const isBatchMode = ref(false)

  // ── 生成事件 ──
  let _lastGenerateRecordId: number | null = null

  const isGenerating = computed(() => taskQueueStore.hasActiveTasks)

  const onGenerateStart = (_task: any) => {
    _lastGenerateRecordId = null
  }

  const onGenerateCreated = (data: any) => {
    const info = Array.isArray(data) ? data[0] : data
    if (!info) return
    const taskId = info.id || info.task_id
    const existingTask = taskId ? taskQueueStore.findTaskByBackendId(taskId) : undefined
    const emittedRecordId = Number(info.queueRecordId)
    const recordId = existingTask?.id
      || (Number.isFinite(emittedRecordId) && emittedRecordId > 0 ? emittedRecordId : null)
      || _lastGenerateRecordId
    if (!recordId) return
    _lastGenerateRecordId = recordId
    taskQueueStore.updateTask(recordId, {
      taskId,
      prompt: info.prompt || undefined,
      reference_urls: info.reference_urls || [],
      params_display: (info.params_display || []).filter((p: any) => p.key !== 'prompt'),
      modelDisplayName: info.model_display_name || info.model_info?.name || undefined,
      genType: info.capability || info.type || undefined,
    })
  }

  const onGenerateProgress = (data: any) => {
    const recordId = _lastGenerateRecordId
    if (!recordId) return
    let statusText = '生成中...'
    if (data.type === 'intent') {
      statusText = data.message || '意图分析中...'
    } else if (data.type === 'progress' && data.message) {
      statusText = data.message
    } else if (data.current_step && data.total_steps) {
      statusText = `步骤 ${data.current_step}/${data.total_steps}`
    } else if (data.node_id) {
      statusText = `执行: ${data.node_id}`
    } else if (data.message) {
      statusText = data.message
    }
    taskQueueStore.updateTask(recordId, {
      progress: data.percent ?? generationStore.progress,
      statusText,
    })
  }

  const onGenerateComplete = async (_result: unknown) => {
    await assetStore.load()
    ElMessage.success('生成完成')
    nextTick(() => {
      if (containerRef.value) containerRef.value.scrollTop = 0
    })
  }

  const onGenerateError = (error: string) => {
    const message = normalizeGenerationErrorMessage(error)
    const recordId = _lastGenerateRecordId
    if (recordId) {
      taskQueueStore.updateTask(recordId, {
        isGenerating: false,
        status: 'failed',
        statusText: message,
        canCancel: false,
      })
    }
    ElMessage.error(message)
  }

  const onCancelGenerate = (recordId?: number) => {
    generationStore.cancel()
    if (recordId) {
      taskQueueStore.cancelTask(recordId)
    }
  }

  // ── 批量模式 ──
  const onBatchModeChange = (val: boolean) => {
    isBatchMode.value = val
  }

  const closeBatchMode = () => {
    isBatchMode.value = false
    inputRef.value?.exitBatchMode()
  }

  const onBatchModelSelect = (data: any) => {
    inputRef.value?.onModelSelect(data)
  }

  const onBatchCapabilityChange = (capId: string) => {
    inputRef.value?.onCapabilityBarChange(capId)
  }

  const onBatchParamChange = (data: Record<string, any>) => {
    inputRef.value?.onParamChange(data)
  }

  // ── batch computed bridges ──
  const batchModelId = computed(() => inputRef.value?.selectedModelId || '')
  const batchModelInfo = computed(() => inputRef.value?.selectedModelInfo || null)
  const batchCapability = computed(() => inputRef.value?.selectedCapability || 'image_generation')
  const batchMode = computed(() => inputRef.value?.selectedMode || 'standard')
  const batchModes = computed(() => inputRef.value?.availableModes || [])
  const batchModelParams = computed(() => inputRef.value?.modelParams || [])
  const batchParamValues = computed(() => inputRef.value?.paramValues || {})

  return {
    isBatchMode,
    isGenerating,
    _lastGenerateRecordId: () => _lastGenerateRecordId,
    onGenerateStart,
    onGenerateCreated,
    onGenerateProgress,
    onGenerateComplete,
    onGenerateError,
    onCancelGenerate,
    onBatchModeChange,
    closeBatchMode,
    onBatchModelSelect,
    onBatchCapabilityChange,
    onBatchParamChange,
    batchModelId,
    batchModelInfo,
    batchCapability,
    batchMode,
    batchModes,
    batchModelParams,
    batchParamValues,
  }
}

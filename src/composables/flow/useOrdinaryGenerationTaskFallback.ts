import { getTaskStatus, type GenerationTask } from '@/api/generation'
import { extractAigcRecordId, getStatusPresentation } from '@/stores/task-queue/taskQueueShared'

export interface OrdinaryTaskFallbackDeps {
  nodes: { value: any[] }
  emit: (...args: any[]) => void
  findTeamonesAigcRecord?: (recordId: string) => Promise<any>
  applyRecordIdToNodeData: (data: any, recordId: string) => any
  attachTaskIdToGenerationState: (data: any, taskId?: string) => any
}

interface OrdinaryTaskFallbackHelpers {
  applyRecordToExistingResultNode: (nodeId: string, record: any, fallbackRecordId?: string) => Promise<boolean>
}

interface TrackOrdinaryTaskPayload {
  taskId: string
  slotNodeId: string
}

interface TaskFallbackEntry {
  slotNodeId: string
  lastSignalAt: number
  timerId: number | null
  inFlight: boolean
}

const FALLBACK_IDLE_MS = 4000

/**
 * 普通模式占位卡的本地补偿器。
 * 事件静默一段时间后再查 task，避免把 task 查询变成主链。
 */
export function useOrdinaryGenerationTaskFallback(
  deps: OrdinaryTaskFallbackDeps,
  helpers: OrdinaryTaskFallbackHelpers,
) {
  const entries = new Map<string, TaskFallbackEntry>()

  function clearOrdinaryTaskFallback(taskId: string): void {
    const entry = entries.get(taskId)
    if (entry?.timerId != null) window.clearTimeout(entry.timerId)
    entries.delete(taskId)
  }

  function resolveSlotIndex(slotNodeId: string): number {
    return deps.nodes.value.findIndex((node: any) => node.id === slotNodeId)
  }

  function hasResolvedVisualResult(data: any): boolean {
    return !!String(data?.url || data?.thumb || '').trim()
  }

  function scheduleOrdinaryTaskFallback(taskId: string): void {
    const entry = entries.get(taskId)
    if (!entry) return
    if (entry.timerId != null) window.clearTimeout(entry.timerId)
    entry.timerId = window.setTimeout(() => {
      entry.timerId = null
      void pollOrdinaryTaskFallback(taskId)
    }, FALLBACK_IDLE_MS)
  }

  function markOrdinaryTaskSignal(taskId: string): void {
    const entry = entries.get(taskId)
    if (!entry) return
    entry.lastSignalAt = Date.now()
    scheduleOrdinaryTaskFallback(taskId)
  }

  function updateSlotFromTaskStatus(slotNodeId: string, taskId: string, task: GenerationTask): void {
    const slotIdx = resolveSlotIndex(slotNodeId)
    if (slotIdx < 0) return
    const currentNode = deps.nodes.value[slotIdx]
    const currentData = currentNode.data || {}
    const nextState = getStatusPresentation(task)
    const recordId = extractAigcRecordId(task)
    const baseData = recordId
      ? deps.applyRecordIdToNodeData(currentData, recordId)
      : { ...currentData }
    deps.nodes.value[slotIdx] = {
      ...currentNode,
      data: deps.attachTaskIdToGenerationState({
        ...baseData,
        status: nextState.status,
        statusText: nextState.statusText,
        progress: nextState.progress,
        isGenerating: nextState.status !== 'completed' && nextState.status !== 'failed' && nextState.status !== 'cancelled',
        taskId,
        _activeTaskId: taskId,
      }, taskId),
    }
    deps.nodes.value = [...deps.nodes.value]
    deps.emit('update:modelNodes', deps.nodes.value)
  }

  function buildSyntheticRecordFromTask(task: GenerationTask, fallbackRecordId: string): any {
    const info = task?.data?.aigc_record_info || task?.result?.aigc_record_info || (task as any)?.aigc_record_info
    const mediaInfo = task?.data?.media_info || task?.result?.media_info || (task as any)?.media_info
    if (!info && !mediaInfo) return null
    const media = mediaInfo ? [mediaInfo] : []
    return {
      ...(info || {}),
      ...(fallbackRecordId ? { id: fallbackRecordId } : {}),
      media,
    }
  }

  async function applyCompletedTaskToSlot(slotNodeId: string, task: GenerationTask): Promise<boolean> {
    const recordId = extractAigcRecordId(task)
    if (recordId && typeof deps.findTeamonesAigcRecord === 'function') {
      const record = await deps.findTeamonesAigcRecord(recordId).catch(() => null)
      if (record) return helpers.applyRecordToExistingResultNode(slotNodeId, record, recordId)
    }
    const syntheticRecord = buildSyntheticRecordFromTask(task, recordId)
    if (!syntheticRecord) return false
    return helpers.applyRecordToExistingResultNode(slotNodeId, syntheticRecord, recordId)
  }

  async function pollOrdinaryTaskFallback(taskId: string): Promise<void> {
    const entry = entries.get(taskId)
    if (!entry || entry.inFlight) return
    const slotIdx = resolveSlotIndex(entry.slotNodeId)
    if (slotIdx < 0) {
      clearOrdinaryTaskFallback(taskId)
      return
    }
    const slotData = deps.nodes.value[slotIdx]?.data || {}
    if (slotData.status === 'completed' || hasResolvedVisualResult(slotData)) {
      clearOrdinaryTaskFallback(taskId)
      return
    }
    if (Date.now() - entry.lastSignalAt < FALLBACK_IDLE_MS) {
      scheduleOrdinaryTaskFallback(taskId)
      return
    }

    entry.inFlight = true
    try {
      const task = await getTaskStatus(taskId)
      updateSlotFromTaskStatus(entry.slotNodeId, taskId, task)
      if (task.status === 'completed') {
        const applied = await applyCompletedTaskToSlot(entry.slotNodeId, task)
        if (applied) {
          clearOrdinaryTaskFallback(taskId)
          return
        }
      }
      if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'completed') {
        clearOrdinaryTaskFallback(taskId)
        return
      }
    } catch {
      // 事件链仍然是主来源；这里只做静默补偿，不把查询失败再扩散成新错误态。
    } finally {
      const latest = entries.get(taskId)
      if (latest) latest.inFlight = false
    }
    scheduleOrdinaryTaskFallback(taskId)
  }

  function trackOrdinaryTaskFallback(payload: TrackOrdinaryTaskPayload): void {
    const taskId = String(payload.taskId || '').trim()
    const slotNodeId = String(payload.slotNodeId || '').trim()
    if (!taskId || !slotNodeId) return
    clearOrdinaryTaskFallback(taskId)
    entries.set(taskId, {
      slotNodeId,
      lastSignalAt: Date.now(),
      timerId: null,
      inFlight: false,
    })
    scheduleOrdinaryTaskFallback(taskId)
  }

  return {
    trackOrdinaryTaskFallback,
    markOrdinaryTaskSignal,
    clearOrdinaryTaskFallback,
  }
}

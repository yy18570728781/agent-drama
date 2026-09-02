import {
  _parseFetchSSE,
  getTaskStatus,
  subscribeBatchEvents,
  subscribeTaskEvents,
  type TaskSSEEvent,
} from '@/api/generation'
import { getApiBase } from '@/api/client'
import { useAssetStore } from '@/stores/assets.store'
import type { QueueTask, TaskQueueStatus } from './taskQueue.types'
import {
  buildCompletedPayloadFromTaskStatus,
  extractAigcRecordId,
  getStatusPresentation,
} from './taskQueueShared'

interface SubscribeBatchCallbacks {
  onCompleted?: (taskId: string, result: unknown) => void
  onError?: (taskId: string, message: string) => void
  onProgress?: (taskId: string, percent: number, data: unknown) => void
}

interface SubscribeSingleCallbacks {
  onCompleted?: (result: unknown) => void
  onError?: (message: string) => void
  onProgress?: (percent: number, data: unknown) => void
}

interface TaskQueueSseDeps {
  tasks: { value: QueueTask[] }
  updateTask: (id: number, patch: Partial<QueueTask>) => void
  removeTask: (id: number) => void
  sseCleanups: Map<string, () => void>
  acquireSseSlot: () => Promise<() => void>
}

/**
 * Centralizes SSE subscription state so the store can stay focused on task data.
 */
export function createTaskQueueSseManager(deps: TaskQueueSseDeps) {
  function buildElapsed(recordId: number): string | undefined {
    const task = deps.tasks.value.find((item) => item.id === recordId)
    return task?._startTime
      ? `${((Date.now() - task._startTime) / 1000).toFixed(1)}s`
      : undefined
  }

  function subscribeBatch(
    batchId: string,
    eventsUrl: string,
    taskEntries: { taskId: string; recordId: number; prompt: string }[],
    callbacks?: SubscribeBatchCallbacks,
  ) {
    const taskMap = new Map(taskEntries.map((entry) => [entry.taskId, entry.recordId]))
    let completedOrErrorCount = 0
    let innerClose: (() => void) | null = null
    let slotReleased = false
    let cancelled = false
    let releaseFn: (() => void) | null = null
    let reconnectTimer: number | null = null
    let reconnectAttempts = 0
    const totalCount = taskEntries.length
    const maxReconnectAttempts = 3
    const taskLastSeq = new Map<string, number>()
    const terminalTaskIds = new Set<string>()

    const releaseSlot = (): void => {
      if (slotReleased) return
      slotReleased = true
      releaseFn?.()
    }
    const clearReconnectTimer = (): void => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }
    const shouldIgnoreEvent = (taskId: string, event: TaskSSEEvent): boolean => {
      if (!taskId || terminalTaskIds.has(taskId)) return true
      if (typeof event.seq !== 'number') return false
      const lastSeq = taskLastSeq.get(taskId)
      if (typeof lastSeq === 'number' && event.seq <= lastSeq) return true
      taskLastSeq.set(taskId, event.seq)
      const recordId = taskMap.get(taskId)
      if (recordId !== undefined) {
        deps.updateTask(recordId, { _lastSeq: event.seq })
      }
      return false
    }
    const markTaskTerminal = (taskId: string): void => {
      terminalTaskIds.add(taskId)
      completedOrErrorCount += 1
      if (completedOrErrorCount >= totalCount) {
        innerClose?.()
        clearReconnectTimer()
        releaseSlot()
        deps.sseCleanups.delete(batchId)
      }
    }
    const finalizeBatchTaskCompleted = (taskId: string, event: TaskSSEEvent | any): void => {
      if (terminalTaskIds.has(taskId)) return
      const recordId = taskMap.get(taskId)
      if (recordId !== undefined) {
        const aigcRecordId = extractAigcRecordId(event)
        deps.updateTask(recordId, {
          isGenerating: false,
          status: 'completed',
          progress: 100,
          statusText: '已完成',
          elapsed: buildElapsed(recordId),
          _completedResult: event,
          queuePosition: undefined,
          _sseDisconnected: false,
          ...(aigcRecordId ? { aigcRecordId } : {}),
        })
        window.setTimeout(() => deps.removeTask(recordId), 3000)
        try { useAssetStore().markStale() } catch {}
      }
      markTaskTerminal(taskId)
      callbacks?.onCompleted?.(taskId, event)
    }
    const finalizeBatchTaskError = (taskId: string, message: string): void => {
      if (terminalTaskIds.has(taskId)) return
      const recordId = taskMap.get(taskId)
      if (recordId !== undefined) {
        deps.updateTask(recordId, {
          isGenerating: false,
          status: 'failed',
          statusText: message,
          queuePosition: undefined,
          _sseDisconnected: false,
          canCancel: false,
        })
      }
      markTaskTerminal(taskId)
      callbacks?.onError?.(taskId, message)
    }
    const updateBatchTaskRunningState = (taskId: string, event: TaskSSEEvent): void => {
      const recordId = taskMap.get(taskId)
      if (recordId === undefined) return
      const nextState = getStatusPresentation(event)
      const aigcRecordId = extractAigcRecordId(event)
      deps.updateTask(recordId, {
        progress: nextState.progress,
        statusText: nextState.statusText,
        status: nextState.status,
        isGenerating: true,
        queuePosition: nextState.queuePosition,
        _sseDisconnected: false,
        canCancel: event.raw?.can_cancel ?? undefined,
        ...(aigcRecordId ? { aigcRecordId } : {}),
      })
    }
    const scheduleBatchReconnect = (message: string): void => {
      if (cancelled || terminalTaskIds.size >= totalCount) return
      reconnectAttempts += 1
      const recoveringText = reconnectAttempts <= maxReconnectAttempts
        ? `连接中断，正在尝试恢复任务状态 (${reconnectAttempts}/${maxReconnectAttempts})...`
        : '连接中断，正在持续恢复任务状态...'
      for (const entry of taskEntries) {
        if (terminalTaskIds.has(entry.taskId)) continue
        deps.updateTask(entry.recordId, {
          isGenerating: true,
          statusText: recoveringText,
          _sseDisconnected: true,
        })
      }
      clearReconnectTimer()
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        void reconcileBatchDisconnect(message)
      }, Math.min(1000 * Math.max(reconnectAttempts, 1), 5000))
    }
    const reconcileBatchDisconnect = async (message: string): Promise<void> => {
      if (cancelled || terminalTaskIds.size >= totalCount) return
      let hasActiveTask = false
      for (const entry of taskEntries) {
        if (terminalTaskIds.has(entry.taskId)) continue
        try {
          const task = await getTaskStatus(entry.taskId)
          if (cancelled) return
          if (task.status === 'completed') {
            finalizeBatchTaskCompleted(entry.taskId, buildCompletedPayloadFromTaskStatus(task))
            continue
          }
          if (task.status === 'failed' || task.status === 'cancelled') {
            finalizeBatchTaskError(entry.taskId, task.error || task.message || '任务失败')
            continue
          }
          hasActiveTask = true
          const nextState = getStatusPresentation(task)
          deps.updateTask(entry.recordId, {
            status: nextState.status,
            statusText: nextState.statusText,
            progress: nextState.progress,
            isGenerating: true,
            queuePosition: nextState.queuePosition,
            _sseDisconnected: true,
            canCancel: !!task.can_cancel,
          })
        } catch {
          hasActiveTask = true
          deps.updateTask(entry.recordId, {
            isGenerating: true,
            statusText: '连接中断，正在尝试恢复任务状态...',
            _sseDisconnected: true,
          })
        }
      }
      if (terminalTaskIds.size >= totalCount) return
      if (hasActiveTask) {
        scheduleBatchReconnect(message)
        return
      }
      innerClose?.()
      clearReconnectTimer()
      releaseSlot()
      deps.sseCleanups.delete(batchId)
    }

    deps.acquireSseSlot().then((release) => {
      releaseFn = release
      if (cancelled) {
        release()
        return
      }
      innerClose = subscribeBatchEvents(eventsUrl, {
        onStatus: (taskId, event) => {
          if (shouldIgnoreEvent(taskId, event)) return
          reconnectAttempts = 0
          if (event.status === 'completed') return finalizeBatchTaskCompleted(taskId, event)
          if (event.status === 'failed') return finalizeBatchTaskError(taskId, event.message || '任务失败')
          updateBatchTaskRunningState(taskId, event)
        },
        onProgress: (taskId, event) => {
          if (shouldIgnoreEvent(taskId, event)) return
          reconnectAttempts = 0
          if (event.status === 'completed') return finalizeBatchTaskCompleted(taskId, event)
          if (event.status === 'failed') return finalizeBatchTaskError(taskId, event.message || '任务失败')
          updateBatchTaskRunningState(taskId, event)
          callbacks?.onProgress?.(taskId, event.percent || 0, event)
        },
        onCompleted: (taskId, event) => {
          if (shouldIgnoreEvent(taskId, event)) return
          reconnectAttempts = 0
          finalizeBatchTaskCompleted(taskId, event)
        },
        onTaskError: (taskId, event) => {
          if (shouldIgnoreEvent(taskId, event)) return
          reconnectAttempts = 0
          finalizeBatchTaskError(taskId, event.message || event.data?.detail || '任务失败')
        },
        onConnectionError: (message) => {
          void reconcileBatchDisconnect(message || '连接中断，正在尝试恢复任务状态...')
        },
      })
    })

    const close = (): void => {
      cancelled = true
      innerClose?.()
      clearReconnectTimer()
      releaseSlot()
      deps.sseCleanups.delete(batchId)
    }
    deps.sseCleanups.set(batchId, close)
    return close
  }

  function subscribeSingle(
    recordId: number,
    taskId: string,
    eventsUrl?: string,
    callbacks?: SubscribeSingleCallbacks,
  ) {
    let innerClose: (() => void) | null = null
    let slotReleased = false
    let cancelled = false
    let releaseFn: (() => void) | null = null
    let reconnectTimer: number | null = null
    let completionProbeTimer: number | null = null
    let completionProbeAttempts = 0
    let reconnectAttempts = 0
    let sseDisconnectedFlag = false
    const maxReconnectAttempts = 3
    const maxCompletionProbeAttempts = 6

    const applyEventSeq = (event: TaskSSEEvent): boolean => {
      if (typeof event.seq !== 'number') return true
      const current = deps.tasks.value.find((task) => task.id === recordId)
      if (typeof current?._lastSeq === 'number' && event.seq <= current._lastSeq) return false
      deps.updateTask(recordId, { _lastSeq: event.seq })
      return true
    }
    const releaseSlot = (): void => {
      if (slotReleased) return
      slotReleased = true
      releaseFn?.()
    }
    const clearReconnectTimer = (): void => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }
    const clearCompletionProbeTimer = (): void => {
      if (completionProbeTimer !== null) {
        window.clearTimeout(completionProbeTimer)
        completionProbeTimer = null
      }
    }
    const finalizeError = (message: string): void => {
      sseDisconnectedFlag = false
        deps.updateTask(recordId, {
          isGenerating: false,
          status: 'failed',
          statusText: message,
          queuePosition: undefined,
          canCancel: false,
        })
      innerClose?.()
      clearReconnectTimer()
      clearCompletionProbeTimer()
      releaseSlot()
      deps.sseCleanups.delete(taskId)
      try { callbacks?.onError?.(message) } catch {}
    }
    const finalizeCompleted = (data: any): void => {
      sseDisconnectedFlag = false
      const aigcRecordId = extractAigcRecordId(data)
      deps.updateTask(recordId, {
        isGenerating: false,
        status: 'completed',
        progress: 100,
        statusText: '已完成',
        elapsed: buildElapsed(recordId),
        _completedResult: data,
        queuePosition: undefined,
        canCancel: false,
        ...(aigcRecordId ? { aigcRecordId } : {}),
      })
      window.setTimeout(() => deps.removeTask(recordId), 3000)
      try { useAssetStore().markStale() } catch {}
      innerClose?.()
      clearReconnectTimer()
      clearCompletionProbeTimer()
      releaseSlot()
      deps.sseCleanups.delete(taskId)
      try { callbacks?.onCompleted?.(data) } catch {}
    }
    const scheduleCompletionProbe = (): void => {
      if (cancelled || completionProbeTimer !== null) return
      if (completionProbeAttempts >= maxCompletionProbeAttempts) return
      completionProbeAttempts += 1
      completionProbeTimer = window.setTimeout(async () => {
        completionProbeTimer = null
        if (cancelled) return
        try {
          const task = await getTaskStatus(taskId)
          if (cancelled) return
          if (task.status === 'completed') return finalizeCompleted(buildCompletedPayloadFromTaskStatus(task))
          if (task.status === 'failed' || task.status === 'cancelled') return finalizeError(task.error || task.message || '任务失败')
          const nextState = getStatusPresentation(task)
          deps.updateTask(recordId, {
            status: nextState.status,
            statusText: nextState.statusText,
            progress: nextState.progress,
            isGenerating: true,
            queuePosition: nextState.queuePosition,
          })
          if (nextState.progress >= 100) scheduleCompletionProbe()
        } catch {
          scheduleCompletionProbe()
        }
      }, 1500)
    }
    const scheduleReconnect = (message: string): void => {
      if (cancelled) return
      reconnectAttempts += 1
      const current = deps.tasks.value.find((task) => task.id === recordId)
      if (current?.status !== 'completed' && current?.status !== 'failed' && current?.status !== 'cancelled') {
        deps.updateTask(recordId, {
          isGenerating: true,
          status: current?.status === 'waiting_submit' ? 'waiting_submit' : current?.status === 'queued' ? 'queued' : 'running',
          statusText: reconnectAttempts <= maxReconnectAttempts
            ? `连接中断，正在尝试恢复任务状态 (${reconnectAttempts}/${maxReconnectAttempts})...`
            : '连接中断，正在持续恢复任务状态...',
          _sseDisconnected: true,
        })
      }
      clearReconnectTimer()
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        if (reconnectAttempts <= maxReconnectAttempts) {
          openStream()
          return
        }
        void reconcileAfterDisconnect(message)
      }, Math.min(1000 * Math.max(reconnectAttempts, 1), 5000))
    }
    const reconcileAfterDisconnect = async (fallbackMessage: string): Promise<void> => {
      if (cancelled) return
      try {
        const task = await getTaskStatus(taskId)
        if (cancelled) return
        if (task.status === 'completed') return finalizeCompleted(buildCompletedPayloadFromTaskStatus(task))
        if (task.status === 'failed' || task.status === 'cancelled') return finalizeError(task.error || task.message || '任务失败')
        const nextState = getStatusPresentation(task)
        const aigcRecordId = extractAigcRecordId(task)
        deps.updateTask(recordId, {
          status: nextState.status,
          statusText: nextState.statusText,
          progress: nextState.progress,
          isGenerating: true,
          queuePosition: nextState.queuePosition,
          _sseDisconnected: true,
          canCancel: !!task.can_cancel,
          ...(aigcRecordId ? { aigcRecordId } : {}),
        })
        sseDisconnectedFlag = true
        scheduleReconnect(fallbackMessage)
      } catch {
        deps.updateTask(recordId, {
          isGenerating: true,
          statusText: '连接中断，正在尝试恢复任务状态...',
          _sseDisconnected: true,
        })
        sseDisconnectedFlag = true
        scheduleReconnect(fallbackMessage)
      }
    }
    const handleSseMessage = (data: TaskSSEEvent): void => {
      if (!applyEventSeq(data)) return
      reconnectAttempts = 0
      if (sseDisconnectedFlag) {
        sseDisconnectedFlag = false
        deps.updateTask(recordId, { _sseDisconnected: false })
      }
      const current = deps.tasks.value.find((task) => task.id === recordId)
      if (current && (current.status === 'failed' || current.status === 'cancelled' || current.status === 'completed')) return
      switch (data.type) {
        case 'status': {
          if (data.status === 'completed') return finalizeCompleted(data)
          if (data.status === 'failed' || data.status === 'cancelled') return finalizeError(data.message || data.data?.detail || '任务失败')
          const nextState = getStatusPresentation(data)
          const aigcRecordId = extractAigcRecordId(data)
          deps.updateTask(recordId, {
            status: nextState.status,
            statusText: nextState.statusText,
            progress: nextState.progress,
            isGenerating: nextState.status !== 'completed' && nextState.status !== 'failed' && nextState.status !== 'cancelled',
            queuePosition: nextState.queuePosition,
            canCancel: data.raw?.can_cancel ?? undefined,
            ...(aigcRecordId ? { aigcRecordId } : {}),
          })
          return
        }
        case 'progress': {
          if (data.status === 'completed') return finalizeCompleted(data)
          if (data.status === 'failed' || data.status === 'cancelled') return finalizeError(data.message || data.data?.detail || '任务失败')
          const nextState = getStatusPresentation({
            ...data,
            status: data.status || 'running',
          })
          const aigcRecordId = extractAigcRecordId(data)
          deps.updateTask(recordId, {
            progress: nextState.progress,
            statusText: nextState.statusText,
            status: nextState.status,
            isGenerating: true,
            queuePosition: nextState.queuePosition,
            canCancel: data.raw?.can_cancel ?? undefined,
            ...(aigcRecordId ? { aigcRecordId } : {}),
          })
          try { callbacks?.onProgress?.(data.percent || 0, data) } catch {}
          if (nextState.progress >= 100) scheduleCompletionProbe()
          return
        }
        case 'completed':
          finalizeCompleted(data)
          return
        case 'error':
          finalizeError(data.message || '生成失败')
      }
    }
    const handleSseError = (message: string): void => {
      if (cancelled) return
      void reconcileAfterDisconnect(message || '连接中断，正在尝试恢复任务状态...')
    }
    const handleSseEnd = (): void => {
      if (cancelled) return
      const current = deps.tasks.value.find((task) => task.id === recordId)
      if (!current || !current.isGenerating) return
      void reconcileAfterDisconnect('连接中断，正在尝试恢复任务状态...')
    }
    const openStream = (): void => {
      if (cancelled) return
      innerClose?.()
      if (eventsUrl) {
        const fullUrl = eventsUrl.startsWith('http') ? eventsUrl : `${getApiBase()}${eventsUrl}`
        innerClose = _parseFetchSSE(fullUrl, handleSseMessage, handleSseError, handleSseEnd)
        return
      }
      innerClose = subscribeTaskEvents(taskId, {
        onStatus: handleSseMessage,
        onProgress: handleSseMessage,
        onCompleted: handleSseMessage,
        onTaskError: handleSseMessage,
        onConnectionError: handleSseError,
      }, handleSseEnd)
    }

    deps.acquireSseSlot().then((release) => {
      releaseFn = release
      if (cancelled) {
        release()
        return
      }
      openStream()
    })

    const close = (): void => {
      cancelled = true
      innerClose?.()
      clearReconnectTimer()
      clearCompletionProbeTimer()
      releaseSlot()
      deps.sseCleanups.delete(taskId)
    }
    deps.sseCleanups.set(taskId, close)
    return close
  }

  return {
    subscribeBatch,
    subscribeSingle,
  }
}

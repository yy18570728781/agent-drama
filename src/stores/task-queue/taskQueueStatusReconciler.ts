import { getTaskStatus } from '@/api/generation'
import { useAssetStore } from '@/stores/assets.store'
import type { QueueTask } from './taskQueue.types'
import {
  buildCompletedPayloadFromTaskStatus,
  getStatusPresentation,
} from './taskQueueShared'

interface TaskQueueStatusReconcilerDeps {
  tasks: { value: QueueTask[] }
  updateTask: (id: number, patch: Partial<QueueTask>) => void
  removeTask: (id: number) => void
}

export interface TaskQueueReconcileResult {
  outcome: 'completed' | 'failed' | 'active'
  payload?: unknown
  message?: string
}

function buildElapsed(recordId: number, tasks: QueueTask[]): string | undefined {
  const task = tasks.find((item) => item.id === recordId)
  return task?._startTime
    ? `${((Date.now() - task._startTime) / 1000).toFixed(1)}s`
    : undefined
}

/**
 * Creates a status reconciler that treats getTaskStatus as the source of truth.
 * SSE may arrive earlier, but polling must be able to finish every job alone.
 */
export function createTaskQueueStatusReconciler(deps: TaskQueueStatusReconcilerDeps) {
  function isLocalTerminal(recordId: number): boolean {
    const task = deps.tasks.value.find((item) => item.id === recordId)
    return task?.status === 'completed' || task?.status === 'failed' || task?.status === 'cancelled'
  }

  function applyFailedStatus(recordId: number, message: string): void {
    deps.updateTask(recordId, {
      isGenerating: false,
      status: 'failed',
      statusText: message,
      queuePosition: undefined,
      _sseDisconnected: false,
      canCancel: false,
    })
  }

  function applyCompletedStatus(recordId: number, status: any): unknown {
    const payload = buildCompletedPayloadFromTaskStatus(status)
    deps.updateTask(recordId, {
      isGenerating: false,
      status: 'completed',
      progress: 100,
      statusText: '已完成',
      elapsed: buildElapsed(recordId, deps.tasks.value),
      _completedResult: payload,
      queuePosition: undefined,
      _sseDisconnected: false,
      canCancel: false,
    })
    window.setTimeout(() => deps.removeTask(recordId), 3000)
    try { useAssetStore().markStale() } catch {}
    return payload
  }

  function applyActiveStatus(recordId: number, status: any): void {
    const nextState = getStatusPresentation(status)
    deps.updateTask(recordId, {
      status: nextState.status,
      statusText: nextState.statusText,
      progress: nextState.progress,
      isGenerating: true,
      queuePosition: nextState.queuePosition,
      canCancel: !!status.can_cancel,
      _sseDisconnected: false,
    })
  }

  async function reconcileTaskStatus(recordId: number, taskId: string): Promise<TaskQueueReconcileResult> {
    const status = await getTaskStatus(taskId)
    if (status.status === 'completed') {
      return { outcome: 'completed', payload: applyCompletedStatus(recordId, status) }
    }
    if (status.status === 'failed' || status.status === 'cancelled') {
      const message = status.error || status.message || '任务失败'
      applyFailedStatus(recordId, message)
      return { outcome: 'failed', message }
    }
    applyActiveStatus(recordId, status)
    return { outcome: 'active' }
  }

  return {
    isLocalTerminal,
    reconcileTaskStatus,
  }
}

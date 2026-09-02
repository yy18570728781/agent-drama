import type { GenerationTask } from '@/api/generation'
import { getStatusPresentation } from '@/stores/task-queue/taskQueueShared'
import type { QueueTask } from '@/stores/task-queue/taskQueue.types'

type NodeData = Record<string, any>

function normalizeTaskId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

function attachTaskIdToGenState(data: NodeData, taskId: string): NodeData {
  const nextData = { ...data }
  const nextGenState = { ...(nextData._genState || {}) }
  nextGenState.taskId = taskId
  nextGenState.task_id = taskId
  nextData._genState = nextGenState
  return nextData
}

/**
 * Returns the best available task id from workflow node runtime or persisted data.
 * @param data Workflow node data blob
 * @returns Normalized task id or empty string
 */
export function getWorkflowNodeTaskId(data?: NodeData): string {
  return normalizeTaskId(data?._genState?.task_id || data?._genState?.taskId || data?.taskId || data?._activeTaskId)
}

/**
 * Extracts task fields that should survive workflow serialization.
 * @param data Workflow node runtime data
 * @returns Persistable task fields
 */
export function buildPersistedWorkflowTaskData(data?: NodeData): NodeData {
  const taskId = getWorkflowNodeTaskId(data)
  return taskId ? { taskId } : {}
}

/**
 * Reattaches persisted task fields onto runtime node data after workflow hydration.
 * @param source Persisted node data
 * @param runtime Runtime node data created from the workflow definition
 * @returns Runtime node data with task metadata restored
 */
export function applyPersistedWorkflowTaskData(source: NodeData | undefined, runtime: NodeData): NodeData {
  const taskId = getWorkflowNodeTaskId(source)
  if (!taskId) return runtime
  const nextData = attachTaskIdToGenState(runtime || {}, taskId)
  nextData.taskId = taskId
  nextData._activeTaskId = taskId
  return nextData
}

/**
 * Mirrors queue task progress onto a workflow node so refresh can resume its visual state.
 * @param data Current workflow node data
 * @param task Queue task snapshot
 * @returns Updated node data
 */
export function applyQueueTaskToNodeData(data: NodeData, task: Pick<QueueTask, 'taskId' | 'status' | 'progress' | 'statusText'>): NodeData {
  const taskId = normalizeTaskId(task.taskId)
  if (!taskId) return { ...(data || {}) }
  const nextData = attachTaskIdToGenState(data || {}, taskId)
  const active = task.status === 'waiting_submit' || task.status === 'queued' || task.status === 'running'
  nextData.taskId = taskId
  nextData._activeTaskId = active ? taskId : undefined
  nextData.isGenerating = active
  nextData.status = task.status
  nextData.progress = typeof task.progress === 'number' ? task.progress : nextData.progress
  nextData.statusText = task.statusText || nextData.statusText
  if (task.status !== 'failed' && task.status !== 'cancelled') delete nextData.failReason
  if (!active) delete nextData._activeTaskId
  return nextData
}

/**
 * Mirrors backend task status onto a workflow node when queue state is unavailable.
 * @param data Current workflow node data
 * @param task Backend task status response
 * @returns Updated node data
 */
export function applyBackendTaskToNodeData(data: NodeData, task: GenerationTask): NodeData {
  const presentation = getStatusPresentation(task || {})
  return applyQueueTaskToNodeData(data || {}, {
    taskId: task?.task_id,
    status: presentation.status,
    progress: presentation.progress,
    statusText: presentation.statusText,
  })
}

/**
 * Maps AIGC record status to workflow node status for recordId fallback recovery.
 * @param data Current workflow node data
 * @param status Normalized Teamones record status
 * @param statusText Optional backend status text
 * @returns Updated node data
 */
export function applyRecordStatusToNodeData(data: NodeData, status: string, statusText?: string): NodeData {
  const nextData = { ...(data || {}) }
  if (status === 'waiting_submit') {
    nextData.isGenerating = true
    nextData.status = 'waiting_submit'
    nextData.statusText = statusText || '等待提交'
    return nextData
  }
  if (status === 'pending' || status === 'queued') {
    nextData.isGenerating = true
    nextData.status = 'queued'
    nextData.statusText = statusText || '排队中...'
    return nextData
  }
  if (status === 'running') {
    nextData.isGenerating = true
    nextData.status = 'running'
    nextData.statusText = statusText || '生成中...'
    return nextData
  }
  if (status === 'failed' || status === 'cancelled') {
    nextData.isGenerating = false
    nextData.status = 'failed'
    nextData.statusText = statusText || '任务失败'
    return nextData
  }
  return nextData
}

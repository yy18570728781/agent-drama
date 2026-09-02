import type { GenerationTask, TaskSSEEvent } from '@/api/generation'
import type { TaskQueueStatus } from './taskQueue.types'

export function isUploadingPhase(message: string | undefined): boolean {
  if (!message) return false
  return /上传|保存|uploading|saving|cos/i.test(message)
}

interface TaskStatusPresentation {
  status: TaskQueueStatus
  statusText: string
  progress: number
  queuePosition: number | undefined
}

interface TaskStatusSource {
  status?: string
  percent?: number
  progress?: number | { percent?: number; message?: string | null } | null
  progress_detail?: { percent?: number; message?: string | null } | null
  error?: unknown
  message?: string | null
  queue_position?: number | null
}

/**
 * Normalize backend task status fields for queue presentation.
 * @param task Backend task status payload.
 * @returns Stable queue status, progress and display text.
 */
export function getStatusPresentation(task: TaskStatusSource): TaskStatusPresentation {
  const backendStatus = task?.status
  const progressPercent = typeof task?.percent === 'number'
    ? task.percent
    : typeof task?.progress === 'number'
      ? task.progress
      : typeof task?.progress?.percent === 'number'
        ? task.progress.percent
        : typeof task?.progress_detail?.percent === 'number'
          ? task.progress_detail.percent
          : 0
  const detailMessage = task?.progress_detail?.message || task?.message
  const errorMessage = typeof task?.error === 'string' ? task.error : ''
  const queuePosition = typeof task?.queue_position === 'number' ? task.queue_position : undefined

  if (backendStatus === 'completed') {
    return { status: 'completed' as TaskQueueStatus, statusText: '已完成', progress: 100, queuePosition: undefined }
  }
  if (backendStatus === 'failed') {
    return {
      status: 'failed' as TaskQueueStatus,
      statusText: errorMessage || task?.message || '任务失败',
      progress: progressPercent,
      queuePosition: undefined,
    }
  }
  if (backendStatus === 'cancelled') {
    return {
      status: 'cancelled' as TaskQueueStatus,
      statusText: errorMessage || task?.message || '任务已取消',
      progress: progressPercent,
      queuePosition: undefined,
    }
  }
  if (backendStatus === 'waiting_submit') {
    return {
      status: 'waiting_submit' as TaskQueueStatus,
      statusText: task?.message || '等待提交',
      progress: 0,
      queuePosition,
    }
  }
  if (backendStatus === 'queued') {
    return {
      status: 'queued' as TaskQueueStatus,
      statusText: '排队中',
      progress: 0,
      queuePosition,
    }
  }
  return {
    status: 'running' as TaskQueueStatus,
    statusText: detailMessage || '生成中...',
    progress: progressPercent,
    queuePosition: undefined,
  }
}

export function buildCompletedPayloadFromTaskStatus(task: GenerationTask): TaskSSEEvent {
  return {
    code: typeof task.code === 'number' ? task.code : 0,
    type: 'completed',
    task_id: task.task_id,
    status: 'completed',
    percent: typeof task.percent === 'number' ? task.percent : 100,
    message: task.message || '任务完成',
    timestamp: task.timestamp || null,
    seq: typeof task.seq === 'number' ? task.seq : null,
    aigc_record_id: task.aigc_record_id ?? task.data?.aigc_record_id ?? task.result?.aigc_record_id ?? null,
    data: task.data ?? task.result ?? null,
    raw: task,
  }
}

export function extractAigcRecordId(input: any): string {
  return String(
    input?.aigc_record_id
    || input?.data?.aigc_record_id
    || input?.aigc_record_info?.id
    || input?.data?.aigc_record_info?.id
    || ''
  ).trim()
}

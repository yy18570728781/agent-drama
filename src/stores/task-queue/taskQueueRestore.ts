import { getTaskPool, queryTasks, type GenerationTask } from '@/api/generation'
import { appendDebugFileLog } from '@/utils/debugFileLog'
import type { QueueTask, TaskQueuePersistedMeta, TaskQueueStatus } from './taskQueue.types'
import { buildCompletedPayloadFromTaskStatus, extractAigcRecordId, getStatusPresentation } from './taskQueueShared'

interface TaskQueueRestoreDeps {
  tasks: { value: QueueTask[] }
  addTask: (task: QueueTask) => void
  updateTask: (id: number, patch: Partial<QueueTask>) => void
  removeTask: (id: number) => void
  readTaskMetaMap: () => Promise<Record<string, TaskQueuePersistedMeta>>
  syncTaskMetaStorage: () => void
  subscribeSingle: (recordId: number, taskId: string) => unknown
}

const ACTIVE_STATUSES = new Set<TaskQueueStatus>(['waiting_submit', 'queued', 'running'])
const QUERY_BATCH_SIZE = 50
const RESTORE_DEDUPE_MS = 5_000
let restorePromise: Promise<void> | null = null
let restoredAt = 0

function getTaskClientRequestId(task: GenerationTask): string {
  const payload = task as GenerationTask & { client_request_id?: unknown }
  return String(payload.client_request_id || '').trim()
}

/**
 * 合并短时间内由全局任务队列和画布同时触发的运行态恢复。
 * @param restore 实际的任务恢复流程。
 * @returns 当前共享恢复任务；命中短缓存时直接完成。
 */
export function runTaskQueueRestoreOnce(restore: () => Promise<void>): Promise<void> {
  if (restorePromise) return restorePromise
  if (Date.now() - restoredAt < RESTORE_DEDUPE_MS) return Promise.resolve()

  restorePromise = restore()
    .then(() => {
      restoredAt = Date.now()
    })
    .finally(() => {
      restorePromise = null
    })
  return restorePromise
}

function buildTaskPatch(
  task: GenerationTask,
  meta: TaskQueuePersistedMeta,
  fallbackStartTime: number,
): Partial<QueueTask> {
  const nextState = getStatusPresentation(task)
  const aigcRecordId = extractAigcRecordId(task)
  return {
    taskId: String(task.task_id || '').trim(),
    prompt: meta.prompt || '',
    modelInfo: meta.modelInfo || task.model || '',
    modelDisplayName: meta.modelDisplayName || task.model || '',
    aigcRecordId: aigcRecordId || String(meta.aigcRecordId || '').trim() || undefined,
    vendor: meta.vendor || '',
    genType: meta.genType || task.type || 'image',
    progress: nextState.progress,
    status: nextState.status,
    isGenerating: nextState.status === 'waiting_submit' || nextState.status === 'queued' || nextState.status === 'running',
    statusText: nextState.statusText,
    queuePosition: nextState.queuePosition,
    file_urls: Array.isArray(meta.file_urls) ? meta.file_urls : [],
    reference_urls: meta.reference_urls || [],
    params_display: Array.isArray(meta.params_display) ? meta.params_display.filter(item => item.key !== 'prompt') : [],
    _startTime: meta._startTime || fallbackStartTime,
    _flowNodeId: String(meta.flowNodeId || '').trim() || undefined,
    _clientRequestId: getTaskClientRequestId(task) || undefined,
    canCancel: !!task.can_cancel,
    ...(nextState.status === 'completed' ? { _completedResult: buildCompletedPayloadFromTaskStatus(task) } : {}),
  } satisfies Partial<QueueTask>
}

function applyBackendTasks(
  backendTasks: GenerationTask[],
  deps: TaskQueueRestoreDeps,
  taskMetaMap: Record<string, TaskQueuePersistedMeta>,
): void {
  backendTasks.forEach((task, index) => {
    const taskId = String(task.task_id || '').trim()
    if (!taskId) return
    const meta = taskMetaMap[taskId] || {}
    const clientRequestId = getTaskClientRequestId(task)
    const existing = deps.tasks.value.find((item) => (
      item.taskId === taskId || (clientRequestId && item._clientRequestId === clientRequestId)
    ))
    const patch = buildTaskPatch(task, meta, Date.now() + index)
    if (existing) {
      deps.updateTask(existing.id, patch)
      return
    }
    deps.addTask({
      id: Date.now() + Math.round(Math.random() * 10000) + index,
      ...patch,
      prompt: patch.prompt ?? '',
      progress: patch.progress ?? 0,
      status: patch.status ?? 'waiting_submit',
      isGenerating: patch.isGenerating ?? true,
    })
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length ? [items] : []
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

function removeRuntimeTaskByTaskId(deps: TaskQueueRestoreDeps, taskId: string): void {
  const target = deps.tasks.value.find((item) => item.taskId === taskId)
  if (target) deps.removeTask(target.id)
}

async function readActiveTaskPool(): Promise<GenerationTask[]> {
  try {
    const pool = await getTaskPool()
    return [
      ...(pool.tasks.waiting_submit || []),
      ...(pool.tasks.queued || []),
      ...(pool.tasks.running || []),
    ]
  } catch (error) {
    appendDebugFileLog('queue-manager', 'restore-pool-error', { msg: String(error) })
    return []
  }
}

function mergeBackendTasks(groups: GenerationTask[][]): GenerationTask[] {
  const taskMap = new Map<string, GenerationTask>()
  groups.flat().forEach((task) => {
    const taskId = String(task.task_id || '').trim()
    if (taskId) taskMap.set(taskId, task)
  })
  return [...taskMap.values()]
}

/**
 * 刷新恢复：用本地持久化的 task_id 列表批量查询后端任务状态，固定 1 次请求 + M 条 SSE。
 * 并发控制由后端负责，前端不再有本地 pending submission 队列需要恢复。
 * @param deps Task queue state and persistence adapters.
 * @returns Resolves after local state and subscriptions are restored.
 */
export async function restoreTaskQueueRunningState(deps: TaskQueueRestoreDeps): Promise<void> {
  try {
    const taskMetaMap = await deps.readTaskMetaMap()
    const allKeys = Object.keys(taskMetaMap)
    const localTaskIds = allKeys
      .filter((taskId) => taskId && !taskId.startsWith('_byFlowNodeId:'))

    // ① 批量查询所有本地任务（内存命中优先，未命中回查 SQLite，含已完成/失败）
    const batches = chunk(localTaskIds, QUERY_BATCH_SIZE)
    const allTasks: GenerationTask[] = []
    for (const batch of batches) {
      const tasks = await queryTasks(batch)
      allTasks.push(...tasks)
    }

    // 页面可能在创建接口返回 task_id 前刷新；任务池负责接回这类已创建但未落本地的任务。
    const activePoolTasks = await readActiveTaskPool()
    const backendTasks = mergeBackendTasks([allTasks, activePoolTasks])
    applyBackendTasks(backendTasks, deps, taskMetaMap)

    // ② 本地有但服务端未返回的 task_id（被 cleanup / 串号 / 超 7 天）→ 清掉本地
    const serverTaskIds = new Set(
      backendTasks.map((task) => String(task.task_id || '').trim()).filter(Boolean),
    )
    for (const localId of localTaskIds) {
      if (!serverTaskIds.has(localId)) {
        removeRuntimeTaskByTaskId(deps, localId)
      }
    }

    // ③ 活跃任务重订阅 SSE
    deps.tasks.value.forEach((task) => {
      if (!task.taskId) return
      if (ACTIVE_STATUSES.has(task.status)) deps.subscribeSingle(task.id, task.taskId)
    })

    deps.syncTaskMetaStorage()
  } catch (err) {
    appendDebugFileLog('queue-manager', 'restore-error', { msg: String(err) })
  }
}

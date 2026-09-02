import type { QueueTask, TaskQueuePersistedMeta } from '@/stores/task-queue/taskQueue.types'
import type { EnqueueOptions } from '@/stores/task-queue/taskQueue.types'
import type { GenerationParams } from '@/api/generation'
import { getStoredAuthScope } from '@/api/tokenStorage'
import { idbGet, idbRemove, idbSet } from '@/utils/indexedDBStorage'

export interface TaskQueuePersistenceServiceDeps {
  tasks: { value: QueueTask[] }
  addTask: (task: QueueTask) => void
}

export interface PendingSubmissionSnapshot {
  recordId: number
  request: GenerationParams
  opts: EnqueueOptions
  createdAt: number
}

export interface TaskQueuePersistenceServiceApi {
  readTaskMetaMap: () => Promise<Record<string, TaskQueuePersistedMeta>>
  writeTaskMetaMap: (meta: Record<string, TaskQueuePersistedMeta>) => void
  syncTaskMetaStorage: () => void
  savePendingSubmissions: (ownerKey: string, entries: PendingSubmissionSnapshot[]) => void
  readPendingSubmissions: () => Promise<PendingSubmissionSnapshot[]>
  clearPendingSubmissions: (ownerKey: string) => void
}

const TASK_META_SUFFIX = 'flowTaskMeta'
const PENDING_SUBMISSIONS_SUFFIX = 'pendingSubmissions'
const PENDING_SUBMISSION_TTL_MS = 30 * 60 * 1000

/** @returns 当前 Teamones 用户对应的任务恢复作用域键。 */
export function getTaskRecoveryOwnerKey(): string | null {
  const scope = getStoredAuthScope()
  if (!scope) return null
  return `${encodeURIComponent(scope.tenantId)}:${encodeURIComponent(scope.userId)}`
}

function buildScopedKey(ownerKey: string, suffix: string): string {
  return `taskQueue:${ownerKey}:${suffix}`
}

/**
 * taskMetaMap：taskId → 元信息（flowNodeId / 模型 / prompt），用于刷新后按 taskId 批量恢复。
 * pendingSubmissions：提交瞬间缓存请求，createGeneration 返回后清除；
 *   刷新时若有残留 → 使用同一个 _client_request_id 安全重投并接回原任务。
 */
export function createTaskQueuePersistenceService(
  deps: TaskQueuePersistenceServiceDeps,
): TaskQueuePersistenceServiceApi {
  let activeOwnerKey = getTaskRecoveryOwnerKey()

  function activateCurrentOwner(): string | null {
    const ownerKey = getTaskRecoveryOwnerKey()
    if (!ownerKey) return null
    if (activeOwnerKey && activeOwnerKey !== ownerKey) {
      deps.tasks.value = []
    }
    activeOwnerKey = ownerKey
    return ownerKey
  }

  async function readTaskMetaMap(): Promise<Record<string, TaskQueuePersistedMeta>> {
    const ownerKey = activateCurrentOwner()
    if (!ownerKey) return {}
    const storageKey = buildScopedKey(ownerKey, TASK_META_SUFFIX)
    const idbValue = await idbGet<Record<string, TaskQueuePersistedMeta>>(storageKey).catch(() => null)
    if (idbValue && typeof idbValue === 'object' && !Array.isArray(idbValue)) return idbValue
    return {}
  }

  function writeTaskMetaMap(meta: Record<string, TaskQueuePersistedMeta>): void {
    const ownerKey = getTaskRecoveryOwnerKey()
    if (!ownerKey) return
    void idbSet(buildScopedKey(ownerKey, TASK_META_SUFFIX), meta).catch(() => {})
  }

  function syncTaskMetaStorage(): void {
    const meta: Record<string, TaskQueuePersistedMeta> = {}
    for (const task of deps.tasks.value) {
      const taskId = String(task.taskId || '').trim()
      const flowNodeId = String(task._flowNodeId || '').trim()
      if (!flowNodeId) continue
      const taskMeta = {
        flowNodeId,
        prompt: task.prompt || '',
        modelInfo: task.modelInfo || '',
        modelDisplayName: task.modelDisplayName || '',
        aigcRecordId: task.aigcRecordId || '',
        vendor: task.vendor || '',
        genType: task.genType || '',
        file_urls: Array.isArray(task.file_urls) ? [...task.file_urls] : [],
        reference_urls: Array.isArray(task.reference_urls) ? [...task.reference_urls] : [],
        params_display: Array.isArray(task.params_display) ? [...task.params_display] : [],
        _startTime: task._startTime || Date.now(),
      }
      if (taskId) {
        meta[taskId] = taskMeta
      } else {
        meta[`_byFlowNodeId:${flowNodeId}`] = taskMeta
      }
    }
    writeTaskMetaMap(meta)
  }

  function savePendingSubmissions(ownerKey: string, entries: PendingSubmissionSnapshot[]): void {
    if (!entries.length) return
    void idbSet(buildScopedKey(ownerKey, PENDING_SUBMISSIONS_SUFFIX), entries).catch(() => {})
  }

  async function readPendingSubmissions(): Promise<PendingSubmissionSnapshot[]> {
    const ownerKey = activateCurrentOwner()
    if (!ownerKey) return []
    const storageKey = buildScopedKey(ownerKey, PENDING_SUBMISSIONS_SUFFIX)
    const stored = await idbGet<PendingSubmissionSnapshot[]>(storageKey).catch(() => null)
    if (!Array.isArray(stored)) return []
    const now = Date.now()
    const active = stored.filter((item) => (
      Number.isFinite(item.createdAt) && now - item.createdAt <= PENDING_SUBMISSION_TTL_MS
    ))
    if (active.length !== stored.length) {
      if (active.length) void idbSet(storageKey, active).catch(() => {})
      else void idbRemove(storageKey).catch(() => {})
    }
    return active
  }

  function clearPendingSubmissions(ownerKey: string): void {
    void idbRemove(buildScopedKey(ownerKey, PENDING_SUBMISSIONS_SUFFIX)).catch(() => {})
  }

  return {
    readTaskMetaMap,
    writeTaskMetaMap,
    syncTaskMetaStorage,
    savePendingSubmissions,
    readPendingSubmissions,
    clearPendingSubmissions,
  }
}

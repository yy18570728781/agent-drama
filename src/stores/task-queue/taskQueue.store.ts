import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GenerationTask } from '@/api/generation'
import { cancelTask as apiCancelTask, getTaskPool } from '@/api/generation'
import { createTaskQueuePersistenceService } from '@/services/task-queue/taskQueuePersistence.service'
import type {
  TaskQueueStatus,
  QueueTask,
  EnqueueOptions,
  FlowDisplayTaskOptions,
} from './taskQueue.types'
import {
  getStatusPresentation,
  buildCompletedPayloadFromTaskStatus,
} from './taskQueueShared'
import { createTaskQueueSseManager } from './taskQueueSse'
import { createTaskQueueSubmissionManager } from './taskQueueSubmission'
import { restoreTaskQueueRunningState, runTaskQueueRestoreOnce } from './taskQueueRestore'
import { createTaskQueueStatusReconciler } from './taskQueueStatusReconciler'

export const useTaskQueueStore = defineStore('taskQueue', () => {
  const MAX_QUEUE_GENERATIONS = Number.MAX_SAFE_INTEGER
  const SUBMIT_BURST_WINDOW_MS = 20_000
  const SUBMIT_BURST_MAX_TASKS = 10
  const SUBMIT_BLOCK_MS = 10_000
  const TASK_STATUS_POLL_INTERVAL_MS = 30_000
  // ── SSE 连接池：限制并发数，避免浏览器 HTTP/1.1 连接耗尽 ──
  const MAX_CONCURRENT_SSE = 2
  const _activeSSE = ref(0)
  const _sseQueue: Array<() => void> = []

  function _acquireSSESLOT(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (_activeSSE.value < MAX_CONCURRENT_SSE) {
          _activeSSE.value++
          let released = false
          resolve(() => {
            if (released) return
            released = true
            _activeSSE.value--
            if (_sseQueue.length > 0) {
              const next = _sseQueue.shift()!
              next()
            }
          })
        } else {
          _sseQueue.push(tryAcquire)
        }
      }
      tryAcquire()
    })
  }

  const tasks = ref<QueueTask[]>([])
  const submitCooldownUntil = ref(0)
  const currentSubmitCooldownMs = ref(0)
  const _recentSubmitTimestamps = ref<number[]>([])
  const _nowTs = ref(Date.now())
  let _cooldownTimer: number | null = null
  let _taskStatusPollTimer: number | null = null
  let _taskStatusPolling = false
  // SSE cleanup functions - not reactive
  const sseCleanups = new Map<string, () => void>()

  // Computed
  const activeTasks = computed(() => tasks.value.filter(t => t.status === 'waiting_submit' || t.status === 'queued' || t.status === 'running'))
  const hasActiveTasks = computed(() => activeTasks.value.length > 0)
  const activeCount = computed(() => activeTasks.value.length)
  const waitingCount = computed(() => tasks.value.filter(t => t.status === 'waiting_submit').length)
  const queuedCount = computed(() => tasks.value.filter(t => t.status === 'queued').length)
  const generatingCount = computed(() => tasks.value.filter(t => t.status === 'running').length)
  const queueTotalCount = computed(() => tasks.value.filter(t =>
    t.status === 'waiting_submit' || t.status === 'queued' || t.status === 'running',
  ).length)
  const totalPendingCount = computed(() => queueTotalCount.value)
  const submitCooldownRemainingMs = computed(() => Math.max(0, submitCooldownUntil.value - _nowTs.value))
  const isSubmitCoolingDown = computed(() => submitCooldownRemainingMs.value > 0)

  function _pruneRecentSubmissions(now = Date.now()) {
    _recentSubmitTimestamps.value = _recentSubmitTimestamps.value.filter(ts => now - ts <= SUBMIT_BURST_WINDOW_MS)
  }

  function _ensureCooldownTimer() {
    if (_cooldownTimer !== null) return
    _cooldownTimer = window.setInterval(() => {
      _nowTs.value = Date.now()
      _pruneRecentSubmissions(_nowTs.value)
      if (submitCooldownUntil.value <= _nowTs.value && _cooldownTimer !== null) {
        window.clearInterval(_cooldownTimer)
        _cooldownTimer = null
      }
    }, 250)
  }

  function _stopTaskStatusPollTimer() {
    if (_taskStatusPollTimer === null) return
    window.clearInterval(_taskStatusPollTimer)
    _taskStatusPollTimer = null
  }

  function getAvailableWaitingSlots() {
    return Number.MAX_SAFE_INTEGER
  }

  function canEnqueue(count = 1) {
    return count > 0
  }

  function assertCanEnqueue(count = 1) {
    if (count <= 0) return
  }

  function assertSubmitCooldownReady() {
    submitCooldownUntil.value = 0
    currentSubmitCooldownMs.value = 0
  }

  function markSubmitCooldown(taskCount = 1) {
    _recentSubmitTimestamps.value = []
    _nowTs.value = Date.now()
    submitCooldownUntil.value = 0
    currentSubmitCooldownMs.value = 0
  }

  function assertCanStartSubmission(count = 1) {
    assertCanEnqueue(count)
  }

  function addTask(task: QueueTask) {
    tasks.value.push(task)
    _syncTaskMetaStorage()
    _ensureTaskStatusPollTimer()
  }

  function updateTask(id: number, patch: Partial<QueueTask>) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const existing = tasks.value[idx]
    let changed = false
    for (const key of Object.keys(patch) as (keyof QueueTask)[]) {
      if (existing[key] !== patch[key]) {
        changed = true
        break
      }
    }
    if (!changed) return
    tasks.value[idx] = { ...existing, ...patch }
    _syncTaskMetaStorage()
    _ensureTaskStatusPollTimer()
  }

  function markTaskCompletedFromStatus(id: number, task: GenerationTask) {
    const elapsedTask = tasks.value.find(t => t.id === id)
    const elapsed = elapsedTask?._startTime
      ? ((Date.now() - elapsedTask._startTime) / 1000).toFixed(1) + 's'
      : undefined
    updateTask(id, {
      isGenerating: false,
      status: 'completed',
      progress: 100,
      statusText: '已完成',
      elapsed,
      _completedResult: buildCompletedPayloadFromTaskStatus(task),
      queuePosition: undefined,
      canCancel: false,
    })
  }

  function createFlowDisplayTask(opts: FlowDisplayTaskOptions) {
    const id = Date.now() + Math.round(Math.random() * 10000)
    addTask({
      id,
      prompt: String(opts.prompt || '').trim(),
      modelInfo: opts.modelInfo || '',
      modelDisplayName: opts.modelDisplayName || '',
      genType: opts.genType || '',
      progress: 0,
      status: 'waiting_submit',
      isGenerating: true,
      statusText: '等待提交...',
      _flowNodeId: String(opts.flowNodeId || '').trim() || undefined,
      _startTime: Date.now(),
      canCancel: true,
    })
    return id
  }

  function bindTaskBackendId(id: number, taskId: string) {
    const normalizedTaskId = String(taskId || '').trim()
    if (!normalizedTaskId) return
    updateTask(id, { taskId: normalizedTaskId })
  }

  function claimFlowNodeIdForTask(taskId: string, flowNodeId: string) {
    const normalizedTaskId = String(taskId || '').trim()
    const normalizedFlowNodeId = String(flowNodeId || '').trim()
    if (!normalizedTaskId || !normalizedFlowNodeId) return
    const task = tasks.value.find((item) => item.taskId === normalizedTaskId)
    if (!task) return
    if (task._flowNodeId === normalizedFlowNodeId) return
    updateTask(task.id, { _flowNodeId: normalizedFlowNodeId })
  }

  function updateTaskProgressState(id: number, patch: {
    progress?: number
    statusText?: string
    status?: TaskQueueStatus
    isGenerating?: boolean
  }) {
    updateTask(id, patch)
  }

  function markTaskError(id: number, message: string) {
    updateTask(id, {
      isGenerating: false,
      status: 'failed',
      statusText: String(message || '生成失败'),
      queuePosition: undefined,
      canCancel: false,
    })
  }

  function removeTask(id: number) {
    tasks.value = tasks.value.filter(t => t.id !== id)
    _syncTaskMetaStorage()
    _ensureTaskStatusPollTimer()
  }

  function findTaskByBackendId(taskId: string): QueueTask | undefined {
    return tasks.value.find(t => t.taskId === taskId)
  }

  async function cancelTask(id: number) {
    const task = tasks.value.find(t => t.id === id)
    if (task?.taskId) {
      try {
        await apiCancelTask(task.taskId)
      } catch {
        // ignore cancel errors
      }
    }
    removeTask(id)
  }

  function clearCompleted() {
    tasks.value = tasks.value.filter(t => t.status !== 'completed')
    _syncTaskMetaStorage()
    _ensureTaskStatusPollTimer()
  }

  function clearErrors() {
    tasks.value = tasks.value.filter(t => t.status !== 'failed' && t.status !== 'cancelled')
    _syncTaskMetaStorage()
    _ensureTaskStatusPollTimer()
  }

  async function reconcileQueueState() {
    try {
      const pool = await getTaskPool()
      const backendTasks = [
        ...(pool.tasks.waiting_submit || []),
        ...(pool.tasks.queued || []),
        ...(pool.tasks.running || []),
      ]
      const backendTaskIds = new Set(
        backendTasks
          .map((task: any) => task?.task_id)
          .filter(Boolean),
      )

      tasks.value = tasks.value.filter((task) => {
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          return true
        }
        if (task.taskId) {
          return backendTaskIds.has(task.taskId)
        }
        return true // 尚未拿到 taskId 的提交中任务保留
      })

      _syncTaskMetaStorage()
      _refreshQueuePositions()
    } catch {
      // ignore reconcile failures and keep current local queue state
    }
  }

  /** 当 queued 任务开始执行时更新排队位置 */
  function _refreshQueuePositions() {
    const queued = tasks.value.filter(t => t.status === 'queued' || t.status === 'waiting_submit')
    queued.forEach((t, i) => {
      t.queuePosition = i + 1
    })
  }

  // ── 提交队列：限制并发提交数，完成/失败一个提交一个 ──
  const sseManager = createTaskQueueSseManager({
    tasks,
    updateTask,
    removeTask,
    sseCleanups,
    acquireSseSlot: _acquireSSESLOT,
  })
  const {
    readTaskMetaMap: _readTaskMetaMap,
    syncTaskMetaStorage: _syncTaskMetaStorage,
    savePendingSubmissions: _savePendingSubmissions,
    readPendingSubmissions: _readPendingSubmissions,
    clearPendingSubmissions: _clearPendingSubmissions,
  } = createTaskQueuePersistenceService({
    tasks,
    addTask,
  })
  const submissionManager = createTaskQueueSubmissionManager({
    tasks,
    addTask,
    updateTask,
    assertCanEnqueue,
    savePendingSubmissions: _savePendingSubmissions,
    clearPendingSubmissions: _clearPendingSubmissions,
    subscribeSingle: sseManager.subscribeSingle,
  })
  const statusReconciler = createTaskQueueStatusReconciler({
    tasks,
    updateTask,
    removeTask,
  })

  async function _pollActiveTaskStatuses() {
    if (_taskStatusPolling) return
    const active = tasks.value.filter((task) => {
      if (!task.taskId) return false
      return task.status === 'waiting_submit' || task.status === 'queued' || task.status === 'running'
    })
    if (!active.length) {
      _stopTaskStatusPollTimer()
      return
    }
    _taskStatusPolling = true
    try {
      for (const task of active) {
        if (!task.taskId || statusReconciler.isLocalTerminal(task.id)) continue
        await statusReconciler.reconcileTaskStatus(task.id, task.taskId)
      }
    } finally {
      _taskStatusPolling = false
    }
  }

  function _ensureTaskStatusPollTimer() {
    const hasPollableTask = tasks.value.some((task) => (
      !!task.taskId && (task.status === 'waiting_submit' || task.status === 'queued' || task.status === 'running')
    ))
    if (!hasPollableTask) {
      _stopTaskStatusPollTimer()
      return
    }
    if (_taskStatusPollTimer !== null) return
    _taskStatusPollTimer = window.setInterval(() => {
      void _pollActiveTaskStatuses()
    }, TASK_STATUS_POLL_INTERVAL_MS)
    void _pollActiveTaskStatuses()
  }

  /**
   * 提交生成任务（后端负责并发控制）。
   */
  function enqueueGeneration(opts: EnqueueOptions): number {
    return submissionManager.enqueueGeneration(opts)
  }

  /**
   * Subscribe to a batch SSE stream and auto-update task states.
   * Returns a cleanup function.
   */
  function subscribeBatch(
    batchId: string,
    eventsUrl: string,
    taskEntries: { taskId: string; recordId: number; prompt: string }[],
    callbacks?: {
      onCompleted?: (taskId: string, result: any) => void
      onError?: (taskId: string, message: string) => void
      onProgress?: (taskId: string, percent: number, data: any) => void
    },
  ) {
    return sseManager.subscribeBatch(batchId, eventsUrl, taskEntries, callbacks)
  }

  /**
   * Subscribe to a single task SSE stream.
   */
  function subscribeSingle(
    recordId: number,
    taskId: string,
    eventsUrl?: string,
    callbacks?: {
      onCompleted?: (result: any) => void
      onError?: (message: string) => void
      onProgress?: (percent: number, data: any) => void
    },
  ) {
    return sseManager.subscribeSingle(recordId, taskId, eventsUrl, callbacks)
  }

  /**
   * Restore running tasks from server on mount.
   */
  async function restoreRunningTasks() {
    await runTaskQueueRestoreOnce(async () => {
      const pendingSnapshots = await _readPendingSubmissions()
      if (pendingSnapshots.length > 0) {
        submissionManager.resubmitPending(pendingSnapshots)
      }
      await restoreTaskQueueRunningState({
        tasks,
        addTask,
        updateTask,
        removeTask,
        readTaskMetaMap: _readTaskMetaMap,
        syncTaskMetaStorage: _syncTaskMetaStorage,
        subscribeSingle,
      })
      _ensureTaskStatusPollTimer()
    })
  }

  return {
    tasks,
    activeTasks,
    hasActiveTasks,
    activeCount,
    waitingCount,
    queuedCount,
    generatingCount,
    queueTotalCount,
    totalPendingCount,
    MAX_QUEUE_GENERATIONS,
    submitCooldownUntil,
    currentSubmitCooldownMs,
    submitCooldownRemainingMs,
    isSubmitCoolingDown,
    addTask,
    updateTask,
    markTaskCompletedFromStatus,
    createFlowDisplayTask,
    bindTaskBackendId,
    claimFlowNodeIdForTask,
    updateTaskProgressState,
    markTaskError,
    removeTask,
    findTaskByBackendId,
    cancelTask,
    clearCompleted,
    clearErrors,
    reconcileQueueState,
    canEnqueue,
    getAvailableWaitingSlots,
    assertCanEnqueue,
    assertSubmitCooldownReady,
    markSubmitCooldown,
    assertCanStartSubmission,
    enqueueGeneration,
    subscribeBatch,
    subscribeSingle,
    restoreRunningTasks,
  }
})




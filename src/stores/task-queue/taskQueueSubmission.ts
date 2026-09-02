import { createGeneration } from '@/api/generation'
import type { GenerationParams } from '@/api/generation'
import { appendDebugFileLog } from '@/utils/debugFileLog'
import { extractRequestErrorMessage } from '@/utils/requestErrorMessage'
import type { GenerationCallbacks, EnqueueOptions, QueueTask } from './taskQueue.types'
import {
  extractAigcRecordId,
  getStatusPresentation,
} from './taskQueueShared'
import {
  getTaskRecoveryOwnerKey,
  type PendingSubmissionSnapshot,
} from '@/services/task-queue/taskQueuePersistence.service'

export interface TaskQueueSubmissionDeps {
  tasks: { value: QueueTask[] }
  addTask: (task: QueueTask) => void
  updateTask: (id: number, patch: Partial<QueueTask>) => void
  assertCanEnqueue: (count?: number) => void
  savePendingSubmissions: (ownerKey: string, entries: PendingSubmissionSnapshot[]) => void
  clearPendingSubmissions: (ownerKey: string) => void
  subscribeSingle: (
    recordId: number,
    taskId: string,
    eventsUrl?: string,
    callbacks?: {
      onCompleted?: (result: unknown) => void
      onError?: (message: string) => void
      onProgress?: (percent: number, data: unknown) => void
    },
  ) => (() => void) | void
}

interface SubmissionEntry {
  recordId: number
  request: GenerationParams
  callbacks?: GenerationCallbacks
  opts: EnqueueOptions
  ownerKey: string | null
  createdAt: number
}

function extractQueueFileUrls(request: unknown, fallback?: string[]): string[] {
  const params = (request && typeof request === 'object' ? (request as any).params : null)
  const raw = Array.isArray(params?.file_urls) ? params.file_urls : fallback
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function getClientRequestId(request: GenerationParams): string {
  if (!request || typeof request !== 'object') return ''
  const params = 'params' in request && request.params && typeof request.params === 'object'
    ? request.params
    : request
  return String(params._client_request_id || '').trim()
}

function createClientRequestId(): string {
  const randomUuid = globalThis.crypto?.randomUUID
  if (typeof randomUuid === 'function') return randomUuid.call(globalThis.crypto)
  const randomPart = Math.random().toString(36).slice(2)
  return `${Date.now().toString(36)}-${randomPart}-${Math.random().toString(36).slice(2)}`
}

function withClientRequestId(request: GenerationParams): GenerationParams {
  const clientRequestId = createClientRequestId()
  if ('params' in request && request.params && typeof request.params === 'object') {
    return {
      ...request,
      params: { ...request.params, _client_request_id: clientRequestId },
    }
  }
  return { ...request, _client_request_id: clientRequestId }
}

/**
 * 并发控制由后端负责（单用户最多 2 个活跃任务，超出自动进 waiting_submit）。
 * 前端流程：
 *   1. 提交瞬间缓存请求到 IndexedDB（防刷新丢失）
 *   2. POST /api/generations → 拿 taskId
 *   3. addTask（占位卡出生即带 taskId）→ subscribeSingle
 *   4. 成功/失败后立刻清除 pending 缓存
 */
export function createTaskQueueSubmissionManager(deps: TaskQueueSubmissionDeps) {
  const _inFlight = new Map<number, SubmissionEntry>()

  function invokeCallback(name: keyof GenerationCallbacks, entry: SubmissionEntry, args: unknown[]): void {
    const callback = entry.callbacks?.[name] as ((...callbackArgs: any[]) => void) | undefined
    if (!callback) return
    try {
      callback(...args)
    } catch (error: any) {
      appendDebugFileLog('queue-manager', 'callback-error', {
        name,
        error: String(error?.message || error || ''),
      })
    }
  }

  function persistInFlight(ownerKey: string | null): void {
    if (!ownerKey) return
    const snapshots: PendingSubmissionSnapshot[] = []
    for (const entry of _inFlight.values()) {
      if (entry.ownerKey !== ownerKey) continue
      snapshots.push({
        recordId: entry.recordId,
        request: entry.request,
        opts: entry.opts,
        createdAt: entry.createdAt,
      })
    }
    if (snapshots.length) deps.savePendingSubmissions(ownerKey, snapshots)
    else deps.clearPendingSubmissions(ownerKey)
  }

  async function submitOne(entry: SubmissionEntry): Promise<void> {
    const { recordId, request, opts } = entry
    const queueFileUrls = extractQueueFileUrls(request, opts.file_urls || opts.reference_urls)
    const existingTask = deps.tasks.value.find(task => task.id === recordId)
    const baseTask: QueueTask = {
      id: recordId,
      prompt: opts.prompt,
      modelInfo: opts.modelInfo,
      modelDisplayName: opts.modelDisplayName,
      vendor: opts.vendor,
      genType: opts.genType,
      progress: 0,
      status: 'waiting_submit',
      isGenerating: true,
      statusText: '等待提交...',
      file_urls: queueFileUrls,
      reference_urls: opts.reference_urls,
      params_display: opts.params_display,
      _flowNodeId: opts.flowNodeId,
      _requestIndex: Number.isFinite(Number(opts.requestIndex)) ? Number(opts.requestIndex) : undefined,
      _clientRequestId: getClientRequestId(request),
      _startTime: Date.now(),
      canCancel: false,
    }
    if (existingTask) deps.updateTask(recordId, baseTask)
    else deps.addTask(baseTask)

    let result: any
    try {
      result = await createGeneration(request)
    } catch (error: any) {
      _inFlight.delete(recordId)
      persistInFlight(entry.ownerKey)
      if (entry.ownerKey !== getTaskRecoveryOwnerKey()) return
      const message = extractRequestErrorMessage(error, '提交失败')
      deps.updateTask(recordId, {
        prompt: opts.prompt,
        modelInfo: opts.modelInfo,
        modelDisplayName: opts.modelDisplayName,
        vendor: opts.vendor,
        genType: opts.genType,
        progress: 0,
        status: 'failed',
        isGenerating: false,
        statusText: message,
        file_urls: queueFileUrls,
        reference_urls: opts.reference_urls,
        params_display: opts.params_display,
        _flowNodeId: opts.flowNodeId,
        _requestIndex: Number.isFinite(Number(opts.requestIndex)) ? Number(opts.requestIndex) : undefined,
        _startTime: Date.now(),
        canCancel: false,
      })
      appendDebugFileLog('queue-manager', 'submit-error', { error: message })
      invokeCallback('onError', entry, [recordId, message])
      return
    }

    // 拿到响应，立刻从 pending 缓存移除
    _inFlight.delete(recordId)
    persistInFlight(entry.ownerKey)
    if (entry.ownerKey !== getTaskRecoveryOwnerKey()) return

    const taskId = String(result.task_id || result.id || '').trim()
    if (!taskId) {
      deps.updateTask(recordId, {
        prompt: opts.prompt,
        modelInfo: opts.modelInfo,
        modelDisplayName: opts.modelDisplayName,
        vendor: opts.vendor,
        genType: opts.genType,
        progress: 0,
        status: 'failed',
        isGenerating: false,
        statusText: '提交成功但缺少 task_id',
        file_urls: queueFileUrls,
        reference_urls: opts.reference_urls,
        params_display: opts.params_display,
        _flowNodeId: opts.flowNodeId,
        _requestIndex: Number.isFinite(Number(opts.requestIndex)) ? Number(opts.requestIndex) : undefined,
        _startTime: Date.now(),
        canCancel: false,
      })
      appendDebugFileLog('queue-manager', 'submit-error', { error: 'missing task_id' })
      invokeCallback('onError', entry, [recordId, '提交成功但缺少 task_id'])
      return
    }

    const nextState = getStatusPresentation({
      ...(result || {}),
      task_id: taskId,
      status: result?.status || 'waiting_submit',
      percent: typeof result?.percent === 'number' ? result.percent : 0,
    })

    deps.updateTask(recordId, {
      taskId,
      prompt: opts.prompt,
      modelInfo: opts.modelInfo,
      modelDisplayName: opts.modelDisplayName,
      vendor: opts.vendor,
      genType: opts.genType,
      progress: nextState.progress,
      status: nextState.status,
      isGenerating: true,
      statusText: nextState.statusText,
      queuePosition: nextState.queuePosition,
      file_urls: queueFileUrls,
      reference_urls: opts.reference_urls,
      params_display: opts.params_display,
      _flowNodeId: opts.flowNodeId,
      _requestIndex: Number.isFinite(Number(opts.requestIndex)) ? Number(opts.requestIndex) : undefined,
      _startTime: Date.now(),
      canCancel: true,
      ...(extractAigcRecordId(result) ? { aigcRecordId: extractAigcRecordId(result) } : {}),
    })

    invokeCallback('onCreated', entry, [recordId, taskId, result])

    let done = false
    let closeSse: (() => void) | void
    const finish = (): boolean => {
      if (done) return false
      done = true
      if (typeof closeSse === 'function') closeSse()
      return true
    }
    closeSse = deps.subscribeSingle(recordId, taskId, result.events_url, {
      onProgress: (percent, data) => {
        invokeCallback('onProgress', entry, [recordId, percent, data])
      },
      onCompleted: (payload) => {
        if (!finish()) return
        invokeCallback('onCompleted', entry, [recordId, payload])
      },
      onError: (message) => {
        if (!finish()) return
        invokeCallback('onError', entry, [recordId, message])
      },
    })
  }

  function enqueueGeneration(opts: EnqueueOptions): number {
    deps.assertCanEnqueue(1)
    const recordId = Date.now() + Math.round(Math.random() * 10000)
    const entry: SubmissionEntry = {
      recordId,
      request: withClientRequestId(opts.request),
      callbacks: opts.callbacks,
      opts,
      ownerKey: getTaskRecoveryOwnerKey(),
      createdAt: Date.now(),
    }
    _inFlight.set(recordId, entry)
    persistInFlight(entry.ownerKey)
    void submitOne(entry)
    return recordId
  }

  /** 刷新后只重投带稳定幂等键的请求；旧版无幂等键快照直接丢弃。 */
  function resubmitPending(snapshots: PendingSubmissionSnapshot[]): void {
    const ownerKey = getTaskRecoveryOwnerKey()
    if (!ownerKey || snapshots.length === 0) return
    let discardedCount = 0
    for (const snap of snapshots) {
      if (_inFlight.has(snap.recordId)) continue
      if (!getClientRequestId(snap.request)) {
        discardedCount += 1
        continue
      }
      const entry: SubmissionEntry = {
        recordId: snap.recordId,
        request: snap.request,
        callbacks: snap.opts.callbacks,
        opts: snap.opts,
        ownerKey,
        createdAt: snap.createdAt,
      }
      _inFlight.set(snap.recordId, entry)
      void submitOne(entry)
    }
    persistInFlight(ownerKey)
    if (discardedCount) {
      appendDebugFileLog('queue-manager', 'discard-legacy-pending-after-reload', {
        count: discardedCount,
      })
    }
  }

  return {
    enqueueGeneration,
    resubmitPending,
  }
}

import client, { getApiBase, authFetch } from './client'

export interface LegacyGenerationParams {
  prompt: string
  model?: string
  capability?: string
  mode?: string
  vendor?: string | null
  negative_prompt?: string
  seed?: number
  n?: number
  duration?: number
  image_urls?: string[]
  vendor_hint?: string
  [key: string]: any
}

export interface GenerationRequestPayload {
  capability: string
  mode?: string
  vendor?: string | null
  params: Record<string, any>
}

export type GenerationParams = GenerationRequestPayload | LegacyGenerationParams

export interface GenerationVendorRequestPreview {
  request_type: string
  method?: string | null
  url?: string | null
  headers?: Record<string, string> | null
  body?: any
  followup?: Record<string, any> | null
  notes?: string[]
}

export interface GenerationPreviewResult {
  valid: boolean
  task_type?: string | null
  resolved_model_id?: string | null
  resolved_mode?: string | null
  resolved_vendor?: string | null
  request: GenerationRequestPayload
  resolved_params?: Record<string, any> | null
  vendor_request?: GenerationVendorRequestPreview | null
  warnings: string[]
  errors: string[]
}

export type TaskBackendStatus = 'waiting_submit' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type TaskSSEType = 'status' | 'progress' | 'completed' | 'error'

export interface GenerationTask {
  task_id: string
  status: TaskBackendStatus
  type?: 'image' | 'video' | 'model' | 'audio'
  model?: string
  code?: number
  percent?: number
  message?: string | null
  timestamp?: string | null
  seq?: number | null
  data?: any
  progress?: number
  progress_detail?: {
    percent: number
    message?: string | null
  } | null
  result?: any
  error?: any
  created_at?: string
  started_at?: string | null
  completed_at?: string | null
  aigc_record_id?: string | null
  platform_task_id?: string | number | null
  queue_position?: number | null
  can_cancel?: boolean
}

function isGenerationRequestPayload(value: GenerationParams): value is GenerationRequestPayload {
  return !!value && typeof value === 'object' && typeof value.capability === 'string' && !!value.params && typeof value.params === 'object' && !Array.isArray(value.params)
}

function sanitizeGenerationRequestParams(params: Record<string, any> | undefined | null): Record<string, any> {
  const nextParams = params && typeof params === 'object' && !Array.isArray(params)
    ? { ...params }
    : {}
  delete nextParams.task_id
  delete nextParams.query_id
  delete nextParams.vendor
  return nextParams
}

function normalizeGenerationRequest(request: GenerationParams): GenerationRequestPayload {
  if (isGenerationRequestPayload(request)) {
    return {
      capability: request.capability || 'image_generation',
      ...(request.mode ? { mode: request.mode } : {}),
      ...(request.vendor !== undefined ? { vendor: request.vendor } : {}),
      params: sanitizeGenerationRequestParams(request.params),
    }
  }

  const {
    capability,
    mode,
    vendor,
    ...params
  } = request

  return {
    capability: capability || 'image_generation',
    ...(mode ? { mode } : {}),
    ...(vendor !== undefined ? { vendor } : {}),
    params: sanitizeGenerationRequestParams(params),
  }
}

function extractProgressPercent(progress: any): number | undefined {
  if (typeof progress === 'number') return progress
  if (progress && typeof progress === 'object' && typeof progress.percent === 'number') {
    return progress.percent
  }
  return undefined
}

export interface TaskPoolResponse {
  limits: {
    active_max: number
  }
  counts: Record<TaskBackendStatus, number>
  tasks: Partial<Record<'waiting_submit' | 'queued' | 'running', GenerationTask[]>>
}

export interface TaskSSEEvent {
  code?: number
  type: TaskSSEType
  task_id: string
  status: TaskBackendStatus
  percent?: number
  message?: string | null
  timestamp?: string | null
  seq?: number | null
  data?: any
  aigc_record_id?: string | number | null
  platform_task_id?: string | number | null
  query_id?: string | number | null
  batch_id?: string | null
  raw?: any
}

function normalizeTaskSSEEvent(raw: any): TaskSSEEvent {
  const payload = raw || {}
  const nestedData = payload?.data
  const status = payload.status || 'waiting_submit'
  const type = payload.type || (status === 'failed' || status === 'cancelled' ? 'error' : status === 'completed' ? 'completed' : 'status')
  const percent = typeof payload.percent === 'number'
    ? payload.percent
    : extractProgressPercent(payload.progress)

  return {
    code: typeof payload.code === 'number' ? payload.code : undefined,
    type,
    task_id: payload.task_id || '',
    status,
    percent,
    message: typeof payload.message === 'string' ? payload.message : null,
    timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : null,
    seq: typeof payload.seq === 'number' ? payload.seq : null,
    data: nestedData ?? null,
    aigc_record_id: payload.aigc_record_id ?? nestedData?.aigc_record_id ?? null,
    platform_task_id: payload.platform_task_id ?? nestedData?.platform_task_id ?? null,
    query_id: payload.platform_task_id ?? nestedData?.platform_task_id ?? payload.query_id ?? nestedData?.query_id ?? null,
    batch_id: payload.batch_id ?? null,
    raw: payload,
  }
}

function normalizeGenerationTask(raw: any): GenerationTask {
  const payload = raw?.data || raw || {}
  const progressPercent = typeof payload.percent === 'number'
    ? payload.percent
    : extractProgressPercent(payload.progress)
  const progressDetail = payload.progress && typeof payload.progress === 'object'
    ? {
        percent: typeof payload.progress.percent === 'number' ? payload.progress.percent : 0,
        message: typeof payload.progress.message === 'string' ? payload.progress.message : null,
      }
    : progressPercent !== undefined
      ? { percent: progressPercent, message: null }
      : null

  return {
    ...payload,
    status: payload.status || 'waiting_submit',
    code: typeof payload.code === 'number' ? payload.code : undefined,
    percent: progressPercent,
    message: typeof payload.message === 'string'
      ? payload.message
      : typeof progressDetail?.message === 'string'
        ? progressDetail.message
        : null,
    timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : null,
    seq: typeof payload.seq === 'number' ? payload.seq : null,
    data: payload.data ?? null,
    progress: progressPercent,
    progress_detail: progressDetail,
    result: payload.result ?? payload.data ?? null,
    error: payload.error?.message || payload.error || payload.data?.detail || (payload.status === 'failed' ? payload.message : null) || null,
  }
}

/**
 * POST /api/generations
 * 创建生成任务，请求头需带 Prefer: respond-async
 * 返回 task_id 用于后续 SSE 订阅
 */
export async function createGeneration(params: GenerationParams): Promise<any> {
  const payload = normalizeGenerationRequest(params)
  const { data } = await client.post('/api/generations', payload, {
    headers: {
      'Prefer': 'respond-async'
    },
    timeout: 120000,
  })
  return data?.data || data
}

/**
 * POST /api/generations/preview
 * 预览生成请求的最终解析结果
 */
export async function previewGeneration(request: GenerationRequestPayload): Promise<GenerationPreviewResult> {
  const { data } = await client.post('/api/generations/preview', request)
  return data?.data || data
}

/**
 * POST /api/batch_generations
 * 批量创建生成任务
 * 返回 batch_id 和 task_ids 列表
 */
export async function createBatchGenerations(requests: GenerationParams[]): Promise<{
  batch_id: string
  task_ids: string[]
  count: number
  events_url: string
}> {
  const payload = requests.map(normalizeGenerationRequest)
  const { data } = await client.post('/api/batch_generations', payload)
  return data?.data || data
}

/** GET /api/tasks/{task_id} — 查询任务状态 */
export async function getTaskStatus(taskId: string): Promise<GenerationTask> {
  const { data } = await client.get(`/api/tasks/${encodeURIComponent(taskId)}`)
  return normalizeGenerationTask(data)
}

const queryTasksRequests = new Map<string, Promise<GenerationTask[]>>()
const queryTasksCache = new Map<string, { value: GenerationTask[]; expiresAt: number }>()
const QUERY_TASKS_CACHE_TTL_MS = 1000

function getQueryTasksCacheKey(ids: string[]): string {
  return JSON.stringify([...new Set(ids)].sort())
}

/**
 * POST /api/tasks/query — 按 task_id 列表批量查询任务状态
 * 内存命中优先，未命中回查 SQLite（7 天内可查），字段结构与 GET /api/tasks/{id} 一致。
 * 找不到的 id 不会出现在返回结果里。
 * 单次上限 50 个 id，超过需调用方分批。
 */
export async function queryTasks(ids: string[]): Promise<GenerationTask[]> {
  if (!ids.length) return []
  const cacheKey = getQueryTasksCacheKey(ids)
  const cached = queryTasksCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const pending = queryTasksRequests.get(cacheKey)
  if (pending) return pending

  const request = client.post('/api/tasks/query', { ids })
    .then(({ data }) => {
      const payload = data?.data || data || {}
      const tasks = Array.isArray(payload?.tasks) ? payload.tasks : []
      const value = tasks.map(normalizeGenerationTask)
      queryTasksCache.set(cacheKey, { value, expiresAt: Date.now() + QUERY_TASKS_CACHE_TTL_MS })
      return value
    })
    .finally(() => {
      queryTasksRequests.delete(cacheKey)
    })
  queryTasksRequests.set(cacheKey, request)
  return request
}

/** GET /api/tasks/pool — 查询当前用户任务池快照 */
export async function getTaskPool(): Promise<TaskPoolResponse> {
  const { data } = await client.get('/api/tasks/pool')
  const payload = data?.data || data || {}
  return {
    limits: {
      active_max: Number(payload?.limits?.active_max || 0),
    },
    counts: {
      waiting_submit: Number(payload?.counts?.waiting_submit || 0),
      queued: Number(payload?.counts?.queued || 0),
      running: Number(payload?.counts?.running || 0),
      completed: Number(payload?.counts?.completed || 0),
      failed: Number(payload?.counts?.failed || 0),
      cancelled: Number(payload?.counts?.cancelled || 0),
    },
    tasks: {
      waiting_submit: Array.isArray(payload?.tasks?.waiting_submit)
        ? payload.tasks.waiting_submit.map(normalizeGenerationTask)
        : [],
      queued: Array.isArray(payload?.tasks?.queued)
        ? payload.tasks.queued.map(normalizeGenerationTask)
        : [],
      running: Array.isArray(payload?.tasks?.running)
        ? payload.tasks.running.map(normalizeGenerationTask)
        : [],
    },
  }
}

/** POST /api/tasks/{task_id}/cancel — 取消任务 */
export async function cancelTask(taskId: string): Promise<void> {
  await client.post(`/api/tasks/${encodeURIComponent(taskId)}/cancel`)
}

/** SSE 事件回调 */
export interface SSECallbacks {
  onStatus?: (event: TaskSSEEvent) => void
  onProgress?: (event: TaskSSEEvent) => void
  onCompleted?: (event: TaskSSEEvent) => void
  onTaskError?: (event: TaskSSEEvent) => void
  onConnectionError?: (message: string) => void
}

/** 批量 SSE 事件回调 */
export interface BatchSSECallbacks {
  onStatus?: (taskId: string, event: TaskSSEEvent) => void
  onProgress?: (taskId: string, event: TaskSSEEvent) => void
  onCompleted?: (taskId: string, event: TaskSSEEvent) => void
  onTaskError?: (taskId: string, event: TaskSSEEvent) => void
  onConnectionError?: (message: string) => void
}

/**
 * 通用 fetch SSE 解析器（使用 Teamones access_token 认证）
 * 使用 fetch + ReadableStream 替代 EventSource（后者不支持自定义 header）
 */
export function _parseFetchSSE(
  url: string,
  onMessage: (data: any) => void,
  onError: (msg: string) => void,
  onEnd?: () => void,
): () => void {
  const abortController = new AbortController()

  ;(async () => {
    try {
      const response = await authFetch(url, {
        signal: abortController.signal,
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })
      if (!response.ok || !response.body) {
        onError(`SSE 连接失败 (${response.status})`)
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          onEnd?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split(/\r?\n\r?\n/)
        buffer = chunks.pop() || ''

        for (const chunk of chunks) {
          const lines = chunk.split(/\r?\n/)
          const dataLines = lines
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith(':') && line.startsWith('data:'))

          if (!dataLines.length) continue

          const payload = dataLines
            .map((line) => line.slice(5).trimStart())
            .join('\n')

          try {
            const data = JSON.parse(payload)
            onMessage(data)
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('SSE error:', e)
        onError('SSE 连接失败')
      }
    }
  })()

  return () => abortController.abort()
}


/**
 * 订阅任务的 SSE 事件流
 * GET /api/tasks/{task_id}/events
 * @param taskId 任务 ID
 * @param callbacks 事件回调
 * @returns 返回关闭 SSE 连接的函数
 */
export function subscribeTaskEvents(taskId: string, callbacks: SSECallbacks, onEnd?: () => void): () => void {
  const url = `${getApiBase()}/api/tasks/${taskId}/events`
  let closed = false

  const close = _parseFetchSSE(
    url,
    (rawData) => {
      if (closed) return
      const event = normalizeTaskSSEEvent(rawData)
      switch (event.type) {
        case 'status':
          callbacks.onStatus?.(event)
          break
        case 'progress':
          callbacks.onProgress?.(event)
          break
        case 'completed':
          callbacks.onCompleted?.(event)
          closed = true
          close()
          break
        case 'error':
          callbacks.onTaskError?.(event)
          closed = true
          close()
          break
      }
    },
    (msg) => {
      if (!closed) callbacks.onConnectionError?.(msg)
    },
    onEnd,
  )

  return close
}

/**
 * 订阅批量任务的 SSE 事件流
 * GET /api/batches/{batch_id}/events
 * @param eventsUrl 事件流 URL (如 /api/batches/batch_xxx/events)
 * @param callbacks 事件回调
 * @returns 返回关闭 SSE 连接的函数
 */
export function subscribeBatchEvents(eventsUrl: string, callbacks: BatchSSECallbacks): () => void {
  const fullUrl = eventsUrl.startsWith('http') ? eventsUrl : `${getApiBase()}${eventsUrl}`

  return _parseFetchSSE(
    fullUrl,
    (rawData) => {
      const event = normalizeTaskSSEEvent(rawData)
      const taskId = event.task_id
      switch (event.type) {
        case 'status':
          callbacks.onStatus?.(taskId, event)
          break
        case 'progress':
          callbacks.onProgress?.(taskId, event)
          break
        case 'completed':
          callbacks.onCompleted?.(taskId, event)
          break
        case 'error':
          callbacks.onTaskError?.(taskId, event)
          break
      }
    },
    (msg) => {
      callbacks.onConnectionError?.(msg)
    },
  )
}

/** 全局事件回调 */
export interface GlobalEventCallbacks {
  onEvent?: (event: { type: string; data: any }) => void
  onConnected?: () => void
  onError?: (message: string) => void
}

/**
 * 订阅全局 SSE 事件流
 * GET /api/events
 *
 * 接收 MCP 工具调用（如 generate_image）和系统广播事件。
 * 断线后 5 秒自动重连。
 *
 * @param callbacks 事件回调
 * @returns 返回关闭 SSE 连接的函数
 */
export function subscribeGlobalEvents(callbacks: GlobalEventCallbacks): () => void {
  let stopped = false
  let currentClose: (() => void) | null = null

  function connect() {
    if (stopped) return

    currentClose = _parseFetchSSE(
      `${getApiBase()}/api/events`,
      (data) => {
        if (data.type === 'connected') {
          callbacks.onConnected?.()
          return
        }
        callbacks.onEvent?.(data)
      },
      (msg) => {
        callbacks.onError?.(msg || '全局 SSE 连接断开，正在重连...')
        if (!stopped) {
          setTimeout(connect, 5000)
        }
      },
    )
  }

  connect()

  return () => {
    stopped = true
    currentClose?.()
  }
}

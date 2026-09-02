import axios from 'axios'
import { withWorkerRetry } from '@/services/generation/topazProcess.constants'
import type {
  TopazModelsResponse,
  PresetListResponse,
  PresetDetail,
  EstimateResponse,
  UploadResponse,
  RunAsyncResponse,
  ProcessResultResponse,
  ProcessProgressData,
} from '@/services/generation/topazProcess.types'

const service = axios.create({
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

function resolveBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export async function fetchHealth(): Promise<{ status: string }> {
  return withWorkerRetry((base) =>
    service.get(`${resolveBase(base)}/health`).then((r) => r.data),
  )
}

export async function fetchModels(): Promise<TopazModelsResponse> {
  return withWorkerRetry((base) =>
    service.get(`${resolveBase(base)}/models`).then((r) => r.data),
  )
}

export async function fetchPresets(): Promise<PresetListResponse> {
  return withWorkerRetry((base) =>
    service.get(`${resolveBase(base)}/presets`).then((r) => r.data),
  )
}

export async function fetchPresetDetail(name: string): Promise<PresetDetail> {
  return withWorkerRetry((base) =>
    service
      .get(`${resolveBase(base)}/presets/${encodeURIComponent(name)}`)
      .then((r) => r.data),
  )
}

export async function uploadVideo(
  baseUrl: string,
  file: File,
): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await service.post(`${resolveBase(baseUrl)}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function runAsync(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<RunAsyncResponse> {
  const { data } = await service.post(
    `${resolveBase(baseUrl)}/run_async`,
    params,
  )
  return data
}

export async function fetchResult(
  baseUrl: string,
  taskId: string,
): Promise<ProcessResultResponse> {
  const { data } = await service.get(
    `${resolveBase(baseUrl)}/result/${encodeURIComponent(taskId)}`,
  )
  return data
}

interface EstimatePayload {
  video_url: string
  video_path: string
  topaz_model: string
  topaz_path: string
}

export async function estimateParams(
  baseUrl: string,
  payload: EstimatePayload,
): Promise<EstimateResponse> {
  const { data } = await service.post(
    `${resolveBase(baseUrl)}/estimate`,
    payload,
  )
  return data
}

/**
 * 查询任务状态（GET /status/{task_id}），用于 SSE 断线后回退轮询。
 */
async function fetchStatus(
  baseUrl: string,
  taskId: string,
): Promise<ProcessProgressData & { file_url?: string }> {
  const { data } = await service.get(
    `${resolveBase(baseUrl)}/status/${encodeURIComponent(taskId)}`,
  )
  return data
}

const POLL_INTERVAL_MS = 2000

/**
 * 订阅任务进度 SSE，返回关闭函数。
 * SSE 断线时自动回退到轮询 /status/{task_id}，避免连接关闭导致的时序竞争。
 */
export function subscribeProgress(
  baseUrl: string,
  taskId: string,
  onMessage: (data: ProcessProgressData) => void,
  onError?: (err: Event) => void,
): () => void {
  const url = `${resolveBase(baseUrl)}/progress/${encodeURIComponent(taskId)}`
  let cancelled = false
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  const source = new EventSource(url)

  function startPolling() {
    if (cancelled || pollTimer) return
    const poll = async () => {
      if (cancelled) return
      try {
        const status = await fetchStatus(baseUrl, taskId)
        if (cancelled) return
        onMessage({
          status: status.status,
          progress: status.progress,
          message: status.message,
          current_frame: 0,
          total_frames: 0,
        })
        if (status.status !== 'completed' && status.status !== 'error') {
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch {
        if (!cancelled) {
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      }
    }
    poll()
  }

  source.onmessage = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data) as ProcessProgressData
      onMessage(parsed)
    } catch {
      /* ignore parse errors */
    }
  }

  source.onerror = () => {
    source.close()
    if (cancelled) return
    startPolling()
  }

  return () => {
    cancelled = true
    if (pollTimer) clearTimeout(pollTimer)
    source.close()
  }
}

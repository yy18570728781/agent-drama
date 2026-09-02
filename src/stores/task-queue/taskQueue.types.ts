export type TaskQueueStatus = 'waiting_submit' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface QueueTask {
  id: number
  prompt: string
  modelInfo?: string
  modelDisplayName?: string
  aigcRecordId?: string
  vendor?: string
  genType?: string
  progress: number
  status: TaskQueueStatus
  isGenerating: boolean
  statusText?: string
  elapsed?: string
  params_display?: { label: string; key: string; value: any }[]
  file_urls?: string[]
  reference_urls?: string[]
  taskId?: string
  queuePosition?: number
  _startTime?: number
  _flowNodeId?: string
  _requestIndex?: number
  _clientRequestId?: string
  _completedResult?: any
  _sseDisconnected?: boolean
  _lastSeq?: number
  canCancel?: boolean
}

export interface GenerationCallbacks {
  onCreated?: (recordId: number, taskId: string, result: any) => void
  onProgress?: (recordId: number, percent: number, data: any) => void
  onCompleted?: (recordId: number, result: any) => void
  onError?: (recordId: number, message: string) => void
}

export interface TaskQueuePersistedMeta {
  _startTime?: number
  aigcRecordId?: string | number
  file_urls?: string[]
  flowNodeId?: string | number
  genType?: string
  modelDisplayName?: string
  modelInfo?: string
  params_display?: QueueTask['params_display']
  prompt?: string
  reference_urls?: string[]
  vendor?: string
}

export interface EnqueueOptions {
  request: any
  prompt: string
  modelInfo?: string
  modelDisplayName?: string
  vendor?: string
  genType?: string
  flowNodeId?: string
  requestIndex?: number
  file_urls?: string[]
  reference_urls?: string[]
  params_display?: { label: string; key: string; value: any }[]
  callbacks?: GenerationCallbacks
}

export interface FlowDisplayTaskOptions {
  flowNodeId: string
  prompt?: string
  modelInfo?: string
  modelDisplayName?: string
  genType?: string
}

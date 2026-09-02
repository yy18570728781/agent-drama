import { extractCreatedAigcRecordId } from '@/composables/generation/useGenerationRunner'

interface IndexedCreatedOptions {
  result: any
  taskId: string
  prompt: string
  requestIndex: number
  modelDisplayName?: string
}

interface IndexedCompleteOptions {
  modelId: string
  prompt: string
  items: any[]
  result: any
  aigcRecordIds: string[]
  requestIndex: number
  numImagesPerRequest: number
  totalExpectedItems: number
}

export function buildIndexedCreatedPayload(options: IndexedCreatedOptions): Record<string, any> {
  return {
    recordId: extractCreatedAigcRecordId(options.result),
    taskId: options.taskId,
    prompt: options.prompt,
    _requestIndex: options.requestIndex,
    ...(options.modelDisplayName ? { modelDisplayName: options.modelDisplayName } : {}),
    rawResult: options.result,
    formattedData: options.result?.formatted_data || null,
  }
}

export function buildIndexedCompletePayload(options: IndexedCompleteOptions): Record<string, any> {
  return {
    model_id: options.modelId,
    prompt: options.prompt,
    items: options.items,
    taskId: options.result?.taskId || options.result?.task_id || '',
    recordId: options.aigcRecordIds[0] || '',
    aigcRecordId: options.aigcRecordIds[0],
    aigcRecordIds: options.aigcRecordIds,
    timestamp: Date.now(),
    requestIndex: options.requestIndex,
    _requestIndex: options.requestIndex,
    numImagesPerRequest: options.numImagesPerRequest,
    totalExpectedItems: options.totalExpectedItems,
  }
}

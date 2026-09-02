import { findTeamonesAigcRecord } from '@/api/assets'
import type { GenerationRequestPayload } from '@/api/generation'

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function unwrapAssetUrl(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  return normalizeString(
    (value as any).origin_url
    || (value as any).url
    || (value as any).proxy_url
    || (value as any).thumb
    || '',
  )
}

function buildResultCardLabel(recordId: string, modelName = ''): string {
  const shortId = recordId.slice(-6) || Date.now().toString(36).slice(-6)
  return `${normalizeString(modelName) || '模型'} #${shortId}`
}

export function createBatchGridSlotKey(nodeId: string, itemId: string): string {
  return `${nodeId}:${itemId}`
}

export function cloneBatchGridRegenerateRequest(request: Record<string, any>): GenerationRequestPayload | null {
  const capability = normalizeString(request?.capability)
  const params = request?.params
  if (!capability || !params || typeof params !== 'object' || Array.isArray(params)) return null
  return {
    capability,
    mode: normalizeString(request?.mode) || 'standard',
    params: cloneJson(params),
  }
}

export function buildBatchGridGenerationStatusData(
  request: GenerationRequestPayload,
  data: Record<string, any>,
  status: string,
  extras: Record<string, any> = {},
): Record<string, any> {
  return {
    ...data,
    request,
    status,
    mediaType: normalizeString(data.mediaType) || 'image',
    ...extras,
  }
}

export async function buildBatchGridRegenerateRequestFromRecord(
  recordId: string,
): Promise<GenerationRequestPayload | null> {
  const record = await findTeamonesAigcRecord(recordId)
  const meta = record?.param
  const params = meta?.params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null
  return {
    capability: normalizeString(record?.capability || meta?.capability || 'image_generation') || 'image_generation',
    mode: normalizeString(meta?.mode) || 'standard',
    params: cloneJson(params),
  }
}

export async function resolveBatchGridCompletedData(
  event: any,
  currentData: Record<string, any>,
): Promise<Record<string, any> | null> {
  const recordId = normalizeString(
    event?.aigc_record_id
    || event?.data?.aigc_record_id
    || event?.record_id
    || event?.data?.record_id
    || currentData?.recordId
    || '',
  )
  if (!recordId) return null
  const record = await findTeamonesAigcRecord(recordId)
  const url = unwrapAssetUrl(record?.url)
  const thumb = unwrapAssetUrl(record?.thumbnail_url) || url
  if (!url || !thumb) return null
  return {
    label: buildResultCardLabel(
      recordId,
      normalizeString(record?.model_display_name || record?.model || currentData?.modelDisplayName || ''),
    ),
    mediaType: normalizeString(record?.type || currentData?.mediaType || 'image') || 'image',
    recordId,
    url,
    preview: url,
    imageUrl: url,
    thumb,
    status: 'completed',
    isGenerating: false,
    progress: undefined,
    taskId: undefined,
    _activeTaskId: undefined,
    _queueRecordId: undefined,
    ...(currentData?.request ? { request: cloneJson(currentData.request) } : {}),
    ...(currentData?._genState ? { _genState: cloneJson(currentData._genState) } : {}),
    ...(normalizeString(record?.model_display_name || currentData?.modelDisplayName) ? {
      modelDisplayName: normalizeString(record?.model_display_name || currentData?.modelDisplayName),
    } : {}),
  }
}

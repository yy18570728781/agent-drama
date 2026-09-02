import { findTeamonesAigcRecord } from '@/api/assets'
import { sanitizeTextureMaterialItemData } from '@/utils/textureMaterialItems'
import type { GenerationRequestPayload } from '@/api/generation'

export function createTextureSlotKey(nodeId: string, channel: string): string {
  return `${nodeId}:${channel}`
}

export function cloneTextureRegenerateRequest(request: Record<string, any>): GenerationRequestPayload | null {
  const capability = String(request?.capability || '').trim()
  const params = request?.params
  if (!capability || !params || typeof params !== 'object' || Array.isArray(params)) return null
  return {
    capability,
    ...(request?.mode ? { mode: String(request.mode).trim() || 'standard' } : {}),
    params: JSON.parse(JSON.stringify(params)),
  }
}

function unwrapAssetUrl(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  return String(
    (value as any).origin_url
    || (value as any).url
    || (value as any).proxy_url
    || (value as any).thumb
    || '',
  ).trim()
}

function buildResultCardLabel(recordId: string, modelName: string = ''): string {
  const shortId = String(recordId || '').trim().slice(-6) || Date.now().toString(36).slice(-6)
  return `${String(modelName || '').trim() || '模型'} #${shortId}`
}

export function extractTextureCompletedRecordId(event: any): string {
  return String(
    event?.aigc_record_id
    || event?.data?.aigc_record_id
    || event?.record_id
    || event?.data?.record_id
    || '',
  ).trim()
}

export function buildTextureGenerationStatusData(
  request: GenerationRequestPayload,
  data: Record<string, any>,
  status: string,
  extras: Record<string, any> = {},
): Record<string, any> {
  return sanitizeTextureMaterialItemData('image_generation', {
    ...data,
    request,
    status,
    ...extras,
  })
}

export async function buildTextureRegenerateRequestFromRecord(
  recordId: string,
): Promise<GenerationRequestPayload | null> {
  const record = await findTeamonesAigcRecord(recordId)
  const meta = record?.param
  const params = meta?.params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null
  return {
    capability: String(record?.capability || meta?.capability || 'image_generation').trim() || 'image_generation',
    mode: String(meta?.mode || 'standard').trim() || 'standard',
    params: JSON.parse(JSON.stringify(params)),
  }
}

export async function resolveTextureCompletedData(
  event: any,
  currentData: Record<string, any>,
): Promise<Record<string, any> | null> {
  const recordId = extractTextureCompletedRecordId(event)
  if (!recordId) return null
  const record = await findTeamonesAigcRecord(recordId)
  const url = unwrapAssetUrl(record?.url)
  const thumb = unwrapAssetUrl(record?.thumbnail_url) || url
  if (!url || !thumb) return null
  return sanitizeTextureMaterialItemData('aigc_result', {
    label: buildResultCardLabel(
      recordId,
      String(record?.model_display_name || record?.model || currentData?.modelDisplayName || currentData?.model || '').trim(),
    ),
    mediaType: String(record?.type || currentData?.mediaType || 'image'),
    recordId,
    url,
    thumb,
  })
}

import type { AssetItem } from '@/api/assets'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getNestedRecord(value: unknown, key: string): UnknownRecord | null {
  return asRecord(asRecord(value)?.[key])
}

function getNestedArray(value: unknown, key: string): unknown[] {
  return asArray(asRecord(value)?.[key])
}

/**
 * Rejects Teamones business errors that are returned with HTTP 200.
 * @param payload Raw Teamones response payload
 * @throws Error carrying the upstream business message
 */
export function assertTeamonesResponseSuccess(payload: unknown): void {
  const root = asRecord(payload)
  if (typeof root?.code === 'number' && root.code !== 0) {
    throw new Error(asString(root.msg) || `Teamones request failed (${root.code})`)
  }
}

/**
 * Unwraps the common Teamones response envelope.
 * @param payload Raw HTTP response payload
 * @returns Inner data payload when present
 */
export function extractTeamonesPayload(payload: unknown): unknown {
  const root = asRecord(payload)
  const data = asRecord(root?.data)?.data
  return data ?? root?.data ?? payload
}

/**
 * Reads a record list payload into a flat array.
 * @param payload Raw Teamones response payload
 * @returns Candidate record items
 */
export function extractTeamonesRecordItems(payload: unknown): unknown[] {
  const data = extractTeamonesPayload(payload)
  if (Array.isArray(data)) return data
  return getNestedArray(data, 'data').length
    ? getNestedArray(data, 'data')
    : getNestedArray(data, 'items')
}

/**
 * Reads a single record from a Teamones detail or list payload.
 * @param payload Raw Teamones response payload
 * @returns First resolved record object
 */
export function extractTeamonesRecord(payload: unknown): UnknownRecord | null {
  const data = extractTeamonesPayload(payload)
  if (Array.isArray(data)) return asRecord(data[0])
  const firstData = getNestedArray(data, 'data')[0]
  if (firstData) return asRecord(firstData)
  const firstItem = getNestedArray(data, 'items')[0]
  if (firstItem) return asRecord(firstItem)
  return asRecord(data)
}

/**
 * Extracts a count field from a Teamones count or list payload.
 * @param payload Raw Teamones response payload
 * @returns Numeric total when available
 */
export function extractTeamonesCount(payload: unknown): number {
  const data = extractTeamonesPayload(payload)
  const dataRecord = asRecord(data)
  const nestedData = getNestedRecord(data, 'data')
  const candidates = [
    data,
    dataRecord?.count,
    dataRecord?.total,
    dataRecord?.total_count,
    nestedData?.count,
    nestedData?.total,
  ]
  const value = candidates.find(item => typeof item === 'number' && Number.isFinite(item))
  return typeof value === 'number' ? value : 0
}

function normalizeType(raw: unknown): string {
  if (raw === 1 || raw === '1') return 'video'
  if (raw === 0 || raw === '0') return 'image'
  if (raw === 2 || raw === '2') return 'audio'
  if (raw === 3 || raw === '3') return 'model'
  const value = String(raw ?? '').toLowerCase()
  if (value.includes('video')) return 'video'
  if (value.includes('audio')) return 'audio'
  if (value.includes('model') || value.includes('3d')) return 'model'
  return 'image'
}

function normalizeStatus(raw: unknown, hasMedia: boolean, hasFailure: boolean): string | null {
  if (typeof raw === 'string' && raw.trim() && Number.isNaN(Number(raw))) {
    return raw.trim().toLowerCase()
  }
  switch (Number(raw)) {
    case 0: return 'pending'
    // Teamones has used both the legacy 0/1/2 and current 0/1/2/3 status
    // schemes.  A returned media result is authoritative for old status=1
    // rows, while a failure payload disambiguates old status=2 rows.
    case 1: return hasMedia ? 'completed' : 'running'
    case 2: return hasFailure && !hasMedia ? 'failed' : 'completed'
    case 3: return 'failed'
    case 4: return 'cancelled'
    default: return null
  }
}

function toIsoDate(raw: unknown): string {
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw)
    return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString()
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const millis = raw > 1e12 ? raw : raw * 1000
    return new Date(millis).toISOString()
  }
  return new Date(0).toISOString()
}

function getParam(record: UnknownRecord): UnknownRecord {
  return getNestedRecord(record, 'param') ?? getNestedRecord(getNestedRecord(record, 'data'), 'param') ?? {}
}

function getMediaList(record: UnknownRecord): UnknownRecord[] {
  const rawMedia = record.media
  if (Array.isArray(rawMedia)) return rawMedia.map(item => asRecord(item)).filter(Boolean) as UnknownRecord[]
  const mediaRecord = asRecord(rawMedia)
  if (mediaRecord) return [mediaRecord]
  const nestedMedia = getNestedRecord(getNestedRecord(record, 'data'), 'media')
  if (nestedMedia) return [nestedMedia]
  return []
}

function getReferenceUrls(record: UnknownRecord, param: UnknownRecord): string[] {
  const values = [
    param.reference_urls,
    param.file_urls,
    getNestedRecord(param, 'params')?.reference_urls,
    getNestedRecord(param, 'params')?.reference_files,
    getNestedRecord(param, 'params')?.file_urls,
    getNestedRecord(param, 'params')?.files,
    getNestedRecord(param, 'params')?.file_url,
  ]
  const urls = new Set<string>()
  const append = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) urls.add(value.trim())
    if (Array.isArray(value)) value.forEach(append)
    const objectValue = asRecord(value)
    if (!objectValue) return
    for (const key of ['origin_url', 'proxy_url', 'url', 'file_url', 'src', 'path']) {
      const candidate = asString(objectValue[key])
      if (candidate) {
        urls.add(candidate)
        return
      }
    }
  }
  values.forEach(append)
  return Array.from(urls)
}

function getFailReason(record: UnknownRecord): string | null {
  const failReason = asRecord(record.fail_reason)
  const candidates = [
    asString(failReason?.error_message),
    asString(failReason?.message),
    asString(record.fail_reason),
    asString(record.error_message),
    asString(record.error),
  ]
  return candidates.find(Boolean) || null
}

/**
 * Normalizes a Teamones AIGC record into the asset-view model.
 * @param rawRecord Raw Teamones record object
 * @returns UI-ready asset item or null when the record is unusable
 */
export function normalizeTeamonesAigcRecord(rawRecord: unknown): AssetItem | null {
  const record = asRecord(rawRecord)
  if (!record) return null
  const param = getParam(record)
  const media = getMediaList(record)
  const firstMedia = media[0] ?? {}
  const assetId = firstMedia.file_id ?? record.file_id ?? record.asset_id ?? record.id
  if (assetId === undefined || assetId === null || assetId === '') return null
  const recordId = record.id ?? record.record_id ?? assetId
  const failReason = getFailReason(record)
  const status = normalizeStatus(record.status, media.length > 0, Boolean(failReason))
  const paramParams = getNestedRecord(param, 'params')
  const rawEndpointId = record.endpoint_id ?? param.endpoint_id ?? param._teamones_endpoint_id ?? null
  const endpointId = rawEndpointId === 0 || rawEndpointId === '0' || rawEndpointId === '' ? null : rawEndpointId
  const thumb = asString(firstMedia.thumb)
  const directUrl = asString(firstMedia.origin_url)

  return {
    id: String(assetId),
    record_id: String(recordId),
    endpoint_id: typeof endpointId === 'string' || typeof endpointId === 'number' ? endpointId : null,
    user: asRecord(record.user) as AssetItem['user'] ?? null,
    type: normalizeType(firstMedia.type ?? param.capability ?? record.type),
    source: 'teamones_aigc_record',
    media,
    vendor: asString(param.vendor) || null,
    platform_task_id: asString(param.platform_task_id) || asString(paramParams?.platform_task_id) || null,
    query_id: asString(param.platform_task_id) || asString(paramParams?.platform_task_id) || asString(param.query_id) || null,
    model: asString(paramParams?.model) || null,
    model_display_name: asString(paramParams?.model) || null,
    capability: asString(param.capability) || asString(record.capability) || null,
    prompt: asString(record.prompt) || asString(paramParams?.prompt) || null,
    param: Object.keys(param).length ? param : null,
    params_display: null,
    reference_urls: getReferenceUrls(record, param),
    file_size: Number(firstMedia.file_size ?? record.file_size ?? 0) || 0,
    is_favorites: Boolean(record.is_favorites ?? record.is_favorite),
    created_at: toIsoDate(record.created_at ?? record.created ?? record.create_time ?? record.createdAt),
    width: Number(firstMedia.width ?? record.width ?? 0) || undefined,
    height: Number(firstMedia.height ?? record.height ?? 0) || undefined,
    aspect_ratio: undefined,
    url: directUrl,
    thumbnail_url: thumb || null,
    tags: asArray(record.tags ?? param.tags).map(item => asString(asRecord(item)?.name ?? item)).filter(Boolean),
    isGenerating: status === 'pending' || status === 'running',
    progress: status === 'completed' ? 100 : undefined,
    statusText: status === 'pending'
      ? '排队中'
      : status === 'running'
        ? '生成中'
        : status === 'completed'
          ? '已完成'
          : status === 'failed'
            ? (failReason || '失败')
            : status ?? undefined,
    status: status ?? undefined,
    failReason,
    fail_reason: asRecord(record.fail_reason) ?? null,
    created_by: Number(record.created_by ?? 0) || undefined,
  }
}

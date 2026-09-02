type TextureMaterialPersistedItem = {
  id: string
  type: string
  data: Record<string, any>
  pbrChannel?: string
}

const GENERATION_ITEM_TYPES = new Set([
  'text_generation',
  'image_generation',
  'video_generation',
  'model_generation',
  'audio_generation',
])

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function getItemUrl(data: Record<string, any>): string {
  return normalizeString(data.url || '')
}

function getItemMediaType(nodeType: string, data: Record<string, any>, url: string): string {
  const mediaType = normalizeString(data.mediaType)
  if (mediaType) return mediaType
  if (nodeType === 'video_generation' || /\.mp4($|\?)/i.test(url)) return 'video'
  if (nodeType === 'audio_generation' || /\.mp3($|\?)/i.test(url)) return 'audio'
  if (nodeType === 'text_generation') return 'text'
  if (nodeType === 'model_generation') return '3d_model'
  return 'image'
}

function buildPersistedRequest(data: Record<string, any>): Record<string, any> | null {
  const direct = data.request
  if (direct && typeof direct === 'object' && normalizeString((direct as any).capability)) {
    return cloneJson(direct)
  }
  return null
}

function applyGenerationFields(nodeType: string, data: Record<string, any>, rawData: Record<string, any>): void {
  if (!GENERATION_ITEM_TYPES.has(nodeType)) return
  if (normalizeString(rawData.taskId)) data.taskId = normalizeString(rawData.taskId)
  if (normalizeString(rawData.prompt)) data.prompt = normalizeString(rawData.prompt)
  if (normalizeString(rawData.model)) data.model = normalizeString(rawData.model)
  if (normalizeString(rawData.status)) data.status = normalizeString(rawData.status)
  if (typeof rawData.progress === 'number') data.progress = rawData.progress
  if (normalizeString(rawData.failReason)) data.failReason = normalizeString(rawData.failReason)
  if (normalizeString(rawData.fail_reason)) data.fail_reason = normalizeString(rawData.fail_reason)
  if (normalizeString(rawData.statusText)) data.statusText = normalizeString(rawData.statusText)
}

export function sanitizeTextureMaterialItemData(nodeType: string, rawData: Record<string, any>): Record<string, any> {
  const url = getItemUrl(rawData)
  const thumb = normalizeString(rawData.thumb || rawData.thumbnail_url)
  const mediaType = getItemMediaType(nodeType, rawData, url)
  const data: Record<string, any> = {
    label: normalizeString(rawData.label) || '图片',
    mediaType,
  }
  if (url) data.url = url
  if (thumb) data.thumb = thumb
  if (rawData.content) data.content = rawData.content
  if (rawData.bgColor) data.bgColor = rawData.bgColor
  if (rawData.locked) data.locked = true
  if (rawData.collapsed) data.collapsed = true

  const request = buildPersistedRequest(rawData)
  if (request && GENERATION_ITEM_TYPES.has(nodeType)) data.request = request

  const referenceOrder = Array.isArray(rawData.referenceOrder)
    ? rawData.referenceOrder.filter((item: unknown): item is string => typeof item === 'string' && !!item.trim())
    : []
  if (referenceOrder.length) data.referenceOrder = [...referenceOrder]

  const recordId = normalizeString(rawData.recordId)
  if (recordId) data.recordId = recordId
  if (normalizeString(rawData.modelDisplayName)) data.modelDisplayName = normalizeString(rawData.modelDisplayName)
  applyGenerationFields(nodeType, data, rawData)
  if (nodeType === 'aigc_result' && data.recordId) delete data.request
  return data
}

export function normalizeTextureMaterialItemSnapshot(raw: any): TextureMaterialPersistedItem | null {
  if (!raw || typeof raw !== 'object' || !raw.data || typeof raw.data !== 'object') return null
  const type = normalizeString(raw.type) || 'file_input'
  return {
    id: normalizeString(raw.id),
    type,
    data: sanitizeTextureMaterialItemData(type, raw.data),
    ...(normalizeString(raw.pbrChannel) ? { pbrChannel: normalizeString(raw.pbrChannel) } : {}),
  }
}

export function normalizeTextureMaterialItems(items: any[]): TextureMaterialPersistedItem[] {
  return Array.isArray(items)
    ? items.map(normalizeTextureMaterialItemSnapshot).filter(Boolean) as TextureMaterialPersistedItem[]
    : []
}

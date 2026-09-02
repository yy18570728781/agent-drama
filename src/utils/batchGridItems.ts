type BatchGridPersistedItem = {
  id: string
  type: string
  data: Record<string, any>
}

const GENERATION_ITEM_TYPES = new Set([
  'text_generation',
  'image_generation',
  'video_generation',
  'model_generation',
  'audio_generation',
])

const MEDIA_TYPE_BY_NODE_TYPE: Record<string, string> = {
  file_input: 'image',
  aigc_result: 'image',
  text_generation: 'text',
  image_generation: 'image',
  video_generation: 'video',
  model_generation: '3d_model',
  audio_generation: 'audio',
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

function createFallbackItemId(): string {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function getItemUrl(data: Record<string, any>): string {
  return normalizeString(data.url)
}

function getItemMediaType(nodeType: string, data: Record<string, any>, url: string): string {
  const mediaType = normalizeString(data.mediaType)
  if (mediaType) return mediaType
  if (nodeType === 'video_generation' || /\.mp4($|\?)/i.test(url)) return 'video'
  if (nodeType === 'audio_generation' || /\.mp3($|\?)/i.test(url)) return 'audio'
  if (nodeType === 'text_generation') return 'text'
  if (nodeType === 'model_generation') return '3d_model'
  return MEDIA_TYPE_BY_NODE_TYPE[nodeType] || 'image'
}

function buildPersistedRequest(data: Record<string, any>): Record<string, any> | null {
  const direct = data.request
  if (direct && typeof direct === 'object' && normalizeString((direct as any).capability)) {
    return cloneJson(direct)
  }
  return null
}

function buildPersistedMediaMeta(data: Record<string, any>): Record<string, number> | null {
  const rawMeta = data.mediaMeta && typeof data.mediaMeta === 'object' ? data.mediaMeta : {}
  const width = Number(rawMeta.width || data.width || 0)
  const height = Number(rawMeta.height || data.height || 0)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  const rawRatio = Number(rawMeta.aspectRatio || rawMeta.aspect_ratio || data.aspectRatio || data.aspect_ratio || 0)
  const aspectRatio = Number.isFinite(rawRatio) && rawRatio > 0 ? rawRatio : width / height
  return { width, height, aspectRatio }
}

function hasRecoverableItemData(data: Record<string, any>): boolean {
  return Boolean(
    normalizeString(data.url)
    || normalizeString(data.thumb || data.thumbnail_url)
    || normalizeString(data.recordId)
    || normalizeString(data.taskId || data._activeTaskId)
    || normalizeString(data.status)
    || buildPersistedRequest(data),
  )
}

function applyGenerationFields(nodeType: string, data: Record<string, any>, rawData: Record<string, any>): void {
  if (!GENERATION_ITEM_TYPES.has(nodeType) && nodeType !== 'aigc_result') return
  const taskId = normalizeString(rawData.taskId || rawData._activeTaskId)
  if (taskId) data.taskId = taskId
  const status = normalizeString(rawData.status)
  if (status) data.status = status
  if (typeof rawData.progress === 'number') data.progress = rawData.progress
  const statusText = normalizeString(rawData.statusText)
  if (statusText) data.statusText = statusText
  const failReason = normalizeString(rawData.failReason || rawData.fail_reason)
  if (failReason) data.failReason = failReason
  if (rawData.isGenerating === true) data.isGenerating = true
}

function buildPersistedItemData(nodeType: string, rawData: Record<string, any>): Record<string, any> {
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
  const mediaMeta = buildPersistedMediaMeta(rawData)
  if (mediaMeta) data.mediaMeta = mediaMeta

  const request = buildPersistedRequest(rawData)
  if (request && (GENERATION_ITEM_TYPES.has(nodeType) || nodeType === 'aigc_result')) {
    data.request = request
  }

  const referenceOrder = Array.isArray(rawData.referenceOrder)
    ? rawData.referenceOrder.filter((item: unknown): item is string => typeof item === 'string' && !!item.trim())
    : []
  if (referenceOrder.length) data.referenceOrder = [...referenceOrder]

  const recordId = normalizeString(rawData.recordId)
  if (recordId && (nodeType === 'aigc_result' || GENERATION_ITEM_TYPES.has(nodeType))) {
    data.recordId = recordId
  }

  const modelDisplayName = normalizeString(rawData.modelDisplayName)
  if (modelDisplayName) data.modelDisplayName = modelDisplayName
  applyGenerationFields(nodeType, data, rawData)
  return data
}

function buildLegacyAssetItem(raw: Record<string, any>): BatchGridPersistedItem | null {
  if (!hasRecoverableItemData(raw)) return null
  return {
    id: normalizeString(raw.id) || createFallbackItemId(),
    type: 'file_input',
    data: buildPersistedItemData('file_input', raw),
  }
}

export function isBatchGridGenerationItemType(nodeType = ''): boolean {
  return GENERATION_ITEM_TYPES.has(normalizeString(nodeType))
}

export function normalizeBatchGridItemSnapshot(raw: any): BatchGridPersistedItem | null {
  if (!raw || typeof raw !== 'object') return null
  if (raw.data && typeof raw.data === 'object') {
    const type = normalizeString(raw.type) || 'file_input'
    return {
      id: normalizeString(raw.id) || createFallbackItemId(),
      type,
      data: buildPersistedItemData(type, raw.data),
    }
  }
  return buildLegacyAssetItem(raw)
}

export function normalizeBatchGridItems(items: any[]): BatchGridPersistedItem[] {
  return Array.isArray(items)
    ? items.map(normalizeBatchGridItemSnapshot).filter(Boolean) as BatchGridPersistedItem[]
    : []
}

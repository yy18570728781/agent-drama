type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readText(source: unknown, keys: string[]): string {
  if (!isRecord(source)) return ''
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function mediaItems(source: unknown): RawRecord[] {
  if (Array.isArray(source)) return source.filter(isRecord)
  if (!isRecord(source)) return []
  const items = source.items ?? source.list ?? source.data
  return Array.isArray(items) ? items.filter(isRecord) : []
}

function coverFromMedia(raw: RawRecord, asset: RawRecord): string {
  const direct = readText(raw, ['thumb', 'cover_url']) || readText(asset, ['thumb', 'cover_url'])
  if (direct) return direct
  const media = isRecord(raw.media) ? raw.media : isRecord(asset.media) ? asset.media : {}
  const items = [...mediaItems(raw.media), ...mediaItems(asset.media)]
  const coverId = String(media.cover ?? raw.cover ?? asset.cover ?? '').trim()
  const cover = items.find((item) => String(item.is_cover ?? '') === '1')
    ?? items.find((item) => String(item.id ?? item.media_id ?? '') === coverId)
    ?? items[0]
  return readText(cover, ['thumb', 'url', 'path'])
}

function coverFromNodes(definition: RawRecord): string {
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : []
  for (const node of nodes) {
    const direct = readText(node, ['cover', 'thumb', 'preview', 'url', 'imageUrl'])
    const nested = isRecord(node) ? readText(node.data, ['cover', 'thumb', 'preview', 'url', 'imageUrl']) : ''
    if (direct || nested) return direct || nested
  }
  return ''
}

/**
 * 优先从 Teamones 资产媒体关系读取封面，并兼容历史画布节点预览图。
 * @param raw 资产列表接口的原始记录。
 * @param definition 已解析的画布定义。
 * @returns 可用于画布卡片展示的封面 URL。
 */
export function resolveFlowLibraryCover(raw: RawRecord, definition: RawRecord): string {
  const asset = isRecord(raw.asset) ? raw.asset : raw
  return coverFromMedia(raw, asset) || coverFromNodes(definition)
}

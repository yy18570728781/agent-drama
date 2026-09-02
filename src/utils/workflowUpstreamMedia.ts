function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cloneItem<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function getSourceNodeId(item: Record<string, any> | null | undefined): string {
  return readText(item?.nodeId || item?.sourceNodeId || item?.id)
}

function getNodeMediaUrl(node: Record<string, any> | null | undefined): string {
  const data = node?.data || {}
  return readText(data.url || data.preview || data.imageUrl || data.videoUrl || data.audioUrl || data.sourceUrl)
}

function getNodeThumbUrl(node: Record<string, any> | null | undefined): string {
  const data = node?.data || {}
  return readText(data.thumb || data.thumbnail_url)
}

function getNodeLabel(node: Record<string, any> | null | undefined, fallback = ''): string {
  return readText(node?.data?.label) || fallback
}

function getNodeReferenceName(node: Record<string, any> | null | undefined): string {
  return readText(node?.data?.referenceName) || readText(node?.data?.sourceFileName)
}

function getNodeMediaType(node: Record<string, any> | null | undefined, fallback = 'image'): string {
  return readText(node?.data?.mediaType) || fallback
}

export function sanitizeStoredUpstreamItems(items: unknown, mediaType: string): Array<Record<string, any>> {
  if (!Array.isArray(items)) return []
  return items
    .map((item: any) => {
      const sourceNodeId = getSourceNodeId(item)
      if (!sourceNodeId) return null
      const nextItem: Record<string, any> = {
        nodeId: sourceNodeId,
        sourceNodeId,
        mediaType: readText(item?.mediaType) || mediaType,
      }
      const label = readText(item?.label)
      if (label) nextItem.label = label
      const referenceName = readText(item?.referenceName)
      if (referenceName) nextItem.referenceName = referenceName
      if (item?.groupAggregate) nextItem.groupAggregate = true
      const groupNodeId = readText(item?.groupNodeId)
      if (groupNodeId) nextItem.groupNodeId = groupNodeId
      if (typeof item?.groupOrder === 'number') nextItem.groupOrder = item.groupOrder
      return nextItem
    })
    .filter((item): item is Record<string, any> => !!item)
}

export function sanitizeStoredUpstreamInputs(upstreamInputs: Record<string, any> | null | undefined): Record<string, any> {
  const images = sanitizeStoredUpstreamItems(upstreamInputs?.images, 'image')
  const videos = sanitizeStoredUpstreamItems(upstreamInputs?.videos, 'video')
  const audios = sanitizeStoredUpstreamItems(upstreamInputs?.audios, 'audio')
  const models3d = sanitizeStoredUpstreamItems(upstreamInputs?.models3d, '3d_model')
  return {
    images,
    videos,
    audios,
    models3d,
    totalImageCount: images.length,
    totalVideoCount: videos.length,
    totalAudioCount: audios.length,
    totalModels3dCount: models3d.length,
  }
}

export function resolveStoredUpstreamItems(
  items: unknown,
  findNode: ((id: string) => any) | null | undefined,
  fallbackMediaType: string,
): Array<Record<string, any>> {
  if (!Array.isArray(items)) return []
  return items
    .map((item: any) => {
      const sourceNodeId = getSourceNodeId(item)
      if (!sourceNodeId) return null
      const sourceNode = findNode?.(sourceNodeId)
      const url = getNodeMediaUrl(sourceNode)
      if (!url) return null
      const resolved = cloneItem(item)
      resolved.nodeId = sourceNodeId
      resolved.sourceNodeId = sourceNodeId
      resolved.url = url
      const thumb = getNodeThumbUrl(sourceNode)
      if (thumb) resolved.thumb = thumb
      const referenceName = getNodeReferenceName(sourceNode)
      if (referenceName) resolved.referenceName = referenceName
      if (!readText(resolved.label)) {
        const label = getNodeLabel(sourceNode, '')
        if (label) resolved.label = label
      }
      resolved.mediaType = readText(resolved.mediaType) || getNodeMediaType(sourceNode, fallbackMediaType)
      return resolved
    })
    .filter((item): item is Record<string, any> => !!item)
}

export function resolveStoredUpstreamInputs(
  upstreamInputs: Record<string, any> | null | undefined,
  findNode: ((id: string) => any) | null | undefined,
): Record<string, any> {
  const images = resolveStoredUpstreamItems(upstreamInputs?.images, findNode, 'image')
  const videos = resolveStoredUpstreamItems(upstreamInputs?.videos, findNode, 'video')
  const audios = resolveStoredUpstreamItems(upstreamInputs?.audios, findNode, 'audio')
  const models3d = resolveStoredUpstreamItems(upstreamInputs?.models3d, findNode, '3d_model')
  return {
    images,
    videos,
    audios,
    models3d,
    totalImageCount: images.length,
    totalVideoCount: videos.length,
    totalAudioCount: audios.length,
    totalModels3dCount: models3d.length,
  }
}

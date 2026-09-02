type ReferenceSyncNode = {
  id: string
  type?: string
  data?: Record<string, unknown>
}

type ReferenceSyncEdge = {
  source: string
  target: string
}

type ReferenceMediaType = 'image' | 'video' | 'audio'

type ReferenceMediaItem = {
  nodeId: string
  sourceNodeId: string
  url: string
  thumb: string
  label: string
  mediaType: ReferenceMediaType
}

type SyncReferencesArgs = {
  node: ReferenceSyncNode | null | undefined
  edges: ReferenceSyncEdge[]
  findNode: (id: string) => ReferenceSyncNode | null | undefined
  generator: {
    buildCurrentRequestPayload?: () => { referenceOrder?: unknown } | null | undefined
    setReferenceMedia?: (items: ReferenceGeneratorItem[]) => Promise<unknown> | unknown
  } | null | undefined
}

type ReferenceGeneratorItem = {
  url: string
  mediaType: ReferenceMediaType
  isVideo: boolean
  nodeId: string
  sourceNodeId: string
}

const REFERENCE_PARAM_KEYS = [
  'file_urls',
  'reference_urls',
  'reference_files',
  'files',
  'file_url',
  'image_urls',
  'image_first_frame',
  'image_last_frame',
]

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getNodeMediaUrl(node: ReferenceSyncNode | null | undefined): string {
  const data = node?.data || {}
  return readText(data.url) || readText(data.sourceUrl)
}

function getNodeMediaType(node: ReferenceSyncNode): ReferenceMediaType {
  const mediaType = readText(node.data?.mediaType)
  if (mediaType === 'video' || node.type === 'video_generation') return 'video'
  if (mediaType === 'audio' || node.type === 'audio_generation') return 'audio'
  return 'image'
}

function collectIncomingReferenceMedia(
  targetNodeId: string,
  edges: ReferenceSyncEdge[],
  findNode: SyncReferencesArgs['findNode'],
  visited = new Set<string>(),
): ReferenceMediaItem[] {
  if (!targetNodeId || visited.has(targetNodeId)) return []
  visited.add(targetNodeId)

  return edges
    .filter((edge) => edge.target === targetNodeId)
    .flatMap((edge) => {
      const sourceNode = findNode(edge.source)
      if (!sourceNode) return []
      if (sourceNode.type === 'waypoint') {
        return collectIncomingReferenceMedia(sourceNode.id, edges, findNode, visited)
      }

      const url = getNodeMediaUrl(sourceNode)
      if (!url) return []
      return [{
        nodeId: sourceNode.id,
        sourceNodeId: sourceNode.id,
        url,
        thumb: readText(sourceNode.data?.thumb),
        label: readText(sourceNode.data?.label),
        mediaType: getNodeMediaType(sourceNode),
      }]
    })
}

function dedupeReferenceMedia(items: ReferenceMediaItem[]): ReferenceMediaItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.nodeId}:${item.url}`
    if (!item.url || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function readCurrentReferenceOrder(generator: SyncReferencesArgs['generator']): string[] {
  const rawOrder = generator?.buildCurrentRequestPayload?.()?.referenceOrder
  if (!Array.isArray(rawOrder)) return []
  return rawOrder
    .map((item) => readText(item))
    .filter((item, index, arr) => !!item && arr.indexOf(item) === index)
}

function getReferenceKeys(item: ReferenceMediaItem): string[] {
  return [`node:${item.nodeId}`, `node:${item.sourceNodeId}`, `url:${item.url}`]
}

function stripStoredReferenceParams(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  const nextParams = { ...(params as Record<string, unknown>) }
  REFERENCE_PARAM_KEYS.forEach((key) => {
    delete nextParams[key]
  })
  return nextParams
}

function resetNodeStoredReferenceCaches(node: ReferenceSyncNode, referenceOrder: string[]): void {
  const data = node.data || {}
  data.referenceUrls = []
  data.referenceItems = []
  data.referenceOrder = [...referenceOrder]

  if (data.params && typeof data.params === 'object') {
    data.params = stripStoredReferenceParams(data.params)
  }

  if (data.request && typeof data.request === 'object') {
    const request = data.request as Record<string, unknown>
    request.params = stripStoredReferenceParams(request.params)
    data.request = request
  }

  if (data._genState && typeof data._genState === 'object') {
    const state = data._genState as Record<string, unknown>
    state.params = stripStoredReferenceParams(state.params)
    state.referenceOrder = [...referenceOrder]
    state.referenceItems = []
    state.fileUrls = undefined
    data._genState = state
  }
}

function sortMediaByCurrentReferenceOrder(
  media: ReferenceMediaItem[],
  currentOrder: string[],
): ReferenceMediaItem[] {
  if (!media.length || !currentOrder.length) return media
  const rank = new Map(currentOrder.map((key, index) => [key, index] as const))
  return media
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = getReferenceKeys(a.item).reduce((hit, key) => Math.min(hit, rank.get(key) ?? hit), Number.MAX_SAFE_INTEGER)
      const bRank = getReferenceKeys(b.item).reduce((hit, key) => Math.min(hit, rank.get(key) ?? hit), Number.MAX_SAFE_INTEGER)
      if (aRank !== bRank) return aRank - bRank
      return a.index - b.index
    })
    .map(({ item }) => item)
}

/**
 * Syncs the embedded generator with the actual current flow edges right before send.
 * Current edges decide membership; the reference area keeps user-adjusted order.
 * @param args Current node, edges and embedded generator adapter.
 * @returns Resolves after generator reference state is synchronized.
 */
export async function syncGeneratorReferencesFromCurrentEdges(args: SyncReferencesArgs): Promise<void> {
  const nodeId = String(args.node?.id || '').trim()
  if (!nodeId || !args.node?.data) return

  const incomingEdges = args.edges.filter((edge) => edge.target === nodeId)
  const edgeMedia = collectIncomingReferenceMedia(nodeId, args.edges, args.findNode)
  const media = dedupeReferenceMedia(edgeMedia)
  if (!media.length && incomingEdges.length) return
  const sortedMedia = sortMediaByCurrentReferenceOrder(media, readCurrentReferenceOrder(args.generator))

  const images = sortedMedia.filter((item) => item.mediaType === 'image')
  const videos = sortedMedia.filter((item) => item.mediaType === 'video')
  const audios = sortedMedia.filter((item) => item.mediaType === 'audio')
  const previousUpstreamInputs = typeof args.node.data._upstreamInputs === 'object' && args.node.data._upstreamInputs
    ? args.node.data._upstreamInputs
    : {}
  args.node.data._upstreamInputs = {
    ...previousUpstreamInputs,
    images: images.map((item) => ({
      nodeId: item.nodeId,
      sourceNodeId: item.sourceNodeId,
      label: item.label,
      mediaType: item.mediaType,
    })),
    videos: videos.map((item) => ({
      nodeId: item.nodeId,
      sourceNodeId: item.sourceNodeId,
      label: item.label,
      mediaType: item.mediaType,
    })),
    audios: audios.map((item) => ({
      nodeId: item.nodeId,
      sourceNodeId: item.sourceNodeId,
      label: item.label,
      mediaType: item.mediaType,
    })),
    totalImageCount: images.length,
    totalVideoCount: videos.length,
    totalAudioCount: audios.length,
  }
  const referenceOrder = sortedMedia.map((item) => `node:${item.nodeId}`)
  resetNodeStoredReferenceCaches(args.node, referenceOrder)
  await args.generator?.setReferenceMedia?.(
    sortedMedia.map((item) => ({
      url: item.url,
      mediaType: item.mediaType,
      isVideo: item.mediaType === 'video',
      nodeId: item.nodeId,
      sourceNodeId: item.sourceNodeId,
    })),
  )
}

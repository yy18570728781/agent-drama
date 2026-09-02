type UnknownRecord = Record<string, unknown>

export interface GeneratorReferenceMedia {
  url: string
  referenceName?: string
  isVideo: boolean
  mediaType: string
  nodeId: string
}

interface BuildGeneratorReferenceMediaOptions {
  upstreamInputs: UnknownRecord | null | undefined
  currentNodeId?: string
  blockedNodeIds: ReadonlySet<string>
  referenceOrder: string[]
}

interface NormalizedUpstreamMedia extends UnknownRecord {
  url: string
  nodeId: string
  referenceName?: string
  sourceFileName?: string
  label?: string
  isSelf?: boolean
  isVideo: boolean
  mediaType: string
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeMediaItems(
  value: unknown,
  mediaType: string,
  isVideo: boolean,
): NormalizedUpstreamMedia[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as UnknownRecord
    const url = readText(record.url)
    const nodeId = readText(record.nodeId)
    if (!url || !nodeId) return []
    return [{ ...record, url, nodeId, mediaType, isVideo } as NormalizedUpstreamMedia]
  })
}

function getReferenceOrderKey(media: NormalizedUpstreamMedia): string {
  return media.nodeId ? `node:${media.nodeId}` : `url:${media.url}`
}

function sortMedia(
  media: NormalizedUpstreamMedia[],
  referenceOrder: string[],
): NormalizedUpstreamMedia[] {
  if (!referenceOrder.length) return media
  const orderRank = new Map(referenceOrder.map((item, index) => [item, index]))
  return [...media].sort((left, right) => {
    const leftRank = orderRank.get(getReferenceOrderKey(left)) ?? Number.MAX_SAFE_INTEGER
    const rightRank = orderRank.get(getReferenceOrderKey(right)) ?? Number.MAX_SAFE_INTEGER
    return leftRank - rightRank
  })
}

/**
 * 将工作流上游媒体整理为生成器可消费的有序参考媒体。
 * @param options 上游媒体、当前节点、屏蔽节点和已保存顺序。
 * @returns 过滤并按保存顺序排列后的参考媒体。
 */
export function buildGeneratorReferenceMedia(
  options: BuildGeneratorReferenceMediaOptions,
): GeneratorReferenceMedia[] {
  const inputs = options.upstreamInputs || {}
  const media = [
    ...normalizeMediaItems(inputs.images, 'image', false),
    ...normalizeMediaItems(inputs.videos, 'video', true),
    ...normalizeMediaItems(inputs.audios, 'audio', false),
  ].filter(item => (
    item.nodeId !== options.currentNodeId
    && !item.isSelf
    && !options.blockedNodeIds.has(item.nodeId)
  ))
  return sortMedia(media, options.referenceOrder).map(item => ({
    url: item.url,
    referenceName: item.referenceName || item.sourceFileName || item.label,
    isVideo: item.isVideo,
    mediaType: item.mediaType,
    nodeId: item.nodeId,
  }))
}

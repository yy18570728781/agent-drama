import { inferReferenceMediaTypeFromUrl } from '@/composables/useFileDrop'
import type { ReferenceImage, ReferenceMediaType } from '@/composables/generation/useReferenceManager'
import type { UIRememberReferenceTools, UseUIRememberOptions } from './uiRemember.types'

function appendReferenceUrl(out: string[], value: any): void {
  if (!value) return
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) out.push(trimmed)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => appendReferenceUrl(out, item))
    return
  }
  if (typeof value !== 'object') return
  for (const key of ['origin_url', 'proxy_url', 'url', 'file_url', 'src', 'path']) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      out.push(candidate.trim())
      return
    }
  }
}

function collectReferenceUrls(data: Record<string, any> | null | undefined): string[] {
  const urls: string[] = []
  appendReferenceUrl(urls, data?.fileUrls)
  appendReferenceUrl(urls, data?.referenceUrls)
  appendReferenceUrl(urls, data?.params?.file_urls)
  appendReferenceUrl(urls, data?.params?.reference_urls)
  appendReferenceUrl(urls, data?.params?.reference_files)
  appendReferenceUrl(urls, data?.params?.files)
  appendReferenceUrl(urls, data?.params?.file_url)
  appendReferenceUrl(urls, data?.params?.image_first_frame)
  appendReferenceUrl(urls, data?.params?.image_last_frame)
  return Array.from(new Set(urls))
}

function getReferenceOrderKey(item: Partial<ReferenceImage> | null | undefined): string {
  const sourceNodeId = typeof item?.sourceNodeId === 'string' ? item.sourceNodeId.trim() : ''
  if (sourceNodeId) return `node:${sourceNodeId}`
  const url = typeof item?.sourceUrl === 'string' && item.sourceUrl.trim()
    ? item.sourceUrl.trim()
    : (typeof item?.url === 'string' ? item.url.trim() : '')
  return url ? `url:${url}` : ''
}

function buildReferenceFromState(options: UseUIRememberOptions, value: any): ReferenceImage | null {
  if (!value) return null
  if (typeof value === 'string') return options.buildRememberedReferenceImage(value)
  if (typeof value !== 'object') return null
  const rawUrl = typeof value.url === 'string' && value.url.trim()
    ? value.url.trim()
    : (typeof value.sourceUrl === 'string' && value.sourceUrl.trim() ? value.sourceUrl.trim() : '')
  if (!rawUrl) return null
  const sourceUrl = typeof value.sourceUrl === 'string' && value.sourceUrl.trim()
    ? value.sourceUrl.trim()
    : rawUrl
  const fallbackType = value.isVideo === true ? 'video' : 'image'
  const mediaType = inferReferenceMediaTypeFromUrl(
    rawUrl,
    typeof value.mediaType === 'string' ? value.mediaType as ReferenceMediaType : fallbackType,
  )
  const mimeType = mediaType === 'video'
    ? 'video/mp4'
    : mediaType === 'audio' ? 'audio/mpeg' : mediaType === '3d_model' ? 'model/gltf-binary' : 'image/png'
  const basename = rawUrl.split(/[?#]/)[0].split('/').pop() || `reference_${Date.now()}`
  return {
    url: rawUrl,
    file: new File([], basename, { type: mimeType }),
    isVideo: mediaType === 'video',
    mediaType,
    sourceUrl,
    sourceNodeId: typeof value.sourceNodeId === 'string' && value.sourceNodeId.trim()
      ? value.sourceNodeId.trim()
      : undefined,
    uploaded: !!value.uploaded,
  }
}

function sortReferences(images: ReferenceImage[], order: string[]): ReferenceImage[] {
  if (!images.length || !order.length) return images
  const rank = new Map(order.map((key, index) => [key, index] as const))
  return images.map((item, index) => ({ item, index, key: getReferenceOrderKey(item) }))
    .sort((left, right) => {
      const leftRank = left.key && rank.has(left.key) ? rank.get(left.key)! : Number.MAX_SAFE_INTEGER
      const rightRank = right.key && rank.has(right.key) ? rank.get(right.key)! : Number.MAX_SAFE_INTEGER
      return leftRank !== rightRank ? leftRank - rightRank : left.index - right.index
    })
    .map((entry) => entry.item)
}

/**
 * 管理 UI 记忆中的引用资源解析、去重和排序。
 * @param options 引用状态与业务回调。
 * @returns 引用资源读写工具。
 */
export function useUIRememberReferences(options: UseUIRememberOptions): UIRememberReferenceTools {
  const shouldRememberReferences = (): boolean => !options.disableReferenceRemember.value
  const getCurrentReferenceUrls = (): string[] => Array.from(new Set(
    options.refImages.value
      .map((item) => item.sourceUrl || item.url)
      .filter((url): url is string => typeof url === 'string' && !!url.trim()),
  ))
  const replaceRememberedReferenceUrls = (urls: string[]): void => {
    options.refImages.value.forEach((item) => {
      if (typeof item.url === 'string' && item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
    })
    options.refImages.value = urls.map(options.buildRememberedReferenceImage)
  }
  const buildFromState = (value: any): ReferenceImage | null => buildReferenceFromState(options, value)
  return {
    shouldRememberReferences,
    getCurrentReferenceUrls,
    replaceRememberedReferenceUrls,
    appendRememberedReferenceUrl: appendReferenceUrl,
    collectRememberedReferenceUrls: collectReferenceUrls,
    buildRememberedReferenceImageFromState: buildFromState,
    collectRememberedReferenceItems: (data) => Array.isArray(data?.referenceItems)
      ? data.referenceItems.map(buildFromState).filter((item): item is ReferenceImage => !!item)
      : [],
    getReferenceOrderKey,
    collectRememberedReferenceOrder: (data) => Array.isArray(data?.referenceOrder)
      ? data.referenceOrder
        .map((item: any) => typeof item === 'string' ? item.trim() : '')
        .filter((item: string, index: number, items: string[]) => !!item && items.indexOf(item) === index)
      : [],
    sortReferenceImagesByOrder: sortReferences,
  }
}

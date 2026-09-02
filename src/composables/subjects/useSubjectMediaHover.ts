import { ref } from 'vue'
import { subjectAssetApi, type RawMedia } from '@/api/subjectAsset'
import { buildThumbUrl } from '@/utils/cosUpload'

export interface SubjectMediaThumb {
  id: string
  thumb: string
  thumbUrl: string
  sourceUrl: string
  mediaType: 'image' | 'video'
}

const mediaCache = new Map<string, SubjectMediaThumb[]>()
const loadingSet = new Set<string>()

function mapRawMedia(raw: RawMedia): SubjectMediaThumb {
  const fullUrl = raw.thumb || raw.path || ''
  const thumb = raw.thumb || raw.path || ''
  const isVideo = String(raw.type || '').toLowerCase().startsWith('video')
  return {
    id: String(raw.id),
    thumb: fullUrl,
    thumbUrl: thumb ? buildThumbUrl(thumb) : '',
    sourceUrl: fullUrl,
    mediaType: isVideo ? 'video' : 'image',
  }
}

/**
 * 主体媒体懒加载 + 缓存：
 * 首次调用 getMedia 时请求 API，后续直接读缓存。
 */
export function useSubjectMediaHover() {
  const loading = ref(false)

  async function loadMedia(subjectId: string): Promise<SubjectMediaThumb[]> {
    const cached = mediaCache.get(subjectId)
    if (cached) return cached
    if (loadingSet.has(subjectId)) return []

    loadingSet.add(subjectId)
    loading.value = true
    try {
      const rawList = await subjectAssetApi.getMedia(subjectId)
      const mapped = (rawList || [])
        .filter(m => m.thumb || m.path)
        .map(mapRawMedia)
      mediaCache.set(subjectId, mapped)
      return mapped
    } catch {
      mediaCache.set(subjectId, [])
      return []
    } finally {
      loadingSet.delete(subjectId)
      loading.value = false
    }
  }

  function getCached(subjectId: string): SubjectMediaThumb[] | null {
    return mediaCache.get(subjectId) ?? null
  }

  return { loading, loadMedia, getCached }
}

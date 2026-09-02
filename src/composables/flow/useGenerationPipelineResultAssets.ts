import type { GenerationPipelineDeps } from './useGenerationPipeline.types'

export interface GenerationPipelineResultAssetsApi {
  resolveCompletedResultAsset: (item: any, result: any, index: number) => Promise<{
    recordId: string
    preview: string
    thumb: string
    record: any
    width: number
    height: number
    aspectRatio: number
  }>
}

/**
 * Normalizes result asset lookup so record hydration and SSE fallback stay consistent.
 */
export function useGenerationPipelineResultAssets(
  deps: GenerationPipelineDeps,
): GenerationPipelineResultAssetsApi {
  function getResolvedMetrics(item: any, record: any): { width: number; height: number; aspectRatio: number } {
    const media = record?.media?.[0] || item?.media?.[0] || resultMedia(item) || resultMedia(record)
    const mediaInfo = record?.media_info || item?.media_info || record?.data?.media_info || item?.data?.media_info
    const width = Number(media?.width || mediaInfo?.width || record?.width || item?.width || 0)
    const height = Number(media?.height || mediaInfo?.height || record?.height || item?.height || 0)
    return {
      width,
      height,
      aspectRatio:
        width > 0 && height > 0
          ? width / height
          : Number(media?.aspect_ratio || media?.aspectRatio || mediaInfo?.aspect_ratio || mediaInfo?.aspectRatio || item?.aspect_ratio || item?.aspectRatio || 0),
    }
  }

  function resultMedia(source: any): any {
    if (!source) return null
    if (Array.isArray(source?.media) && source.media.length) return source.media[0]
    return source?.media_info || source?.data?.media_info || null
  }

  async function resolveCompletedResultAsset(item: any, result: any, index: number) {
    const recordId = deps.getResultRecordId(result, item, index)
    let thumb = ''
    let preview = ''
    let record = null

    if (recordId) {
      try {
        record = await deps.findTeamonesAigcRecord(recordId)
        if (record) {
          const mediaItem = record?.media?.[0] || record?.media_info
          if (mediaItem?.thumb) thumb = mediaItem.thumb
          if (!preview) {
            preview = mediaItem?.origin_url || record?.url || deps.extractPreviewUrl(record) || ''
          }
        }
      } catch (error) {
        console.warn('[FlowCanvas] fetch record for completed result failed:', error)
      }
    }

    if (!thumb) {
      const rawThumb = item?.thumb
      thumb = typeof rawThumb === 'string' ? rawThumb : ''
    }
    if (!preview) {
      const itemMedia = Array.isArray(item?.media) ? item.media[0] : null
      preview = deps.extractUrl(
        (index === 0 ? result?.data?.media_info?.origin_url : null)
        || itemMedia?.origin_url
        || itemMedia?.url
        || item?.origin_url
        || item?.url
        || item?.thumb,
      ) || deps.extractPreviewUrl(item)
    }

    return { recordId, preview, thumb, record, ...getResolvedMetrics(item, record) }
  }

  return {
    resolveCompletedResultAsset,
  }
}

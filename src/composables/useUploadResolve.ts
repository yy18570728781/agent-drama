import { type Ref } from 'vue'
import { uploadFileToCosUrl, uploadRemoteUrlToCosUrl } from '@/api/uploadHelpers'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'

export interface DroppedAssetInfo {
  id?: string | number
  recordId?: string | number
  url?: string
  type?: string
  prompt?: string
  model?: string
}

export function useUploadResolve(options: {
  refImages: Ref<ReferenceImage[]>
  normalizeReferenceUrlForCompare: (url: string) => string
  getReferenceFileKey: (img: ReferenceImage) => string
}) {
  const { refImages, normalizeReferenceUrlForCompare, getReferenceFileKey } = options

  /** 从 API 返回的 URL 字段中提取可用地址（兼容新对象结构和旧字符串结构） */
  function extractUrl(raw: any): string {
    if (!raw) return ''
    if (typeof raw === 'object') return raw.origin_url || raw.url || raw.proxy_url || ''
    return raw as string
  }

  function extractPreviewUrl(item: any): string | null {
    const previewUrl = extractUrl(item?.thumbnail_url || item?.url)
    return previewUrl || null
  }

  function parseDroppedAssetInfo(raw: string): DroppedAssetInfo | null {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as DroppedAssetInfo) : null
    } catch {
      return null
    }
  }

  async function resolveDroppedAssetUrl(e: DragEvent, fallbackUrl: string): Promise<string> {
    // Lazy import to avoid circular deps
    const { findTeamonesAigcRecord } = await import('@/api/assets')
    const { getAsset } = await import('@/api/assets')
    const assetInfo = parseDroppedAssetInfo(e.dataTransfer?.getData('application/x-asset-info') || '')
    if (!assetInfo) return fallbackUrl

    try {
      if (assetInfo.recordId !== undefined && assetInfo.recordId !== null && assetInfo.recordId !== '') {
        const record = await findTeamonesAigcRecord(assetInfo.recordId)
        const recordUrl = extractUrl(record?.url)
        if (recordUrl) return recordUrl
      }

      if (assetInfo.id !== undefined && assetInfo.id !== null && assetInfo.id !== '') {
        const assetDetail = await getAsset(String(assetInfo.id))
        const detailUrl = extractUrl(assetDetail?.url)
        if (detailUrl) return detailUrl
      }
    } catch (error) {
      console.warn('[GeneratorInput] failed to resolve dropped asset detail url:', error)
    }

    return fallbackUrl || assetInfo.url || ''
  }

  const uploadInputFile = async (item: File | ReferenceImage): Promise<string> => {
    if (item instanceof File) {
      return uploadFileToCosUrl(item)
    }
    if (item.uploaded && typeof item.url === 'string' && /^https?:\/\//.test(item.url)) {
      return item.url
    }
    if (item.sourceUrl) {
      return uploadRemoteUrlToCosUrl(item.sourceUrl)
    }
    if (typeof item.url === 'string' && /^https?:\/\//.test(item.url)) {
      return uploadRemoteUrlToCosUrl(item.url)
    }
    return uploadFileToCosUrl(item.file)
  }

  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [header, base64] = dataUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
    const bytes = atob(base64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new File([arr], filename, { type: mime })
  }

  const resolveReferenceImageGroup = async (images: ReferenceImage[]) => {
    const nextImages: ReferenceImage[] = []
    const resolvedUrls: string[] = []
    const seen = new Set<string>()
    let duplicateCount = 0

    for (const img of images) {
      const resolvedUrl = img.uploaded ? img.url : await uploadInputFile(img)
      const normalized = normalizeReferenceUrlForCompare(resolvedUrl)

      if (normalized && seen.has(normalized)) {
        duplicateCount += 1
        if (img.url?.startsWith('blob:')) {
          URL.revokeObjectURL(img.url)
        }
        continue
      }
      if (normalized) seen.add(normalized)
      resolvedUrls.push(resolvedUrl)
      nextImages.push({
        ...img,
        url: resolvedUrl,
        sourceUrl: img.sourceUrl || resolvedUrl,
        uploaded: true,
      })
    }

    return {
      urls: resolvedUrls,
      images: nextImages,
      duplicateCount,
    }
  }

  const resolveReferenceImageGroupUrls = async (images: ReferenceImage[]): Promise<string[]> => {
    const result = await resolveReferenceImageGroup(images)
    return result.urls
  }

  const resolveRefImageUrls = async (): Promise<string[]> => {
    const { urls, images, duplicateCount } = await resolveReferenceImageGroup(refImages.value)
    const nextImages = images

    refImages.value = nextImages

    if (duplicateCount > 0) {
      const { ElMessage } = await import('element-plus')
      ElMessage.warning(`检测到 ${duplicateCount} 个重复参考资源，已自动跳过`)
    }

    return urls
  }

  const resolveDataUrlToUpload = async (dataUrl: string, index: number): Promise<string> => {
    const file = dataUrlToFile(dataUrl, `batch_image_${index}.png`)
    return uploadInputFile(file)
  }

  return {
    extractUrl,
    extractPreviewUrl,
    parseDroppedAssetInfo,
    resolveDroppedAssetUrl,
    uploadInputFile,
    dataUrlToFile,
    resolveReferenceImageGroup,
    resolveReferenceImageGroupUrls,
    resolveRefImageUrls,
    resolveDataUrlToUpload,
  }
}

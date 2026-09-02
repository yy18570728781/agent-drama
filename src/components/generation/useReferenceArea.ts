import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadFileToCosUrl } from '@/api/uploadHelpers'
import { normalizeReferenceUrlForCompare } from '@/composables/useFileDrop'
import type { ReferenceExternalDropPayload, ReferenceImage } from './referenceMedia.types'

interface ReferenceAreaProps {
  refImages: ReferenceImage[]
  delegateExternalDrop?: boolean
  delegatePreview?: boolean
}

interface ReferenceAreaEmit {
  (e: 'update:ref-images', images: ReferenceImage[]): void
  (e: 'preview', index: number): void
  (e: 'remove', index: number): void
  (e: 'auto-collapse-change', enabled: boolean): void
  (e: 'reference-url-updated', index: number, url: string): void
  (e: 'before-remove-reference', item: unknown): void
  (e: 'request-payload-change'): void
  (e: 'clear-all'): void
  (e: 'remove-upstream', nodeId: string, paramKey: string): void
  (e: 'files-dropped', payload: ReferenceExternalDropPayload): void
}

function getReferenceFileKey(item: ReferenceImage): string {
  const file = item.file
  if (!file?.name && !file?.size) return ''
  return `${file.name || ''}|${file.size || 0}|${file.lastModified || 0}`
}

function getReferenceUrlKeys(item: { sourceUrl?: string; url?: string }): string[] {
  return Array.from(
    new Set<string>(
      [item.sourceUrl, item.url]
        .filter((candidate): candidate is string => typeof candidate === 'string' && !!candidate.trim())
        .map(normalizeReferenceUrlForCompare)
        .filter((candidate): candidate is string => !!candidate)
    )
  )
}

export function useReferenceArea(props: ReferenceAreaProps, emit: ReferenceAreaEmit) {
  const fileUrlsParamRef = ref()
  const previewIndex = ref(-1)
  const editorImageUrl = ref<string | null>(null)
  const editorImageFile = ref<File | null>(null)
  const editorVideoUrl = ref<string | null>(null)
  const editorVideoFile = ref<File | null>(null)

  function dedupeReferenceImages(items: ReferenceImage[]): { images: ReferenceImage[]; duplicateCount: number } {
    const seenUrls = new Set<string>()
    const seenFiles = new Set<string>()
    const images: ReferenceImage[] = []
    let duplicateCount = 0

    items.forEach((item) => {
      const urlKeys = getReferenceUrlKeys(item)
      const fileKey = getReferenceFileKey(item)
      const duplicateUrl = urlKeys.some((key) => seenUrls.has(key))
      const duplicateFile = !!fileKey && seenFiles.has(fileKey)

      if (duplicateUrl || duplicateFile) {
        duplicateCount += 1
        if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
        return
      }

      urlKeys.forEach((key) => seenUrls.add(key))
      if (fileKey) seenFiles.add(fileKey)
      images.push(item)
    })

    return { images, duplicateCount }
  }

  function hasReferenceUrl(url: string, excludeIndex?: number): boolean {
    const normalized = normalizeReferenceUrlForCompare(url)
    if (!normalized) return false
    return props.refImages.some((item, index) => {
      if (typeof excludeIndex === 'number' && index === excludeIndex) return false
      return getReferenceUrlKeys(item).includes(normalized)
    })
  }

  function appendReferenceImageUnique(item: ReferenceImage, replaceIndex?: number): boolean {
    const isDuplicateUrl = getReferenceUrlKeys(item).some((candidate) => hasReferenceUrl(candidate, replaceIndex))
    const fileKey = getReferenceFileKey(item)
    const isDuplicateFile = !!fileKey && props.refImages.some((current, index) => {
      if (typeof replaceIndex === 'number' && index === replaceIndex) return false
      return getReferenceFileKey(current) === fileKey
    })

    if (isDuplicateUrl || isDuplicateFile) {
      if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
      ElMessage.warning('已存在相同的参考资源')
      return false
    }

    if (typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < props.refImages.length) {
      const nextImages = [...props.refImages]
      const current = nextImages[replaceIndex]
      if (current?.url?.startsWith('blob:')) URL.revokeObjectURL(current.url)
      nextImages[replaceIndex] = item
      emit('update:ref-images', nextImages)
      return true
    }

    emit('update:ref-images', [...props.refImages, item])
    return true
  }

  function onRefImagesUpdate(nextImages: ReferenceImage[]): void {
    const { images, duplicateCount } = dedupeReferenceImages(nextImages)
    emit('update:ref-images', images)
    if (duplicateCount > 0) {
      ElMessage.warning(`检测到 ${duplicateCount} 个重复参考资源，已自动跳过`)
    }
  }

  let ownedEditorBlobUrl = ''

  function revokeEditorBlobUrl(): void {
    if (ownedEditorBlobUrl) {
      URL.revokeObjectURL(ownedEditorBlobUrl)
      ownedEditorBlobUrl = ''
    }
  }

  async function fetchRemoteBlob(url: string): Promise<Blob | null> {
    const doFetch = async (u: string): Promise<Response> => {
      const resp = await fetch(u)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return resp
    }
    try {
      return (await doFetch(url)).blob()
    } catch {
      try {
        return (await doFetch(`/__image-proxy?url=${encodeURIComponent(url)}`)).blob()
      } catch {
        return null
      }
    }
  }

  function setEditorFromItem(index: number): void {
    const item = props.refImages[index]
    if (!item) return
    revokeEditorBlobUrl()
    if (item.isVideo || item.mediaType === 'video') {
      editorVideoUrl.value = item.url
      editorVideoFile.value = item.file
      editorImageUrl.value = null
      editorImageFile.value = null
    } else {
      editorImageUrl.value = item.url
      editorImageFile.value = item.file
      editorVideoUrl.value = null
      editorVideoFile.value = null
    }
  }

  async function enrichAndSetEditor(index: number): Promise<void> {
    const item = props.refImages[index]
    if (!item) return
    const remoteUrl = item.sourceUrl || item.url
    if (!/^https?:\/\//i.test(remoteUrl)) {
      setEditorFromItem(index)
      return
    }
    const blob = await fetchRemoteBlob(remoteUrl)
    revokeEditorBlobUrl()
    if (blob) {
      const blobUrl = URL.createObjectURL(blob)
      ownedEditorBlobUrl = blobUrl
      const file = new File([blob], item.file?.name || `ref_${index}.png`, { type: blob.type || 'image/png' })
      if (item.isVideo || item.mediaType === 'video') {
        editorVideoUrl.value = blobUrl
        editorVideoFile.value = file
        editorImageUrl.value = null
        editorImageFile.value = null
      } else {
        editorImageUrl.value = blobUrl
        editorImageFile.value = file
        editorVideoUrl.value = null
        editorVideoFile.value = null
      }
    } else {
      setEditorFromItem(index)
    }
  }

  function onThumbClick(index: number): void {
    if (props.delegatePreview) {
      emit('preview', index)
      return
    }
    previewIndex.value = index
    enrichAndSetEditor(index)
  }

  function onRefImageRemove(index: number): void {
    const removed = props.refImages[index]
    if (props.delegateExternalDrop) {
      emit('before-remove-reference', removed)
      emit('request-payload-change')
      return
    }
    emit('before-remove-reference', removed)
    const nextImages = [...props.refImages]
    if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)
    nextImages.splice(index, 1)
    emit('update:ref-images', nextImages)
    emit('remove', index)
    emit('request-payload-change')
    if (removed?.sourceNodeId) {
      emit('remove-upstream', removed.sourceNodeId, 'file_urls')
    }
  }

  function onClearAllReferences(): void {
    if (props.delegateExternalDrop) {
      props.refImages.forEach((item) => {
        emit('before-remove-reference', item)
      })
      emit('clear-all')
      emit('request-payload-change')
      return
    }

    const nextImages = [...props.refImages]
    nextImages.forEach((item) => {
      if (item?.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
    })
    emit('update:ref-images', [])
    emit('clear-all')
    nextImages.forEach((_, index) => emit('remove', index))
    emit('request-payload-change')
  }

  function closeRefEditor(): void {
    previewIndex.value = -1
    editorImageUrl.value = null
    editorImageFile.value = null
    editorVideoUrl.value = null
    editorVideoFile.value = null
    revokeEditorBlobUrl()
  }

  function onVideoEditApply(): void {
    ElMessage.success('视频编辑已应用')
    closeRefEditor()
  }

  async function onImageEditApply(data: { file: File; url: string }): Promise<void> {
    const index = previewIndex.value
    if (index < 0) return
    const previousUrl = props.refImages[index]?.url

    try {
      const uploadedUrl = await uploadFileToCosUrl(data.file, data.file.name)
      if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
      const nextImages = [...props.refImages]
      nextImages[index] = {
        url: uploadedUrl,
        file: data.file,
        isVideo: false,
        mediaType: 'image',
        sourceUrl: uploadedUrl,
      }
      emit('update:ref-images', nextImages)
      if (data.url.startsWith('blob:')) URL.revokeObjectURL(data.url)
      ElMessage.success('编辑结果已上传并替换')
      closeRefEditor()
      return
    } catch (error) {
      console.error('Failed to upload edited image:', error)
      ElMessage.warning('上传失败，先使用本地编辑结果')
    }

    if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
    const nextImages = [...props.refImages]
    nextImages[index] = {
      url: data.url,
      file: data.file,
      isVideo: false,
      mediaType: 'image',
    }
    emit('update:ref-images', nextImages)
    closeRefEditor()
  }

  function onReferenceAutoCollapseChange(value: boolean): void {
    emit('auto-collapse-change', value)
  }

  function onExternalDrop(payload: ReferenceExternalDropPayload): void {
    emit('files-dropped', payload)
  }

  return {
    fileUrlsParamRef,
    previewIndex,
    editorImageUrl,
    editorImageFile,
    editorVideoUrl,
    editorVideoFile,
    appendReferenceImageUnique,
    hasReferenceUrl,
    onRefImagesUpdate,
    onThumbClick,
    onRefImageRemove,
    onClearAllReferences,
    closeRefEditor,
    onVideoEditApply,
    onImageEditApply,
    onReferenceAutoCollapseChange,
    onExternalDrop,
  }
}

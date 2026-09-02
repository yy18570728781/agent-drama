import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadFileToCosUrl, uploadRemoteUrlToCosUrl } from '@/api/uploadHelpers'
import { maybeCompressImageFilesBeforeUpload } from '@/utils/imageCompressDialogService'
import type { BackendModelInfo, ModelParamSchema } from '@/api/models'
import {
  type ReferenceMediaType,
  VIDEO_EXTS,
  IMAGE_URL_EXTS,
  AUDIO_URL_EXTS,
  MODEL_URL_EXTS,
  REMOTE_MEDIA_URL_EXTS,
  normalizeDroppedUrl,
  normalizeReferenceUrlForCompare,
  inferReferenceMediaTypeFromFile,
  inferReferenceMediaTypeFromUrl,
} from '@/composables/useFileDrop'

// ── Types ─────────────────────────────────────────────────────
export type ReferenceImage = {
  url: string
  file: File
  referenceName?: string
  isVideo: boolean
  mediaType?: ReferenceMediaType
  sourceUrl?: string
  sourceNodeId?: string
  uploaded?: boolean
  uploading?: boolean
  uploadProgress?: number
}

export { type ReferenceMediaType }

// ── Options ───────────────────────────────────────────────────
export interface UseReferenceManagerOptions {
  emit: {
    (e: 'generate-start', payload: any): void
    (e: 'request-payload-change', payload: any): void
    (e: 'reference-url-updated', oldUrl: string, newUrl: string): void
  }
  hasFileParam: ComputedRef<boolean>
  selectedModelInfo: Ref<BackendModelInfo | null>
  selectedCapability: Ref<string>
  selectedMode: Ref<string>
  ensureFileUploadMode: (opts: any) => Promise<boolean>
  modelParams: Ref<ModelParamSchema[]>
  currentModeName: ComputedRef<string>
  /** Called externally when reference-auto-collapse preference changes */
  saveUIRemember: () => void
  /** The auto-collapse ref to update */
  isReferenceAutoCollapseEnabled: Ref<boolean>
  /** Callback to re-render prompt editor after reference changes */
  renderPromptEditorFromState: () => void
  /** Auto-switch to a file-upload-capable mode (from useModeManager) */
  autoSwitchToFileMode?: (silent?: boolean) => Promise<boolean>
  /** Upload a File/ReferenceImage → COS URL (from useUploadResolve) */
  uploadInputFile?: (item: File | ReferenceImage) => Promise<string>
  /** Optional override for UI-side reference capacity, e.g. smart multi-frame mode */
  referenceLimitOverride?: ComputedRef<number | null>
}

// ── Composable ────────────────────────────────────────────────
export function useReferenceManager(options: UseReferenceManagerOptions) {
  const {
    emit,
    hasFileParam,
    selectedModelInfo,
    selectedCapability,
    selectedMode,
    ensureFileUploadMode,
    modelParams,
    currentModeName,
    saveUIRemember,
    isReferenceAutoCollapseEnabled,
    renderPromptEditorFromState,
    autoSwitchToFileMode,
    uploadInputFile: uploadInputFileFn,
    referenceLimitOverride,
  } = options

  // ── State ────────────────────────────────────────────────
  const refImages = ref<ReferenceImage[]>([])
  const contextMenu = ref({ visible: false, x: 0, y: 0, index: -1 })
  const isDragging = ref(false)
  const isBoxHover = ref(false)
  const isExternalDragging = ref(false)
  const hoveredThumb = ref(-1)
  const previewIndex = ref(-1)
  const draggedIndex = ref(-1)
  const dragOverIndex = ref(-1)
  const dragOffset = ref({ x: 0, y: 0 })

  // ── Helper: label / ordinal ──────────────────────────────
  function getReferenceTypeLabel(item: Partial<ReferenceImage> | null | undefined) {
    const mediaType = item?.mediaType || (item?.isVideo ? 'video' : 'image')
    if (mediaType === 'video') return '视频'
    if (mediaType === 'audio') return '音频'
    if (mediaType === '3d_model') return '模型'
    return '图片'
  }

  function getReferenceMediaType(item: Partial<ReferenceImage> | null | undefined): ReferenceMediaType {
    return item?.mediaType || (item?.isVideo ? 'video' : 'image')
  }

  function getReferenceOrdinal(index: number): number {
    const current = refImages.value[index]
    if (!current) return index + 1
    const mediaType = getReferenceMediaType(current)
    let ordinal = 0
    for (let i = 0; i <= index; i += 1) {
      if (getReferenceMediaType(refImages.value[i]) === mediaType) {
        ordinal += 1
      }
    }
    return ordinal
  }

  function getReferenceDisplayLabel(index: number): string {
    const item = refImages.value[index]
    if (!item) return ''
    return `${getReferenceTypeLabel(item)}${getReferenceOrdinal(index)}`
  }

  function getReferenceIndexByTypedOrdinal(mediaTypeLabel: string, ordinal: number): number {
    if (!Number.isFinite(ordinal) || ordinal <= 0) return -1
    let normalizedMediaType: ReferenceMediaType | null = null
    if (mediaTypeLabel === '视频') normalizedMediaType = 'video'
    else if (mediaTypeLabel === '音频') normalizedMediaType = 'audio'
    else if (mediaTypeLabel === '模型') normalizedMediaType = '3d_model'
    else if (mediaTypeLabel === '图' || mediaTypeLabel === '图片') normalizedMediaType = 'image'
    if (!normalizedMediaType) return -1

    let seen = 0
    for (let i = 0; i < refImages.value.length; i += 1) {
      if (getReferenceMediaType(refImages.value[i]) !== normalizedMediaType) continue
      seen += 1
      if (seen === ordinal) return i
    }
    return -1
  }

  // ── Slot-limit helpers ───────────────────────────────────
  function canAddRefImage(): boolean {
    const maxItems = getRefImageMaxItems()
    if (Number.isFinite(maxItems) && refImages.value.length >= maxItems) {
      ElMessage.warning(buildReferenceLimitWarning(maxItems))
      return false
    }
    return true
  }

  function getRefImageMaxItems(): number {
    const overrideMax = referenceLimitOverride?.value
    if (overrideMax) return overrideMax
    const fileParam = modelParams.value.find(p => p.name === 'file_urls')
    return fileParam?.max_items || Infinity
  }

  function getRemainingReferenceSlots(): number {
    const maxItems = getRefImageMaxItems()
    if (!Number.isFinite(maxItems)) return Number.MAX_SAFE_INTEGER
    return Math.max(0, maxItems - refImages.value.length)
  }

  function buildReferenceLimitWarning(maxItems: number): string {
    if (referenceLimitOverride?.value) {
      return `当前模式最多支持 ${maxItems} 张参考图`
    }
    const modelName = selectedModelInfo.value?.display_name || selectedModelInfo.value?.name || ''
    return `模型${modelName ? ' ' + modelName : ''}在${currentModeName.value ? ' ' + currentModeName.value : ''}模式下只支持${maxItems}个参考`
  }

  // ── Upload helpers ───────────────────────────────────────
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

  function buildRemoteReferenceFilename(url: string, contentType = '') {
    const cleanPath = url.split(/[?#]/)[0]
    const rawName = cleanPath.split('/').pop() || `remote_${Date.now()}`
    if (/\.[a-z0-9]+$/i.test(rawName)) return rawName
    if (contentType.includes('png')) return `${rawName}.png`
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return `${rawName}.jpg`
    if (contentType.includes('webp')) return `${rawName}.webp`
    return `${rawName}.png`
  }

  function buildReferenceProxyUrl(url: string) {
    return `/__image-proxy?url=${encodeURIComponent(url)}`
  }

  async function fetchBlobFromUrl(url: string): Promise<Blob | null> {
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      return await response.blob()
    } catch {
      return null
    }
  }

  async function fetchRemoteReferenceAsFile(
    url: string,
    fallbackMediaType: ReferenceMediaType,
    onProgress: (percent: number) => void,
  ): Promise<File | null> {
    onProgress(8)
    let blob = await fetchBlobFromUrl(url)
    if (!blob && fallbackMediaType === 'image') {
      blob = await fetchBlobFromUrl(buildReferenceProxyUrl(url))
    }
    if (!blob) {
      return null
    }
    onProgress(18)
    const blobType = blob.type || (fallbackMediaType === 'image' ? 'image/png' : '')
    const fileName = buildRemoteReferenceFilename(url, blobType)
    onProgress(28)
    return new File([blob], fileName, {
      type: blobType,
      lastModified: Date.now(),
    })
  }

  async function prepareRemoteReferenceFile(
    item: ReferenceImage,
    onProgress: (percent: number) => void,
  ): Promise<File | null> {
    const remoteUrl = item.sourceUrl || item.url
    if (!remoteUrl || !/^https?:\/\//.test(remoteUrl)) return null
    const remoteFile = await fetchRemoteReferenceAsFile(remoteUrl, getReferenceMediaType(item), onProgress)
    if (!(remoteFile instanceof File)) return null
    if (!remoteFile.type.startsWith('image/')) return remoteFile
    const preparedFiles = await maybeCompressImageFilesBeforeUpload([remoteFile])
    if (!preparedFiles?.length) {
      return null
    }
    onProgress(45)
    const preparedFile = preparedFiles[0] instanceof File ? preparedFiles[0] : remoteFile
    return preparedFile
  }

  function patchReferenceImageUploadState(index: number, patch: Partial<ReferenceImage>) {
    const current = refImages.value[index]
    if (!current) return
    refImages.value[index] = {
      ...current,
      ...patch,
    }
  }

  async function uploadReferenceTarget(
    item: ReferenceImage,
    onProgress: (percent: number) => void,
  ): Promise<string> {
    if (item.uploaded && typeof item.url === 'string' && /^https?:\/\//.test(item.url)) {
      onProgress(100)
      return item.url
    }
    if (item.sourceUrl) {
      const preparedFile = await prepareRemoteReferenceFile(item, onProgress)
      if (preparedFile) {
        onProgress(55)
        const nextUrl = await uploadFileToCosUrl(preparedFile, preparedFile.name, (percent) => {
          onProgress(55 + Math.round(percent * 0.45))
        })
        onProgress(100)
        return nextUrl
      }
      onProgress(30)
      const nextUrl = await uploadRemoteUrlToCosUrl(item.sourceUrl)
      onProgress(100)
      return nextUrl
    }
    if (typeof item.url === 'string' && /^https?:\/\//.test(item.url)) {
      const preparedFile = await prepareRemoteReferenceFile(item, onProgress)
      if (preparedFile) {
        onProgress(55)
        const nextUrl = await uploadFileToCosUrl(preparedFile, preparedFile.name, (percent) => {
          onProgress(55 + Math.round(percent * 0.45))
        })
        onProgress(100)
        return nextUrl
      }
      onProgress(30)
      const nextUrl = await uploadRemoteUrlToCosUrl(item.url)
      onProgress(100)
      return nextUrl
    }
    return uploadFileToCosUrl(item.file, item.file.name, onProgress)
  }

  async function uploadReferenceImageAt(index: number) {
    const current = refImages.value[index]
    if (!current || current.uploaded) return

    const previousUrl = current.url
    const preservedSourceUrl = current.sourceNodeId
      ? (current.sourceUrl || current.url)
      : undefined
    patchReferenceImageUploadState(index, {
      uploading: true,
      uploadProgress: 0,
    })
    const nextUrl = uploadInputFileFn
      ? await uploadInputFileFn(current)
      : await uploadReferenceTarget(current, (percent) => {
        patchReferenceImageUploadState(index, {
          uploading: true,
          uploadProgress: percent,
        })
      })
    const nextIndex = refImages.value.findIndex((item, itemIndex) => {
      if (itemIndex === index) return true
      return item.url === previousUrl && getReferenceFileKey(item) === getReferenceFileKey(current)
    })
    if (nextIndex < 0) return

    const latest = refImages.value[nextIndex]
    const duplicateIndex = findReferenceUrlDuplicateIndex(nextUrl, nextIndex)
    if (duplicateIndex >= 0) {
      if (previousUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrl)
      }
      refImages.value.splice(nextIndex, 1)
      ElMessage.warning('已存在相同的参考资源，已自动跳过重复项')
      return
    }
    refImages.value[nextIndex] = {
      ...latest,
      url: nextUrl,
      sourceUrl: preservedSourceUrl || nextUrl,
      uploaded: true,
      uploading: false,
      uploadProgress: 100,
    }
    if (previousUrl !== nextUrl) {
      emit('reference-url-updated', previousUrl, nextUrl)
      emit('request-payload-change', { type: 'reference-url-updated', oldUrl: previousUrl, newUrl: nextUrl })
    }
    if (previousUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previousUrl)
    }
  }

  // ── Add uploaded reference file ──────────────────────────
  async function addUploadedReferenceFile(file: File, replaceIndex?: number) {
    const isReplace = typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < refImages.value.length
    if (!isReplace && !canAddRefImage()) return

    const blobUrl = URL.createObjectURL(file)
    const item: ReferenceImage = {
      url: blobUrl,
      file,
      isVideo: file.type.startsWith('video/'),
      mediaType: inferReferenceMediaTypeFromFile(file),
      uploading: true,
      uploadProgress: 0,
    }
    const appended = appendReferenceImageUnique(item, {
      duplicateMessage: '已存在相同的本地参考文件',
      replaceIndex,
    })

    if (appended) {
      const targetIndex = typeof replaceIndex === 'number' && replaceIndex >= 0
        ? replaceIndex
        : refImages.value.findIndex(img => img.url === blobUrl)
      if (targetIndex >= 0) {
        uploadReferenceImageAt(targetIndex).catch((error) => {
          console.warn('[useReferenceManager] Failed to upload local reference immediately:', error)
        })
      }
    }
  }

  // ── Thumbnail interactions ───────────────────────────────
  function onThumbEnter(e: MouseEvent, i: number) {
    hoveredThumb.value = i
    const thumb = e.currentTarget as HTMLElement
    const vid = thumb.querySelector('video')
    if (vid) vid.play().catch(() => {})
  }

  function onThumbLeave(e: MouseEvent, _i: number) {
    hoveredThumb.value = -1
    const thumb = e.currentTarget as HTMLElement
    const vid = thumb.querySelector('video')
    if (vid) { vid.pause(); vid.currentTime = 0 }
  }

  function onThumbClick(index: number) {
    previewIndex.value = index
  }

  function onRefImageRemove(removed: any) {
    // The actual splice is handled by ReferenceArea; this is a notification-only hook
    // that the component can use to emit upstream-removal events.
  }

  function closeRefEditor() {
    previewIndex.value = -1
  }

  function onVideoEditApply(_data: any) {
    ElMessage.success('视频编辑已应用')
  }

  async function onImageEditApply(data: { file: File; url: string }) {
    const idx = previewIndex.value
    if (idx < 0) return

    const previous = refImages.value[idx]
    const previousUrl = previous?.url

    try {
      const uploadedUrl = await uploadFileToCosUrl(data.file, data.file.name)
      if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
      refImages.value[idx] = {
        url: uploadedUrl,
        file: data.file,
        isVideo: false,
        mediaType: 'image',
        sourceUrl: uploadedUrl,
      }
      if (data.url.startsWith('blob:')) URL.revokeObjectURL(data.url)
      ElMessage.success('编辑结果已上传并替换')
      closeRefEditor()
      return
    } catch (error) {
      console.error('Failed to upload edited image:', error)
      ElMessage.warning('上传失败，先使用本地编辑结果')
    }

    if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
    refImages.value[idx] = {
      url: data.url,
      file: data.file,
      isVideo: false,
      mediaType: 'image',
    }
    closeRefEditor()
  }

  // ── Dedup helpers ────────────────────────────────────────
  function buildRemoteReferenceImage(url: string, type = '', uploading = false): ReferenceImage {
    const cleanPath = url.split(/[?#]/)[0]
    const basename = cleanPath.split('/').pop() || `remote_${Date.now()}`
    const mediaType = type
      ? inferReferenceMediaTypeFromUrl(url, type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : 'image')
      : inferReferenceMediaTypeFromUrl(url, 'image')
    const isVideo = mediaType === 'video'
    const fallbackType = mediaType === 'video'
      ? 'video/mp4'
      : mediaType === 'audio'
        ? 'audio/mpeg'
        : mediaType === '3d_model'
          ? 'model/gltf-binary'
          : 'image/png'
    return {
      url,
      file: new File([], basename, { type: type || fallbackType }),
      isVideo,
      mediaType,
      sourceUrl: url,
      uploading,
      uploadProgress: uploading ? 0 : undefined,
    }
  }

  function getReferenceUrlKeys(item: { sourceUrl?: string; url?: string }): string[] {
    return Array.from(
      new Set(
        [item.sourceUrl, item.url]
          .filter((candidate): candidate is string => typeof candidate === 'string' && !!candidate.trim())
          .map(normalizeReferenceUrlForCompare)
          .filter(Boolean)
      )
    )
  }

  function getAllReferenceUrlKeys(items: Array<{ sourceUrl?: string; url?: string }>): Set<string> {
    const keys = new Set<string>()
    items.forEach((item) => {
      getReferenceUrlKeys(item).forEach((key) => keys.add(key))
    })
    return keys
  }

  function getReferenceFileKey(item: ReferenceImage): string {
    const file = item.file
    if (!file?.name && !file?.size) return ''
    return `${file.name || ''}|${file.size || 0}|${file.lastModified || 0}`
  }

  function dedupeReferenceImages(items: ReferenceImage[]): { images: ReferenceImage[]; duplicateCount: number } {
    const seenUrls = new Set<string>()
    const seenFiles = new Set<string>()
    const images: ReferenceImage[] = []
    let duplicateCount = 0

    items.forEach(item => {
      const urlCandidates = [item.sourceUrl, item.url].filter(Boolean) as string[]
      const urlKeys = urlCandidates.map(normalizeReferenceUrlForCompare).filter(Boolean)
      const fileKey = getReferenceFileKey(item)
      const isDuplicateUrl = urlKeys.some(key => seenUrls.has(key))
      const isDuplicateFile = !!fileKey && seenFiles.has(fileKey)

      if (isDuplicateUrl || isDuplicateFile) {
        duplicateCount += 1
        if (item.url?.startsWith('blob:')) {
          URL.revokeObjectURL(item.url)
        }
        return
      }

      urlKeys.forEach(key => seenUrls.add(key))
      if (fileKey) seenFiles.add(fileKey)
      images.push(item)
    })

    return { images, duplicateCount }
  }

  function onRefImagesUpdate(nextImages: ReferenceImage[], isEmbedded: boolean) {
    const { images, duplicateCount } = dedupeReferenceImages(nextImages)

    if (isEmbedded) {
      const currentFileKeys = new Set(refImages.value.map(item => getReferenceFileKey(item)).filter(Boolean))
      const addedLocalFiles = images
        .filter((item) => item?.file instanceof File)
        .filter((item) => {
          const fileKey = getReferenceFileKey(item)
          return !!fileKey && !currentFileKeys.has(fileKey)
        })
        .map(item => item.file)

      if (addedLocalFiles.length) {
        const remaining = getRemainingReferenceSlots()
        const acceptedFiles = addedLocalFiles.slice(0, remaining)
        if (addedLocalFiles.length > acceptedFiles.length) {
          const maxItems = getRefImageMaxItems()
          ElMessage.warning(buildReferenceLimitWarning(maxItems))
        }
      }
    }

    refImages.value = images
    nextTick(() => {
      renderPromptEditorFromState()
    })
    if (duplicateCount > 0) {
      ElMessage.warning(`检测到 ${duplicateCount} 个重复参考资源，已自动跳过`)
    }
  }

  function onReferenceAutoCollapseChange(value: boolean) {
    isReferenceAutoCollapseEnabled.value = value
    saveUIRemember()
  }

  // ── URL existence helpers ────────────────────────────────
  function hasReferenceUrl(url: string): boolean {
    const normalized = normalizeReferenceUrlForCompare(url)
    if (!normalized) return false
    return refImages.value.some(item => {
      return getReferenceUrlKeys(item).some(candidate => candidate === normalized)
    })
  }

  function hasReferenceUrlExcept(url: string, excludeIndex: number): boolean {
    const normalized = normalizeReferenceUrlForCompare(url)
    if (!normalized) return false
    return refImages.value.some((item, index) => {
      if (index === excludeIndex) return false
      return getReferenceUrlKeys(item).some(candidate => candidate === normalized)
    })
  }

  function findReferenceUrlDuplicateIndex(url: string, excludeIndex: number): number {
    const normalized = normalizeReferenceUrlForCompare(url)
    if (!normalized) return -1
    return refImages.value.findIndex((item, index) => {
      if (index === excludeIndex) return false
      return getReferenceUrlKeys(item).some(candidate => candidate === normalized)
    })
  }

  function hasReferenceFileExcept(fileKey: string, excludeIndex?: number): boolean {
    if (!fileKey) return false
    return refImages.value.some((item, index) => {
      if (typeof excludeIndex === 'number' && index === excludeIndex) return false
      return getReferenceFileKey(item) === fileKey
    })
  }

  function appendReferenceImageUnique(
    item: ReferenceImage,
    options: { duplicateMessage?: string; replaceIndex?: number } = {},
  ): boolean {
    const { duplicateMessage = '已存在相同的参考资源', replaceIndex } = options
    const candidates = getReferenceUrlKeys(item)
    const isDuplicateUrl = candidates.some(candidate => {
      return typeof replaceIndex === 'number'
        ? hasReferenceUrlExcept(candidate, replaceIndex)
        : hasReferenceUrl(candidate)
    })
    const fileKey = getReferenceFileKey(item)
    const isDuplicateFile = hasReferenceFileExcept(fileKey, replaceIndex)

    if (isDuplicateUrl || isDuplicateFile) {
      if (item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url)
      }
      if (duplicateMessage) ElMessage.warning(duplicateMessage)
      return false
    }

    if (typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < refImages.value.length) {
      const current = refImages.value[replaceIndex]
      if (current?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(current.url)
      }
      refImages.value[replaceIndex] = item
      return true
    }

    refImages.value.push(item)
    return true
  }

  async function addRemoteReferenceUrl(url: string, opts: { successMessage?: string; failureMessage?: string; replaceIndex?: number } = {}) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false
    const isReplace = typeof opts.replaceIndex === 'number' && opts.replaceIndex >= 0 && opts.replaceIndex < refImages.value.length
    if (!isReplace && !canAddRefImage()) return false

    if (isReplace ? hasReferenceUrlExcept(url, opts.replaceIndex!) : hasReferenceUrl(url)) {
      ElMessage.warning('已存在相同的参考资源')
      return false
    }

    const appendedRemote = appendReferenceImageUnique(buildRemoteReferenceImage(url, '', true), {
      duplicateMessage: '已存在相同的参考资源',
      replaceIndex: opts.replaceIndex,
    })
    if (appendedRemote) {
      const nextIndex = isReplace ? opts.replaceIndex! : refImages.value.findIndex(item => item.url === url || item.sourceUrl === url)
      if (nextIndex >= 0) {
        uploadReferenceImageAt(nextIndex).catch((error) => {
          console.warn('[useReferenceManager] Failed to upload remote reference immediately:', error)
        })
      }
      if (opts.successMessage) ElMessage.success(opts.successMessage)
      return true
    }

    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      if (!blob.type.startsWith('image/') && !blob.type.startsWith('video/') && !blob.type.startsWith('audio/')) {
        if (!REMOTE_MEDIA_URL_EXTS.test(url)) {
          ElMessage.warning(opts.failureMessage || '无法加载该链接的资源')
          return false
        }
        const appended = appendReferenceImageUnique(buildRemoteReferenceImage(url, '', true), {
          duplicateMessage: '已存在相同的参考资源',
          replaceIndex: opts.replaceIndex,
        })
        if (!appended) return false
        if (opts.successMessage) ElMessage.success(opts.successMessage)
        return true
      }
      const ext = blob.type.split('/')[1] || 'png'
      const file = new File([blob], `remote_${Date.now()}.${ext}`, { type: blob.type })
      const appended = appendReferenceImageUnique({
        url: URL.createObjectURL(file),
        file,
        isVideo: blob.type.startsWith('video/'),
        sourceUrl: url,
        uploading: true,
        uploadProgress: 0,
      }, {
        duplicateMessage: '已存在相同的参考资源',
        replaceIndex: opts.replaceIndex,
      })
      if (!appended) return false
      const nextIndex = isReplace
        ? opts.replaceIndex!
        : refImages.value.findIndex(item =>
          item.sourceUrl === url && item.file.name === file.name && item.file.size === file.size
        )
      if (nextIndex >= 0) {
        uploadReferenceImageAt(nextIndex).catch((error) => {
          console.warn('[useReferenceManager] Failed to upload fetched remote reference immediately:', error)
        })
      }
      if (opts.successMessage) ElMessage.success(opts.successMessage)
      return true
    } catch {
      if (!REMOTE_MEDIA_URL_EXTS.test(url)) {
        ElMessage.warning(opts.failureMessage || '无法加载链接')
        return false
      }
      const appended = appendReferenceImageUnique(buildRemoteReferenceImage(url, '', true), {
        duplicateMessage: '已存在相同的参考资源',
        replaceIndex: opts.replaceIndex,
      })
      if (!appended) return false
      const nextIndex = isReplace ? opts.replaceIndex! : refImages.value.findIndex(item => item.url === url || item.sourceUrl === url)
      if (nextIndex >= 0) {
        uploadReferenceImageAt(nextIndex).catch((error) => {
          console.warn('[useReferenceManager] Failed to upload fallback remote reference immediately:', error)
        })
      }
      if (opts.successMessage) ElMessage.success(opts.successMessage)
      return true
    }
  }

  // ── Set / add reference media (full-list operations) ────
  async function setReferenceMedia(items: Array<{ url: string; referenceName?: string; isVideo?: boolean; mediaType?: ReferenceMediaType; nodeId?: string }> = []) {
    if (items.length && !hasFileParam.value) {
      const switched = await autoSwitchToFileMode?.(true)
      if (!switched) return false
      await nextTick()
    }

    refImages.value.forEach(item => {
      if (typeof item.url === 'string' && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url)
      }
    })

    refImages.value = items
      .filter(item => !!item?.url)
      .map((item, index) => {
        const cleanPath = String(item.url).split(/[?#]/)[0]
        const basename = item.referenceName?.trim() || cleanPath.split('/').pop() || `reference_${index + 1}`
        const mediaType = item.mediaType
          ? inferReferenceMediaTypeFromUrl(String(item.url), item.mediaType)
          : inferReferenceMediaTypeFromUrl(String(item.url), item.isVideo ? 'video' : 'image')
        const isVideo = mediaType === 'video'
        return {
          url: item.url,
          sourceUrl: item.url,
          referenceName: item.referenceName?.trim() || undefined,
          sourceNodeId: item.nodeId,
          isVideo,
          uploaded: true,
          mediaType,
          file: new File([], basename, { type: isVideo ? 'video/mp4' : mediaType === 'audio' ? 'audio/mpeg' : mediaType === '3d_model' ? 'model/gltf-binary' : 'image/png' }),
        } as ReferenceImage
      })

    return true
  }

  async function addReferenceMedia(items: Array<{ url: string; referenceName?: string; isVideo?: boolean; mediaType?: ReferenceMediaType; nodeId?: string; uploaded?: boolean }>) {
    if (!items.length) return false

    if (!hasFileParam.value) {
      const switched = await autoSwitchToFileMode?.(true)
      if (!switched) return false
      await nextTick()
    }

    const existingNorms = getAllReferenceUrlKeys(refImages.value)
    let duplicateCount = 0
    let addedCount = 0
    const uploadTasks: Promise<void>[] = []

    const maxItems = getRefImageMaxItems()
    const remaining = getRemainingReferenceSlots()
    const limitedItems = remaining > 0 ? items.slice(0, remaining) : []
    if (items.length > limitedItems.length) {
      ElMessage.warning(buildReferenceLimitWarning(maxItems))
    }
    if (!limitedItems.length) return false

    limitedItems.forEach((item, index) => {
      if (!item.url) return
      const urlKeys = getReferenceUrlKeys({ sourceUrl: item.url, url: item.url })
      if (urlKeys.some(key => existingNorms.has(key))) {
        duplicateCount += 1
        return
      }

      const cleanPath = item.url.split(/[?#]/)[0]
      const basename = item.referenceName?.trim() || cleanPath.split('/').pop() || `reference_${index + 1}`
      const mediaType = item.mediaType
        ? inferReferenceMediaTypeFromUrl(String(item.url), item.mediaType)
        : inferReferenceMediaTypeFromUrl(String(item.url), item.isVideo ? 'video' : 'image')
      const isVideo = mediaType === 'video'
      const file = new File([], basename, { type: isVideo ? 'video/mp4' : mediaType === 'audio' ? 'audio/mpeg' : mediaType === '3d_model' ? 'model/gltf-binary' : 'image/png' })

      refImages.value.push({
        url: item.url,
        file,
        isVideo,
        mediaType,
        sourceUrl: item.url,
        referenceName: item.referenceName?.trim() || undefined,
        sourceNodeId: item.nodeId,
        uploaded: item.uploaded === true ? true : undefined,
      })
      if (item.uploaded !== true) {
        uploadTasks.push(uploadReferenceImageAt(refImages.value.length - 1).catch((error) => {
          console.warn('[useReferenceManager] Failed to upload reference media immediately:', error)
        }))
      }
      urlKeys.forEach(key => existingNorms.add(key))
      addedCount += 1
    })

    if (uploadTasks.length) {
      await Promise.allSettled(uploadTasks)
    }
    if (duplicateCount > 0) {
      ElMessage.warning(`检测到 ${duplicateCount} 个重复参考资源，已自动跳过`)
    }
    return addedCount > 0
  }

  async function addReferenceMediaAt(
    item: { url: string; referenceName?: string; isVideo?: boolean; mediaType?: ReferenceMediaType; nodeId?: string; uploaded?: boolean },
    replaceIndex?: number,
  ) {
    if (!item?.url) return false
    if (typeof replaceIndex !== 'number') return addReferenceMedia([item])
    if (!hasFileParam.value) {
      const switched = await autoSwitchToFileMode?.(true)
      if (!switched) return false
      await nextTick()
    }
    const cleanPath = item.url.split(/[?#]/)[0]
    const basename = item.referenceName?.trim() || cleanPath.split('/').pop() || `reference_${replaceIndex + 1}`
    const mediaType = item.mediaType
      ? inferReferenceMediaTypeFromUrl(String(item.url), item.mediaType)
      : inferReferenceMediaTypeFromUrl(String(item.url), item.isVideo ? 'video' : 'image')
    const isVideo = mediaType === 'video'
    const file = new File([], basename, { type: isVideo ? 'video/mp4' : mediaType === 'audio' ? 'audio/mpeg' : mediaType === '3d_model' ? 'model/gltf-binary' : 'image/png' })
    const appended = appendReferenceImageUnique({
      url: item.url,
      file,
      isVideo,
      mediaType,
      sourceUrl: item.url,
      referenceName: item.referenceName?.trim() || undefined,
      sourceNodeId: item.nodeId,
      uploaded: !!item.uploaded,
    }, {
      duplicateMessage: '已存在相同的参考资源',
      replaceIndex,
    })
    return appended
  }

  // ── Reference order helpers ──────────────────────────────
  function getReferenceOrderKey(item: Partial<ReferenceImage> | null | undefined): string {
    const sourceNodeId = typeof item?.sourceNodeId === 'string' ? item.sourceNodeId.trim() : ''
    if (sourceNodeId) return `node:${sourceNodeId}`
    const url = typeof item?.sourceUrl === 'string' && item.sourceUrl.trim()
      ? item.sourceUrl.trim()
      : (typeof item?.url === 'string' ? item.url.trim() : '')
    return url ? `url:${url}` : ''
  }

  function getReferenceOrder(items: ReferenceImage[] = []): string[] {
    const out: string[] = []
    items.forEach((item) => {
      const key = getReferenceOrderKey(item)
      if (key && !out.includes(key)) out.push(key)
    })
    return out
  }

  function collectRememberedReferenceOrder(data: Record<string, any> | null | undefined): string[] {
    if (!Array.isArray(data?.referenceOrder)) return []
    return data.referenceOrder
      .map((item: any) => typeof item === 'string' ? item.trim() : '')
      .filter((item: string, index: number, arr: string[]) => !!item && arr.indexOf(item) === index)
  }

  function sortReferenceImagesByOrder(images: ReferenceImage[], order: string[]): ReferenceImage[] {
    if (!images.length || !order.length) return images
    const keyed = images.map((item, index) => ({ item, index, key: getReferenceOrderKey(item) }))
    const rank = new Map(order.map((key, index) => [key, index] as const))
    return [...keyed]
      .sort((a, b) => {
        const aRank = a.key && rank.has(a.key) ? rank.get(a.key)! : Number.MAX_SAFE_INTEGER
        const bRank = b.key && rank.has(b.key) ? rank.get(b.key)! : Number.MAX_SAFE_INTEGER
        if (aRank !== bRank) return aRank - bRank
        return a.index - b.index
      })
      .map(entry => entry.item)
  }

  // ── Add files (batch) ────────────────────────────────────
  const addFiles = async (files: FileList | File[], isEmbedded: boolean, replaceIndex?: number) => {
    const supportedFiles = Array.from(files).filter((file) => {
      const mediaType = inferReferenceMediaTypeFromFile(file)
      return ['image', 'video', 'audio', '3d_model'].includes(mediaType)
    })
    if (isEmbedded) {
      const remaining = getRemainingReferenceSlots()
      const acceptedFiles = supportedFiles.slice(0, remaining)
      if (supportedFiles.length > acceptedFiles.length) {
        const maxItems = getRefImageMaxItems()
        ElMessage.warning(buildReferenceLimitWarning(maxItems))
      }
      return acceptedFiles
    }

    const uploadReady = await ensureFileUploadMode({
      warnOnFailure: true,
      warningMessage: '当前模型没有支持文件上传的模式',
    })
    if (!uploadReady) return []

    const preparedFiles = await maybeCompressImageFilesBeforeUpload(supportedFiles)
    if (!preparedFiles?.length) return []

    const keys = new Set(refImages.value.map(i => `${i.file.name}|${i.file.size}`))
    const maxItems = getRefImageMaxItems()
    let duplicateCount = 0
    const uniqueFiles: File[] = []
    for (const file of preparedFiles) {
      const mediaType = inferReferenceMediaTypeFromFile(file)
      if (!['image', 'video', 'audio', '3d_model'].includes(mediaType)) continue
      const key = `${file.name}|${file.size}`
      if (keys.has(key)) {
        duplicateCount += 1
        continue
      }
      keys.add(key)
      uniqueFiles.push(file)
    }

    const isReplace = typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < refImages.value.length
    const remaining = isReplace ? 1 : getRemainingReferenceSlots()
    const acceptedFiles = uniqueFiles.slice(0, remaining)
    if (uniqueFiles.length > acceptedFiles.length) {
      ElMessage.warning(buildReferenceLimitWarning(maxItems))
    }

    for (const file of acceptedFiles) {
      const mediaType = inferReferenceMediaTypeFromFile(file)
      try {
        await addUploadedReferenceFile(file, isReplace ? replaceIndex : undefined)
      } catch (error) {
        console.error('Failed to upload reference file:', error)
        if (isReplace || canAddRefImage()) {
          appendReferenceImageUnique(
            { url: URL.createObjectURL(file), file, isVideo: file.type.startsWith('video/'), mediaType },
            { duplicateMessage: '已存在相同的本地参考文件', replaceIndex: isReplace ? replaceIndex : undefined }
          )
          ElMessage.warning(`"${file.name}" 上传失败，先保留本地引用`)
        }
      }
    }
    if (duplicateCount > 0) {
      ElMessage.warning(`检测到 ${duplicateCount} 个重复参考资源，已自动跳过`)
    }
    return preparedFiles
  }

  return {
    // State
    refImages,
    contextMenu,
    previewIndex,
    isDragging,
    isBoxHover,
    isExternalDragging,
    hoveredThumb,
    draggedIndex,
    dragOverIndex,
    dragOffset,

    // Slot-limit helpers
    canAddRefImage,
    getRefImageMaxItems,
    getRemainingReferenceSlots,

    // Upload / add
    addUploadedReferenceFile,
    addFiles,
    uploadReferenceImageAt,

    // Thumbnail interactions
    onThumbEnter,
    onThumbLeave,
    onThumbClick,
    onRefImageRemove,
    closeRefEditor,
    onVideoEditApply,
    onImageEditApply,

    // Dedup
    dedupeReferenceImages,
    onRefImagesUpdate,
    onReferenceAutoCollapseChange,

    // URL existence
    hasReferenceUrl,
    hasReferenceUrlExcept,
    hasReferenceFileExcept,
    appendReferenceImageUnique,
    addRemoteReferenceUrl,

    // Order
    getReferenceOrderKey,
    getReferenceOrder,
    collectRememberedReferenceOrder,
    sortReferenceImagesByOrder,

    // URL normalization (re-export for convenience)
    normalizeReferenceUrlForCompare,
    buildRemoteReferenceImage,
    getReferenceUrlKeys,
    getAllReferenceUrlKeys,
    getReferenceFileKey,

    // Label / type helpers
    getReferenceTypeLabel,
    getReferenceMediaType,
    getReferenceOrdinal,
    getReferenceDisplayLabel,
    getReferenceIndexByTypedOrdinal,
    inferReferenceMediaTypeFromFile,
    inferReferenceMediaTypeFromUrl,

    // Full-list operations
    setReferenceMedia,
    addReferenceMedia,
    addReferenceMediaAt,
  }
}

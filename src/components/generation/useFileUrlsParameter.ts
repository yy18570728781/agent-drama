import { computed, ref } from 'vue'
import type { ModelParamSchema } from '@/api/models'
import { useAssetDragOut, type AssetDragPayload } from '@/composables/assets/useAssetDragOut'
import type { ReferenceExternalDropPayload, ReferenceImage } from './referenceMedia.types'
import {
  compactReferenceImages,
  createEmptyReferenceImage,
  createReferenceImageFromFile,
  ensureReferenceImageLength,
  inferReferenceMediaKind,
  uploadReferenceImageAt,
} from './referenceImage.utils'
import { buildReferenceExternalDropPayload } from './useReferenceExternalDrop'

interface FileUrlsParameterProps {
  fileParam: ModelParamSchema
  images: ReferenceImage[]
  maxItems?: number
  maxItemsWarning?: string
  delegateExternalDrop?: boolean
}

interface FileUrlsParameterEmit {
  (e: 'update:images', images: ReferenceImage[]): void
  (e: 'preview', index: number): void
  (e: 'remove', index: number): void
  (e: 'clear-all'): void
  (e: 'auto-collapse-change', val: boolean): void
  (e: 'external-drop', payload: ReferenceExternalDropPayload): void
}

type SlotItem = { key: string; label: string }

export function useFileUrlsParameter(props: FileUrlsParameterProps, emit: FileUrlsParameterEmit) {
  const assetDragOut = useAssetDragOut()
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const uploadTargetIndex = ref(-1)
  const dragOverIndex = ref(-1)
  const reorderHoverIndex = ref(-1)
  const draggedIndex = ref(-1)
  const internalDragToken = ref('')
  const areaDragOver = ref(false)

  const subParams = computed(() => props.fileParam.sub_params || [])
  const hasFixedSlots = computed(() => subParams.value.length > 1)
  const canAppend = computed(() => !props.maxItems || props.images.length < props.maxItems)
  const canReorder = computed(() => props.images.length > 1)
  const slotItems = computed<SlotItem[]>(() => {
    if (hasFixedSlots.value) {
      return subParams.value.map((item, index) => ({
        key: item.name || `slot-${index}`,
        label: item.label || `参考 ${index + 1}`,
      }))
    }
    const singleLabel = subParams.value[0]?.label || '参考'
    const count = Math.max(props.images.length + (canAppend.value ? 1 : 0), 1)
    return Array.from({ length: count }, (_, index) => ({ key: `reference-${index}`, label: singleLabel }))
  })

  function getImage(index: number): ReferenceImage | null {
    return props.images[index] || null
  }

  function hasExternalAssetPayload(event: DragEvent): boolean {
    return !!event.dataTransfer?.getData('application/x-asset-info')
      || !!event.dataTransfer?.getData('application/x-asset-url')
      || !!event.dataTransfer?.getData('text/uri-list')
      || !!event.dataTransfer?.getData('text/plain')
  }

  function isInternalReorderDrag(event: DragEvent): boolean {
    return draggedIndex.value >= 0
      && !hasExternalAssetPayload(event)
      && !!internalDragToken.value
      && !!event.dataTransfer?.types.includes('application/x-reference-reorder')
  }

  function triggerUpload(index: number): void {
    uploadTargetIndex.value = index
    if (!fileInputRef.value) return
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }

  function emitImages(images: ReferenceImage[]): void {
    emit('update:images', images)
  }

  function getImageUrlKey(image: ReferenceImage | null | undefined): string {
    const raw = String(image?.sourceUrl || image?.url || '').trim()
    if (!raw) return ''
    return raw.replace(/#.*$/, '')
  }

  function hasDuplicateReferenceUrl(image: ReferenceImage, excludeIndex?: number): boolean {
    const nextUrlKey = getImageUrlKey(image)
    if (!nextUrlKey) return false
    return props.images.some((item, itemIndex) => {
      if (typeof excludeIndex === 'number' && itemIndex === excludeIndex) return false
      return getImageUrlKey(item) === nextUrlKey
    })
  }

  function replaceImageAt(index: number, images: ReferenceImage[]): void {
    const nextImages = [...props.images]
    const current = nextImages[index]
    if (current?.url?.startsWith('blob:')) URL.revokeObjectURL(current.url)
    nextImages.splice(index, 1, ...images)
    emitImages(nextImages)
  }

  async function applyFiles(files: FileList | File[], index = -1): Promise<void> {
    const accepted = Array.from(files)
      .filter((file) => !!inferReferenceMediaKind(file))
      .map(createReferenceImageFromFile)
    if (!accepted.length) return

    const isReplace = index >= 0 && index < props.images.length
    if (isReplace) {
      const [firstAccepted] = accepted
      const [firstFile] = Array.from(files)
      if (!firstAccepted || !firstFile) return
      if (hasDuplicateReferenceUrl(firstAccepted, index)) {
        if (firstAccepted.url?.startsWith('blob:')) URL.revokeObjectURL(firstAccepted.url)
        return
      }
      replaceImageAt(index, [firstAccepted])
      await resolveUploadedFile(firstFile, index, firstAccepted.url)
      return
    }

    const remaining = props.maxItems ? Math.max(0, props.maxItems - props.images.length) : accepted.length
    const appended = props.maxItems ? accepted.slice(0, remaining) : accepted
    if (!appended.length) return
    emitImages([...props.images, ...appended])
  }

  async function resolveUploadedFile(file: File, index: number, blobUrl: string): Promise<void> {
    await uploadReferenceImageAt(file, () => props.images, index, blobUrl, emitImages)
  }

  async function applyDroppedFiles(files: File[], index: number): Promise<void> {
    if (!files.length) return
    const isReplace = index >= 0 && index < props.images.length && !!getImage(index)?.url
    if (isReplace) {
      const [file] = files
      if (!file || !inferReferenceMediaKind(file)) return
      await applyFiles([file], index)
      return
    }

    const acceptedFiles = files.filter((file) => !!inferReferenceMediaKind(file))
    if (!acceptedFiles.length) return

    if (index >= 0 && !getImage(index)?.url) {
      const nextImages = [...props.images]
      for (let offset = 0; offset < acceptedFiles.length; offset += 1) {
        const file = acceptedFiles[offset]
        const targetIndex = index + offset
        const blobItem = createReferenceImageFromFile(file)
        const padded = ensureReferenceImageLength(nextImages, targetIndex + 1)
        padded[targetIndex] = blobItem
        nextImages.splice(0, nextImages.length, ...padded)
        await resolveUploadedFile(file, targetIndex, blobItem.url)
      }
      emitImages(compactReferenceImages(nextImages))
      return
    }

    await applyFiles(acceptedFiles)
  }

  async function onFileChange(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files
    if (!files?.length) return
    if (props.delegateExternalDrop) {
      const acceptedFiles = Array.from(files).filter((file) => !!inferReferenceMediaKind(file))
      if (acceptedFiles.length) {
        emit('external-drop', {
          files: acceptedFiles,
          ...(uploadTargetIndex.value >= 0 ? { replaceIndex: uploadTargetIndex.value } : {}),
        })
      }
      uploadTargetIndex.value = -1
      return
    }
    await applyFiles(files, uploadTargetIndex.value)
    uploadTargetIndex.value = -1
  }

  function removeImage(index: number): void {
    const nextImages = [...props.images]
    const removed = nextImages[index]
    if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)
    nextImages.splice(index, 1)
    emitImages(nextImages)
    if (removed) emit('remove', index)
  }

  function clearAllImages(): void {
    emit('clear-all')
  }

  function getCardStyle(index: number): Record<string, string> {
    return {
      '--drag-shift-x': '0px',
      '--insert-gap-left': '0px',
      '--insert-gap-right': '0px',
    }
  }

  function onCardDragStart(event: DragEvent, index: number): void {
    const image = getImage(index)
    if (!image || !event.dataTransfer) return
    draggedIndex.value = index
    internalDragToken.value = `${Date.now()}-${index}`
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-reference-reorder', '1')
    event.dataTransfer.setData('application/x-reference-reorder-token', internalDragToken.value)
    event.dataTransfer.setData('text/x-ref-index', String(index))
    const ghost = new window.Image()
    ghost.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    event.dataTransfer.setDragImage(ghost, 0, 0)
  }

  function onCardDragEnd(event?: DragEvent): void {
    internalDragToken.value = ''
    draggedIndex.value = -1
    dragOverIndex.value = -1
    reorderHoverIndex.value = -1
  }

  function onCardDragPrepare(_index: number): void {}

  function onInsertSlotDragOver(event: DragEvent, insertIndex: number): void {
    if (!isInternalReorderDrag(event)) return
    if (dragOverIndex.value !== -1) dragOverIndex.value = -1
    if (reorderHoverIndex.value !== insertIndex) reorderHoverIndex.value = insertIndex
  }

  async function onInsertSlotDrop(event: DragEvent, insertIndex: number): Promise<void> {
    event.stopPropagation()
    areaDragOver.value = false
    if (draggedIndex.value < 0) return
    event.preventDefault()
    const internalIndex = draggedIndex.value
    const normalizedInsertIndex = Math.max(0, Math.min(props.images.length, insertIndex))
    if (normalizedInsertIndex !== internalIndex && normalizedInsertIndex !== internalIndex + 1) {
      const nextImages = [...props.images]
      const [draggedItem] = nextImages.splice(internalIndex, 1)
      const targetIndex = internalIndex < normalizedInsertIndex ? normalizedInsertIndex - 1 : normalizedInsertIndex
      nextImages.splice(Math.max(0, targetIndex), 0, draggedItem)
      emitImages(nextImages)
    }
    draggedIndex.value = -1
    dragOverIndex.value = -1
    reorderHoverIndex.value = -1
    internalDragToken.value = ''
  }

  function onExternalDragPrepare(index: number): void {
    const image = getImage(index)
    if (!image) return
    assetDragOut.prepare(buildReferenceAssetDragPayload(image, index))
  }

  function onExternalDragStart(event: DragEvent, index: number): void {
    const image = getImage(index)
    if (!image) return
    event.stopPropagation()
    assetDragOut.startDrag(event, buildReferenceAssetDragPayload(image, index))
  }

  function onExternalDragEnd(event: DragEvent, index: number): void {
    const image = getImage(index)
    if (!image) return
    assetDragOut.endDrag(event, buildReferenceAssetDragPayload(image, index))
  }

  async function emitExternalOrApplyDrop(
    event: DragEvent,
    index?: number,
    hoveredReplaceIndex?: number,
  ): Promise<void> {
    const fallbackReplaceIndex = typeof index === 'number'
      ? index
      : (
          typeof hoveredReplaceIndex === 'number'
          && hoveredReplaceIndex >= 0
          && !!getImage(hoveredReplaceIndex)?.url
            ? hoveredReplaceIndex
            : (
              dragOverIndex.value >= 0
              && !!getImage(dragOverIndex.value)?.url
                ? dragOverIndex.value
                : undefined
            )
        )
    const payload = buildReferenceExternalDropPayload(event, fallbackReplaceIndex)
    if (!payload) return
    if (props.delegateExternalDrop || payload.urls?.length || payload.assetInfo) {
      emit('external-drop', payload)
      return
    }
    if (payload.files?.length) {
      await applyDroppedFiles(payload.files, typeof index === 'number' ? index : props.images.length)
    }
  }

  async function onFilledCardDrop(event: DragEvent, index: number): Promise<void> {
    event.stopPropagation()
    areaDragOver.value = false
    if (draggedIndex.value >= 0) {
      event.preventDefault()
      const internalIndex = draggedIndex.value
      const rawInsertIndex = reorderHoverIndex.value >= 0 ? reorderHoverIndex.value : index
      const insertIndex = Math.max(0, Math.min(props.images.length, rawInsertIndex))
      if (insertIndex !== internalIndex && insertIndex !== internalIndex + 1) {
        const nextImages = [...props.images]
        const [draggedItem] = nextImages.splice(internalIndex, 1)
        const targetIndex = internalIndex < insertIndex ? insertIndex - 1 : insertIndex
        nextImages.splice(Math.max(0, targetIndex), 0, draggedItem)
        emitImages(nextImages)
      }
      draggedIndex.value = -1
      dragOverIndex.value = -1
      reorderHoverIndex.value = -1
      internalDragToken.value = ''
      return
    }
    dragOverIndex.value = -1
    reorderHoverIndex.value = -1
    await emitExternalOrApplyDrop(event, index)
  }

  async function onEmptyCardDrop(event: DragEvent): Promise<void> {
    event.stopPropagation()
    areaDragOver.value = false
    const hoveredReplaceIndex = dragOverIndex.value
    if (draggedIndex.value >= 0) {
      event.preventDefault()
      const internalIndex = draggedIndex.value
      const insertIndex = Math.max(0, Math.min(props.images.length, reorderHoverIndex.value >= 0 ? reorderHoverIndex.value : props.images.length))
      if (insertIndex !== internalIndex && insertIndex !== internalIndex + 1) {
        const nextImages = [...props.images]
        const [draggedItem] = nextImages.splice(internalIndex, 1)
        const targetIndex = internalIndex < insertIndex ? insertIndex - 1 : insertIndex
        nextImages.splice(Math.max(0, targetIndex), 0, draggedItem)
        emitImages(nextImages)
      }
      draggedIndex.value = -1
      dragOverIndex.value = -1
      reorderHoverIndex.value = -1
      internalDragToken.value = ''
      return
    }
    dragOverIndex.value = -1
    reorderHoverIndex.value = -1
    await emitExternalOrApplyDrop(event, undefined, hoveredReplaceIndex)
  }

  function onAreaDragOver(event: DragEvent): void {
    if (isInternalReorderDrag(event)) return
    areaDragOver.value = true
  }

  function onAreaDragLeave(event: DragEvent): void {
    const currentTarget = event.currentTarget
    const relatedTarget = event.relatedTarget
    if (currentTarget instanceof HTMLElement && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
      return
    }
    areaDragOver.value = false
  }

  async function onAreaDrop(event: DragEvent): Promise<void> {
    if (isInternalReorderDrag(event)) {
      areaDragOver.value = false
      return
    }
    areaDragOver.value = false
    dragOverIndex.value = -1
    reorderHoverIndex.value = -1
    await emitExternalOrApplyDrop(event)
  }

  function load_params(urls: string[]): void {
    if (subParams.value.length <= 1) {
      const images = urls.filter(Boolean).map((url, index) => {
        const isVideo = /\.(mp4|webm|mov|avi)(\?.*)?$/i.test(url)
        return {
          url,
          file: new File([], url.split('/').pop() || `file_${index}`),
          isVideo,
          mediaType: isVideo ? 'video' as const : 'image' as const,
          sourceUrl: url,
          uploaded: true,
        }
      })
      emitImages(images)
      return
    }
    const images = subParams.value.map((_, index) => {
      const url = urls[index]
      if (!url) return createEmptyReferenceImage()
      const isVideo = /\.(mp4|webm|mov|avi)(\?.*)?$/i.test(url)
      return {
        url,
        file: new File([], url.split('/').pop() || `file_${index}`),
        isVideo,
        mediaType: isVideo ? 'video' as const : 'image' as const,
        sourceUrl: url,
        uploaded: true,
      }
    })
    emitImages(compactReferenceImages(images))
  }

  return {
    fileInputRef,
    areaDragOver,
    dragOverIndex,
    reorderHoverIndex,
    draggedIndex,
    canReorder,
    slotItems,
    getCardStyle,
    getImage,
    clearAllImages,
    removeImage,
    load_params,
    get_urls: () => props.images.map((image) => image?.url || '').filter(Boolean),
    onCardClick: (index: number) => getImage(index)?.url ? emit('preview', index) : triggerUpload(index),
    onCardDragPrepare,
    onCardDragStart,
    onCardDragEnd,
    onExternalDragPrepare,
    onExternalDragStart,
    onExternalDragEnd,
    onFileChange,
    onDragOver: (event: DragEvent, index: number) => {
      if (isInternalReorderDrag(event)) {
        const currentTarget = event.currentTarget
        if (!(currentTarget instanceof HTMLElement)) return
        const rect = currentTarget.getBoundingClientRect()
        const midpoint = rect.left + rect.width / 2
        const placeAfter = event.clientX >= midpoint
        const nextHoverIndex = Math.max(0, Math.min(props.images.length, index + (placeAfter ? 1 : 0)))
        if (dragOverIndex.value !== -1) dragOverIndex.value = -1
        if (reorderHoverIndex.value !== nextHoverIndex) reorderHoverIndex.value = nextHoverIndex
        return
      }
      if (dragOverIndex.value !== index) dragOverIndex.value = index
      if (reorderHoverIndex.value !== -1) reorderHoverIndex.value = -1
    },
    onDragLeave: (event: DragEvent, index: number) => {
      const currentTarget = event.currentTarget
      const relatedTarget = event.relatedTarget
      if (currentTarget instanceof HTMLElement && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
        return
      }
      if (dragOverIndex.value === index) dragOverIndex.value = -1
      if (reorderHoverIndex.value === index || reorderHoverIndex.value === index + 1) reorderHoverIndex.value = -1
    },
    onAreaDragOver,
    onAreaDragLeave,
    onAreaDrop,
    onFilledCardDrop,
    onEmptyCardDrop,
    addFiles: applyFiles,
  }
}

function buildReferenceAssetDragPayload(image: ReferenceImage, index: number): AssetDragPayload {
  const sourceUrl = String(image.sourceUrl || image.url || '').trim()
  const isVideo = Boolean(image.isVideo || image.mediaType === 'video')
  return {
    id: sourceUrl || `reference-${index}`,
    url: sourceUrl,
    thumb: sourceUrl,
    type: isVideo ? 'video' : 'image',
    filename: image.file?.name || sourceUrl.split('/').pop() || `reference-${index}`,
  }
}

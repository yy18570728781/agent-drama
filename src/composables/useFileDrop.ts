import { ref, type Ref } from 'vue'

// ── URL constants ────────────────────────────────────────────
export const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|flv|wmv)$/i
export const IMAGE_URL_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?)(\?|$)/i
export const AUDIO_URL_EXTS = /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i
export const MODEL_URL_EXTS = /\.(glb|gltf|fbx|obj|usdz|blend|abc|dae|stl|ply)(\?|#|$)/i
export const REMOTE_MEDIA_URL_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|mp4|webm|mov|avi|mkv|flv|wmv|mp3|wav|ogg|m4a|aac|flac|glb|gltf|fbx|obj|usdz|blend|abc|dae|stl|ply)(\?|#|$)/i
export const MODEL_REFERENCE_EXTS = ['glb', 'gltf', 'fbx', 'obj', 'usdz', 'blend', 'abc', 'dae', 'stl', 'ply']

// ── Dropped asset info (from CardView drag) ──────────────────
export type DroppedAssetInfo = {
  id?: string | number
  recordId?: string | number
  url?: string
  type?: string
  source?: string
  dragOrigin?: string
  prompt?: string
  model?: string
  mediaType?: string
}

export function parseDroppedAssetInfo(raw: string): DroppedAssetInfo | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as DroppedAssetInfo) : null
  } catch {
    return null
  }
}

// ── URL normalization ────────────────────────────────────────
export function normalizeDroppedUrl(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#')) || ''
}

export function normalizeReferenceUrlForCompare(url: string | null | undefined): string {
  const raw = (url || '').trim().replace(/#.*$/, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return raw;
  }
}

// ── Reference media type helpers ─────────────────────────────
export type ReferenceMediaType = 'image' | 'video' | 'audio' | '3d_model'

export function inferReferenceMediaTypeFromFile(file: File): ReferenceMediaType {
  const mimeType = String(file?.type || '').toLowerCase()
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase() || ''
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (MODEL_REFERENCE_EXTS.includes(ext)) return '3d_model'
  return 'image'
}

export function inferReferenceMediaTypeFromUrl(rawUrl: string, fallback: ReferenceMediaType = 'image'): ReferenceMediaType {
  const cleanPath = String(rawUrl || '').split(/[?#]/)[0].toLowerCase()
  if (VIDEO_EXTS.test(cleanPath)) return 'video'
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(cleanPath)) return 'audio'
  if (/\.(glb|gltf|fbx|obj|usdz|blend|abc|dae|stl|ply)$/i.test(cleanPath)) return '3d_model'
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg|avif)$/i.test(cleanPath)) return 'image'
  return fallback
}

/** Filter a FileList / File[] to only supported reference types */
export function collectSupportedReferenceFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((file) => {
    const mediaType = inferReferenceMediaTypeFromFile(file)
    return ['image', 'video', 'audio', '3d_model'].includes(mediaType)
  })
}

// ── Composable ───────────────────────────────────────────────
export interface UseFileDropOptions {
  /** Host element template ref — used by getDropTargetIndex */
  containerRef: Ref<HTMLElement | null>
  /** Current reference count — for slot-limit checks */
  getCurrentCount: () => number
  /** Maximum allowed items */
  getMaxItems: () => number
  /** Callback when files are collected (caller does upload / model-switch) */
  onFiles: (files: File[], replaceIndex?: number) => void
  /** Callback when a URL is dropped / pasted */
  onUrl?: (url: string, replaceIndex?: number) => void
  /** Callback when an internal asset payload is dropped */
  onAssetInfo?: (assetInfo: DroppedAssetInfo, replaceIndex?: number) => void
  /** Whether drop is enabled (default true) */
  enabled?: Ref<boolean> | (() => boolean)
}

export function useFileDrop(options: UseFileDropOptions) {
  const isDragging = ref(false)
  const isExternalDragging = ref(false)
  const dropHoverIndex = ref(-1)

  function resetDragState() {
    isDragging.value = false
    isExternalDragging.value = false
    dropHoverIndex.value = -1
  }

  const isEnabled = () => {
    if (options.enabled === undefined) return true
    if (typeof options.enabled === 'function') return options.enabled()
    return options.enabled.value
  }

  /** Calculate the nearest thumbnail index for drop-hover highlight */
  function getDropTargetIndex(e: DragEvent): number {
    const box = options.containerRef.value
    if (!box) return -1
    // Electron 壳层拖拽不一定命中子卡片事件，这里按真实 DOM 兜底计算目标卡片。
    const thumbs = Array.from(box.querySelectorAll<HTMLElement>('.ref-thumb, .fu-card--has-image'))
    const currentCount = options.getCurrentCount()
    const maxItems = options.getMaxItems()
    const canAppend = !Number.isFinite(maxItems) || currentCount < maxItems
    const addButton = box.querySelector<HTMLElement>('.upload-add-btn, .fu-card:not(.fu-card--has-image)')

    if (canAppend && addButton) {
      const rect = addButton.getBoundingClientRect()
      if (
        e.clientX >= rect.left
        && e.clientX <= rect.right
        && e.clientY >= rect.top
        && e.clientY <= rect.bottom
      ) return currentCount
    }

    if (!thumbs.length) return -1

    let closest = -1
    let minDist = Infinity
    thumbs.forEach((el, i) => {
      const rect = el.getBoundingClientRect()
      const inside = e.clientX >= rect.left
        && e.clientX <= rect.right
        && e.clientY >= rect.top
        && e.clientY <= rect.bottom
      if (!inside) return
      const centerX = rect.left + rect.width / 2
      const dist = Math.abs(e.clientX - centerX)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    return closest
  }

  function onExternalDragOver(e: DragEvent) {
    if (!isEnabled()) return
    // Only handle external file drags; ignore internal reorder drags
    if (e.dataTransfer?.types.includes('text/x-ref-index')) return
    isDragging.value = true
    isExternalDragging.value = true
    const maxItems = options.getMaxItems()
    if (Number.isFinite(maxItems) && maxItems > 0) {
      dropHoverIndex.value = getDropTargetIndex(e)
    }
  }

  function onExternalDragLeave(e: DragEvent) {
    const box = e.currentTarget as HTMLElement
    if (box && box.contains(e.relatedTarget as Node)) return
    isDragging.value = false
    isExternalDragging.value = false
    dropHoverIndex.value = -1
  }

  async function onDrop(e: DragEvent) {
    e.stopPropagation()
    // Electron 壳层可能丢失连续 dragover，drop 时再按鼠标位置重算一次命中卡片。
    const dropTargetIndex = getDropTargetIndex(e)
    const savedDropIndex = dropTargetIndex >= 0 ? dropTargetIndex : dropHoverIndex.value

    resetDragState()

    if (!isEnabled()) return

    // Ignore internal reorder drags
    if (e.dataTransfer?.types.includes('text/x-ref-index')) {
      e.preventDefault()
      return
    }

    // Extract URLs
    const uriList =
      e.dataTransfer?.getData('application/x-asset-url') ||
      e.dataTransfer?.getData('text/uri-list') ||
      e.dataTransfer?.getData('text/plain') ||
      ''
    const droppedUrl = normalizeDroppedUrl(uriList)
    const hasFiles = e.dataTransfer?.files && e.dataTransfer.files.length > 0
    const assetInfo = parseDroppedAssetInfo(e.dataTransfer?.getData('application/x-asset-info') || '')
    const hasInternalAssetUrl = !!e.dataTransfer?.types.includes('application/x-asset-url')

    if (!hasFiles && !droppedUrl && !assetInfo) return

    // Handle files
    if (hasFiles) {
      const supported = collectSupportedReferenceFiles(e.dataTransfer!.files)
      if (supported.length) {
        const maxItems = options.getMaxItems()
        const currentCount = options.getCurrentCount()
        const shouldReplace = savedDropIndex >= 0 && savedDropIndex < currentCount
        const remaining = Number.isFinite(maxItems) ? Math.max(0, maxItems - currentCount) : Number.MAX_SAFE_INTEGER
        const accepted = shouldReplace ? supported.slice(0, 1) : supported.slice(0, remaining)
        if (accepted.length) {
          const replaceIndex = accepted.length === 1 && shouldReplace
            ? savedDropIndex
            : undefined
          options.onFiles(accepted, replaceIndex)
        }
        return
      }
    }

    // Handle internal asset URL drags first — these are already remote-ready assets and
    // should preserve drag metadata instead of falling through to generic remote-URL upload logic.
    if (
      droppedUrl
      && (droppedUrl.startsWith('http://') || droppedUrl.startsWith('https://'))
      && hasInternalAssetUrl
      && options.onAssetInfo
    ) {
      const currentCount = options.getCurrentCount()
      const replaceIndex = savedDropIndex >= 0 && savedDropIndex < currentCount ? savedDropIndex : undefined
      options.onAssetInfo({
        ...(assetInfo || {}),
        url: droppedUrl,
        dragOrigin: assetInfo?.dragOrigin || 'internal-asset-url',
      }, replaceIndex)
      return
    }

    // Handle URL
    if (droppedUrl && (droppedUrl.startsWith('http://') || droppedUrl.startsWith('https://'))) {
      const currentCount = options.getCurrentCount()
      const replaceIndex = savedDropIndex >= 0 && savedDropIndex < currentCount ? savedDropIndex : undefined
      options.onUrl?.(droppedUrl, replaceIndex)
      return
    }

    if (assetInfo) {
      const currentCount = options.getCurrentCount()
      const replaceIndex = savedDropIndex >= 0 && savedDropIndex < currentCount ? savedDropIndex : undefined
      options.onAssetInfo?.(assetInfo, replaceIndex)
    }
  }

  /**
   * Detect media files / URLs in a ClipboardEvent.
   * Returns true if files/URLs were found (caller should preventDefault).
   */
  function handlePaste(e: ClipboardEvent): { files: File[]; url: string | null } {
    const files = Array.from(e.clipboardData?.items || [])
      .filter(i => i.kind === 'file' && (
        i.type.startsWith('image/')
        || i.type.startsWith('video/')
        || i.type.startsWith('audio/')
        || VIDEO_EXTS.test(i.getAsFile()?.name || '')
        || /\.(glb|gltf|fbx|obj|usdz|blend|abc|dae|stl|ply)$/i.test(i.getAsFile()?.name || '')
      ))
      .map(i => i.getAsFile()!)
      .filter(Boolean)

    if (files.length) {
      return { files, url: null }
    }

    const text = normalizeDroppedUrl(e.clipboardData?.getData('text/plain') || '')
    if (!text) return { files: [], url: null }

    const isSupportedReferenceUrl = (text.startsWith('http://') || text.startsWith('https://')) &&
      (IMAGE_URL_EXTS.test(text) || VIDEO_EXTS.test(text) || AUDIO_URL_EXTS.test(text) || MODEL_URL_EXTS.test(text))

    if (isSupportedReferenceUrl) {
      return { files: [], url: text }
    }

    return { files: [], url: null }
  }

  return {
    isDragging,
    isExternalDragging,
    dropHoverIndex,
    resetDragState,
    onExternalDragOver,
    onExternalDragLeave,
    onDrop,
    getDropTargetIndex,
    handlePaste,
  }
}

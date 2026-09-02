import type { Ref } from 'vue'
import {
  inferReferenceMediaTypeFromUrl,
  useFileDrop,
  type DroppedAssetInfo,
  type ReferenceMediaType,
} from '@/composables/useFileDrop'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'

export interface GeneratorReferenceIngressPayload {
  files?: File[]
  urls?: string[]
  assetInfo?: DroppedAssetInfo | null
  replaceIndex?: number
}

interface NormalizedIngressPayload {
  files: File[]
  urls: string[]
  assetInfo: DroppedAssetInfo | null
  replaceIndex?: number
}

interface ReferenceMediaInput {
  url: string
  isVideo?: boolean
  mediaType?: ReferenceMediaType
  nodeId?: string
  uploaded?: boolean
}

interface RemoteReferenceOptions {
  successMessage?: string
  failureMessage?: string
  replaceIndex?: number
}

interface EnsureFileUploadModeOptions {
  warnOnFailure: boolean
}

export interface UseGeneratorReferenceIngressOptions {
  containerRef: Ref<HTMLElement | null>
  refImages: Ref<ReferenceImage[]>
  isEmbedded: () => boolean
  getRefImageMaxItems: () => number
  ensureFileUploadMode: (options: EnsureFileUploadModeOptions) => Promise<boolean>
  addFiles: (files: File[], isEmbedded: boolean, replaceIndex?: number) => Promise<unknown>
  addReferenceMedia: (items: ReferenceMediaInput[]) => Promise<boolean>
  addReferenceMediaAt: (item: ReferenceMediaInput, replaceIndex?: number) => Promise<boolean>
  addRemoteReferenceUrl: (url: string, options?: RemoteReferenceOptions) => Promise<boolean>
  emitFilesDropped: (payload: GeneratorReferenceIngressPayload) => void
}

export interface UseGeneratorReferenceIngressReturn {
  expandedDrop: ReturnType<typeof useFileDrop>
  onExpandedPanelDrop: (event: DragEvent) => void
  onExpandedPanelDropCapture: (event: DragEvent) => void
  onReferenceAreaFilesDropped: (payload: GeneratorReferenceIngressPayload) => Promise<void>
}
function normalizePayload(payload: GeneratorReferenceIngressPayload): NormalizedIngressPayload {
  const files = Array.isArray(payload.files)
    ? payload.files.filter((file): file is File => file instanceof File)
    : []
  const urls = Array.isArray(payload.urls)
    ? payload.urls.filter((url): url is string => typeof url === 'string' && !!url.trim())
    : []
  return {
    files,
    urls,
    assetInfo: payload.assetInfo ?? null,
    replaceIndex: payload.replaceIndex,
  }
}
function readAssetUrl(assetInfo: DroppedAssetInfo | null): string {
  return typeof assetInfo?.url === 'string' ? assetInfo.url.trim() : ''
}
function isDirectGenerationAsset(assetInfo: DroppedAssetInfo | null, assetUrl: string): boolean {
  if (!assetUrl || !assetInfo) return false
  const source = typeof assetInfo.source === 'string' ? assetInfo.source.trim() : ''
  const dragOrigin = typeof assetInfo.dragOrigin === 'string' ? assetInfo.dragOrigin.trim() : ''
  const recordId = assetInfo.recordId
  return dragOrigin === 'generation-card'
    || dragOrigin === 'generation-reference'
    || source === 'teamones_aigc_record'
    || source === 'generation_reference'
    || (recordId !== undefined && recordId !== null && String(recordId).trim() !== '')
}

async function ensureUploadMode(options: UseGeneratorReferenceIngressOptions): Promise<boolean> {
  return options.ensureFileUploadMode({ warnOnFailure: true })
}

async function addDroppedFiles(
  options: UseGeneratorReferenceIngressOptions,
  payload: NormalizedIngressPayload,
): Promise<boolean> {
  if (!payload.files.length) return true
  if (!(await ensureUploadMode(options))) return false
  await options.addFiles(payload.files, false, payload.replaceIndex)
  return true
}

async function addDirectAsset(
  options: UseGeneratorReferenceIngressOptions,
  payload: NormalizedIngressPayload,
  assetUrl: string,
): Promise<boolean> {
  if (!isDirectGenerationAsset(payload.assetInfo, assetUrl)) return false
  if (!(await ensureUploadMode(options))) return true
  const fallbackType: ReferenceMediaType = payload.assetInfo?.type === 'video' ? 'video' : 'image'
  const mediaType = inferReferenceMediaTypeFromUrl(assetUrl, fallbackType)
  const item: ReferenceMediaInput = { url: assetUrl, mediaType, uploaded: true }
  if (typeof payload.replaceIndex === 'number') {
    await options.addReferenceMediaAt(item, payload.replaceIndex)
    return true
  }
  await options.addReferenceMedia([item])
  return true
}

async function addDroppedUrls(
  options: UseGeneratorReferenceIngressOptions,
  payload: NormalizedIngressPayload,
): Promise<boolean> {
  if (!payload.urls.length) return true
  if (!(await ensureUploadMode(options))) return false
  for (const url of payload.urls) {
    await options.addRemoteReferenceUrl(url, {
      successMessage: '已添加拖入的链接',
      failureMessage: '无法加载拖入的链接',
      replaceIndex: payload.replaceIndex,
    })
  }
  return true
}

async function addFallbackAsset(
  options: UseGeneratorReferenceIngressOptions,
  payload: NormalizedIngressPayload,
  assetUrl: string,
): Promise<void> {
  if (!assetUrl || payload.urls.includes(assetUrl)) return
  if (!(await ensureUploadMode(options))) return
  await options.addRemoteReferenceUrl(assetUrl, {
    successMessage: '已添加拖入的资源',
    failureMessage: '无法加载拖入的资源',
    replaceIndex: payload.replaceIndex,
  })
}

async function processIngress(
  options: UseGeneratorReferenceIngressOptions,
  ingressPayload: GeneratorReferenceIngressPayload,
): Promise<void> {
  const payload = normalizePayload(ingressPayload)
  if (options.isEmbedded()) {
    options.emitFilesDropped(payload)
    return
  }
  if (!(await addDroppedFiles(options, payload))) return
  const assetUrl = readAssetUrl(payload.assetInfo)
  if (await addDirectAsset(options, payload, assetUrl)) return
  if (!(await addDroppedUrls(options, payload))) return
  await addFallbackAsset(options, payload, assetUrl)
}

/**
 * 建立生成器引用素材的统一拖入入口。
 *
 * 必须在 ReferenceManager 初始化后调用，避免通过延迟回调读取尚未声明的引用状态。
 * @param options 已初始化的引用状态、添加方法与外层事件桥接。
 * @returns 展开面板拖拽状态及可直接绑定到模板的入口方法。
 * @throws 引用上传或远程素材添加依赖拒绝时会向调用方传播异常。
 */
export function useGeneratorReferenceIngress(
  options: UseGeneratorReferenceIngressOptions,
): UseGeneratorReferenceIngressReturn {
  const onReferenceAreaFilesDropped = (
    payload: GeneratorReferenceIngressPayload,
  ): Promise<void> => processIngress(options, payload)

  const expandedDrop = useFileDrop({
    containerRef: options.containerRef,
    getCurrentCount: () => options.refImages.value.length,
    getMaxItems: options.getRefImageMaxItems,
    onFiles: (files, replaceIndex) => {
      void onReferenceAreaFilesDropped({ files, replaceIndex })
    },
    onUrl: (url, replaceIndex) => {
      void onReferenceAreaFilesDropped({ urls: [url], replaceIndex })
    },
    onAssetInfo: (assetInfo, replaceIndex) => {
      void onReferenceAreaFilesDropped({ assetInfo, replaceIndex })
    },
  })

  function isReferenceAreaDrop(event: DragEvent): boolean {
    const target = event.target
    return target instanceof Element && target.closest('.reference-area-root') !== null
  }

  function onExpandedPanelDropCapture(event: DragEvent): void {
    if (isReferenceAreaDrop(event)) expandedDrop.resetDragState()
  }

  function onExpandedPanelDrop(event: DragEvent): void {
    if (isReferenceAreaDrop(event)) return
    void expandedDrop.onDrop(event)
  }

  return {
    expandedDrop,
    onExpandedPanelDrop,
    onExpandedPanelDropCapture,
    onReferenceAreaFilesDropped,
  }
}

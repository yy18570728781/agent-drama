import { onUnmounted, ref, type Ref } from 'vue'
import { useEnvironment } from '@/composables/useEnvironment'

type FlowDragPayload = {
  id: string
  url: string
  type: string
  recordId?: string
  prompt?: string
  model?: string
  thumb?: string
  pbrChannel?: string
}

type UseFlowAssetDragOptions = {
  findNode: (nodeId: string) => unknown
}

interface UseFlowAssetDragReturn {
  activeDragPayload: Ref<FlowDragPayload | null>
  prepareNodeAssetDrag: (nodeId: string) => void
  beginNodeAssetDrag: (event: DragEvent, nodeId: string) => boolean
  endNodeAssetDrag: (event: DragEvent, nodeId: string) => void
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {}
}

function firstString(...values: unknown[]): string {
  const value = values.find((item) => typeof item === 'string' || typeof item === 'number')
  return value == null ? '' : String(value).trim()
}

function extractNodeDragUrl(data: Record<string, unknown>): string {
  return String(
    data.url
    || data.imageUrl
    || data.videoUrl
    || data.audioUrl
    || data.preview
    || '',
  ).trim()
}

function buildNodeDragPayload(value: unknown): FlowDragPayload | null {
  const node = asRecord(value)
  const data = asRecord(node.data)
  const requestParams = asRecord(asRecord(data.request).params)
  const url = extractNodeDragUrl(data)
  if (!url) return null
  return {
    id: firstString(node.id),
    url,
    type: firstString(data.mediaType, node.type) || 'file',
    recordId: firstString(data.recordId) || undefined,
    prompt: firstString(data.prompt, requestParams.prompt) || undefined,
    model: firstString(data.model, data._modelDisplayName, requestParams.model) || undefined,
    thumb: firstString(data.thumb) || undefined,
    pbrChannel: firstString(data.pbrChannel) || undefined,
  }
}

function configureDragTransfer(event: DragEvent, payload: FlowDragPayload): void {
  if (!event.dataTransfer) return
  const extMap: Record<string, { mime: string; ext: string }> = {
    video: { mime: 'video/mp4', ext: 'mp4' },
    audio: { mime: 'audio/mpeg', ext: 'mp3' },
    image: { mime: 'image/png', ext: 'png' },
  }
  const meta = extMap[payload.type] || { mime: 'application/octet-stream', ext: 'bin' }
  const filename = `${payload.id || 'asset'}.${meta.ext}`
  event.dataTransfer.setData('DownloadURL', `${meta.mime}:${filename}:${payload.url}`)
  event.dataTransfer.setData('application/x-asset-url', payload.url)
  event.dataTransfer.setData('application/x-asset-info', JSON.stringify(payload))
  event.dataTransfer.setData('text/uri-list', payload.url)
  event.dataTransfer.setData('text/plain', payload.url)
  event.dataTransfer.effectAllowed = 'copy'
}

/**
 * 提供画布节点资源的浏览器拖拽和安全父窗口通知能力。
 * @param options - 节点查询依赖。
 * @returns 节点拖拽状态与事件处理方法。
 */
export function useFlowAssetDrag(options: UseFlowAssetDragOptions): UseFlowAssetDragReturn {
  const { isIframe, postToParent } = useEnvironment()
  const preparedDragUrls = new Set<string>()
  const activeDragPayload = ref<FlowDragPayload | null>(null)

  function prepareNodeAssetDrag(nodeId: string): void {
    const payload = buildNodeDragPayload(options.findNode(nodeId))
    if (!payload?.url || !isIframe.value || preparedDragUrls.has(payload.url)) return
    preparedDragUrls.add(payload.url)
    postToParent({ type: 'asset-drag-prepare', payload: { asset: payload } })
  }

  function beginNodeAssetDrag(event: DragEvent, nodeId: string): boolean {
    const payload = buildNodeDragPayload(options.findNode(nodeId))
    if (!payload) return false
    activeDragPayload.value = payload
    const nativeDragEvent = new CustomEvent('shenshu-native-drag-start', {
      cancelable: true,
      detail: { asset: payload },
    })
    const nativeHandled = !window.dispatchEvent(nativeDragEvent)
    if (nativeHandled) return true
    configureDragTransfer(event, payload)
    return true
  }

  function endNodeAssetDrag(_event: DragEvent, _nodeId: string): void {
    activeDragPayload.value = null
  }

  onUnmounted(() => preparedDragUrls.clear())

  return {
    activeDragPayload,
    prepareNodeAssetDrag,
    beginNodeAssetDrag,
    endNodeAssetDrag,
  }
}

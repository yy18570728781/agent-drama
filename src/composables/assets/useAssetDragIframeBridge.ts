import { onUnmounted, ref } from 'vue'
import { useEnvironment } from '@/composables/useEnvironment'

export interface AssetDragPayload {
  id: string | number
  url: string
  thumb?: string
  type?: string
  recordId?: string | number
  prompt?: string
  model?: string
  pbrChannel?: string
  filename?: string
  [key: string]: unknown
}

export interface CardViewScreenshotPayload {
  requestId?: string
  asset?: AssetDragPayload | null
  point?: { x: number; y: number }
  hideWindow?: boolean
  mode?: 'hide-window' | 'keep-window'
  meta?: Record<string, unknown>
}

export interface CardViewScreenshotCallbackPayload {
  requestId?: string
  accepted?: boolean
  cancelled?: boolean
  screenshotUrl?: string
  screenshotFilePath?: string
  error?: string
  meta?: Record<string, unknown>
}

interface ParentBridgeMessage {
  type: string
  payload?: unknown
}

interface UseAssetDragIframeBridgeReturn {
  isIframe: boolean
  prepareAssetDrag: (payload: AssetDragPayload) => void
  beginAssetDrag: (payload: AssetDragPayload) => boolean
  endAssetDrag: (event: DragEvent, payload?: AssetDragPayload | null) => void
  requestScreenshot: (payload?: CardViewScreenshotPayload) => string
  requestHiddenWindowScreenshot: (payload?: CardViewScreenshotPayload) => string
  requestVisibleWindowScreenshot: (payload?: CardViewScreenshotPayload) => string
  onScreenshotCallback: (handler: (payload: CardViewScreenshotCallbackPayload) => void) => () => void
  onceScreenshotCallback: (requestId: string, handler: (payload: CardViewScreenshotCallbackPayload) => void) => () => void
}

function createRequestId(): string {
  return `shot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isParentBridgeMessage(value: unknown): value is ParentBridgeMessage {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { type?: unknown }).type === 'string'
}

/**
 * 提供资源拖拽和截图请求所需的安全父窗口通信。
 * @returns 资源拖拽、截图请求和截图回调订阅方法。
 */
export function useAssetDragIframeBridge(): UseAssetDragIframeBridgeReturn {
  const { isIframe, onParentMessage, postToParent } = useEnvironment()
  const activeDragPayload = ref<AssetDragPayload | null>(null)
  const preparedDragUrls = new Set<string>()

  function resetActiveDrag(): void {
    activeDragPayload.value = null
  }

  function prepareAssetDrag(payload: AssetDragPayload): void {
    if (
      !isIframe.value
      || !payload.url
      || preparedDragUrls.has(payload.url)
    ) return
    preparedDragUrls.add(payload.url)
    postToParent({ type: 'asset-drag-prepare', payload: { asset: payload } })
  }

  function beginAssetDrag(payload: AssetDragPayload): boolean {
    activeDragPayload.value = payload
    console.info('[CardView] drag start', { asset: payload })
    const nativeDragEvent = new CustomEvent('shenshu-native-drag-start', {
      cancelable: true,
      detail: { asset: payload },
    })
    return !window.dispatchEvent(nativeDragEvent)
  }

  function endAssetDrag(_event: DragEvent, payload?: AssetDragPayload | null): void {
    if (!activeDragPayload.value && payload) activeDragPayload.value = payload
    resetActiveDrag()
  }

  function requestScreenshot(payload: CardViewScreenshotPayload = {}): string {
    const requestId = payload.requestId || createRequestId()
    postToParent({ type: 'screenshot', payload: { ...payload, requestId } })
    return requestId
  }

  function requestHiddenWindowScreenshot(
    payload: CardViewScreenshotPayload = {},
  ): string {
    return requestScreenshot({
      ...payload,
      hideWindow: true,
      mode: 'hide-window',
    })
  }

  function requestVisibleWindowScreenshot(
    payload: CardViewScreenshotPayload = {},
  ): string {
    return requestScreenshot({
      ...payload,
      hideWindow: false,
      mode: 'keep-window',
    })
  }

  function onScreenshotCallback(
    handler: (payload: CardViewScreenshotCallbackPayload) => void,
  ): () => void {
    return onParentMessage((message) => {
      if (!isParentBridgeMessage(message) || message.type !== 'screenshot-callback') return
      const payload = typeof message.payload === 'object' && message.payload !== null
        ? message.payload as CardViewScreenshotCallbackPayload
        : {}
      handler(payload)
    })
  }

  function onceScreenshotCallback(
    requestId: string,
    handler: (payload: CardViewScreenshotCallbackPayload) => void,
  ): () => void {
    const unsubscribe = onScreenshotCallback((payload) => {
      if (payload.requestId !== requestId) return
      unsubscribe()
      handler(payload)
    })
    return unsubscribe
  }

  onUnmounted(() => {
    preparedDragUrls.clear()
    resetActiveDrag()
  })

  return {
    isIframe: isIframe.value,
    prepareAssetDrag,
    beginAssetDrag,
    endAssetDrag,
    requestScreenshot,
    requestHiddenWindowScreenshot,
    requestVisibleWindowScreenshot,
    onScreenshotCallback,
    onceScreenshotCallback,
  }
}

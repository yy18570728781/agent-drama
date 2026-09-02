import { useAssetDragIframeBridge, type AssetDragPayload } from './useAssetDragIframeBridge'

export type { AssetDragPayload }

/**
 * 统一封装"把一个媒体资源拖出窗口"的两条路径：
 *  - 路径 A（iframe 嵌入桌面壳）：通过 iframeBridge 派发 'shenshu-native-drag-start'
 *    自定义事件 + postMessage('asset-drag-prepare')，由外部桌面壳接管原生 OS 拖拽。
 *  - 路径 B（独立浏览器）：往 DragEvent.dataTransfer 写入 DownloadURL 等 key，
 *    拖到文件管理器时浏览器自动下载。
 *
 * payload 结构即对外契约：序列化后通过 CustomEvent.detail.asset / dataTransfer
 * 'application/x-asset-info' 传给桌面壳与浏览器，字段保持稳定，勿随意删改。
 */
export function useAssetDragOut() {
  const bridge = useAssetDragIframeBridge()

  /** mousedown / mouseenter 时预热，让桌面壳提前下载资源（仅 iframe 模式生效）。 */
  function prepare(payload: AssetDragPayload): void {
    if (!payload?.url) return
    bridge.prepareAssetDrag(payload)
  }

  /** HTML5 dragstart 入口：先试路径 A，被壳接管则 preventDefault；否则走路径 B。 */
  function startDrag(e: DragEvent, payload: AssetDragPayload): void {
    if (!e.dataTransfer || !payload?.url) return

    // 参考图列表内部排序依赖 HTML5 DataTransfer，不能被 Electron 壳层 native drag 接管。
    const isReferenceInternalDrag = e.dataTransfer.types.includes('text/x-ref-index')
      || e.dataTransfer.types.includes('application/x-reference-image')
    const handledByShell = !isReferenceInternalDrag && bridge.beginAssetDrag(payload)
    if (handledByShell) {
      e.preventDefault()
      return
    }

    const isVideo = payload.type === 'video'
    const isAudio = payload.type === 'audio'
    const mimeType = isAudio ? 'audio/mpeg' : isVideo ? 'video/mp4' : 'image/png'
    const ext = isAudio ? 'mp3' : isVideo ? 'mp4' : 'png'
    const fallbackName = payload.id != null && payload.id !== '' ? String(payload.id) : isAudio ? 'audio' : 'image'
    const filename = payload.filename || `${fallbackName}.${ext}`
    const { url } = payload
    e.dataTransfer.setData('DownloadURL', `${mimeType}:${filename}:${url}`)
    e.dataTransfer.setData('application/x-asset-url', url)
    e.dataTransfer.setData('application/x-asset-info', JSON.stringify(payload))
    e.dataTransfer.setData('text/uri-list', url)
    e.dataTransfer.setData('text/plain', url)
    e.dataTransfer.effectAllowed = 'copy'
    const target = e.target as HTMLElement | null
    const img = target?.querySelector?.('img, video') as HTMLImageElement | null
    if (img) {
      e.dataTransfer.setDragImage(img, 40, 40)
    }
  }

  /**
   * 仅触发路径 A（无 DragEvent 可用时使用，例如图片编辑器边界检测拖出）。
   * 返回 true 表示桌面壳接管；false 表示当前环境不支持拖出（如独立浏览器模式）。
   */
  function triggerExternal(payload: AssetDragPayload): boolean {
    if (!payload?.url) return false
    return bridge.beginAssetDrag(payload)
  }

  /** dragend 收尾。 */
  function endDrag(e?: DragEvent, payload?: AssetDragPayload | null): void {
    bridge.endAssetDrag(e as DragEvent, payload || null)
  }

  return { prepare, startDrag, triggerExternal, endDrag }
}

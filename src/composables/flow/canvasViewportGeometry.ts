import type { Ref } from 'vue'

export interface CanvasViewportBounds {
  left: number
  top: number
  right: number
  bottom: number
  zoom: number
  width: number
  height: number
  vpX: number
  vpY: number
}

export interface CanvasNodeLike {
  computedPosition?: { x?: number; y?: number }
  position?: { x?: number; y?: number }
}

/**
 * 将屏幕视口换算成画布世界坐标边界。
 * @param wrapperRef 画布容器引用。
 * @param viewportRef Vue Flow 视口状态。
 * @param padding 世界坐标扩展量。
 * @returns 容器尚未挂载时返回 null，否则返回世界坐标边界。
 */
export function getCanvasViewportWorldBounds(
  wrapperRef: Ref<HTMLElement | null>,
  viewportRef: Ref<unknown>,
  padding = 0,
): CanvasViewportBounds | null {
  const wrapper = wrapperRef.value
  const viewport = (viewportRef.value || {}) as { x?: number; y?: number; zoom?: number }
  const zoom = Number(viewport.zoom) || 1
  if (!wrapper || zoom <= 0) return null

  const width = wrapper.clientWidth || 0
  const height = wrapper.clientHeight || 0
  const vpX = Number(viewport.x || 0)
  const vpY = Number(viewport.y || 0)
  const left = -vpX / zoom - padding
  const top = -vpY / zoom - padding

  return {
    left,
    top,
    right: left + width / zoom + padding * 2,
    bottom: top + height / zoom + padding * 2,
    zoom,
    width,
    height,
    vpX,
    vpY,
  }
}

/**
 * 判断节点矩形是否与世界坐标视口相交。
 * @param node 待检查节点。
 * @param bounds 世界坐标边界。
 * @param getNodeWidth 节点宽度解析器。
 * @param getNodeHeight 节点高度解析器。
 * @returns 相交时返回 true。
 */
export function isCanvasNodeIntersectingWorldBounds(
  node: CanvasNodeLike | null | undefined,
  bounds: CanvasViewportBounds | null,
  getNodeWidth: (node: CanvasNodeLike) => number,
  getNodeHeight: (node: CanvasNodeLike) => number,
): boolean {
  if (!node || !bounds) return false
  const width = getNodeWidth(node)
  const height = getNodeHeight(node)
  const x = Number(node.computedPosition?.x ?? node.position?.x) || 0
  const y = Number(node.computedPosition?.y ?? node.position?.y) || 0
  return !(x + width < bounds.left || x > bounds.right || y + height < bounds.top || y > bounds.bottom)
}

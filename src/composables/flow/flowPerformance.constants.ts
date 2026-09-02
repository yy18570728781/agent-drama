export const VISIBLE_ELEMENT_RENDER_NODE_THRESHOLD = 60
export const VISIBLE_ELEMENT_INITIAL_NODE_THRESHOLD = 120
export const VISIBLE_ELEMENT_RENDER_SETTLE_MS = 800
export const ANIMATED_EDGE_RENDER_LIMIT = 180
export const FLOW_PREPARE_BATCH_SIZE = 160
export const FLOW_CANVAS_MIN_ZOOM = 0.12

/**
 * 大画布缩小时会让过多节点同时进入视口，因此按节点规模抬高缩放下限。
 * @param nodeCount 当前根画布节点数。
 * @returns Vue Flow 允许的最小缩放值。
 */
export function getCanvasMinimumZoom(nodeCount: number): number {
  if (nodeCount >= 2000) return 0.5
  if (nodeCount >= 800) return 0.2
  return FLOW_CANVAS_MIN_ZOOM
}

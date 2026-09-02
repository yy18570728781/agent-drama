import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { CanvasViewportBounds } from './canvasViewportGeometry'

interface MediaNode {
  id: string
  hidden?: boolean
  data?: { _collapsedByGroup?: boolean }
  computedPosition?: { x?: number; y?: number }
  position?: { x?: number; y?: number }
}

interface MediaCandidate {
  id: string
  distance: number
  hasThumb?: boolean
}

interface MediaRenderSets {
  fullIds: Set<string>
  mediaIds: Set<string>
  thumbIds: Set<string>
}

interface CanvasMediaRenderingDeps {
  nodes: Ref<MediaNode[]>
  viewport: Ref<unknown>
  effectiveRenderZoom: Ref<number>
  effectiveMediaPreviewLimit: ComputedRef<number>
  isViewportMoving: Ref<boolean>
  isZoomPromotionPending: ComputedRef<boolean>
  shouldSuspendHeavyCanvasWork: ComputedRef<boolean>
  getViewportWorldBounds: (padding?: number) => CanvasViewportBounds | null
  isNodeIntersectingWorldBounds: (node: MediaNode, bounds: CanvasViewportBounds | null) => boolean
  getNodeWidth: (node: MediaNode) => number
  getNodeHeight: (node: MediaNode) => number
  isRenderableMediaNode: (node: MediaNode) => boolean
  hasRenderableMediaThumb: (node: MediaNode) => boolean
  isPlaceholderEligibleNode: (node: MediaNode) => boolean
}

export const NODE_FULL_RENDER_VIEWPORT_PADDING = 28

function getMediaRenderBudget(zoom: number, limit: number): number {
  if (zoom < 0.68) return 0
  if (zoom < 1.18) return Math.min(limit, 80)
  if (zoom < 1.35) return Math.min(limit, 160)
  return limit
}

function getFullNodeRenderBudget(zoom: number, nodeCount: number): number {
  if (zoom < 0.2) return 0
  if (zoom < 0.3) return 6
  if (zoom < 0.42) return 12
  if (nodeCount > 1500) return 16
  if (nodeCount > 800) return 24
  if (nodeCount > 500) return 32
  if (nodeCount > 300) return 48
  return 80
}

function collectCandidates(
  deps: CanvasMediaRenderingDeps,
  bounds: CanvasViewportBounds,
): { media: MediaCandidate[]; full: MediaCandidate[] } {
  const centerX = (-bounds.vpX + bounds.width / 2) / bounds.zoom
  const centerY = (-bounds.vpY + bounds.height / 2) / bounds.zoom
  const media: MediaCandidate[] = []
  const full: MediaCandidate[] = []
  for (const node of deps.nodes.value) {
    if (node.hidden || node.data?._collapsedByGroup || !deps.isNodeIntersectingWorldBounds(node, bounds)) continue
    const x = Number(node.computedPosition?.x ?? node.position?.x) || 0
    const y = Number(node.computedPosition?.y ?? node.position?.y) || 0
    const distance = Math.abs(x + deps.getNodeWidth(node) / 2 - centerX)
      + Math.abs(y + deps.getNodeHeight(node) / 2 - centerY)
    if (deps.isPlaceholderEligibleNode(node)) full.push({ id: node.id, distance })
    if (deps.isRenderableMediaNode(node)) {
      media.push({ id: node.id, distance, hasThumb: deps.hasRenderableMediaThumb(node) })
    }
  }
  return { media, full }
}

function fillRenderSets(
  deps: CanvasMediaRenderingDeps,
  candidates: ReturnType<typeof collectCandidates>,
  zoom: number,
): MediaRenderSets {
  const fullIds = new Set<string>()
  const mediaIds = new Set<string>()
  const thumbIds = new Set<string>()
  const limit = deps.effectiveMediaPreviewLimit.value
  const fullBudget = getFullNodeRenderBudget(zoom, deps.nodes.value.length)
  candidates.full.sort((a, b) => a.distance - b.distance).slice(0, fullBudget)
    .forEach((item) => fullIds.add(item.id))
  const mediaBudget = getMediaRenderBudget(zoom, limit)
  const sortedMedia = candidates.media.sort((a, b) => a.distance - b.distance)
  sortedMedia.slice(0, mediaBudget).forEach((item) => mediaIds.add(item.id))
  // 缩略图不再额外扩容，避免图片和视频在同一缩放等级下出现不同的渲染层级。
  sortedMedia
    .filter((item) => item.hasThumb && mediaIds.has(item.id))
    .forEach((item) => thumbIds.add(item.id))
  return { fullIds, mediaIds, thumbIds }
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && Array.from(left).every((id) => right.has(id))
}

/**
 * 按视口距离和缩放等级分配媒体、缩略图与完整节点的渲染预算。
 * @param deps 画布节点、视口和节点分类依赖。
 * @returns 三类节点集合及其更新、调度和清理方法。
 */
export function useCanvasMediaRendering(deps: CanvasMediaRenderingDeps) {
  const renderableMediaNodeIds = ref(new Set<string>())
  const thumbRenderableMediaNodeIds = ref(new Set<string>())
  const fullRenderNodeIds = ref(new Set<string>())
  let renderFrame = 0

  function updateRenderableMediaNodeIds(): void {
    const viewportBounds = deps.getViewportWorldBounds()
    if (!viewportBounds) {
      renderableMediaNodeIds.value = new Set()
      thumbRenderableMediaNodeIds.value = new Set()
      fullRenderNodeIds.value = new Set()
      return
    }
    const padding = NODE_FULL_RENDER_VIEWPORT_PADDING / Math.max(viewportBounds.zoom, 0.01)
    const candidateBounds = deps.getViewportWorldBounds(padding)
    if (!candidateBounds) return
    const next = fillRenderSets(deps, collectCandidates(deps, candidateBounds), deps.effectiveRenderZoom.value)
    if (setsEqual(renderableMediaNodeIds.value, next.mediaIds)
      && setsEqual(thumbRenderableMediaNodeIds.value, next.thumbIds)
      && setsEqual(fullRenderNodeIds.value, next.fullIds)) return
    renderableMediaNodeIds.value = next.mediaIds
    thumbRenderableMediaNodeIds.value = next.thumbIds
    fullRenderNodeIds.value = next.fullIds
  }

  function scheduleRenderableMediaNodeIdsUpdate(): void {
    if (deps.isViewportMoving.value || deps.isZoomPromotionPending.value
      || deps.shouldSuspendHeavyCanvasWork.value || renderFrame) return
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0
      if (!deps.isViewportMoving.value && !deps.isZoomPromotionPending.value
        && !deps.shouldSuspendHeavyCanvasWork.value) updateRenderableMediaNodeIds()
    })
  }

  function clearMediaRenderFrame(): void {
    if (!renderFrame) return
    cancelAnimationFrame(renderFrame)
    renderFrame = 0
  }

  return {
    renderableMediaNodeIds,
    thumbRenderableMediaNodeIds,
    fullRenderNodeIds,
    getMediaRenderBudget: (zoom: number) => getMediaRenderBudget(zoom, deps.effectiveMediaPreviewLimit.value),
    getFullNodeRenderBudget,
    updateRenderableMediaNodeIds,
    scheduleRenderableMediaNodeIdsUpdate,
    clearMediaRenderFrame,
  }
}

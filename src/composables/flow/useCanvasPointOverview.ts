import type { ComputedRef, Ref } from 'vue'
import type { CanvasViewportBounds } from './canvasViewportGeometry'

interface OverviewNode {
  id: string
  hidden?: boolean
  selected?: boolean
  data?: { _collapsedByGroup?: boolean }
  computedPosition?: { x?: number; y?: number }
  position?: { x?: number; y?: number }
}

interface CanvasPointOverviewDeps {
  nodes: Ref<OverviewNode[]>
  viewport: Ref<unknown>
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  pointOverviewCanvasRef: Ref<HTMLCanvasElement | null>
  showOverviewCanvas: ComputedRef<boolean>
  getNodeWidth: (node: OverviewNode) => number
  getNodeHeight: (node: OverviewNode) => number
  getViewportWorldBounds: (padding?: number) => CanvasViewportBounds | null
}

/**
 * 管理移动期间的轻量节点轮廓画布，避免复杂 DOM 节点参与逐帧合成。
 * @param deps 画布节点、视口与尺寸解析依赖。
 * @returns 概览绘制、调度和清理方法。
 */
export function useCanvasPointOverview(deps: CanvasPointOverviewDeps) {
  let renderFrame = 0

  function drawNodeOutline(
    context: CanvasRenderingContext2D,
    node: OverviewNode,
    bounds: CanvasViewportBounds,
  ): void {
    const x = Number(node.computedPosition?.x ?? node.position?.x) || 0
    const y = Number(node.computedPosition?.y ?? node.position?.y) || 0
    const left = x * bounds.zoom + bounds.vpX
    const top = y * bounds.zoom + bounds.vpY
    const width = Math.max(4, deps.getNodeWidth(node) * bounds.zoom)
    const height = Math.max(4, deps.getNodeHeight(node) * bounds.zoom)
    if (left > bounds.width + 12 || top > bounds.height + 12 || left + width < -12 || top + height < -12) return

    context.beginPath()
    context.strokeStyle = node.selected ? 'rgba(244, 244, 245, 0.82)' : 'rgba(212, 212, 216, 0.56)'
    context.lineWidth = node.selected ? 1.5 : 1
    context.setLineDash([4, 3])
    context.strokeRect(left, top, width, height)
    context.setLineDash([])
  }

  function renderPointOverviewCanvas(): void {
    const canvas = deps.pointOverviewCanvasRef.value
    const wrapper = deps.flowCanvasWrapperRef.value
    const bounds = deps.getViewportWorldBounds()
    if (!canvas || !wrapper || !bounds || !deps.showOverviewCanvas.value) return

    const nodeCount = deps.nodes.value.length
    const resolutionScale = nodeCount >= 2000 ? 0.4 : nodeCount > 500 ? 0.65 : 1
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * resolutionScale
    const pixelWidth = Math.max(1, Math.round(bounds.width * dpr))
    const pixelHeight = Math.max(1, Math.round(bounds.height * dpr))
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    canvas.style.width = `${bounds.width}px`
    canvas.style.height = `${bounds.height}px`

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, bounds.width, bounds.height)
    for (const node of deps.nodes.value) {
      if (!node.hidden && !node.data?._collapsedByGroup) drawNodeOutline(context, node, bounds)
    }
  }

  function schedulePointOverviewRender(): void {
    if (renderFrame) return
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0
      renderPointOverviewCanvas()
    })
  }

  function clearPointOverviewRender(): void {
    if (!renderFrame) return
    cancelAnimationFrame(renderFrame)
    renderFrame = 0
  }

  return { schedulePointOverviewRender, renderPointOverviewCanvas, clearPointOverviewRender }
}

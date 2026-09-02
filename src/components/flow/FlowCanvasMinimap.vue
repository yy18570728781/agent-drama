<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useVueFlow, type GraphNode } from '@vue-flow/core'
import { useFlowCanvasMinimapInteraction } from '@/composables/flow/useFlowCanvasMinimapInteraction'

const props = withDefaults(defineProps<{
  maxZoom?: number
  minZoom?: number
}>(), {
  maxZoom: 4,
  minZoom: 0.12,
})

interface MapTransform {
  left: number
  top: number
  scale: number
  offsetX: number
  offsetY: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { nodes, viewport, dimensions, setViewport, onNodesChange } = useVueFlow()
const mapTransform: MapTransform = { left: 0, top: 0, scale: 1, offsetX: 0, offsetY: 0 }
const previewCenter = ref<{ x: number; y: number } | null>(null)
let cacheCanvas: HTMLCanvasElement | null = null
let rebuildTimer = 0
let renderFrame = 0
let resizeObserver: ResizeObserver | null = null

function nodeRect(node: GraphNode): { x: number; y: number; width: number; height: number } {
  const position = node.computedPosition || node.position
  return {
    x: Number(position?.x || 0),
    y: Number(position?.y || 0),
    width: Math.max(1, Number(node.dimensions?.width || node.width || 160)),
    height: Math.max(1, Number(node.dimensions?.height || node.height || 100)),
  }
}

function prepareCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const width = Math.max(1, canvas.clientWidth || 220)
  const height = Math.max(1, canvas.clientHeight || 140)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  const context = canvas.getContext('2d')
  context?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return context
}

function updateMapTransform(visibleNodes: GraphNode[], width: number, height: number): void {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const node of visibleNodes) {
    const rect = nodeRect(node)
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  }
  if (!Number.isFinite(minX)) minX = minY = maxX = maxY = 0
  const worldWidth = Math.max(1, maxX - minX)
  const worldHeight = Math.max(1, maxY - minY)
  const scale = Math.min((width - 16) / worldWidth, (height - 16) / worldHeight)
  mapTransform.left = minX
  mapTransform.top = minY
  mapTransform.scale = Math.max(scale, 0.000001)
  mapTransform.offsetX = (width - worldWidth * scale) / 2
  mapTransform.offsetY = (height - worldHeight * scale) / 2
}

function rebuildNodeCache(): void {
  rebuildTimer = 0
  const canvas = canvasRef.value
  if (!canvas || !cacheCanvas) return
  cacheCanvas.style.width = `${canvas.clientWidth}px`
  cacheCanvas.style.height = `${canvas.clientHeight}px`
  const context = prepareCanvas(cacheCanvas)
  if (!context) return
  const width = canvas.clientWidth || 220
  const height = canvas.clientHeight || 140
  const visibleNodes = nodes.value.filter((node) => !node.hidden)
  updateMapTransform(visibleNodes, width, height)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#18181b'
  context.fillRect(0, 0, width, height)
  for (const node of visibleNodes) {
    const rect = nodeRect(node)
    const x = mapTransform.offsetX + (rect.x - mapTransform.left) * mapTransform.scale
    const y = mapTransform.offsetY + (rect.y - mapTransform.top) * mapTransform.scale
    context.fillStyle = node.selected ? '#e4e4e7' : node.type === 'groupNode' ? '#71717a' : '#52525b'
    context.fillRect(x, y, Math.max(1, rect.width * mapTransform.scale), Math.max(1, rect.height * mapTransform.scale))
  }
  scheduleRender()
}

function scheduleCacheRebuild(): void {
  if (rebuildTimer) return
  rebuildTimer = window.setTimeout(rebuildNodeCache, 60)
}

function renderMinimap(): void {
  renderFrame = 0
  const canvas = canvasRef.value
  if (!canvas || !cacheCanvas) return
  const context = prepareCanvas(canvas)
  if (!context) return
  const width = canvas.clientWidth || 220
  const height = canvas.clientHeight || 140
  context.clearRect(0, 0, width, height)
  context.drawImage(cacheCanvas, 0, 0, width, height)
  const zoom = Math.max(0.000001, viewport.value.zoom)
  const viewX = previewCenter.value
    ? previewCenter.value.x - dimensions.value.width / zoom / 2
    : -viewport.value.x / zoom
  const viewY = previewCenter.value
    ? previewCenter.value.y - dimensions.value.height / zoom / 2
    : -viewport.value.y / zoom
  const x = mapTransform.offsetX + (viewX - mapTransform.left) * mapTransform.scale
  const y = mapTransform.offsetY + (viewY - mapTransform.top) * mapTransform.scale
  const viewWidth = dimensions.value.width / zoom * mapTransform.scale
  const viewHeight = dimensions.value.height / zoom * mapTransform.scale
  context.fillStyle = 'rgba(56, 189, 248, 0.1)'
  context.strokeStyle = '#38bdf8'
  context.lineWidth = 1.5
  context.fillRect(x, y, viewWidth, viewHeight)
  context.strokeRect(x, y, viewWidth, viewHeight)
}

function scheduleRender(): void {
  if (renderFrame) return
  renderFrame = requestAnimationFrame(renderMinimap)
}

const {
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
} = useFlowCanvasMinimapInteraction({
  canvasRef,
  dimensions,
  getMaximumZoom: () => props.maxZoom,
  getMinimumZoom: () => props.minZoom,
  mapTransform,
  previewCenter,
  scheduleRender,
  setViewport,
  viewport,
})

const nodesChangeSubscription = onNodesChange(scheduleCacheRebuild)
watch(() => nodes.value, scheduleCacheRebuild, { immediate: true })
watch(() => [viewport.value.x, viewport.value.y, viewport.value.zoom], scheduleRender, { immediate: true })
watch(() => [dimensions.value.width, dimensions.value.height], scheduleRender)

onMounted(() => {
  cacheCanvas = document.createElement('canvas')
  resizeObserver = new ResizeObserver(scheduleCacheRebuild)
  if (canvasRef.value) resizeObserver.observe(canvasRef.value)
  rebuildNodeCache()
})

onUnmounted(() => {
  nodesChangeSubscription.off()
  resizeObserver?.disconnect()
  if (rebuildTimer) clearTimeout(rebuildTimer)
  if (renderFrame) cancelAnimationFrame(renderFrame)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="flow-canvas-minimap"
    aria-label="画布小地图"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent="onWheel"
  ></canvas>
</template>

<style scoped>
.flow-canvas-minimap {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  touch-action: none;
}
</style>

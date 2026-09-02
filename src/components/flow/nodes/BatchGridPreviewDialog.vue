<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1
const BASE_STAGE_WIDTH = 960

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '批量预览' },
  items: { type: Array as () => any[], default: () => [] },
  layout: { type: Object as () => { rows?: number; cols?: number }, default: () => ({}) },
  sourceAspectRatio: { type: Number, default: 0 },
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const zoom = ref(1)
const viewportRef = ref<HTMLElement | null>(null)
const panX = ref(0)
const panY = ref(0)
const panState = {
  active: false,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
}

function readPositiveNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

function readTileSize(item: any): { width: number; height: number } {
  const mediaMeta = item?.mediaMeta && typeof item.mediaMeta === 'object'
    ? item.mediaMeta
    : (item?.data?.mediaMeta && typeof item.data.mediaMeta === 'object' ? item.data.mediaMeta : {})
  const width = readPositiveNumber(item?.width) || readPositiveNumber(mediaMeta.width)
  const height = readPositiveNumber(item?.height) || readPositiveNumber(mediaMeta.height)
  if (width > 0 && height > 0) {
    return { width, height }
  }
  const ratio = readPositiveNumber(item?.aspectRatio) || readPositiveNumber(mediaMeta.aspectRatio)
  if (ratio > 0) {
    return { width: ratio, height: 1 }
  }
  return { width: 1, height: 1 }
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function setZoom(value: number): void {
  zoom.value = clampZoom(value)
}

function handleViewportWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) {
    event.preventDefault()
  }
  const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
  setZoom(zoom.value + delta)
}

function getViewportBounds(): { width: number; height: number } {
  const rect = viewportRef.value?.getBoundingClientRect()
  return {
    width: rect?.width || 0,
    height: rect?.height || 0,
  }
}

function clampPan(nextX: number, nextY: number): { x: number; y: number } {
  const { width, height } = getViewportBounds()
  const stageWidth = BASE_STAGE_WIDTH * zoom.value
  const stageHeight = stageWidth / Math.max(previewAspectRatio.value, 0.0001)
  const overflowX = Math.max(0, stageWidth - width)
  const overflowY = Math.max(0, stageHeight - height)
  const minX = -overflowX / 2
  const maxX = overflowX / 2
  const minY = -overflowY / 2
  const maxY = overflowY / 2
  return {
    x: Math.min(maxX, Math.max(minX, nextX)),
    y: Math.min(maxY, Math.max(minY, nextY)),
  }
}

function resetViewport(): void {
  panX.value = 0
  panY.value = 0
}

function handlePanMove(event: MouseEvent): void {
  if (!panState.active) {
    return
  }
  const next = clampPan(
    panState.startPanX + (event.clientX - panState.startX),
    panState.startPanY + (event.clientY - panState.startY),
  )
  panX.value = next.x
  panY.value = next.y
}

function stopPan(): void {
  if (!panState.active) {
    return
  }
  panState.active = false
  window.removeEventListener('mousemove', handlePanMove)
  window.removeEventListener('mouseup', stopPan)
}

function handleViewportMouseDown(event: MouseEvent): void {
  if (event.button !== 1 || !viewportRef.value) {
    return
  }
  event.preventDefault()
  panState.active = true
  panState.startX = event.clientX
  panState.startY = event.clientY
  panState.startPanX = panX.value
  panState.startPanY = panY.value
  window.addEventListener('mousemove', handlePanMove)
  window.addEventListener('mouseup', stopPan)
}

const normalizedItems = computed(() => (
  (Array.isArray(props.items) ? props.items : []).map((item: any) => ({
    ...item,
    previewUrl: String(item?.thumb || '').trim() || String(item?.url || '').trim(),
    width: readPositiveNumber(item?.width),
    height: readPositiveNumber(item?.height),
    aspectRatio: readPositiveNumber(item?.aspectRatio),
    mediaMeta: item?.mediaMeta,
  }))
))

const gridMetrics = computed(() => {
  const rows = Math.max(1, Number(props.layout?.rows || 1))
  const cols = Math.max(1, Number(props.layout?.cols || 1))
  const widths = Array.from({ length: cols }, () => 1)
  const heights = Array.from({ length: rows }, () => 1)
  normalizedItems.value.forEach((item: any, index: number) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    if (row >= rows) {
      return
    }
    const size = readTileSize(item)
    widths[col] = Math.max(widths[col], size.width)
    heights[row] = Math.max(heights[row], size.height)
  })
  return {
    rows,
    cols,
    widths,
    heights,
    totalWidth: widths.reduce((sum, value) => sum + value, 0),
    totalHeight: heights.reduce((sum, value) => sum + value, 0),
  }
})

const previewGridStyle = computed(() => ({
  gridTemplateColumns: gridMetrics.value.widths.map((value: number) => `${value}fr`).join(' '),
  gridTemplateRows: gridMetrics.value.heights.map((value: number) => `${value}fr`).join(' '),
}))

const previewStageStyle = computed(() => {
  const sourceRatio = readPositiveNumber(props.sourceAspectRatio)
  const fallbackRatio = gridMetrics.value.totalWidth / Math.max(gridMetrics.value.totalHeight, 1)
  const aspectRatio = sourceRatio > 0
    ? sourceRatio
    : (fallbackRatio > 0 ? fallbackRatio : gridMetrics.value.cols / gridMetrics.value.rows)
  return { aspectRatio: String(aspectRatio) }
})

const previewAspectRatio = computed(() => {
  const sourceRatio = readPositiveNumber(props.sourceAspectRatio)
  if (sourceRatio > 0) return sourceRatio
  const fallbackRatio = gridMetrics.value.totalWidth / Math.max(gridMetrics.value.totalHeight, 1)
  return fallbackRatio > 0 ? fallbackRatio : gridMetrics.value.cols / Math.max(gridMetrics.value.rows, 1)
})

const previewStageWrapStyle = computed(() => ({
  width: `${Math.round(BASE_STAGE_WIDTH * zoom.value)}px`,
  transform: `translate(${panX.value}px, ${panY.value}px)`,
}))

const previewSummary = computed(() => (
  `${gridMetrics.value.rows} × ${gridMetrics.value.cols} · ${normalizedItems.value.length} 张`
))

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)

watch(() => props.modelValue, (visible) => {
  if (visible) {
    zoom.value = 1
    resetViewport()
  }
})

watch(zoom, () => {
  const next = clampPan(panX.value, panY.value)
  panX.value = next.x
  panY.value = next.y
})

onBeforeUnmount(() => {
  stopPan()
})

function closeDialog(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="label"
    width="min(94vw, 1320px)"
    top="2vh"
    append-to-body
    destroy-on-close
    class="batch-grid-preview-dialog"
    @close="closeDialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="batch-grid-preview-shell">
      <div class="batch-grid-preview-toolbar">
        <div class="batch-grid-preview-meta">{{ previewSummary }}</div>
        <div class="batch-grid-preview-controls">
          <span class="batch-grid-preview-hint">滚轮缩放</span>
          <span class="batch-grid-preview-zoom">{{ zoomPercent }}</span>
        </div>
      </div>

      <div
        ref="viewportRef"
        class="batch-grid-preview-viewport"
        @wheel="handleViewportWheel"
        @mousedown="handleViewportMouseDown"
      >
        <div class="batch-grid-preview-stage-wrap" :style="previewStageWrapStyle">
          <div class="batch-grid-preview-stage" :style="previewStageStyle">
            <div class="batch-grid-preview-grid" :style="previewGridStyle">
              <div
                v-for="item in normalizedItems"
                :key="item.id || item.previewUrl"
                class="batch-grid-preview-tile"
              >
                <img
                  v-if="item.previewUrl"
                  :src="item.previewUrl"
                  :alt="item.label || 'tile'"
                  class="batch-grid-preview-image"
                  loading="eager"
                >
                <div v-else class="batch-grid-preview-empty"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.batch-grid-preview-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 360px;
}

.batch-grid-preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.batch-grid-preview-meta {
  color: #d4d4d8;
  font-size: 13px;
}

.batch-grid-preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-grid-preview-hint {
  color: #a1a1aa;
  font-size: 12px;
}

.batch-grid-preview-zoom {
  min-width: 52px;
  color: #fafafa;
  font-size: 12px;
  text-align: right;
}

.batch-grid-preview-viewport {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 68vh;
  max-height: 84vh;
  padding: 16px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  background:
    linear-gradient(45deg, #16171a 25%, transparent 25%),
    linear-gradient(-45deg, #16171a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #16171a 75%),
    linear-gradient(-45deg, transparent 75%, #16171a 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  border-radius: 10px;
}

.batch-grid-preview-viewport:active {
  cursor: grabbing;
}

.batch-grid-preview-stage-wrap {
  flex: 0 0 auto;
}

.batch-grid-preview-stage {
  width: 100%;
  background: #0f0f12;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
}

.batch-grid-preview-grid {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 0;
}

.batch-grid-preview-tile {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #111214;
}

.batch-grid-preview-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
}

.batch-grid-preview-empty {
  width: 100%;
  height: 100%;
  background: #18181b;
}
</style>

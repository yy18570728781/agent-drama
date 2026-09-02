<template>
  <div
    ref="stageRef"
    class="media-compare-stage"
    :class="[
      isDragging ? 'cursor-grabbing' : 'cursor-grab',
      { 'media-compare-stage--app-fullscreen': isFullscreen },
    ]"
    @wheel.prevent="handleWheel"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <div class="media-compare-stage__pattern"></div>

    <div
      class="media-compare-stage__viewport"
      :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }"
    >
      <div class="media-compare-stage__glow"></div>
      <div v-if="compareMode && hasCompare && compareType === 'overlay'" class="media-compare-stage__compare">
        <ImageOverlayCompare
          :left-image="compareLeftImage"
          :right-image="compareRightImage"
          :percent="comparePercent"
          :left-label="compareLeftLabel"
          :right-label="compareRightLabel"
          @update:percent="comparePercent = $event"
        />
      </div>
      <div v-else-if="compareMode && hasCompare && compareType === 'split'" class="media-compare-stage__compare">
        <ImageOverlayCompare
          mode="split"
          :left-image="compareLeftImage"
          :right-image="compareRightImage"
          :left-label="compareLeftLabel"
          :right-label="compareRightLabel"
        />
      </div>
      <img
        v-else
        :src="displayImage"
        :alt="alt"
        class="media-compare-stage__single-image"
        draggable="false"
        @load="handleImageLoad"
      />
    </div>

    <div v-if="compareMode && hasReferenceCompare && referenceUrls.length > 1" class="media-compare-stage__ref-switcher">
      <button
        v-for="(url, index) in referenceUrls"
        :key="`${url}-${index}`"
        type="button"
        class="media-compare-stage__ref-thumb"
        :class="{ active: index === compareRefIndex }"
        @click="$emit('update:compareRefIndex', index)"
      >
        <img :src="url" alt="" draggable="false" referrerpolicy="no-referrer" />
      </button>
    </div>

    <div v-if="images.length > 1" class="media-compare-stage__counter">
      {{ currentIndex + 1 }} / {{ images.length }}
    </div>

    <div v-if="showToolbar" class="media-compare-stage__toolbar">
      <div class="media-compare-stage__zoom">
        <button type="button" class="media-compare-stage__tool-btn" title="缩小" @click="zoomOut">
          <Minus :size="14" />
        </button>
        <button type="button" class="media-compare-stage__zoom-label" title="重置视图" @click="resetView">
          {{ displayPercent }}%
        </button>
        <button type="button" class="media-compare-stage__tool-btn" title="放大" @click="zoomIn">
          <Plus :size="14" />
        </button>
      </div>

      <div class="media-compare-stage__divider"></div>

      <button type="button" class="media-compare-stage__tool-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
        <Maximize :size="14" />
      </button>

      <template v-if="hasCompare">
        <div class="media-compare-stage__divider"></div>
        <button
          type="button"
          class="media-compare-stage__tool-btn"
          :class="{ active: compareMode && compareType === 'split' }"
          title="左右对比"
          @click="$emit('enable-compare', 'split')"
        >
          <ArrowLeftRight :size="14" />
        </button>
        <button
          type="button"
          class="media-compare-stage__tool-btn"
          :class="{ active: compareMode && compareType === 'overlay' }"
          title="层叠对比"
          @click="$emit('enable-compare', 'overlay')"
        >
          <Layers :size="14" />
        </button>
        <button
          v-if="compareMode"
          type="button"
          class="media-compare-stage__tool-btn"
          title="关闭对比"
          @click="$emit('disable-compare')"
        >
          <X :size="14" />
        </button>
      </template>
    </div>

    <div v-if="showThumbnails && images.length > 1" class="media-compare-stage__thumbs">
      <button
        v-for="(image, index) in images"
        :key="`${image}-${index}`"
        type="button"
        class="media-compare-stage__thumb"
        :class="{ active: index === currentIndex }"
        @click="$emit('navigate', index)"
      >
        <img :src="image" alt="" draggable="false" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeftRight, Layers, Maximize, Minus, Plus, X } from '@/components/common/icon/lucide'
import ImageOverlayCompare from './ImageOverlayCompare.vue'

const props = withDefaults(defineProps<{
  images: string[]
  currentIndex: number
  displayImage: string
  alt?: string
  compareMode?: boolean
  compareType?: 'split' | 'overlay'
  hasCompare?: boolean
  compareLeftImage?: string
  compareRightImage?: string
  compareLeftLabel?: string
  compareRightLabel?: string
  hasReferenceCompare?: boolean
  referenceUrls?: string[]
  compareRefIndex?: number
  showToolbar?: boolean
  showThumbnails?: boolean
  rightNavOffset?: number
}>(), {
  alt: 'Preview Image',
  compareMode: false,
  compareType: 'overlay',
  hasCompare: false,
  compareLeftImage: '',
  compareRightImage: '',
  compareLeftLabel: '参考',
  compareRightLabel: '结果',
  hasReferenceCompare: false,
  referenceUrls: () => [],
  compareRefIndex: 0,
  showToolbar: true,
  showThumbnails: false,
  rightNavOffset: 16,
})

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'navigate', index: number): void
  (e: 'enable-compare', type: 'split' | 'overlay'): void
  (e: 'disable-compare'): void
  (e: 'update:compareRefIndex', index: number): void
  (e: 'image-load', event: Event): void
}>()

const MIN_SCALE = 0.1
const MAX_SCALE = 5
const ZOOM_SPEED = 0.05
const FIT_PADDING = 0

const stageRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const fitScale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const startX = ref(0)
const startY = ref(0)
const isDragging = ref(false)
const isFullscreen = ref(false)
const comparePercent = ref(50)
let previousBodyOverflow = ''
let imageLoadToken = 0
let hasUserZoomed = false
let resizeObserver: ResizeObserver | null = null

/** 对比模式纯 CSS 驱动（object-fit:contain），不走 transform 缩放，避免双重缩放 */
const isCompareActive = computed(() => props.compareMode && !!props.hasCompare)

function handleWheel(event: WheelEvent): void {
  const delta = event.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED
  scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value * (1 + delta)))
  hasUserZoomed = true
}

const displayPercent = computed(() => {
  if (fitScale.value <= 0) return 100
  return Math.round((scale.value / fitScale.value) * 100)
})

function handleMouseDown(event: MouseEvent): void {
  if (event.button !== 0 && event.button !== 1) return
  if (event.button === 1) event.preventDefault()
  isDragging.value = true
  startX.value = event.clientX - translateX.value
  startY.value = event.clientY - translateY.value
}

function handleMouseMove(event: MouseEvent): void {
  if (isDragging.value) {
    translateX.value = event.clientX - startX.value
    translateY.value = event.clientY - startY.value
  }
}

function handleMouseUp(): void {
  isDragging.value = false
}

function zoomIn(): void {
  scale.value = Math.min(MAX_SCALE, scale.value * 1.25)
  hasUserZoomed = true
}

function zoomOut(): void {
  scale.value = Math.max(MIN_SCALE, scale.value / 1.25)
  hasUserZoomed = true
}

function resetView(): void {
  fitMediaToStage()
}

function resetPan(): void {
  translateX.value = 0
  translateY.value = 0
}

function getFitScale(width: number, height: number): number {
  const stage = stageRef.value
  if (!stage || width <= 0 || height <= 0) return 1
  const sw = stage.clientWidth
  const sh = stage.clientHeight
  if (sw <= 0 || sh <= 0) return 1
  const availableWidth = sw - FIT_PADDING * 2
  const availableHeight = sh - FIT_PADDING * 2
  const heightScale = availableHeight / height
  const widthScale = availableWidth / width
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, heightScale, widthScale))
}

function applyFitScale(width: number, height: number): void {
  fitScale.value = getFitScale(width, height)
  scale.value = fitScale.value
  resetPan()
  hasUserZoomed = false
}

function handleImageLoad(event: Event): void {
  const image = event.target as HTMLImageElement
  applyFitScale(image.naturalWidth, image.naturalHeight)
  emit('image-load', event)
}

function fitMediaToStage(): void {
  if (isCompareActive.value) {
    fitScale.value = 1
    scale.value = 1
    resetPan()
    hasUserZoomed = false
    return
  }
  const image = stageRef.value?.querySelector('img') as HTMLImageElement | null
  if (image?.naturalWidth && image?.naturalHeight) {
    applyFitScale(image.naturalWidth, image.naturalHeight)
    return
  }
  fitScale.value = 1
  scale.value = 1
  resetPan()
  hasUserZoomed = false
}

function preloadDisplayImageForFit(url: string): void {
  const nextToken = imageLoadToken + 1
  imageLoadToken = nextToken
  if (!url) {
    resetView()
    return
  }
  if (isCompareActive.value) {
    fitScale.value = 1
    scale.value = 1
    resetPan()
    hasUserZoomed = false
    return
  }
  const image = new Image()
  image.onload = () => {
    if (nextToken !== imageLoadToken) return
    if (isCompareActive.value) return
    applyFitScale(image.naturalWidth, image.naturalHeight)
  }
  image.src = url
}

async function toggleFullscreen(): Promise<void> {
  isFullscreen.value = !isFullscreen.value
  await nextTick()
  resetView()
}

function syncBodyScrollLock(locked: boolean) {
  if (typeof document === 'undefined') return
  if (locked) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }
  document.body.style.overflow = previousBodyOverflow
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isFullscreen.value) return
  isFullscreen.value = false
}

watch(isFullscreen, (locked) => {
  syncBodyScrollLock(locked)
  if (typeof window === 'undefined') return
  if (locked) {
    window.addEventListener('keydown', handleKeydown)
    return
  }
  window.removeEventListener('keydown', handleKeydown)
})

watch(isCompareActive, (active) => {
  if (active) {
    fitScale.value = 1
    scale.value = 1
    resetPan()
    hasUserZoomed = false
    return
  }
  nextTick(() => preloadDisplayImageForFit(props.displayImage))
})

watch(
  () => props.displayImage,
  (url) => {
    nextTick(() => preloadDisplayImageForFit(url))
  },
  { immediate: true },
)

onMounted(() => {
  fitMediaToStage()
  const stage = stageRef.value
  if (!stage || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    if (hasUserZoomed) return
    fitMediaToStage()
  })
  resizeObserver.observe(stage)
})

onBeforeUnmount(() => {
  syncBodyScrollLock(false)
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped lang="scss">
@use './MediaCompareStage.scss';

/* 对比模式布局：80% 舒适尺寸，flex 居中，浏览器自动响应 resize */
.media-compare-stage__compare {
  position: relative;
  width: 80%;
  height: 80%;
  z-index: 1;
  max-width: none;
  max-height: none;
  border-radius: 2px;
  overflow: hidden;
}
</style>

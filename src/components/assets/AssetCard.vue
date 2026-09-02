<template>
  <div class="record-wrapper group"
    :class="{ 'is-dragging': isDragging, 'is-pushed': isPushed, 'is-selected': selected }"
    :style="cardStyle"
    :data-asset-id="asset.id"
    @mousedown="onDragStart"
    @click="onClick"
    @mouseenter="onHover"
    @mouseleave="onLeave"
  >
    <!-- 媒体区域 -->
    <div class="media-area">
      <template v-if="asset.type === 'video'">
        <video ref="videoRef" :src="asset.url" class="media-content"
          :poster="asset.thumbnail_url || undefined" preload="none" loop muted playsinline style="height:auto"></video>
        <div class="play-overlay">
          <div class="play-btn">&#9654;</div>
        </div>
      </template>
      <template v-else>
        <img
          v-if="asset.thumbnail_url || asset.url"
          :src="asset.thumbnail_url || asset.url"
          class="media-content"
          loading="lazy"
          @error="onImgError"
        />
        <div v-else class="media-placeholder">
          <span class="placeholder-icon">&#128444;</span>
        </div>
      </template>

      <!-- 收藏角标 -->
      <div v-if="asset.is_favorites && !selectable" class="fav-badge">&#9733;</div>

      <!-- 多选 checkbox -->
      <div v-if="selectable" class="select-overlay" @click.stop="$emit('toggle-select', asset.id)">
        <div class="select-checkbox" :class="{ checked: selected }">
          <span v-if="selected">&#10003;</span>
        </div>
      </div>

      <!-- Hover 操作栏 -->
      <div v-if="!selectable && showActions !== false" class="action-overlay" @click.stop>
        <button @click="$emit('favorite', asset)"
          :class="['icon-btn', { 'is-favorite': asset.is_favorites }]"
          :title="asset.is_favorites ? '取消收藏' : '收藏'">
          {{ asset.is_favorites ? '&#9733;' : '&#9734;' }}
        </button>
        <button @click="$emit('download', asset)" class="icon-btn" title="下载">
          &#8659;
        </button>
        <button @click="$emit('delete', asset.id)" class="icon-btn icon-btn-danger" title="删除">
          &#10005;
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  asset: {
    id: string
    type: string
    url: string
    thumbnail_url: string | null
    is_favorites: boolean
    [key: string]: any
  }
  pushOffset?: { x: number, y: number }
  selectable?: boolean
  selected?: boolean
  showActions?: boolean
}>()

const emit = defineEmits<{
  click: [asset: any]
  favorite: [asset: any]
  download: [asset: any]
  delete: [id: string]
  'toggle-select': [id: string]
  dragMove: [id: string, x: number, y: number]
  dragEnd: [id: string, x: number, y: number]
  hover: [id: string, x: number, y: number]
  hoverEnd: [id: string]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isDragging = ref(false)
const isPushed = ref(false)
const isHovering = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const rotation = ref(0)

const cardStyle = computed(() => {
  const transforms = []
  const styles: any = {}

  // 拖拽偏移
  if (isDragging.value) {
    transforms.push(`translate(${dragOffset.value.x}px, ${dragOffset.value.y}px)`)
    transforms.push(`rotate(${rotation.value}deg)`)
    styles.zIndex = 1000
  }
  // 悬停效果
  else if (isHovering.value) {
    transforms.push(`translateY(-4px)`)
    transforms.push(`rotate(${rotation.value}deg)`)
    styles.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  }

  // 推开偏移
  if (props.pushOffset && !isDragging.value) {
    transforms.push(`translate(${props.pushOffset.x}px, ${props.pushOffset.y}px)`)
    styles.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
  }

  if (transforms.length > 0) {
    styles.transform = transforms.join(' ')
  }

  return styles
})

let startX = 0
let startY = 0
let hasMoved = false

const onDragStart = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.action-overlay')) return

  startX = e.clientX
  startY = e.clientY
  hasMoved = false
  isDragging.value = true
  rotation.value = (Math.random() - 0.5) * 8

  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  e.preventDefault()
}

let lastDragX = 0
let lastDragY = 0

const onDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  lastDragX = e.clientX
  lastDragY = e.clientY

  const dx = e.clientX - startX
  const dy = e.clientY - startY

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    hasMoved = true
  }

  dragOffset.value = { x: dx, y: dy }
  rotation.value = (Math.random() - 0.5) * 8 + dx * 0.05

  emit('dragMove', props.asset.id, e.clientX, e.clientY)
}

const onDragEnd = () => {
  isDragging.value = false

  // 回弹动画
  dragOffset.value = { x: 0, y: 0 }
  rotation.value = 0

  emit('dragEnd', props.asset.id, lastDragX, lastDragY)

  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

const onClick = (e: MouseEvent) => {
  if (!hasMoved) {
    emit('click', props.asset)
  }
}

const onHover = (e: MouseEvent) => {
  videoRef.value?.play().catch(() => {})

  // 悬停动效
  isHovering.value = true
  rotation.value = (Math.random() - 0.5) * 3 // 轻微旋转 -1.5° ~ +1.5°

  // 触发推开动效
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  emit('hover', props.asset.id, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

const onLeave = () => {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.currentTime = 0
  }

  // 清除悬停动效
  isHovering.value = false
  rotation.value = 0

  // 清除推开动效
  emit('hoverEnd', props.asset.id)
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  // 显示 placeholder
  const parent = img.parentElement
  if (parent) {
    const ph = document.createElement('div')
    ph.className = 'media-placeholder'
    ph.innerHTML = '<span class="placeholder-icon">&#128444;</span>'
    parent.appendChild(ph)
  }
}
</script>

<style scoped>
.record-wrapper {
  display: block;
  width: 100%;
  overflow: hidden;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: grab;
  user-select: none;
  break-inside: avoid;
}

.record-wrapper.is-dragging {
  cursor: grabbing;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  transition: box-shadow 0.2s;
}

.record-wrapper.is-pushed {
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.record-wrapper:not(.is-dragging):hover {
  outline: 2px solid #3f3f46;
  outline-offset: -1px;
  border-radius: 0;
}

/* 媒体区域 */
.media-area {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #27272a;
}

.media-content {
  width: 100%;
  height: auto;
  display: block;
}

.media-placeholder {
  width: 100%;
  min-height: 80px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #27272a;
  border-radius: 8px;
}

.placeholder-icon {
  font-size: 24px;
  color: #52525b;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  background: rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.record-wrapper:hover .play-overlay {
  opacity: 0;
}

.play-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
}

/* 收藏角标 */
.fav-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(124, 110, 246, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  pointer-events: none;
  box-shadow: 0 1px 4px rgba(0,0,0,0.35);
}

/* Hover 操作栏 */
.action-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 8px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6) 55%);
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.record-wrapper:hover .action-overlay {
  opacity: 1;
  pointer-events: auto;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: rgba(22, 22, 28, 0.82);
  color: #c4c4cc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.12s;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.icon-btn:hover {
  background: rgba(50, 50, 62, 0.95);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.24);
  transform: scale(1.08);
}

/* 已收藏状态 */
.icon-btn.is-favorite {
  color: #7C6EF6;
  border-color: rgba(124, 110, 246, 0.4);
  background: rgba(124, 110, 246, 0.15);
}

.icon-btn.is-favorite:hover {
  background: rgba(124, 110, 246, 0.28);
  border-color: rgba(124, 110, 246, 0.6);
  color: #9D92F8;
}

/* 删除按钮 */
.icon-btn-danger:hover {
  background: rgba(248, 113, 113, 0.2);
  border-color: rgba(248, 113, 113, 0.45);
  color: #F87171;
}

/* 多选 */
.record-wrapper.is-selected {
  outline: 2px solid #3b82f6;
  outline-offset: -1px;
}

.select-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 8px;
  background: rgba(0, 0, 0, 0.1);
  cursor: pointer;
  z-index: 2;
}

.select-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid rgba(255,255,255,0.7);
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: bold;
  transition: background 0.15s, border-color 0.15s;
}

.select-checkbox.checked {
  background: #3b82f6;
  border-color: #3b82f6;
}
</style>

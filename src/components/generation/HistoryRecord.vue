<template>
  <div class="record-wrapper group" @click="emit('click', record)"
    @mouseenter="onHover" @mouseleave="onLeave">
    <!-- 媒体区域 -->
    <div class="media-area" :class="{ 'is-original-ratio': originalRatio }">
      <template v-if="record.type === 'video'">
        <video ref="videoRef" :src="record.media?.[0]" class="media-content"
          draggable="false"
          :poster="record.thumbnail_url || record._asset?.thumbnail_url || undefined"
          preload="metadata" loop muted playsinline width="100%" height="100%"
          @loadedmetadata="onVideoLoaded"></video>
        <div class="play-overlay">
          <div class="play-btn"><Play :size="16" class="ml-0.5" /></div>
        </div>
      </template>
      <template v-else-if="record.type === 'model'">
        <img
          v-if="record.thumbnail_url || record._asset?.thumbnail_url"
          :src="record.thumbnail_url || record._asset?.thumbnail_url"
          class="media-content"
          draggable="false"
          :style="{ objectFit: fit }"
          loading="lazy"
          @load="onImageLoad"
        />
        <div v-else class="media-placeholder media-placeholder-model">
          <Box :size="26" class="media-placeholder-icon" />
          <span class="media-placeholder-label">3D 模型</span>
        </div>
      </template>
      <template v-else>
        <img
          v-if="record.images?.[0] || record.media?.[0]"
          :src="record.images?.[0] ?? record.media?.[0]"
          class="media-content"
          draggable="false"
          :style="{ objectFit: fit }"
          referrerPolicy="no-referrer"
          loading="lazy"
          @load="onImageLoad"
        />
        <div v-else class="media-placeholder">
          <ImageIcon :size="20" class="media-placeholder-icon" />
        </div>
      </template>

      <!-- grid 多图叠加指示 -->
      <div v-if="(record.images?.length || 0) > 1" class="multi-badge">
        {{ record.images.length }}
      </div>

      <!-- Hover 操作栏 -->
      <div v-if="showActions" class="action-overlay" @click.stop>
        <button @click="emit('edit', record)" class="icon-btn" title="重新编辑">
          <Edit3 :size="13" />
        </button>
        <button @click="emit('regenerate', record)" class="icon-btn" title="再次生成">
          <RefreshCw :size="13" />
        </button>
        <el-popover placement="top" trigger="click" :width="140" :teleported="false"
          popper-class="history-record-popover-menu" :show-arrow="false">
          <template #reference>
            <button class="icon-btn" title="更多">
              <MoreHorizontal :size="13" />
            </button>
          </template>
          <button @click="emit('delete', record.id)" class="history-record-menu-item">
            <Trash2 :size="12" /><span>删除</span>
          </button>
        </el-popover>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Edit3, RefreshCw, MoreHorizontal, Trash2, Play, Image as ImageIcon, Box } from '@/components/common/icon/lucide'

withDefaults(defineProps<{
  record: any
  showActions?: boolean
  originalRatio?: boolean
  fit?: 'cover' | 'contain' | 'fill'
}>(), {
  showActions: true,
  originalRatio: false,
  fit: 'cover'
})

const emit = defineEmits<{
  click: [record: any]
  edit: [record: any]
  regenerate: [record: any]
  delete: [id: number]
  'media-loaded': [dimensions: { width: number; height: number }]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

const onImageLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) {
    emit('media-loaded', { width: img.naturalWidth, height: img.naturalHeight })
  }
}

const onVideoLoaded = (e: Event) => {
  const video = e.target as HTMLVideoElement
  if (video.videoWidth && video.videoHeight) {
    emit('media-loaded', { width: video.videoWidth, height: video.videoHeight })
  }
}

const onHover = () => {
  videoRef.value?.play().catch(() => {})
}

const onLeave = () => {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.currentTime = 0
  }
}

</script>

<style scoped>
.record-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
  transition: border-color 0.15s;
  cursor: pointer;
}

.record-wrapper:hover {
  border-color: var(--text-muted);
}

/* 媒体区域 */
.media-area {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--bg-elevated);
}

.media-area.is-original-ratio {
  aspect-ratio: auto;
  height: auto;
  min-height: 100px; /* prevent collapse */
}

.media-content {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-area.is-original-ratio .media-content {
  position: static;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
}

.media-placeholder-model {
  flex-direction: column;
  gap: 8px;
  color: var(--text-muted);
}

.media-placeholder-icon {
  color: var(--text-muted);
}

.media-placeholder-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  transition: opacity 0.2s;
  pointer-events: none;
}

.record-wrapper:hover .play-overlay {
  opacity: 0;
}

.play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  border: 1.5px solid rgba(255, 255, 255, 0.2);
}

.multi-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
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
  gap: 2px;
  padding: 4px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  opacity: 0;
  transition: opacity 0.2s;
}

.record-wrapper:hover .action-overlay {
  opacity: 1;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  backdrop-filter: blur(4px);
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

:deep(.history-record-popover-menu) {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border) !important;
  border-radius: 10px !important;
  padding: 4px !important;
  box-shadow: var(--sys-shadow-elevated) !important;
  color: var(--text-primary) !important;
}

.history-record-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.history-record-menu-item:hover {
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
  color: var(--text-primary);
}

</style>

<template>
  <div class="item-card" :class="{ clickable: clickable }" @click="emit('click')">
    <div class="card-header">
      <div v-if="file_urls && file_urls.length > 0" class="ref-strip">
        <div v-for="(url, index) in file_urls" :key="index" class="ref-thumb" :style="{ transform: `rotate(${-2 + index * 0.5}deg)` }">
          <img v-if="getThumbType(url) === 'image'" :src="url" :alt="`Image ${index + 1}`" />
          <div v-else class="ref-thumb-fallback flex flex-col items-center gap-2 py-2 cursor-pointer">
            <component :is="getThumbType(url) === 'audio' ? AudioLines : getThumbType(url) === 'video' ? Play : Box" class="ref-thumb-symbol" />
            <span class="ref-thumb-text">{{ getThumbType(url) === 'audio' ? '音频' : getThumbType(url) === 'video' ? '视频' : '文件' }}</span>
          </div>
        </div>
      </div>
      <img v-if="icon && (!file_urls || file_urls.length === 0)" :src="icon" :alt="iconAlt" class="card-icon" @error="onIconError" />
      <span class="card-title">{{ title }}</span>
    </div>
    <div class="card-footer">
      <div class="card-tags">
        <span
          v-for="tag in (tags || []).slice(0, 2)"
          :key="tag.label"
          class="card-tag"
          :class="tag.type"
        >
          {{ tag.label }}
        </span>
      </div>
      <span v-if="badge" class="card-badge">{{ badge }}</span>
      <!-- 插槽支持自定义操作按钮 -->
      <slot name="actions"></slot>
      <!-- 兼容旧版按钮 -->
      <button
        v-if="showAction && !$slots.actions"
        class="card-action"
        :class="actionType"
        @click.stop="emit('action')"
      >
        {{ actionText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AudioLines, Play, Box } from '@/components/common/icon/lucide'

withDefaults(defineProps<{
  title: string
  icon?: string
  iconAlt?: string
  file_urls?: string[]
  tags?: { label: string; type?: string }[]
  badge?: string
  showAction?: boolean
  actionText?: string
  actionType?: 'primary' | 'default'
  clickable?: boolean
}>(), {
  icon: '',
  iconAlt: '',
  file_urls: () => [],
  tags: () => [],
  showAction: false,
  actionText: '',
  actionType: 'default',
  clickable: false
})

const emit = defineEmits<{
  click: []
  action: []
}>()

function onIconError(e: Event) {
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
}

function getThumbType(url: string) {
  const raw = String(url || '').toLowerCase()
  if (/\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i.test(raw)) return 'video'
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(raw)) return 'audio'
  if (/\.(glb|gltf|fbx|obj|usdz|blend)(\?|#|$)/i.test(raw)) return 'model'
  return 'image'
}
</script>

<style scoped>
.item-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  transition: all 0.2s ease;
  min-width: 140px;
  min-height: 72px;
}

.item-card.clickable {
  cursor: pointer;
}

.item-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-header {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ref-strip {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-right: 8px;
}

.ref-thumb {
  width: 36px;
  height: 52px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #3f3f46;
  position: relative;
  transform: rotate(-2deg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ref-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ref-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #27272a, #18181b);
  color: #e4e4e7;
}

.ref-thumb-symbol {
  font-size: 16px;
  line-height: 1;
}

.ref-thumb-text {
  font-size: 9px;
  line-height: 1;
}

.card-icon {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  object-fit: contain;
  flex-shrink: 0;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-tags {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.card-tag {
  font-size: 8px;
  font-weight: 500;
  padding: 1px 4px;
  border-radius: 2px;
}

.card-tag.image {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.card-tag.i2i {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}

.card-tag.video {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.card-tag.i2v {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.card-tag.chat {
  background: rgba(236, 72, 153, 0.15);
  color: #ec4899;
}

.card-tag.default {
  background: var(--bg-surface);
  color: var(--text-muted);
}

.card-badge {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
}

.card-action {
  padding: 3px 10px;
  border-radius: 4px;
  border: none;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.card-action.primary {
  background: var(--accent);
  color: #fff;
}

.card-action.primary:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.card-action.default {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.card-action.default:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--text-primary);
}

/* Slot action buttons */
.card-footer :deep(.card-action-chat),
.card-footer :deep(.card-action-config) {
  padding: 3px 10px;
  border-radius: 4px;
  border: none;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.card-footer :deep(.card-action-chat) {
  background: var(--accent);
  color: #fff;
}

.card-footer :deep(.card-action-chat):hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.card-footer :deep(.card-action-config) {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.card-footer :deep(.card-action-config):hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--text-primary);
}
</style>

<template>
  <aside class="media-detail-panel">
    <div class="panel-scroll custom-scrollbar">
      <!-- Medias Section: Thumbnail Grid -->
      <div v-if="images.length > 1" class="section medias-section">
        <h3 class="section-title">图片</h3>
        <div class="thumbnails-grid">
          <div
            v-for="(img, index) in images"
            :key="index"
            class="thumbnail-item"
            :class="{ active: index === currentIndex }"
            @click="$emit('navigate', index)"
          >
            <img :src="img" class="thumbnail-img" alt="" draggable="false" />
            <div v-if="isVideo && index === 0" class="video-badge">
              <Video :size="10" />
            </div>
          </div>
        </div>
      </div>

      <ReferenceFileStrip v-if="referenceUrls.length" :urls="referenceUrls" />

      <!-- Prompt Section -->
      <div v-if="imageInfo?.prompt" class="section prompt-section">
        <div class="section-header">
          <h3 class="section-title">提示词</h3>
          <button class="copy-btn" @click="handleCopyPrompt" title="复制提示词">
            <Check v-if="promptCopied" :size="14" class="text-blue-400" />
            <Copy v-else :size="14" />
          </button>
        </div>
        <div class="prompt-content">
          <p class="prompt-text">{{ imageInfo.prompt }}</p>
        </div>
      </div>

      <!-- Info Section: Metadata -->
      <div class="section info-section">
        <div class="info-bar">
          <div class="info-header">
            <div v-if="imageInfo?.modelDisplayName || imageInfo?.model" class="info-model-card">
              <img
                v-if="imageInfo?.modelVendor"
                :src="`/icons/publishers/${imageInfo.modelVendor}.png`"
                class="info-model-icon"
                :alt="imageInfo.modelVendor"
                @error="($event.target as HTMLImageElement).style.display='none'"
              />
              <div class="info-model-text">
                <span class="info-model-display-name">{{ displayModelName }}</span>
                <span v-if="imageInfo?.model && displayModelName !== imageInfo.model" class="info-model-id">{{ imageInfo.model }}</span>
              </div>
            </div>
            <!-- Detailed Info Popover -->
            <div v-if="hasDetailInfo" class="detail-info-trigger">
            <Popover hover placement="left-end">
              <template #trigger>
                <span class="detail-trigger-text">
                  详细信息 <Info :size="14" />
                </span>
              </template>
              <div class="detail-popover">
                <div class="detail-row" v-if="imageInfo?.usedTools">
                  <span class="detail-label">使用过</span>
                  <span class="detail-value">{{ imageInfo.usedTools }}</span>
                </div>
                <div class="detail-row" v-if="imageInfo?.createTime">
                  <span class="detail-label">生成时间</span>
                  <span class="detail-value mono">{{ imageInfo.createTime }}</span>
                </div>
                <div class="detail-row" v-if="imageInfo?.generationHint">
                  <span class="detail-label">生成提示</span>
                  <span class="detail-value">{{ imageInfo.generationHint }}</span>
                </div>
                <div class="detail-row" v-if="imageInfo?.vendor">
                  <span class="detail-label">平台</span>
                  <span class="detail-value">{{ imageInfo.vendorDisplayName || imageInfo.vendor }}</span>
                </div>
                <div class="detail-row" v-if="imageInfo?.queryId">
                  <span class="detail-label">平台查询ID</span>
                  <span class="detail-value mono">{{ imageInfo.queryId }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">图片数量</span>
                  <span class="detail-value">{{ images.length }} 张</span>
                </div>
              </div>
            </Popover>
          </div>
          </div>
          <div class="info-tags">
            <span v-if="imageInfo?.ratio" class="info-tag">{{ imageInfo.ratio }}</span>
            <span v-if="imageSize" class="info-tag">{{ imageSize.width }}×{{ imageSize.height }}</span>
          </div>
        </div>
      </div>

      <!-- AI Tools Section -->
      <!-- 操作按钮（始终显示，不依赖 showAITools） -->
      <div v-if="showActions" class="section tools-section">
        <h3 class="section-title">操作</h3>
        <div class="tools-grid">
          <button
            v-if="isVideo"
            class="tool-btn tool-standard"
            @click="$emit('editVideo')"
          >
            <Edit3 :size="18" class="tool-icon" />
            <span class="tool-label">视频编辑</span>
          </button>
          <button
            class="tool-btn tool-standard"
            :class="{ 'tool-btn-loading': isReEditing }"
            :disabled="isReEditing"
            @click="!isReEditing && $emit('reEdit')"
          >
            <Loader2 v-if="isReEditing" :size="18" class="tool-icon animate-spin" />
            <PenLine v-else :size="18" class="tool-icon" />
            <span class="tool-label">{{ isReEditing ? '加载中' : '重新编辑' }}</span>
          </button>
          <button
            class="tool-btn tool-standard tool-regen"
            :class="{ 'tool-btn-loading': isRegenerating }"
            :disabled="isRegenerating"
            @click="!isRegenerating && $emit('regenerate')"
          >
            <Loader2 v-if="isRegenerating" :size="18" class="tool-icon animate-spin" />
            <RefreshCcw v-else :size="18" class="tool-icon" />
            <span class="tool-label">{{ isRegenerating ? '生成中' : '再次生成' }}</span>
          </button>
        </div>
      </div>
      <!-- Workflow Actions -->
      <div v-if="showWorkflowActions" class="section workflow-section">
        <div class="workflow-grid">
          <button class="workflow-btn" @click="$emit('workflowAction', 'video')">
            <Video :size="16" class="workflow-icon" />
            <span>视频生成</span>
          </button>
          <button class="workflow-btn" @click="$emit('workflowAction', 'canvas')">
            <PenTool :size="16" class="workflow-icon" />
            <span>去画布编辑</span>
          </button>
        </div>
      </div>

      <!-- Actions Section -->
      <div class="section actions-section">
        <div class="actions-grid">
          <button
            class="action-btn action-primary"
            :disabled="!currentImage"
            :draggable="Boolean(currentImage)"
            title="拖到外部"
            @mouseenter="prepareDragOut"
            @mousedown="prepareDragOut"
            @dragstart="handleDragOutStart"
            @dragend="handleDragOutEnd"
          >
            <Download :size="16" />
            <span>拖到外部</span>
          </button>
          <button v-if="showShare" class="action-btn" @click="$emit('share', currentImage)">
            <Share2 :size="16" />
            <span>分享</span>
          </button>
          <button v-if="showFavorite" class="action-btn" @click="handleFavoriteClick" :class="{ favorited: isFavorited }">
            <Heart :size="16" :fill="isFavorited ? 'currentColor' : 'none'" />
            <span>{{ isFavorited ? '已收藏' : '收藏' }}</span>
          </button>
          <button v-if="showDelete" class="action-btn action-danger" @click="handleDelete">
            <Trash2 :size="16" />
            <span>删除</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Copy, Check, Info, Video, Sparkles, Wand2, Expand, Brush, Eraser,
  PenTool, Download, Heart, Share2, Trash2, PenLine, RefreshCcw, Loader2, Edit3
} from '@/components/common/icon/lucide'
import { getModelDetail } from '@/api/models'
import { useAssetDragOut, type AssetDragPayload } from '@/composables/assets/useAssetDragOut'
import Popover from './Popover.vue'
import ReferenceFileStrip from './ReferenceFileStrip.vue'

// --- Types ---
interface ImageInfo {
  prompt?: string
  model?: string           // 原始 model ID，备用
  modelDisplayName?: string // 展示名，如 Seedream4.5
  modelVendor?: string      // 厂商标识，如 bytedance
  ratio?: string
  size?: string
  createTime?: string
  vendor?: string
  vendorDisplayName?: string
  capability?: string
  mode?: string
  queryId?: string | number
  usedTools?: string
  generationHint?: string
  paramsDisplay?: Array<{ label?: string; key: string; value: any }>
  generateParams?: Record<string, any> | null
  [key: string]: any
}

// --- Props ---
const props = withDefaults(defineProps<{
  images: string[]
  currentIndex: number
  currentImage: string
  imageInfo?: ImageInfo | null
  imageSize?: { width: number; height: number } | null
  isVideo?: boolean
  showAITools?: boolean
  showActions?: boolean
  isReEditing?: boolean
  isRegenerating?: boolean
  showWorkflowActions?: boolean
  showFavorite?: boolean
  showShare?: boolean
  showDelete?: boolean
  isFavorited?: boolean
  recordId?: number | string
}>(), {
  currentIndex: 0,
  currentImage: '',
  imageInfo: null,
  imageSize: null,
  isVideo: false,
  showAITools: true,
  showActions: false,
  isReEditing: false,
  isRegenerating: false,
  showWorkflowActions: true,
  showFavorite: false,
  showShare: false,
  showDelete: true,
  isFavorited: false,
  recordId: undefined
})

// --- Emits ---

const emit = defineEmits<{
  navigate: [index: number]
  toolAction: [tool: string]
  workflowAction: [action: string]
  reEdit: []
  regenerate: []
  editImage: []
  editVideo: []
  download: [url: string]
  copy: [url: string]
  favorite: [recordId: string | number]
  share: [image: string]
  delete: [id: number | string]
}>()


// --- State ---
const promptCopied = ref(false)
const resolvedModelDisplayName = ref('')
const assetDragOut = useAssetDragOut()

function handleFavoriteClick(): void {
  emit('favorite', props.recordId || '')
}

// --- Computed ---
const referenceUrls = computed<string[]>(() => {
  const refs = props.imageInfo?.referenceUrls
  if (!Array.isArray(refs)) return []
  return refs.filter((u: any) => typeof u === 'string' && u.trim())
})

const displayModelName = computed(() => {
  return resolvedModelDisplayName.value || props.imageInfo?.modelDisplayName || props.imageInfo?.model || ''
})

watch(
  () => ({
    model: props.imageInfo?.model || props.imageInfo?.generateParams?.params?.model || '',
    modelDisplayName: props.imageInfo?.modelDisplayName || '',
  }),
  async ({ model, modelDisplayName }) => {
    resolvedModelDisplayName.value = modelDisplayName
    if (model) {
      try {
        const detail = await getModelDetail(model)
        resolvedModelDisplayName.value = detail.display_name || detail.id || model
      } catch (error) {
        console.warn('[MediaDetailPanel] failed to load model detail:', error)
      }
    }
  },
  { immediate: true }
)

const hasDetailInfo = computed(() => {
  return props.imageInfo?.createTime || props.imageInfo?.vendor || props.imageInfo?.queryId || props.imageInfo?.usedTools
})

// --- Methods ---
function readInfoText(key: string): string {
  const value = props.imageInfo?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function buildDragOutPayload(): AssetDragPayload | null {
  if (!props.currentImage) return null
  const recordId = props.recordId || readInfoText('recordId') || readInfoText('record_id')
  const fallbackId = recordId || props.currentImage
  return {
    id: fallbackId,
    url: props.currentImage,
    thumb: props.currentImage,
    type: props.isVideo ? 'video' : 'image',
    recordId,
    prompt: readInfoText('prompt'),
    model: props.imageInfo?.model || props.imageInfo?.modelDisplayName || '',
    filename: readInfoText('filename') || readInfoText('name'),
  }
}

function prepareDragOut(): void {
  const payload = buildDragOutPayload()
  if (payload) assetDragOut.prepare(payload)
}

function handleDragOutStart(event: DragEvent): void {
  const payload = buildDragOutPayload()
  if (payload) assetDragOut.startDrag(event, payload)
}

function handleDragOutEnd(event: DragEvent): void {
  assetDragOut.endDrag(event, buildDragOutPayload())
}

const handleCopyPrompt = async () => {
  if (props.imageInfo?.prompt) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(props.imageInfo.prompt)
      } else {
        // fallback: HTTP 环境下 clipboard API 不可用
        const ta = document.createElement('textarea')
        ta.value = props.imageInfo.prompt
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      promptCopied.value = true
      setTimeout(() => promptCopied.value = false, 2000)
    } catch (err) {
      console.error('Failed to copy prompt:', err)
    }
  }
}

const handleDelete = () => {
  if (props.recordId !== undefined) {
    emit('delete', props.recordId)
  }
}
</script>

<style scoped>
.media-detail-panel {
  width: 320px;
  background: #18181B;
  border-left: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-scroll {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 500;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header .section-title {
  margin-bottom: 0;
}

.copy-btn {
  background: transparent;
  border: none;
  color: #52525b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
}

.copy-btn:hover {
  color: #d4d4d8;
  background: rgba(255, 255, 255, 0.05);
}

/* Thumbnails Grid */
.medias-section .thumbnails-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.thumbnail-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  background: #27272a;
}

.thumbnail-item:hover {
  border-color: #3f3f46;
}

.thumbnail-item.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

/* Prompt Section */
.prompt-content {
  background: #27272A;
  border-radius: 8px;
  padding: 10px 12px;
}

.prompt-text {
  font-size: 12px;
  color: #a1a1aa;
  line-height: 1.6;
  word-break: break-word;
  margin: 0;
}

/* Info Section */
.info-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.info-model-card {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-model-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
  flex-shrink: 0;
}

.info-model-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.info-model-display-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.info-model-id {
  font-size: 10px;
  font-family: 'SF Mono', 'Consolas', monospace;
  color: var(--text-muted);
  line-height: 1.3;
}

.info-model-name {
  font-size: 11px;
  font-weight: 500;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.info-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  background: #27272A;
  color: #a1a1aa;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.02em;
  border: none;
}

.detail-info-trigger {
  position: relative;
}

.detail-trigger-text {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #52525b;
  font-size: 11px;
  font-weight: 500;
  cursor: help;
  transition: color 0.15s;
}

.detail-trigger-text:hover {
  color: #a1a1aa;
}

.detail-popover {
  width: 240px;
  background: #18181B;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 13px;
}

.detail-row:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-label {
  color: #71717a;
}

.detail-value {
  color: #d4d4d8;
}

.detail-value.mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

/* AI Tools Section */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #27272A;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.tool-btn:hover {
  background: #3F3F46;
}

.tool-btn:active {
  transform: scale(0.98);
}

.tool-featured {
  grid-column: span 2;
  flex-direction: row;
  justify-content: space-between;
  padding: 14px;
  text-align: left;
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #d4d4d8;
}

.tool-desc {
  font-size: 11px;
  color: #52525b;
}

.tool-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.tool-badge.pro {
  background: #2563eb;
  color: white;
}

.tool-standard {
  flex-direction: column;
  padding: 14px 10px;
}

.tool-icon {
  color: #52525b;
  transition: color 0.15s;
}

.tool-btn:hover .tool-icon {
  color: #a1a1aa;
}

.tool-label {
  font-size: 11px;
  font-weight: 500;
  color: #52525b;
  transition: color 0.15s;
}

.tool-btn:hover .tool-label {
  color: #a1a1aa;
}

.tool-regen .tool-icon,
.tool-regen .tool-label {
  color: #3b82f6;
  transition: color 0.15s;
}

.tool-regen:hover {
  background: rgba(59, 130, 246, 0.12);
}

.tool-regen:hover .tool-icon,
.tool-regen:hover .tool-label {
  color: #60a5fa;
}

.tool-btn-loading {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Workflow Section */
.workflow-section {
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.workflow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #27272A;
  border: none;
  border-radius: 8px;
  padding: 12px;
  color: #a1a1aa;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.workflow-btn:hover {
  background: #3F3F46;
  color: #d4d4d8;
}

.workflow-btn:active {
  transform: scale(0.98);
}

.workflow-icon {
  color: #52525b;
}

.workflow-btn:hover .workflow-icon {
  color: #71717a;
}

/* Actions Section */
.actions-section {
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.actions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #27272A;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  color: #a1a1aa;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  flex: 1;
  min-width: 80px;
}

.action-btn:hover {
  background: #3F3F46;
  color: #d4d4d8;
}

.action-btn:active {
  transform: scale(0.98);
}

.action-primary {
  background: #2563eb;
  color: white;
}

.action-primary:hover {
  background: #1d4ed8;
  color: white;
}

.action-danger {
  color: #f87171;
}

.action-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: #fca5a5;
}

.action-btn.favorited {
  color: #f43f5e;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #27272a;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #3f3f46;
}
</style>

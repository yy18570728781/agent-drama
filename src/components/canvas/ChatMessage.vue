<template>
  <div class="chat-message" :class="[isUser ? 'message-right' : 'message-left']">
    <!-- User Message (Right side) -->
    <template v-if="isUser">
      <div class="message-content message-user">
        <!-- Prompt/Text -->
        <div v-if="prompt" class="message-text">
          {{ prompt }}
        </div>

        <!-- Params / Reference images if any -->
        <div v-if="images?.length" class="message-images">
          <div v-for="(img, idx) in images" :key="idx" class="message-image-wrapper">
             <img :src="img" class="message-image" />
          </div>
        </div>

        <!-- Metadata for User message (App/Model, Capability, Regenerate/Edit) -->
        <div class="message-meta-actions user-actions mt-0.5">
           <div class="info-meta">
              <span v-if="model">{{ modelDisplayName || model }}</span>
              <span v-if="capability">{{ getCapabilityLabel(capability) }}</span>
           </div>
           <div class="actions ml-2 flex gap-2">
             <button @click="$emit('edit', generatedAssets?.[0])" class="action-btn text-zinc-500 hover:text-white transition-colors" title="重新编辑">
               <Edit3 :size="12" />
             </button>
             <button @click="$emit('regenerate', generatedAssets?.[0])" class="action-btn text-zinc-500 hover:text-white transition-colors" title="再次生成">
               <RefreshCw :size="12" />
             </button>
           </div>
        </div>
      </div>
    </template>

    <!-- System/AI Message (Left side) -->
    <template v-else>
      <div class="message-avatar">
        <!-- Bot Icon -->
        <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
          <Sparkles class="text-purple-400" :size="16" />
        </div>
      </div>

      <div class="message-content message-system">
        <!-- Error State -->
        <div v-if="status === 'error'" class="system-error">
          <div class="error-title">生成失败</div>
          <div class="error-detail">{{ statusText }}</div>
        </div>

        <!-- Generating State -->
        <div v-else-if="isGenerating" class="system-generating">
          <div class="generating-spinner"></div>
          <div class="generating-info">
            <div class="generating-title">AI-Comic-Director-Canvas 生成中...</div>
            <div class="generating-status">{{ statusText }}</div>
          </div>
          <button class="cancel-btn" @click="$emit('cancel', recordId || '')">取消生成</button>
        </div>

        <!-- Completed State -->
        <div v-else class="system-completed">
           <!-- HistoryRecord displays the small generated images -->
           <HistoryRecord
            v-for="asset in generatedAssets"
            :key="asset.id"
            :record="assetToRecord(asset)"
            class="chat-history-record"
            :show-actions="false"
            @click="$emit('open-detail', asset)"
            @delete="$emit('delete', asset.id)"
           />
        </div>

         <!-- Metadata for AI message -->
        <div v-if="!isGenerating && status !== 'error'" class="message-meta-actions">
           <div class="actions">
             <button @click="$emit('use-prompt', prompt || '')" class="use-prompt-btn">使用提示词</button>
           </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles, Edit3, RefreshCw } from '@/components/common/icon/lucide'
import HistoryRecord from '../generation/HistoryRecord.vue'

const props = defineProps<{
  isUser: boolean
  prompt?: string
  images?: string[]
  status?: string
  statusText?: string
  isGenerating?: boolean
  recordId?: string | number
  generatedAssets?: any[]
  model?: string
  modelDisplayName?: string
  capability?: string
}>()

const emit = defineEmits<{
  'cancel': [id: string | number]
  'open-detail': [asset: any]
  'edit': [asset: any]
  'regenerate': [asset: any]
  'delete': [id: string | number]
  'use-prompt': [prompt: string]
}>()

// 适配 HistoryRecord 的属性格式
function assetToRecord(asset: any) {
  const isVideo = asset.type === 'video'
  return {
    id: asset.id,
    layout: 'single' as const,
    type: asset.type,
    prompt: asset.prompt || '',
    modelInfo: asset.model || '',
    modelDisplayName: asset.model || '',
    date: asset.created_at,
    genType: asset.type as any,
    opType: asset.is_favorites ? 'favorite' : 'normal',
    images: isVideo ? [] : (asset.thumbnail_url ? [asset.thumbnail_url] : [asset.url]),
    media: isVideo ? [asset.url] : [],
    isGenerating: false,
    _asset: asset,
  }
}

function getCapabilityLabel(cap?: string) {
  if (!cap) return ''
  const map: Record<string, string> = {
    'image_generation': '图片生成',
    'video_generation': '视频生成',
    'model_generation': '模型生成',
    'audio_generation': '音频生成',
  }
  return map[cap] || cap
}
</script>

<style scoped>
.chat-message {
  display: flex;
  margin-bottom: 16px;
  max-width: 100%;
}

.message-right {
  justify-content: flex-end;
}

.message-left {
  justify-content: flex-start;
  gap: 12px;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  max-width: 80%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* User Message Styles */
.message-user {
  align-items: flex-end;
}

.message-text {
  background-color: #2b2b2b;
  color: #e4e4e7;
  padding: 8px 12px;
  border-radius: 12px 12px 0 12px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.message-image-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #3f3f46;
}

.message-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* System Message Styles */
.message-system {
  align-items: flex-start;
  width: 100%;
}

.system-completed {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background-color: transparent;
}

.chat-history-record {
  width: 70px;
  flex-shrink: 0;
}

.system-generating {
  background-color: #1a1a1c;
  border: 1px solid #2a2a2e;
  border-radius: 12px 12px 12px 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 200px;
}

.generating-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #3f3f46;
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.generating-info {
  text-align: center;
}

.generating-title {
  color: #a78bfa;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.generating-status {
  color: #71717a;
  font-size: 11px;
}

.cancel-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid #3f3f46;
  background: transparent;
  color: #a1a1aa;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.cancel-btn:hover {
  border-color: #ef4444;
  color: #fca5a5;
}

.system-error {
  background-color: #1a1a1c;
  border: 1px solid #dc2626;
  border-radius: 12px 12px 12px 0;
  padding: 12px 16px;
}

.error-title {
  color: #ef4444;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.error-detail {
  color: #71717a;
  font-size: 12px;
}

.message-meta-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 2px;
}

.info-meta {
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: #71717a;
}

.info-meta > span:not(:last-child)::after {
  content: '|';
  margin-left: 6px;
  color: #3f3f46;
}

.use-prompt-btn {
  font-size: 11px;
  color: #a78bfa;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.use-prompt-btn:hover {
  color: #c4b5fd;
  text-decoration: underline;
}
</style>

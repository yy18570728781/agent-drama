<template>
  <div class="task-card" :class="[cardClass, { 'task-compact': compact }]">
    <!-- 流光边框（生成中，非紧凑模式） -->
    <div v-if="task.status === 'running' && !compact" class="glow-border"></div>

    <!-- 紧凑模式：一行展示 -->
    <template v-if="compact">
      <div class="task-compact-row">
        <img v-if="task.vendor" :src="getVendorIcon(task.vendor)" class="task-icon" @error="onIconError" />
        <span class="task-model">{{ task.modelDisplayName || task.modelInfo }}</span>
        <div v-if="displayFileUrls.length" class="task-reference-strip" @click.stop>
          <button
            v-for="(url, index) in displayFileUrls"
            :key="`${url}-${index}`"
            class="task-reference-thumb"
            type="button"
            :title="url"
            @click="openReference(url)"
          >
            <img
              v-if="isPreviewImage(url)"
              :src="url"
              :alt="`参考文件 ${index + 1}`"
              class="task-reference-thumb-media"
            />
            <video
              v-else-if="isPreviewVideo(url)"
              :src="url"
              class="task-reference-thumb-media"
              muted
              playsinline
              preload="metadata"
            />
            <span v-else class="task-reference-thumb-fallback">{{ getReferenceShortLabel(url) }}</span>
          </button>
        </div>
        <span
          v-if="task.prompt"
          class="task-prompt-inline"
          :class="{ 'is-copied': promptCopied }"
          :title="promptCopied ? '已复制' : '点击复制提示词'"
          @click.stop="copyPrompt"
        >"{{ truncatePrompt(task.prompt) }}"</span>
        <span v-if="task.queuePosition" class="queue-pos-inline">#{{ task.queuePosition }}</span>
        <button v-if="task.canCancel" @click="emit('cancel', task.id)" class="compact-cancel" title="取消">
          <X :size="10" />
        </button>
      </div>
    </template>

    <!-- 完整模式 -->
    <template v-else>
      <!-- 顶部：模型信息 + 取消 -->
      <div class="task-header">
        <img v-if="task.vendor" :src="getVendorIcon(task.vendor)" class="task-icon" @error="onIconError" />
        <span class="task-model">{{ task.modelDisplayName || task.modelInfo }}</span>
        <button v-if="task.canCancel" @click="emit('cancel', task.id)" class="header-cancel" title="取消">
          <X :size="12" />
        </button>
      </div>

      <!-- 提示词 -->
      <div
        v-if="task.prompt"
        class="task-prompt-line"
        :class="{ 'is-copied': promptCopied }"
        :title="promptCopied ? '已复制' : '点击复制提示词'"
        @click="copyPrompt"
      >"{{ task.prompt }}"</div>

      <!-- 参数 -->
      <div v-if="task.params_display?.length" class="task-params">
        <span v-for="p in task.params_display.slice(0, 3)" :key="p.key" class="param-tag">
          {{ p.label }}: {{ p.value }}
        </span>
      </div>

      <div v-if="displayFileUrls.length" class="task-references">
        <div class="task-references-label">参考文件</div>
        <div class="task-reference-strip" @click.stop>
          <button
            v-for="(url, index) in displayFileUrls"
            :key="`${url}-${index}`"
            class="task-reference-thumb"
            type="button"
            :title="url"
            @click="openReference(url)"
          >
            <img
              v-if="isPreviewImage(url)"
              :src="url"
              :alt="`参考文件 ${index + 1}`"
              class="task-reference-thumb-media"
            />
            <video
              v-else-if="isPreviewVideo(url)"
              :src="url"
              class="task-reference-thumb-media"
              muted
              playsinline
              preload="metadata"
            />
            <span v-else class="task-reference-thumb-fallback">{{ getReferenceShortLabel(url) }}</span>
          </button>
        </div>
      </div>

      <!-- 上传/保存中 -->
      <div v-if="task.status === 'running'" class="task-progress">
        <div class="pixel-bar">
          <div v-for="i in pixelCount" :key="i"
            class="pixel"
            :class="{ on: i <= litPixels }"
            :style="i <= litPixels ? { background: pixelColor(i), boxShadow: `0 0 4px ${pixelColor(i)}44` } : {}"
          ></div>
        </div>
        <span v-if="task.statusText" class="progress-text">{{ task.statusText }}</span>
      </div>

      <!-- 错误 -->
      <div v-else-if="task.status === 'failed' || task.status === 'cancelled'" class="task-error-section">
        <div
          class="task-error-msg"
          :class="{ 'is-expanded': errorExpanded }"
          @click="errorExpanded = !errorExpanded"
          :title="errorExpanded ? '点击收起' : '点击展开完整错误'"
        >{{ task.statusText || '生成失败' }}</div>
        <div class="task-actions">
          <button @click.stop="copyError" class="action-btn copy-err-btn" :title="copied ? '已复制' : '复制错误'">
            <component :is="copied ? Check : Copy" :size="12" />
          </button>
          <button @click="emit('retry', task)" class="action-btn retry-btn">
            <RefreshCw :size="12" /><span>重试</span>
          </button>
          <button @click="emit('dismiss', task.id)" class="action-btn dismiss-btn">
            <X :size="12" />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, RefreshCw, Check, Copy } from '@/components/common/icon/lucide'

const props = withDefaults(defineProps<{
  task: any
  compact?: boolean
}>(), {
  compact: false,
})

const emit = defineEmits<{
  cancel: [id: number]
  retry: [task: any]
  dismiss: [id: number]
}>()

const cardClass = computed(() => ({
  'task-error': props.task.status === 'failed' || props.task.status === 'cancelled',
  'task-generating': props.task.status === 'running',
}))

const errorExpanded = ref(false)
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

function copyError() {
  const text = props.task.statusText || '生成失败'
  navigator.clipboard.writeText(text).catch(() => {})
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 1500)
}

const promptCopied = ref(false)
let promptCopiedTimer: ReturnType<typeof setTimeout> | null = null

function copyPrompt() {
  const text = props.task.prompt
  if (!text) return
  navigator.clipboard.writeText(text).catch(() => {})
  promptCopied.value = true
  if (promptCopiedTimer) clearTimeout(promptCopiedTimer)
  promptCopiedTimer = setTimeout(() => { promptCopied.value = false }, 1500)
}

function truncatePrompt(prompt: string): string {
  if (prompt.length <= 30) return prompt
  return prompt.slice(0, 30) + '...'
}

const pixelCount = 20
const litPixels = computed(() => Math.round((props.task.progress || 0) / 100 * pixelCount))
const displayFileUrls = computed<string[]>(() => {
  const raw = Array.isArray(props.task?.file_urls) && props.task.file_urls.length
    ? props.task.file_urls
    : props.task?.reference_urls
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)
})

function pixelColor(index: number): string {
  const count = litPixels.value || 1
  const t = (index - 1) / (count - 1 || 1)
  const r = Math.round(187 - t * 113)
  const g = Math.round(247 - t * 25)
  const b = Math.round(208 - t * 80)
  return `rgb(${r},${g},${b})`
}

const vendorIcons: Record<string, string> = {
  '字节跳动': '/icons/vendors/bytedance.png',
  'ByteDance': '/icons/vendors/bytedance.png',
  '智谱AI': '/icons/vendors/zhipu.png',
  'Zhipu': '/icons/vendors/zhipu.png',
  'Google': '/icons/vendors/google.png',
}

function getVendorIcon(vendor: string): string {
  if (!vendor) return '/icons/vendors/default.png'
  return vendorIcons[vendor] || `/icons/vendors/${vendor.toLowerCase().replace(/\s+/g, '-')}.png`
}

function onIconError(e: Event) {
  const target = e.target as HTMLImageElement
  if (target.dataset.fallback === 'true') {
    target.style.display = 'none'
    return
  }
  target.dataset.fallback = 'true'
  target.src = '/icons/vendors/default.png'
}

function getReferenceLabel(url: string, index: number): string {
  try {
    const parsed = new URL(url, window.location.origin)
    const filename = parsed.pathname.split('/').pop()?.trim()
    if (filename) return decodeURIComponent(filename)
  } catch {
    // ignore parse errors and fall back to the raw value
  }
  const compact = url.replace(/^https?:\/\//i, '')
  return compact.length > 28 ? compact.slice(0, 28) + '...' : compact || `文件 ${index + 1}`
}

function getReferenceShortLabel(url: string): string {
  const label = getReferenceLabel(url, 0)
  return label.length > 6 ? label.slice(0, 6) : label
}

function isPreviewImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

function isPreviewVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?.*)?$/i.test(url)
}

function openReference(url: string): void {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.task-card {
  background: #1a1a1c;
  border: 1px solid #2a2a2e;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s;
}

/* 紧凑模式 */
.task-card.task-compact {
  padding: 6px 10px;
  border-radius: 7px;
  gap: 0;
}
.task-compact-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.task-prompt-inline {
  flex: 1;
  font-size: 11px;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  cursor: pointer;
  transition: color 0.15s;
}
.task-prompt-inline:hover {
  color: #a1a1aa;
}
.task-prompt-inline.is-copied {
  color: #4ade80;
}
.queue-pos-inline {
  font-size: 9px;
  color: #52525b;
  flex-shrink: 0;
}
.compact-cancel {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: #3f3f46;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
}
.task-compact:hover .compact-cancel {
  opacity: 1;
}
.compact-cancel:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* 状态边框 */
.task-card.task-generating {
  border-color: rgba(59, 130, 246, 0.3);
  animation: border-breathe 2s ease-in-out infinite;
}
.task-card.task-uploading {
  border-color: rgba(74, 222, 128, 0.3);
}
.task-card.task-error {
  border-color: rgba(239, 68, 68, 0.3);
}

@keyframes border-breathe {
  0%, 100% { border-color: rgba(59, 130, 246, 0.2); box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
  50% { border-color: rgba(59, 130, 246, 0.5); box-shadow: 0 0 12px rgba(59, 130, 246, 0.1); }
}

/* 流光边框 */
.glow-border {
  position: absolute;
  inset: -1px;
  border-radius: 10px;
  pointer-events: none;
  background: conic-gradient(
    from var(--glow-angle, 0deg),
    transparent 0%,
    rgba(59, 130, 246, 0.4) 10%,
    transparent 20%
  );
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  padding: 1px;
  animation: glow-rotate 3s linear infinite;
}

@keyframes glow-rotate {
  from { --glow-angle: 0deg; }
  to { --glow-angle: 360deg; }
}

@property --glow-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

/* 头部 */
.task-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.task-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  object-fit: contain;
  flex-shrink: 0;
}
.task-model {
  flex-shrink: 0;
  font-size: 11px;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
.header-cancel {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: #3f3f46;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0;
}
.task-card:hover .header-cancel {
  opacity: 1;
}
.header-cancel:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* 上传/保存中 */
.task-uploading-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.indeterminate-bar {
  height: 6px;
  border-radius: 3px;
  background: #27272a;
  overflow: hidden;
  position: relative;
}
.indeterminate-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 40%;
  border-radius: 3px;
  background: linear-gradient(90deg, #4ade80, #22c55e);
  animation: indeterminate-slide 1.5s ease-in-out infinite;
}
@keyframes indeterminate-slide {
  0% { left: -40%; }
  100% { left: 100%; }
}
.upload-text {
  font-size: 10px;
  color: #4ade80;
}

/* 生成中进度 */
.task-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.task-references {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.task-references-label {
  font-size: 10px;
  color: #71717a;
}
.task-reference-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.task-reference-thumb {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(96, 165, 250, 0.22);
  background: rgba(96, 165, 250, 0.1);
  color: #bfdbfe;
  border-radius: 6px;
  padding: 0;
  flex-shrink: 0;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.task-reference-thumb:hover {
  background: rgba(96, 165, 250, 0.16);
  border-color: rgba(96, 165, 250, 0.35);
  color: #dbeafe;
}
.task-reference-thumb-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #18181b;
}
.task-reference-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  line-height: 1;
}
.progress-text {
  font-size: 10px;
  color: #64748b;
}
.pixel-bar {
  display: flex;
  gap: 2px;
}
.pixel {
  flex: 1;
  height: 10px;
  border-radius: 1px;
  background: #27272a;
  transition: background 0.2s, box-shadow 0.2s;
}

/* 错误 */
.task-error-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.task-error-msg {
  font-size: 11px;
  color: #ef4444;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
  max-height: 4.5em;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  user-select: text;
  transition: max-height 0.25s ease;
}
.task-error-msg:not(.is-expanded)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1.2em;
  background: linear-gradient(transparent, #1a1a1c);
  pointer-events: none;
}
.task-error-msg.is-expanded {
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #3f3f46 transparent;
}
.task-error-msg.is-expanded::after {
  display: none;
}
.task-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}
.copy-err-btn {
  background: rgba(255, 255, 255, 0.05);
  color: #71717a;
  padding: 3px 5px;
}
.copy-err-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}
.retry-btn {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}
.retry-btn:hover {
  background: rgba(59, 130, 246, 0.25);
}
.dismiss-btn {
  background: rgba(255, 255, 255, 0.05);
  color: #71717a;
  padding: 3px 5px;
}
.dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
}

.task-prompt-line {
  font-size: 11px;
  color: #a1a1aa;
  line-height: 1.45;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  cursor: pointer;
  transition: color 0.15s;
}
.task-prompt-line:hover {
  color: #d4d4d8;
}
.task-prompt-line.is-copied {
  color: #4ade80;
}
.task-params {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.param-tag {
  font-size: 10px;
  color: #71717a;
  background: rgba(255,255,255,0.05);
  padding: 2px 6px;
  border-radius: 999px;
  max-width: 100%;
}
</style>

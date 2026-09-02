<script setup>
import { ref, computed, onUnmounted, inject } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { Music, RotateCcw, Loader2, Upload, X, Copy, Check, Heart, Trash2, Hand, Download, Play, Pause } from 'lucide-vue-next'
import { downloadMedia } from '@/utils/download'
import { copyText } from '@/utils/copyText'
import { buildPortsForNode } from '@/utils/workflowNodeData'
import NodePortsOverlay from '../NodePortsOverlay.vue'
import { useFlowNodeRemoval } from '../useFlowNodeRemoval'
import { useFlowNodeExternalDrag } from './useFlowNodeExternalDrag'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { useAssetDragOut } from '@/composables/assets/useAssetDragOut'

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const { updateNodeInternals, updateNodeData } = useVueFlow()
const { showNodeTitle } = useTheme()

const flowConvertNode = inject('flowConvertNode', null)
const flowLightweightNodeMode = inject('flowLightweightNodeMode', computed(() => false))
const flowUltraLightNodeMode = inject('flowUltraLightNodeMode', computed(() => false))
const flowHasMultiSelection = inject('flowHasMultiSelection', computed(() => false))
const flowToggleResultFavorite = inject('flowToggleResultFavorite', null)
const flowDeleteResultRecord = inject('flowDeleteResultRecord', null)
const flowSaveHistory = inject('flowSaveHistory', null)
const { removeNode } = useFlowNodeRemoval(props.id)

const onAnimationEnd = () => {
  updateNodeInternals([props.id])
}

const isPlaying = ref(false)
const isEditing = ref(false)
const title = ref(props.data.label || '音频节点')
const audioRef = ref(null)
const hoverTimeout = ref(null)
const progress = ref(0)
const currentTime = ref(0)
const duration = ref(0)
const isScrubbing = ref(false)
const progressBarRef = ref(null)
const failureReason = computed(() => props.data.failReason || props.data.statusText || props.data.fail_reason?.error_message || props.data.fail_reason?.message || '未知错误')
const generationStatusLabel = computed(() => {
  const status = String(props.data?.status || '').trim()
  if (status === 'waiting_submit') return '等待提交'
  if (status === 'queued') return '排队中'
  if (status === 'running') return '生成中'
  return String(props.data?.statusText || '').trim() || '生成中'
})
const generationProgressLabel = computed(() => (
  typeof props.data?.progress === 'number' && Number.isFinite(props.data.progress)
    ? ` ${Math.round(props.data.progress * 100)}%`
    : ''
))
const copiedFailReason = ref(false)

const copyFailReason = async () => {
  try {
    await copyText(String(failureReason.value || ''))
    copiedFailReason.value = true
    window.setTimeout(() => {
      copiedFailReason.value = false
    }, 1200)
  } catch (error) {
    console.warn('[AudioNode] 复制失败原因失败:', error)
  }
}
const ports = computed(() => props.data?.ports || { inputs: [], outputs: [] })
const visibleInputPorts = computed(() => (ports.value.inputs || []).filter((port) => port?.visible !== false))
const visibleOutputPorts = computed(() => (ports.value.outputs || []).filter((port) => port?.visible !== false))

const updateProgressFromEvent = (e) => {
  if (!progressBarRef.value || !audioRef.value || !audioRef.value.duration) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = Math.max(0, Math.min(1, x / rect.width))
  audioRef.value.currentTime = percentage * audioRef.value.duration
  progress.value = percentage * 100
  currentTime.value = audioRef.value.currentTime
}

const startScrubbing = (e) => {
  isScrubbing.value = true
  updateProgressFromEvent(e)
  window.addEventListener('mousemove', handleScrubbing)
  window.addEventListener('mouseup', stopScrubbing)
}

const handleScrubbing = (e) => {
  if (!isScrubbing.value) return
  updateProgressFromEvent(e)
}

const stopScrubbing = () => {
  isScrubbing.value = false
  window.removeEventListener('mousemove', handleScrubbing)
  window.removeEventListener('mouseup', stopScrubbing)
}

const handleMouseEnter = () => {
  if (audioRef.value && displayAudio.value) {
    hoverTimeout.value = window.setTimeout(() => {
      audioRef.value?.play().catch(() => {})
      isPlaying.value = true
    }, 300)
  }
}

const handleMouseLeave = () => {
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
  if (audioRef.value && displayAudio.value) {
    audioRef.value.pause()
    isPlaying.value = false
  }
}

const onTimeUpdate = (e) => {
  if (isScrubbing.value) return
  const media = e.target
  currentTime.value = media.currentTime || 0
  if (media.duration) {
    duration.value = media.duration
    progress.value = (media.currentTime / media.duration) * 100
  }
}

const onLoadedMetadata = (e) => {
  const media = e.target
  duration.value = media.duration || 0
}

const formatAudioTime = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const formattedCurrentTime = computed(() => formatAudioTime(currentTime.value))
const formattedDuration = computed(() => formatAudioTime(duration.value))
const audioTitle = computed(() => props.data.label || props.data.title || props.data.name || '音频参考')
const waveformBars = computed(() => {
  const seed = String(displayAudio.value || audioTitle.value || '')
  return Array.from({ length: 42 }, (_, index) => {
    const code = seed.charCodeAt(index % Math.max(seed.length, 1)) || 31
    return 18 + ((code + index * 17) % 36)
  })
})

const toggleAudio = async () => {
  if (!audioRef.value || !displayAudio.value) return
  if (audioRef.value.paused) {
    await audioRef.value.play().catch(() => {})
    isPlaying.value = !audioRef.value.paused
  } else {
    audioRef.value.pause()
    isPlaying.value = false
  }
}

const saveTitle = () => {
  isEditing.value = false
  updateNodeData(props.id, { label: title.value })
  flowSaveHistory?.()
}

const isDragging = ref(false)
const toolbarFileInput = ref(null)

const triggerFileInput = () => {
  toolbarFileInput.value?.click()
}

const getTargetNodeType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'file_input'
  if (mimeType.startsWith('video/')) return 'file_input'
  if (mimeType.startsWith('audio/')) return 'file_input'
  return null
}

const handleFile = (file) => {
  if (file && file.type.startsWith('audio/')) {
    if (props.data.url && props.data.url.startsWith('blob:')) {
      URL.revokeObjectURL(props.data.url)
    }
    props.data.url = URL.createObjectURL(file)
    props.data.mediaType = 'audio'
    props.data.ports = buildPortsForNode('file_input', 'audio')
    isPlaying.value = false
  }
}

const handleFileWithConversion = async (file) => {
  if (!file) return
  const target = getTargetNodeType(file.type)
  if (!target) return

  if (file.type.startsWith('audio/')) {
    handleFile(file)
    return
  }

  const blobUrl = URL.createObjectURL(file)
  if (target === 'file_input' && file.type.startsWith('image/')) {
    flowConvertNode?.(props.id, target, { url: blobUrl, mediaType: 'image' })
  } else if (target === 'file_input') {
    flowConvertNode?.(props.id, target, { url: blobUrl, mediaType: 'video' })
  }
}

const onDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFileWithConversion(file)
}

const onFileChange = (e) => {
  const file = e.target.files?.[0]
  if (file) handleFileWithConversion(file)
  if (toolbarFileInput.value) toolbarFileInput.value.value = ''
}

const clearMedia = () => {
  if (props.data.url && props.data.url.startsWith('blob:')) {
    URL.revokeObjectURL(props.data.url)
  }
  removeNode()
}

const displayAudio = computed(() => {
  const url = props.data.url
  if (url && typeof url === 'string' && (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:audio')
  )) {
    return url
  }
  return null
})

const {
  isExternalDragDraggable,
  armExternalDrag,
  resetExternalDragState,
  handleExternalDragStart,
  handleExternalDragEnd,
} = useFlowNodeExternalDrag(String(props.id || ''), computed(() => !!displayAudio.value))

const canRecordActions = computed(() => (
  !!(displayAudio.value && String(props.data?.recordId || '').trim() && String(props.data?.url || '').trim())
))

const handleToggleFavorite = () => {
  if (!flowToggleResultFavorite || !canRecordActions.value) return
  flowToggleResultFavorite(props.id)
}

const handleDeleteResultRecord = () => {
  if (!flowDeleteResultRecord || !canRecordActions.value) return
  flowDeleteResultRecord(props.id)
}

const handleDownload = async () => {
  if (!displayAudio.value) return
  await downloadMedia(displayAudio.value)
}

const { startDrag: startAssetDragOut, endDrag: endAssetDragOut } = useAssetDragOut()

const handleDragOutStart = (e) => {
  const url = displayAudio.value
  if (!url) return
  startAssetDragOut(e, {
    url,
    type: 'audio',
    id: props.data.id ?? props.id,
    filename: `${props.data.id || props.id || 'audio'}.mp3`,
  })
}

const handleDragOutEnd = (e) => {
  endAssetDragOut(e)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', handleScrubbing)
  window.removeEventListener('mouseup', stopScrubbing)
  if (props.data.url && props.data.url.startsWith('blob:')) {
    URL.revokeObjectURL(props.data.url)
  }
})
</script>

<template>
  <div
    class="w-full h-full relative group animate-node-enter flex flex-col"
    :draggable="isExternalDragDraggable"
    @dragover.prevent
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousedown.capture="armExternalDrag"
    @mouseup.capture="resetExternalDragState"
    @dragstart.capture="handleExternalDragStart"
    @dragend.capture="handleExternalDragEnd"
    @animationend="onAnimationEnd"
  >
    <NodeResizer :is-visible="selected && !flowLightweightNodeMode && !flowUltraLightNodeMode" :min-width="200" :min-height="150" />

    <input type="file" ref="toolbarFileInput" accept="image/*,video/*,audio/*,.txt,.md,.csv,.json" class="hidden" @change="onFileChange" />

    <!-- Floating Label -->
    <div v-if="!flowUltraLightNodeMode && showNodeTitle" class="absolute -top-8 -left-1 flex items-center gap-2 pointer-events-none z-10">
      <div class="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        <Music class="w-3.5 h-3.5" />
      </div>
      <span
        v-if="!isEditing"
        @dblclick.stop="isEditing = true"
        class="text-xs font-medium text-zinc-300 hover:text-zinc-100 pointer-events-auto cursor-text transition-colors drop-shadow-md"
      >
        <Heart v-if="data.is_favorites" fill="currentColor" class="inline-block w-3.5 h-3.5 mr-1 text-rose-500 align-[-2px]" />
        {{ data.label || '音频节点' }}
      </span>
      <input
        v-else
        v-model="title"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        class="text-xs font-medium bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded outline-none border border-amber-500 w-24 pointer-events-auto"
        autofocus
      />
    </div>

    <!-- Action Toolbar -->
    <div v-if="!flowHasMultiSelection" class="node-toolbar-wrap" :class="{ active: selected }">
      <div v-if="canRecordActions" class="tb-btn" :class="{ 'tb-active': data.is_favorites }" :title="data.is_favorites ? '取消收藏' : '收藏'" @click="handleToggleFavorite">
        <Heart class="w-4 h-4" :class="{ 'text-rose-500': data.is_favorites }" :fill="data.is_favorites ? 'currentColor' : 'none'" />
      </div>
      <div v-if="canRecordActions" class="tb-btn tb-danger" title="删除节点" @click="handleDeleteResultRecord">
        <Trash2 class="w-4 h-4" />
      </div>
      <div class="tb-btn" title="上传文件" @click="triggerFileInput">
        <Upload class="w-4 h-4" />
      </div>
      <div v-if="displayAudio" class="tb-btn tb-danger" title="清除" @click="clearMedia">
        <RotateCcw class="w-4 h-4" />
      </div>
      <div v-if="displayAudio" class="tb-btn" title="另存为" @click="handleDownload">
        <Download class="w-4 h-4" />
      </div>
      <div
        v-if="displayAudio"
        class="tb-btn nodrag"
        title="拖出到窗口外"
        draggable="true"
        @pointerdown.stop
        @mousedown.stop
        @dragstart="handleDragOutStart"
        @dragend="handleDragOutEnd"
      >
        <Hand class="w-4 h-4" />
      </div>
    </div>

    <!-- Node Card -->
    <div
      class="w-full h-full border rounded-xl shadow-lg relative flex flex-col"
      :class="[
        flowUltraLightNodeMode
          ? 'border-zinc-700/80 bg-[#18181b]/95 shadow-[0_8px_24px_rgba(15,23,42,0.2)]'
          : selected ? 'border-white shadow-white/10 ring-1 ring-white/30 group-hover:shadow-white/20 group-hover:shadow-2xl' : 'border-zinc-800 hover:border-zinc-700',
        isDragging ? 'ring-2 ring-amber-500 bg-amber-500/10' : ''
      ]"
    >
      <NodePortsOverlay
        :input-ports="visibleInputPorts"
        :output-ports="visibleOutputPorts"
        :disable-input-ports="!!data.disableInputPorts"
        :disable-output-ports="!!data.disableOutputPorts"
      />

      <div class="rounded-xl overflow-hidden flex flex-col h-full">
        <!-- Content Area -->
        <div
          class="flex-1 flex flex-col items-center justify-center relative min-h-0 h-full"
          :class="[
            flowUltraLightNodeMode ? 'bg-[#18181b]/92' : 'bg-[#18181b]',
            displayAudio && !flowUltraLightNodeMode ? 'p-1' : 'p-3',
          ]"
        >
          <template v-if="flowUltraLightNodeMode">
            <div class="w-full h-full relative">
              <div
                class="absolute inset-[10px] rounded-md border border-dashed bg-zinc-900/80"
                :class="selected ? 'border-zinc-200/70 shadow-[0_0_0_1px_rgba(244,244,245,0.18),0_8px_24px_rgba(15,23,42,0.22)]' : 'border-zinc-300/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'"
              ></div>
            </div>
          </template>
          <template v-else-if="displayAudio">
            <audio
              ref="audioRef"
              :src="displayAudio"
              @ended="isPlaying = false"
              class="hidden"
              loop
              @loadedmetadata="onLoadedMetadata"
              @timeupdate="onTimeUpdate"
            ></audio>
            <div class="audio-preview-card">
              <div
                ref="progressBarRef"
                class="audio-waveform"
                @mousedown.stop="startScrubbing"
              >
                <span
                  v-for="(height, index) in waveformBars"
                  :key="index"
                  class="audio-waveform-bar"
                  :class="{ active: index / waveformBars.length * 100 <= progress }"
                  :style="{ height: `${height}%` }"
                ></span>
                <span class="audio-waveform-progress" :style="{ left: `${progress}%` }"></span>
              </div>
              <div class="audio-preview-footer">
                <span class="audio-preview-time">{{ formattedCurrentTime }} / {{ formattedDuration }}</span>
                <button class="audio-preview-play" type="button" @click.stop="toggleAudio">
                  <Pause v-if="isPlaying" class="w-3 h-3" />
                  <Play v-else class="w-3 h-3" />
                </button>
              </div>
            </div>
          </template>

          <div
            v-else-if="data._suppressEmptyMediaPlaceholderIcon"
            class="w-full h-full"
          ></div>

          <div v-else class="flex flex-col items-center gap-2 text-zinc-500">
            <Music class="w-6 h-6 opacity-50" />
          </div>

          <!-- Loading Overlay -->
          <div v-if="data.isGenerating" class="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 class="w-6 h-6 text-amber-500 animate-spin mb-2" />
            <span class="text-xs text-amber-400 font-medium">
              {{ generationStatusLabel }}{{ generationProgressLabel }}
            </span>
          </div>
          <div
            v-else-if="data.status === 'failed'"
            class="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 px-4 text-center node-failed-overlay"
            @mousedown.stop
            @click.stop
          >
            <button class="node-failed-copy-btn mb-2" @click.stop="copyFailReason">
              <Check v-if="copiedFailReason" class="w-3 h-3" />
              <Copy v-else class="w-3 h-3" />
              <span>{{ copiedFailReason ? '已复制' : '复制失败原因' }}</span>
            </button>
            <X class="w-6 h-6 text-red-300 mb-2" />
            <span class="text-xs text-red-200 font-medium">生成失败</span>
            <div class="text-[11px] text-red-100/90 mt-2 node-failed-text">{{ failureReason }}</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.audio-preview-card { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.audio-waveform { position: relative; height: 54px; display: flex; align-items: center; gap: 2px; padding: 8px 9px; border-radius: 7px; background: rgba(24, 24, 27, 0.78); cursor: pointer; overflow: hidden; }
.audio-waveform-bar { width: 3px; min-height: 8px; border-radius: 999px; background: rgba(113, 113, 122, 0.58); transition: background 0.14s ease, opacity 0.14s ease; }
.audio-waveform-bar.active { background: rgba(244, 63, 94, 0.86); }
.audio-waveform-progress { position: absolute; top: 7px; bottom: 7px; width: 2px; border-radius: 999px; background: #f43f5e; box-shadow: 0 0 10px rgba(244, 63, 94, 0.42); transform: translateX(-1px); pointer-events: none; }
.audio-preview-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.audio-preview-time { color: rgba(212, 212, 216, 0.82); font-size: 11px; font-variant-numeric: tabular-nums; }
.audio-preview-play { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 999px; background: rgba(24, 24, 27, 0.92); color: rgba(228, 228, 231, 0.88); cursor: pointer; transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; }
.audio-preview-play:hover { background: rgba(63, 63, 70, 0.95); color: #fff; transform: scale(1.06); }

.node-failed-overlay { pointer-events: none; user-select: text; -webkit-user-select: text; }
.node-failed-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(254, 202, 202, 0.28);
  border-radius: 999px;
  background: rgba(127, 29, 29, 0.72);
  color: #fee2e2;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
.node-failed-copy-btn:hover { background: rgba(153, 27, 27, 0.82); }
.node-failed-text {
  user-select: text;
  -webkit-user-select: text;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
  cursor: text;
}
.node-toolbar-wrap {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1px;
  background: rgba(39, 39, 42, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid #3f3f46;
  border-radius: 5px;
  padding: 3px 5px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.32);
  transition: all 0.2s;
  opacity: 0;
  z-index: 10;
}
.group:hover .node-toolbar-wrap {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.node-toolbar-wrap.active {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.tb-btn {
  padding: 4px;
  color: #a1a1aa;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}
.tb-btn:hover {
  color: white;
  background: #3f3f46;
}
.tb-btn.tb-danger:hover {
  color: #f87171;
}
.tb-divider {
  width: 1px;
  height: 16px;
  background: #52525b;
  margin: 0 2px;
  flex-shrink: 0;
}
</style>

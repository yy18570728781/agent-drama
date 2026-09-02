<template>
  <div ref="rootRef" class="video-ref-editor-content" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="video-ref-editor-body">
      <div class="video-ref-editor-content-wrapper">
        <!-- 视频预览区 -->
        <div class="video-ref-editor-preview-area">
          <div class="video-ref-editor-canvas-wrap" :class="{ 'is-playing': timelinePlaying }" @click="togglePlayPause">
            <template v-for="(track, idx) in videoTracks" :key="'source-' + idx">
              <video v-if="track.type !== 'image'"
                :ref="(el: any) => setVideoSourceRef(el, idx)"
                :src="track.url"
                :muted="videoOptions.muted"
                class="video-ref-editor-source"
                :class="{ active: currentTrackIndex === idx && !isReversing }"
                :preload="Math.abs(idx - currentTrackIndex) <= 1 ? 'auto' : 'metadata'"
                @loadedmetadata="onTrackVideoLoaded(idx)"
                @timeupdate="onPlaybackTimeUpdate(idx)"
                @ended="onTrackEnded(idx)" />
              <img v-else
                :ref="(el: any) => setImageSourceRef(el, idx)"
                :src="track.url"
                class="video-ref-editor-source"
                :class="{ active: currentTrackIndex === idx && !isReversing }"
                @load="onTrackImageLoaded(idx)" />
            </template>
            <canvas ref="canvasRef" class="video-ref-editor-capture-canvas" />
            <canvas v-show="isReversing" ref="reverseCanvasRef" class="video-ref-editor-source active" />
          </div>

          <!-- 播放控制栏 -->
          <div class="video-controls-fixed">
            <div class="video-progress-wrap">
              <input type="range"
                class="video-progress-slider"
                min="0"
                :max="totalDuration || 0"
                step="0.01"
                :value="currentTimelinePosition"
                @input="seekToTimelinePosition(parseFloat(($event.target as HTMLInputElement).value))" />
            </div>
            <div class="video-controls-bar">
              <div class="video-controls-left">
                <span class="video-time">
                  {{ formatDuration(currentTimelinePosition) }} / {{ formatDuration(totalDuration) }}
                  <span style="margin-left: 8px; color: #71717a;">
                    ({{ timelineCurrentFrame }}f / {{ timelineTotalFrames }}f)
                  </span>
                </span>
              </div>
              <div class="video-controls-center">
                <button class="video-ctrl-btn" @click="seekFrame(-1)" title="上一帧 (A)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
                  </svg>
                </button>
                <button class="video-ctrl-btn video-play-btn" @click="togglePlayPause" :title="timelinePlaying ? '暂停 (Space)' : '播放 (Space)'">
                  <svg v-if="!timelinePlaying" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                </button>
                <button class="video-ctrl-btn" @click="seekFrame(1)" title="下一帧 (D)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
              <div class="video-controls-right">
                <button class="video-ctrl-btn" :disabled="isCaptureFrameLoading" @click="captureVideoFrame" :title="isCaptureFrameLoading ? '截取中...' : '截取当前帧'">
                  <Scissors :size="14" />
                </button>
                <button class="video-ctrl-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏预览'">
                  <Minimize2 v-if="isFullscreen" :size="14" />
                  <Maximize2 v-else :size="14" />
                </button>
                <label class="video-mute-toggle" title="静音">
                  <input type="checkbox" v-model="videoOptions.muted" class="video-mute-input" @change="onMutedChange" />
                  <VolumeX :size="14" />
                </label>
                <div class="video-volume-control">
                  <input type="range" min="0" max="1" step="0.1"
                    v-model.number="videoOptions.volume" class="video-volume-slider" @input="onVolumeChange" />
                  <span class="video-volume-val">{{ Math.round(videoOptions.volume * 100) }}</span>
                </div>
                <select class="video-speed-select" :value="videoOptions.playbackRate" @change="changePlaybackRate(parseFloat(($event.target as HTMLSelectElement).value))">
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>
          </div>

          <div v-if="videoTracks.length > 0" class="video-ref-editor-info">
            {{ videoTracks.length }} 个片段 · 总时长 {{ formatDuration(totalDuration) }}
          </div>
        </div>

        <div v-if="capturedFrames.length > 0" class="video-captured-panel">
          <div class="video-captured-panel-header">
            <span>截取帧</span>
            <span class="video-captured-panel-count">{{ capturedFrames.length }}</span>
          </div>
          <div class="video-captured-panel-list">
            <div v-for="(frame, idx) in capturedFrames" :key="frame.id" class="video-captured-item">
              <img :src="frame.url" class="video-captured-thumb" :alt="`第 ${frame.frame} 帧`" />
              <button class="video-captured-remove-btn" @click.stop="removeCapturedFrame(idx)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <button class="video-captured-apply-btn" @click="applyAllCapturedFrames">
            应用全部 ({{ capturedFrames.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- 视频轨道时间线 -->
    <div v-if="!hideTimeline && !isFullscreen" class="video-timeline-area">
      <div class="video-timeline-header">
        <div class="video-timeline-title">
          <span>视频轨道</span>
          <span class="video-timeline-info" v-if="videoTracks.length > 0">
            {{ videoTracks.length }} 个片段 · 总时长 {{ formatDuration(totalDuration) }}
          </span>
        </div>
        <div class="video-timeline-actions">
          <span class="video-timeline-zoom-info">
            缩放: {{ Math.round(timelineZoom * 100) }}%
          </span>
          <button class="video-timeline-zoom-btn" @click="timelineZoom = 1" title="重置缩放 (100%)">
            <span>重置</span>
          </button>
          <button class="video-timeline-add-btn" @click="addVideoTrack" title="添加视频片段">
            <Plus :size="14" />
            <span>添加片段</span>
          </button>
        </div>
      </div>

      <div class="video-timeline-container" @wheel.prevent="onTimelineWheel">
        <div class="video-timeline-tracks" :style="{ width: totalTimelineWidth + 'px' }">
          <!-- 时间刻度尺和播放头 -->
          <div class="video-timeline-ruler" @click="onRulerClick">
            <template v-for="tick in rulerTicks" :key="tick.key">
              <div v-if="tick.major"
                class="ruler-tick ruler-tick-major"
                :style="{ left: tick.pos + 'px' }">
                <span class="ruler-label">{{ tick.label }}</span>
              </div>
              <div v-else
                class="ruler-tick ruler-tick-minor"
                :style="{ left: tick.pos + 'px' }"></div>
            </template>

            <!-- 播放头指示器 -->
            <div ref="playheadEl" class="timeline-playhead"
              :style="{ left: '0px' }"
              @mousedown="onPlayheadMouseDown">
              <div class="timeline-playhead-line"></div>
              <div class="timeline-playhead-handle"></div>
            </div>
          </div>

          <!-- 视频片段轨道 -->
          <div class="video-timeline-track-container" @click="onTimelineClick">
            <div class="video-timeline-track">
              <div v-for="(track, idx) in videoTracks" :key="idx"
                class="video-clip"
                :class="{ active: currentTrackIndex === idx }"
                :style="clipStyles[idx]"
                @click.stop="selectTrack(idx)">

                <!-- 片段缩略图背景 -->
                <div class="video-clip-preview" :style="track.thumbnailUrl ? { backgroundImage: `url(${track.thumbnailUrl})` } : {}">
                  <video v-if="!track.thumbnailUrl && track.type !== 'image'" :src="track.url" class="video-clip-thumb" muted></video>
                  <img v-if="!track.thumbnailUrl && track.type === 'image'" :src="track.url" class="video-clip-thumb" />
                </div>

                <!-- 顶部信息条 -->
                <div class="video-clip-bar-top">
                  <span class="video-clip-name">片段 {{ idx + 1 }}</span>
                  <span class="video-clip-duration">{{ formatFrameRange(track.trimStart, track.trimEnd) }}</span>
                </div>
                <div class="video-clip-bar-bottom"></div>

                <!-- 裁剪手柄 -->
                <div class="video-clip-handle video-clip-handle-start"
                  @mousedown.stop="onClipHandleMouseDown($event, idx, 'start')"
                  title="拖动调整开始帧"></div>
                <div class="video-clip-handle video-clip-handle-end"
                  @mousedown.stop="onClipHandleMouseDown($event, idx, 'end')"
                  title="拖动调整结束帧"></div>

                <!-- 删除按钮 -->
                <button class="video-clip-remove" @click.stop="removeTrack(idx)" title="删除片段">
                  <X :size="12" />
                </button>

                <!-- 前后添加按钮 -->
                <button class="video-clip-add-before" @click.stop="addVideoTrackBefore(idx)" title="在前方添加片段">
                  <Plus :size="10" />
                </button>
                <button class="video-clip-add-after" @click.stop="addVideoTrackAfter(idx)" title="在后方添加片段">
                  <Plus :size="10" />
                </button>
              </div>

              <!-- 空状态提示 -->
              <div v-if="videoTracks.length === 0" class="video-timeline-empty">
                <div class="video-timeline-empty-icon">
                  <Video :size="32" />
                </div>
                <div class="video-timeline-empty-text">暂无视频片段</div>
                <button class="video-timeline-empty-btn" @click="addVideoTrack">
                  <Plus :size="14" />
                  <span>添加第一个片段</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Video, X, Plus, Scissors, VolumeX, Maximize2, Minimize2 } from '@/components/common/icon/lucide'
import { ElMessage } from 'element-plus'
import { uploadFileToCosUrl } from '@/api/uploadHelpers'

interface VideoTrack {
  url: string
  file?: File
  duration: number
  trimStart: number
  trimEnd: number
  thumbnailUrl?: string
  type: 'video' | 'image'
}

interface UpstreamInputs {
  images?: Array<{ url: string; nodeId?: string; label?: string }>
  videos?: Array<{ url: string; nodeId?: string; label?: string }>
}

interface CapturedFrame {
  id: string
  url: string
  file: File
  frame: number
  trackIndex: number
}

interface Props {
  videoUrl?: string
  videoFile?: File
  hideTimeline?: boolean
  autoPlay?: boolean
  upstreamInputs?: UpstreamInputs
  initialVideoUrls?: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'apply', data: any): void
  (e: 'close'): void
  (e: 'capture-frame', data: { url: string; file: File; trackIndex?: number }): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const videoSourceRefs = ref<Map<number, HTMLVideoElement>>(new Map())
const imageSourceRefs = ref<Map<number, HTMLImageElement>>(new Map())
const playheadEl = ref<HTMLElement | null>(null)
const reverseCanvasRef = ref<HTMLCanvasElement | null>(null)
const isReversing = ref(false)

const timelineCurrentFrame = ref(0)
const timelineTotalFrames = ref(0)
const timelinePlaying = ref(false)
const videoFPS = ref(30)
const timelineContainerWidth = ref(0)
let timelineResizeObserver: ResizeObserver | null = null

const videoInfo = ref({ duration: 0, width: 0, height: 0 })
const videoOptions = ref({
  muted: false,
  playbackRate: 1,
  volume: 1,
  rotation: 0,
  flipH: false,
  flipV: false
})

const videoTracks = ref<VideoTrack[]>([])
const currentTrackIndex = ref(-1)
const isDirty = ref(false)
const isCaptureFrameLoading = ref(false)
const timelineZoom = ref(1)
const isFullscreen = ref(false)
const capturedFrames = ref<CapturedFrame[]>([])


const rulerTickInterval = computed(() => {
  const pixelsPerSecond = 100 * timelineZoom.value
  if (pixelsPerSecond >= 50) return 1
  if (pixelsPerSecond >= 20) return 5
  return 10
})

const totalDuration = computed(() => timelineTotalFrames.value / videoFPS.value)

const timelineMinZoom = computed(() => {
  if (videoTracks.value.length === 0) return 0.25
  const durations = videoTracks.value.map(t => t.trimEnd - t.trimStart).filter(d => d > 0)
  if (durations.length === 0) return 0.25
  const minDur = Math.min(...durations)
  return Math.max(0.15, Math.min(0.5, 30 / (minDur * 100)))
})

const timelineMaxZoom = computed(() => {
  if (totalDuration.value <= 0) return 3
  return Math.max(0.5, Math.min(3, 3000 / (totalDuration.value * 100)))
})

const totalTimelineWidth = computed(() => {
  const contentWidth = totalDuration.value * 100 * timelineZoom.value
  return Math.max(timelineContainerWidth.value - 32, contentWidth)
})

const currentTimelinePosition = computed(() => timelineCurrentFrame.value / videoFPS.value)

function createCapturedFrameId(): string {
  return `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function removeCapturedFrame(index: number) {
  const target = capturedFrames.value[index]
  if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url)
  capturedFrames.value.splice(index, 1)
}

function handleFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === rootRef.value
}

async function toggleFullscreen() {
  const target = rootRef.value
  if (!target) return
  try {
    if (document.fullscreenElement === target) {
      await document.exitFullscreen()
      return
    }
    await target.requestFullscreen()
  } catch (error) {
    console.warn('[VideoReferenceEditor] fullscreen toggle failed:', error)
  }
}

async function applyAllCapturedFrames() {
  if (!capturedFrames.value.length) return
  isCaptureFrameLoading.value = true
  try {
    for (const frame of capturedFrames.value) {
      const uploadedUrl = await uploadFileToCosUrl(frame.file, frame.file.name)
      emit('capture-frame', {
        url: uploadedUrl,
        file: frame.file,
        trackIndex: frame.trackIndex,
      })
    }
    capturedFrames.value.forEach(frame => {
      if (frame.url.startsWith('blob:')) URL.revokeObjectURL(frame.url)
    })
    capturedFrames.value = []
    emit('apply', {
      tracks: videoTracks.value,
      options: videoOptions.value,
    })
    emit('close')
  } catch (error) {
    console.error('[VideoReferenceEditor] Failed to apply captured frames:', error)
    ElMessage.error('截帧上传失败，请重试')
  } finally {
    isCaptureFrameLoading.value = false
  }
}

const rulerTicks = computed(() => {
  const ticks: Array<{ key: string; pos: number; major: boolean; label: string }> = []
  const pixelsPerSecond = 100 * timelineZoom.value
  const maxSeconds = Math.max(
    Math.ceil(totalDuration.value),
    Math.ceil(totalTimelineWidth.value / pixelsPerSecond)
  )
  for (let sec = 0; sec <= maxSeconds; sec++) {
    if (sec % rulerTickInterval.value === 0) {
      ticks.push({ key: `major-${sec}`, pos: sec * pixelsPerSecond, major: true, label: `${sec}s (${sec * videoFPS.value}f)` })
    } else {
      ticks.push({ key: `minor-${sec}`, pos: sec * pixelsPerSecond, major: false, label: '' })
    }
  }
  return ticks
})

const clipStyles = computed(() => {
  const result: Array<Record<string, string>> = []
  if (totalDuration.value === 0) return result
  const pixelsPerSecond = 100 * timelineZoom.value
  let startTime = 0
  videoTracks.value.forEach((track, idx) => {
    const clipDuration = track.trimEnd - track.trimStart
    const leftPx = startTime * pixelsPerSecond
    const widthPx = Math.max(40, clipDuration * pixelsPerSecond)
    result.push({ left: leftPx + 'px', width: widthPx + 'px', minWidth: widthPx + 'px' })
    startTime += clipDuration
  })
  return result
})

let playbackAnimationFrame: number | null = null
let lastFrameTime = 0
let lastReactiveUpdate = 0
let isFrameStepping = false
let reverseRAF = 0
let reverseLastTime = 0
let reverseVirtualTime = 0
let reverseSeekInProgress = false
const STEP_RATE = 0.5

function setVideoSourceRef(el: any, idx: number) {
  if (el) {
    videoSourceRefs.value.set(idx, el as HTMLVideoElement)
  }
}

function setImageSourceRef(el: any, idx: number) {
  if (el) {
    imageSourceRefs.value.set(idx, el as HTMLImageElement)
  }
}

function onTrackVideoLoaded(idx: number) {
  const video = videoSourceRefs.value.get(idx)
  if (!video) return

  const track = videoTracks.value[idx]
  if (track) {
    track.duration = video.duration

    if (track.trimEnd === 0) {
      track.trimEnd = video.duration
    }

    if (idx === 0) {
      videoInfo.value = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      }
      resizeCanvas()

      setTimeout(() => {
        seekToFrame(0)
        if (props.autoPlay) {
          startPlayback()
        }
      }, 100)
    }

    calculateTotalFrames()
    generateClipThumbnails(idx)
  }
}

function onTrackImageLoaded(idx: number) {
  const img = imageSourceRefs.value.get(idx)
  if (!img) return

  const track = videoTracks.value[idx]
  if (track) {
    if (idx === 0) {
      videoInfo.value = {
        duration: track.duration,
        width: img.naturalWidth,
        height: img.naturalHeight
      }
      resizeCanvas()

      setTimeout(() => {
        seekToFrame(0)
      }, 100)
    }

    calculateTotalFrames()
    generateClipThumbnails(idx)
  }
}

async function generateClipThumbnails(idx: number) {
  const track = videoTracks.value[idx]
  if (!track || !track.duration) return

  if (track.type === 'image') {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = track.url

    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        setTimeout(reject, 5000)
      })

      const frameWidth = 80
      const frameHeight = 60
      const canvas = document.createElement('canvas')
      canvas.width = frameWidth
      canvas.height = frameHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, frameWidth, frameHeight)

      if (track.thumbnailUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.thumbnailUrl)
      }
      track.thumbnailUrl = canvas.toDataURL('image/jpeg', 0.6)
    } catch (e) {
      // thumbnail generation failed silently
    }
    return
  }

  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.src = track.url
  video.muted = true
  video.preload = 'auto'

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = reject
      setTimeout(reject, 5000)
    })

    const trimDuration = track.trimEnd - track.trimStart
    if (trimDuration <= 0) return

    const frameCount = Math.max(8, Math.ceil(trimDuration * 4))
    const frameWidth = 80
    const frameHeight = 60
    const canvas = document.createElement('canvas')
    canvas.width = frameCount * frameWidth
    canvas.height = frameHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    for (let i = 0; i < frameCount; i++) {
      const sampleTime = track.trimStart + (i / (frameCount - 1 || 1)) * trimDuration
      video.currentTime = Math.min(sampleTime, track.duration - 0.01)
      await new Promise<void>(resolve => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
        setTimeout(resolve, 300)
      })
      await new Promise(r => requestAnimationFrame(r))
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, i * frameWidth, 0, frameWidth, frameHeight)
    }

    if (track.thumbnailUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(track.thumbnailUrl)
    }
    track.thumbnailUrl = canvas.toDataURL('image/jpeg', 0.6)
  } catch (e) {
    // thumbnail generation failed silently
  } finally {
    video.src = ''
    video.load()
  }
}

function calculateTotalFrames() {
  let totalDuration = 0
  videoTracks.value.forEach(track => {
    totalDuration += (track.trimEnd - track.trimStart)
  })
  timelineTotalFrames.value = Math.round(totalDuration * videoFPS.value)
}

function resizeCanvas() {
  if (!canvasRef.value || !videoInfo.value.width) return

  const canvas = canvasRef.value
  const container = canvas.parentElement

  if (!container) return

  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  const videoAspect = videoInfo.value.width / videoInfo.value.height
  const containerAspect = containerWidth / containerHeight

  let displayWidth, displayHeight

  if (containerAspect > videoAspect) {
    displayHeight = containerHeight
    displayWidth = displayHeight * videoAspect
  } else {
    displayWidth = containerWidth
    displayHeight = displayWidth / videoAspect
  }

  canvas.style.width = displayWidth + 'px'
  canvas.style.height = displayHeight + 'px'

  canvas.width = videoInfo.value.width
  canvas.height = videoInfo.value.height
}

watch(() => props.videoUrl, async (newUrl) => {
  if (!newUrl) return
  stopPlayback()
  initTracksFromUpstream()
  if (videoTracks.value.length > 0) {
    await nextTick()
    await nextTick()
  }
})

watch(() => props.initialVideoUrls, async (urls) => {
  if (!urls || urls.length === 0) return
  stopPlayback()
  initTracksFromUpstream()
  if (videoTracks.value.length > 0) {
    await nextTick()
    await nextTick()
  }
})

function initTracksFromUpstream() {
  videoTracks.value = []
  currentTrackIndex.value = -1
  videoSourceRefs.value.clear()
  imageSourceRefs.value.clear()
  timelineCurrentFrame.value = 0

  const inputs = props.upstreamInputs
  if (inputs && ((inputs.videos?.length || 0) + (inputs.images?.length || 0)) > 0) {
    for (const v of inputs.videos || []) {
      videoTracks.value.push({ url: v.url, duration: 0, trimStart: 0, trimEnd: 0, type: 'video' })
    }
    for (const img of inputs.images || []) {
      videoTracks.value.push({ url: img.url, duration: 5, trimStart: 0, trimEnd: 0, type: 'image' })
    }
  } else if (props.initialVideoUrls && props.initialVideoUrls.length > 0) {
    for (const url of props.initialVideoUrls) {
      videoTracks.value.push({ url, duration: 0, trimStart: 0, trimEnd: 0, type: 'video' })
    }
  } else if (props.videoUrl) {
    videoTracks.value.push({
      url: props.videoUrl,
      file: props.videoFile,
      duration: 0,
      trimStart: 0,
      trimEnd: 0,
      type: 'video'
    })
  }

  if (videoTracks.value.length > 0) {
    currentTrackIndex.value = 0
  }
}

onMounted(async () => {
  initTracksFromUpstream()

  if (videoTracks.value.length > 0) {
    await nextTick()
    await nextTick()
  }

  window.addEventListener('resize', resizeCanvas)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  const container = document.querySelector('.video-timeline-container') as HTMLElement
  if (container) {
    timelineContainerWidth.value = container.clientWidth
    timelineResizeObserver = new ResizeObserver((entries) => {
      timelineContainerWidth.value = entries[0].contentRect.width
    })
    timelineResizeObserver.observe(container)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('keyup', onKeyUp)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  timelineResizeObserver?.disconnect()
  timelineResizeObserver = null
  stopPlayback()

  videoTracks.value.forEach(track => {
    if (track.url.startsWith('blob:')) {
      URL.revokeObjectURL(track.url)
    }
  })
  capturedFrames.value.forEach(frame => {
    if (frame.url.startsWith('blob:')) URL.revokeObjectURL(frame.url)
  })
})

// ===== 时间轴计算工具 =====

function getFrameSource(timelineFrame: number): { trackIndex: number; trackFrame: number; trackTime: number } | null {
  let accumulatedFrames = 0

  for (let i = 0; i < videoTracks.value.length; i++) {
    const track = videoTracks.value[i]
    const trackDuration = track.trimEnd - track.trimStart
    const trackFrames = Math.round(trackDuration * videoFPS.value)

    if (timelineFrame < accumulatedFrames + trackFrames) {
      const frameInTrack = timelineFrame - accumulatedFrames
      const timeInTrack = frameInTrack / videoFPS.value
      const absoluteTime = track.trimStart + timeInTrack

      return {
        trackIndex: i,
        trackFrame: frameInTrack,
        trackTime: absoluteTime
      }
    }

    accumulatedFrames += trackFrames
  }

  return null
}

function startPlayback() {
  if (timelinePlaying.value) return
  if (videoTracks.value.length === 0) return

  timelinePlaying.value = true
  lastFrameTime = performance.now()
  lastReactiveUpdate = 0

  const track = videoTracks.value[currentTrackIndex.value]
  if (!track) return

  if (track.type === 'video') {
    const video = videoSourceRefs.value.get(currentTrackIndex.value)
    if (video) {
      video.playbackRate = videoOptions.value.playbackRate
      video.volume = videoOptions.value.volume
      video.muted = videoOptions.value.muted
      video.play().catch(() => {})
    }
  } else {
    const frameSource = getFrameSource(timelineCurrentFrame.value)
    if (frameSource) {
      advanceToNextVideoTrack(frameSource.trackIndex)
    }
  }
}

function stopPlayback() {
  timelinePlaying.value = false
  isFrameStepping = false
  videoSourceRefs.value.forEach(v => v.pause())
}

function onPlaybackTimeUpdate(idx: number) {
  if (!timelinePlaying.value || idx !== currentTrackIndex.value) return

  const video = videoSourceRefs.value.get(idx)
  if (!video) return

  const track = videoTracks.value[idx]
  if (!track) return

  const trackElapsed = video.currentTime - track.trimStart
  if (video.currentTime >= track.trimEnd - 0.02) {
    advanceToNextVideoTrack(idx)
    return
  }

  const globalFrame = computeGlobalFrame(idx, trackElapsed)
  updatePlaybackUI(globalFrame)
}

function onTrackEnded(idx: number) {
  if (!timelinePlaying.value || idx !== currentTrackIndex.value) return
  advanceToNextVideoTrack(idx)
}

function advanceToNextVideoTrack(currentIdx: number) {
  const nextIdx = currentIdx + 1
  if (nextIdx >= videoTracks.value.length) {
    const frameSource = getFrameSource(0)
    if (frameSource) {
      currentTrackIndex.value = frameSource.trackIndex
      seekToFrame(0)
    }
    stopPlayback()
    return
  }

  const prevVideo = videoSourceRefs.value.get(currentIdx)
  if (prevVideo) prevVideo.pause()

  currentTrackIndex.value = nextIdx
  const nextTrack = videoTracks.value[nextIdx]
  if (!nextTrack) return

  if (nextTrack.type === 'video') {
    const video = videoSourceRefs.value.get(nextIdx)
    if (video) {
      video.currentTime = nextTrack.trimStart
      if (timelinePlaying.value) {
        video.playbackRate = isFrameStepping ? STEP_RATE : videoOptions.value.playbackRate
        video.volume = videoOptions.value.volume
        video.muted = videoOptions.value.muted
        video.play().catch(() => {})
      }
    }
  } else {
    const imgElapsed = 0
    const globalFrame = computeGlobalFrame(nextIdx, imgElapsed)
    updatePlaybackUI(globalFrame)
    if (timelinePlaying.value) {
      setTimeout(() => advanceToNextVideoTrack(nextIdx), (nextTrack.trimEnd - nextTrack.trimStart) * 1000 / videoOptions.value.playbackRate)
    }
  }
}

function computeGlobalFrame(trackIdx: number, trackElapsed: number): number {
  let accumulatedFrames = 0
  for (let i = 0; i < trackIdx && i < videoTracks.value.length; i++) {
    const t = videoTracks.value[i]
    accumulatedFrames += Math.round((t.trimEnd - t.trimStart) * videoFPS.value)
  }
  return accumulatedFrames + Math.round(trackElapsed * videoFPS.value)
}

function updatePlaybackUI(globalFrame: number) {
  if (globalFrame >= timelineTotalFrames.value) {
    globalFrame = 0
  }

  const now = performance.now()
  const shouldUpdateReactive = now - lastReactiveUpdate > 100

  if (shouldUpdateReactive) {
    timelineCurrentFrame.value = globalFrame
    lastReactiveUpdate = now
  }

  const pos = (globalFrame / videoFPS.value) * 100 * timelineZoom.value
  if (playheadEl.value) {
    playheadEl.value.style.left = pos + 'px'
  }
}

watch([timelineZoom, timelineCurrentFrame], () => {
  if (timelinePlaying.value) return
  const pos = (timelineCurrentFrame.value / videoFPS.value) * 100 * timelineZoom.value
  if (playheadEl.value) playheadEl.value.style.left = pos + 'px'
})

function togglePlayPause() {
  if (timelinePlaying.value) {
    stopPlayback()
  } else {
    startPlayback()
  }
}

function seekToFrame(frame: number) {
  const clamped = Math.max(0, Math.min(frame, timelineTotalFrames.value - 1))
  timelineCurrentFrame.value = clamped

  const frameSource = getFrameSource(clamped)
  if (!frameSource) return

  currentTrackIndex.value = frameSource.trackIndex
  const track = videoTracks.value[frameSource.trackIndex]
  if (!track) return

  if (track.type === 'video') {
    const video = videoSourceRefs.value.get(frameSource.trackIndex)
    if (video && video.readyState >= 1) {
      video.currentTime = frameSource.trackTime
    }
  }

  if (playheadEl.value) {
    const pos = (clamped / videoFPS.value) * 100 * timelineZoom.value
    playheadEl.value.style.left = pos + 'px'
  }
}

function seekFrame(direction: number) {
  seekToFrame(timelineCurrentFrame.value + direction)
}

function seekToTimelinePosition(timeInSeconds: number) {
  const frame = Math.round(timeInSeconds * videoFPS.value)
  seekToFrame(frame)
}

function changePlaybackRate(rate: number) {
  isDirty.value = true
  videoOptions.value.playbackRate = rate
  const activeVideo = videoSourceRefs.value.get(currentTrackIndex.value)
  if (activeVideo) activeVideo.playbackRate = rate
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function timeToFrame(time: number): number {
  return Math.round(time * videoFPS.value)
}

function frameToTime(frame: number): number {
  return frame / videoFPS.value
}

function formatFrameRange(startTime: number, endTime: number): string {
  const startFrame = timeToFrame(startTime)
  const endFrame = timeToFrame(endTime)
  const duration = endFrame - startFrame
  return `${duration}f`
}

function snapToFrame(time: number): number {
  const frame = Math.round(time * videoFPS.value)
  return frame / videoFPS.value
}

function onVolumeChange() {
  isDirty.value = true
  videoSourceRefs.value.forEach(video => {
    video.volume = videoOptions.value.volume
  })
}

function onMutedChange() {
  isDirty.value = true
  videoSourceRefs.value.forEach(video => {
    video.muted = videoOptions.value.muted
  })
}

async function captureVideoFrame() {
  if (isCaptureFrameLoading.value) return

  const idx = currentTrackIndex.value
  const track = videoTracks.value[idx]
  if (!track) return

  isCaptureFrameLoading.value = true
  try {
    let blob: Blob | null = null

    if (track.type === 'video') {
      const video = videoSourceRefs.value.get(idx)
      if (!video || video.readyState < 2) return
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0)
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    } else {
      const img = imageSourceRefs.value.get(idx)
      if (!img || !img.complete) return
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    }

    if (!blob) return

    const frame = timelineCurrentFrame.value
    const file = new File([blob], `frame-${frame}.png`, { type: 'image/png' })
    capturedFrames.value = [
      ...capturedFrames.value,
      {
        id: createCapturedFrameId(),
        url: URL.createObjectURL(blob),
        file,
        frame,
        trackIndex: currentTrackIndex.value,
      },
    ]
    ElMessage.success(`已截取第 ${frame} 帧`)
  } catch (error) {
    console.error('[VideoReferenceEditor] Failed to capture frame:', error)
  } finally {
    isCaptureFrameLoading.value = false
  }
}

function applyVideoEdit() {
  isDirty.value = false
  emit('apply', {
    tracks: videoTracks.value,
    options: videoOptions.value
  })
}

const IMAGE_DURATION = 10
const IMAGE_DEFAULT_FRAMES = 1 / 30

function openMediaPicker(onFilesReady: (tracks: VideoTrack[]) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'video/*,image/*'
  input.onchange = async (e) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    const tracks: VideoTrack[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const url = URL.createObjectURL(file)

      if (file.type.startsWith('image/')) {
        tracks.push({
          url,
          file,
          duration: IMAGE_DURATION,
          trimStart: 0,
          trimEnd: IMAGE_DEFAULT_FRAMES,
          type: 'image'
        })
      } else {
        const video = document.createElement('video')
        video.src = url
        video.muted = true

        await new Promise((resolve) => {
          video.onloadedmetadata = resolve
          setTimeout(resolve, 5000)
        })

        tracks.push({
          url,
          file,
          duration: video.duration,
          trimStart: 0,
          trimEnd: video.duration,
          type: 'video'
        })

        video.src = ''
        video.load()
      }
    }

    if (tracks.length > 0) {
      onFilesReady(tracks)
    }
  }
  input.click()
}

async function addVideoTrack() {
  openMediaPicker((tracks) => {
    videoTracks.value.push(...tracks)
    currentTrackIndex.value = videoTracks.value.length - 1
    isDirty.value = true
  })
}

async function addVideoTrackBefore(idx: number) {
  openMediaPicker((tracks) => {
    videoTracks.value.splice(idx, 0, ...tracks)
    currentTrackIndex.value = idx
    isDirty.value = true
  })
}

async function addVideoTrackAfter(idx: number) {
  openMediaPicker((tracks) => {
    videoTracks.value.splice(idx + 1, 0, ...tracks)
    currentTrackIndex.value = idx + 1
    isDirty.value = true
  })
}

function removeTrack(idx: number) {
  if (videoTracks.value[idx]) {
    URL.revokeObjectURL(videoTracks.value[idx].url)
  }
  videoTracks.value.splice(idx, 1)
  isDirty.value = true
  if (currentTrackIndex.value >= videoTracks.value.length) {
    currentTrackIndex.value = videoTracks.value.length - 1
  }
}

function selectTrack(idx: number) {
  currentTrackIndex.value = idx
  stopPlayback()
}

function onClipHandleMouseDown(e: MouseEvent, idx: number, handle: 'start' | 'end') {
  e.stopPropagation()
  e.preventDefault()

  const track = videoTracks.value[idx]
  if (!track) return

  currentTrackIndex.value = idx
  stopPlayback()

  const startX = e.clientX
  const startTrimStart = track.trimStart
  const startTrimEnd = track.trimEnd
  const pixelsPerSecond = 100 * timelineZoom.value

  let isDragging = false

  const onMove = (ev: MouseEvent) => {
    isDragging = true;
    isDirty.value = true;
    const deltaX = ev.clientX - startX
    const deltaTime = deltaX / pixelsPerSecond

    if (handle === 'start') {
      const newStart = snapToFrame(Math.max(0, Math.min(startTrimStart + deltaTime, track.trimEnd - frameToTime(1))))
      track.trimStart = newStart

      calculateTotalFrames()
      seekToFrame(timelineCurrentFrame.value)
    } else {
      const newEnd = snapToFrame(Math.min(track.duration, Math.max(startTrimEnd + deltaTime, track.trimStart + frameToTime(1))))
      track.trimEnd = newEnd

      calculateTotalFrames()
      seekToFrame(timelineCurrentFrame.value)
    }
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)

    if (isDragging) {
      const startFrame = timeToFrame(track.trimStart)
      const endFrame = timeToFrame(track.trimEnd)
      ElMessage.success(`片段${idx + 1}: ${startFrame}f - ${endFrame}f (${endFrame - startFrame}f)`)
      generateClipThumbnails(idx)
    }
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onPlayheadMouseDown(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()

  stopPlayback()

  const timelineContainer = document.querySelector('.video-timeline-container') as HTMLElement
  if (!timelineContainer) return

  const containerRect = timelineContainer.getBoundingClientRect()
  const pixelsPerSecond = 100 * timelineZoom.value

  const onMove = (ev: MouseEvent) => {
    const relativeX = ev.clientX - containerRect.left + timelineContainer.scrollLeft
    const clickTime = Math.max(0, relativeX / pixelsPerSecond)

    seekToTimelinePosition(Math.min(totalDuration.value, clickTime))
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onRulerClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.timeline-playhead-handle')) return

  const timelineContainer = document.querySelector('.video-timeline-container') as HTMLElement
  if (!timelineContainer) return
  const containerRect = timelineContainer.getBoundingClientRect()
  const clickX = e.clientX - containerRect.left + timelineContainer.scrollLeft
  const pixelsPerSecond = 100 * timelineZoom.value
  const clickTime = clickX / pixelsPerSecond

  stopPlayback()
  seekToTimelinePosition(Math.max(0, Math.min(totalDuration.value, clickTime)))
}

function onTimelineClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.video-clip')) {
    return
  }

  const timelineContainer = e.currentTarget as HTMLElement
  const rect = timelineContainer.getBoundingClientRect()
  const clickX = e.clientX - rect.left + timelineContainer.scrollLeft
  const pixelsPerSecond = 100 * timelineZoom.value
  const clickTime = clickX / pixelsPerSecond

  seekToTimelinePosition(Math.max(0, Math.min(totalDuration.value, clickTime)))
}

function onTimelineWheel(e: WheelEvent) {
  const zoomDelta = -e.deltaY * 0.001
  timelineZoom.value = Math.max(
    timelineMinZoom.value,
    Math.min(timelineMaxZoom.value, timelineZoom.value * (1 + zoomDelta))
  )
}

function startForwardStep() {
  if (isFrameStepping) return
  const track = videoTracks.value[currentTrackIndex.value]
  if (!track || track.type !== 'video') return
  isFrameStepping = true
  timelinePlaying.value = true
  const video = videoSourceRefs.value.get(currentTrackIndex.value)
  if (video) {
    video.playbackRate = STEP_RATE
    video.muted = videoOptions.value.muted
    video.play().catch(() => {})
  }
}

function startReverseStep() {
  if (isFrameStepping) return
  const track = videoTracks.value[currentTrackIndex.value]
  if (!track || track.type !== 'video') return
  const video = videoSourceRefs.value.get(currentTrackIndex.value)
  if (!video) return

  isFrameStepping = true
  reverseVirtualTime = video.currentTime
  reverseSeekInProgress = false

  const canvas = reverseCanvasRef.value
  if (canvas) {
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 1080
    drawReverseFrame(video)
  }
  isReversing.value = true
  reverseLastTime = performance.now()
  reverseRAF = requestAnimationFrame(reverseLoop)
}

function drawReverseFrame(video: HTMLVideoElement) {
  const canvas = reverseCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
}

function onReverseSeeked() {
  if (!isFrameStepping) return
  const video = videoSourceRefs.value.get(currentTrackIndex.value)
  if (video) drawReverseFrame(video)
  reverseSeekInProgress = false
}

function reverseLoop(now: number) {
  if (!isFrameStepping) { reverseRAF = 0; return }
  const dt = Math.min(0.1, (now - reverseLastTime) / 1000)
  reverseLastTime = now

  const idx = currentTrackIndex.value
  const track = videoTracks.value[idx]
  if (!track) { stopStep(); return }

  reverseVirtualTime -= dt * STEP_RATE

  if (reverseVirtualTime <= track.trimStart) {
    const prevIdx = idx - 1
    if (prevIdx < 0) {
      reverseVirtualTime = track.trimStart
      if (!reverseSeekInProgress) {
        reverseSeekInProgress = true
        const video = videoSourceRefs.value.get(idx)
        if (video) {
          video.currentTime = track.trimStart
          video.addEventListener('seeked', onReverseSeeked, { once: true })
        }
      }
      updateStepUI(idx, 0)
      stopStep()
      return
    }

    const prevTrack = videoTracks.value[prevIdx]
    const prevVideo = videoSourceRefs.value.get(prevIdx)
    currentTrackIndex.value = prevIdx
    reverseVirtualTime = prevTrack.trimEnd

    if (prevVideo && prevTrack.type === 'video') {
      reverseSeekInProgress = true
      prevVideo.currentTime = prevTrack.trimEnd
      prevVideo.addEventListener('seeked', onReverseSeeked, { once: true })
    }
    updateStepUI(prevIdx, prevTrack.trimEnd - prevTrack.trimStart)
  } else {
    const video = videoSourceRefs.value.get(idx)
    if (video && !reverseSeekInProgress) {
      reverseSeekInProgress = true
      video.currentTime = reverseVirtualTime
      video.addEventListener('seeked', onReverseSeeked, { once: true })
    }
    updateStepUI(idx, reverseVirtualTime - track.trimStart)
  }

  reverseRAF = requestAnimationFrame(reverseLoop)
}

function updateStepUI(trackIdx: number, trackElapsed: number) {
  const globalFrame = computeGlobalFrame(trackIdx, trackElapsed)
  const clamped = Math.max(0, Math.min(globalFrame, timelineTotalFrames.value - 1))
  timelineCurrentFrame.value = clamped
  const pos = (clamped / videoFPS.value) * 100 * timelineZoom.value
  if (playheadEl.value) playheadEl.value.style.left = pos + 'px'
}

function stopStep() {
  if (!isFrameStepping) return
  isFrameStepping = false
  isReversing.value = false
  reverseSeekInProgress = false
  if (reverseRAF) { cancelAnimationFrame(reverseRAF); reverseRAF = 0 }
  timelinePlaying.value = false
  videoSourceRefs.value.forEach(v => {
    v.pause()
    v.playbackRate = videoOptions.value.playbackRate
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    togglePlayPause()
  } else if (e.key === 'a' || e.key === 'A') {
    e.preventDefault()
    if (!e.repeat) startReverseStep()
  } else if (e.key === 'd' || e.key === 'D') {
    e.preventDefault()
    if (!e.repeat) startForwardStep()
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
    stopStep()
  }
}

defineExpose({ isDirty, togglePlayPause, seekToFrame, applyVideoEdit })
</script>

<style scoped src="./VideoReferenceEditorContent.css"></style>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-[9999] flex flex-col bg-[#000000] text-zinc-100 font-sans overflow-hidden selection:bg-blue-500/30"
        @keydown.esc="close"
        tabindex="-1"
        ref="modalRef"
      >
        <!-- Toast Notifications -->
        <TransitionGroup name="toast" tag="div" class="fixed top-16 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-3 pointer-events-none">
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="bg-[#27272A] text-white px-5 py-3 rounded-lg shadow-2xl border border-white/[0.04] text-sm flex items-center gap-3 transform transition-all"
          >
            <component :is="toast.icon" :class="toast.iconClass" :size="18" />
            {{ toast.message }}
          </div>
        </TransitionGroup>

        <!-- Top Navigation Bar (Full Mode) -->
        <header v-if="fullMode" class="h-14 min-h-14 flex items-center justify-between px-6 border-b border-white/[0.04] bg-[#18181B] z-20 shrink-0">
          <div class="flex items-center gap-4">
            <button
              type="button"
              @click="close"
              class="back-gallery-btn"
            >
              <ChevronLeft :size="18" />
              <span>返回画廊</span>
              <kbd>Esc</kbd>
            </button>
            <div class="w-px h-4 bg-white/[0.08]"></div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"></span>
              <span class="text-xs font-bold text-zinc-300 tracking-widest uppercase">Ready</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div v-if="!activePanelIsModel" class="w-px h-4 bg-white/[0.08]"></div>
            <div v-if="!activePanelIsVideo && !activePanelIsModel" role="button" tabindex="0" @click="toggle360Mode" class="p-2 transition-colors rounded-lg hover:bg-[#27272A] cursor-pointer" :class="is360Mode ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-100'" title="360° 全景模式">
              <Globe :size="16" />
            </div>
            <div v-if="showFavorite" role="button" tabindex="0" @click="handleFavorite()" class="p-2 text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg hover:bg-[#27272A] cursor-pointer">
              <Heart :size="16" :fill="isFavorited ? 'currentColor' : 'none'" :class="isFavorited ? 'text-rose-500' : ''" />
            </div>
            <div v-if="showShare" role="button" tabindex="0" @click="handleShare" class="p-2 text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg hover:bg-[#27272A] cursor-pointer">
              <Share2 :size="16" />
            </div>
            <div role="button" tabindex="0" @click="close" class="p-2 text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg hover:bg-[#27272A] cursor-pointer" title="关闭 (Esc)">
              <X :size="16" />
            </div>

          </div>
        </header>

        <!-- Main Workspace -->
        <div class="flex flex-1 min-h-0 overflow-hidden">
          <!-- History Cards Column -->
          <aside
            v-if="fullMode && showInspector && hasMultipleRecords && historyItemsToRender.length > 0"
            ref="historySidebarRef"
            class="history-side-column"
            :class="browseMode === 'single' ? 'single-mode' : 'compare-mode'"
            :style="historySidebarStyle"
          >
            <div class="history-side-header">
              <div class="history-side-title-row">
                <div class="history-side-mode-switch">
                  <button
                    class="history-mode-btn"
                    :class="{ active: browseMode === 'single' }"
                    @click="setBrowseMode('single')"
                  >
                    {{ uiText.singleBrowse }}
                  </button>
                  <button
                    class="history-mode-btn"
                    :class="{ active: browseMode === 'compare' }"
                    @click="setBrowseMode('compare')"
                  >
                    {{ uiText.historyCompare }}
                  </button>
                </div>
              </div>
              <div v-if="browseMode === 'single'" class="history-side-caption">
                <span>{{ uiText.singleCaption }}</span>
              </div>
              <div v-else class="history-side-caption history-side-caption-compare">
                <div class="history-side-caption-actions">
                  <button class="compare-align-btn" @click="alignCompareColumns">
                    {{ uiText.alignCards }}
                  </button>
                </div>
              </div>
            </div>
            <div class="compare-picker-grid" :class="{ 'single-mode': browseMode === 'single' }">
              <div class="compare-picker-col">
                <div
                  ref="compareColARef"
                  class="compare-picker-col-scroll custom-scrollbar"
                  :style="browseMode === 'single' ? singleModeScrollStyle : undefined"
                  @scroll="handleCompareColumnScroll"
                >
                  <button
                    v-for="(item, index) in historyItemsToRender"
                    :key="`a-${item.id}-${index}`"
                    class="history-side-card compact"
                    :class="{ active: item.id === compareSelectionA, disabled: isCompareItemDisabled('A', item) }"
                    :disabled="isCompareItemDisabled('A', item)"
                    :title="isCompareItemDisabled('A', item) ? 'Already used by B' : `Assign to A #${index + 1}`"
                    :data-history-id="String(item.id)"
                    :style="getCompareCardStyle(item)"
                    @click="selectCompareItem('A', item, index)"
                  >
                    <template v-if="item.isModel">
                      <img v-if="item.thumbnail" :src="item.thumbnail" class="history-side-card-image compact" alt="" draggable="false" />
                      <div v-else class="history-side-card-model compact">
                        <div class="history-side-card-model-badge">3D</div>
                      </div>
                      <div class="history-side-card-model-badge-overlay">3D</div>
                    </template>
                    <img v-else :src="item.thumbnail" class="history-side-card-image compact" alt="" draggable="false" />
                    <span v-if="isCompareItemDisabled('A', item)" class="history-side-card-mask">X</span>
                  </button>
                </div>
              </div>
              <div v-if="browseMode === 'compare'" class="compare-picker-col">
                <div ref="compareColBRef" class="compare-picker-col-scroll custom-scrollbar" @scroll="handleCompareColumnScroll">
                  <button
                    v-for="(item, index) in historyItemsToRender"
                    :key="`b-${item.id}-${index}`"
                    class="history-side-card compact"
                    :class="{ active: item.id === compareSelectionB, disabled: isCompareItemDisabled('B', item) }"
                    :disabled="isCompareItemDisabled('B', item)"
                    :title="isCompareItemDisabled('B', item) ? 'Already used by A' : `Assign to B #${index + 1}`"
                    :data-history-id="String(item.id)"
                    :style="getCompareCardStyle(item)"
                    @click="selectCompareItem('B', item, index)"
                  >
                    <template v-if="item.isModel">
                      <img v-if="item.thumbnail" :src="item.thumbnail" class="history-side-card-image compact" alt="" draggable="false" />
                      <div v-else class="history-side-card-model compact">
                        <div class="history-side-card-model-badge">3D</div>
                      </div>
                      <div class="history-side-card-model-badge-overlay">3D</div>
                    </template>
                    <img v-else :src="item.thumbnail" class="history-side-card-image compact" alt="" draggable="false" />
                    <span v-if="isCompareItemDisabled('B', item)" class="history-side-card-mask">X</span>
                  </button>
                </div>
              </div>
            </div>
            <div
              v-if="browseMode === 'single'"
              class="history-side-resize-handle"
              @mousedown.prevent="startSidebarResize"
            ></div>
          </aside>

          <!-- Canvas Area -->
          <main class="flex-1 min-w-0 bg-[#000000] overflow-hidden flex flex-col">
            <div v-if="showCompareSummary" class="compare-summary-panel">
              <section class="compare-summary-col compare-summary-col-a">
                <div class="compare-summary-content">
                  <div class="compare-summary-main">
                    <div class="compare-summary-prompt">{{ compareSummaryA.prompt }}</div>
                  </div>
                  <div class="compare-summary-side">
                    <div class="compare-summary-block">
                      <div class="compare-summary-refs">
                        <img
                          v-for="(url, idx) in compareSummaryA.referenceUrls"
                          :key="`a-ref-${idx}`"
                          :src="url"
                          alt=""
                          draggable="false"
                          class="compare-summary-ref"
                        />
                        <span v-if="!compareSummaryA.referenceUrls.length" class="compare-summary-empty">无参考</span>
                      </div>
                    </div>
                    <div class="compare-summary-block">
                      <div class="compare-summary-params">
                        <span
                          v-for="param in compareSummaryA.params"
                          :key="`a-${param.key}`"
                          class="compare-summary-param"
                        >
                          <span class="compare-summary-param-key">{{ param.label || param.key }}</span>
                          <span class="compare-summary-param-value">{{ formatCompareParamValue(param.value) }}</span>
                        </span>
                        <span v-if="!compareSummaryA.params.length" class="compare-summary-empty">无参数</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section class="compare-summary-col compare-summary-col-b">
                <div class="compare-summary-content">
                  <div class="compare-summary-main">
                    <div class="compare-summary-prompt">{{ compareSummaryB.prompt }}</div>
                  </div>
                  <div class="compare-summary-side">
                    <div class="compare-summary-block">
                      <div class="compare-summary-refs">
                        <img
                          v-for="(url, idx) in compareSummaryB.referenceUrls"
                          :key="`b-ref-${idx}`"
                          :src="url"
                          alt=""
                          draggable="false"
                          class="compare-summary-ref"
                        />
                        <span v-if="!compareSummaryB.referenceUrls.length" class="compare-summary-empty">无参考</span>
                      </div>
                    </div>
                    <div class="compare-summary-block">
                      <div class="compare-summary-params">
                        <span
                          v-for="param in compareSummaryB.params"
                          :key="`b-${param.key}`"
                          class="compare-summary-param"
                        >
                          <span class="compare-summary-param-key">{{ param.label || param.key }}</span>
                          <span class="compare-summary-param-value">{{ formatCompareParamValue(param.value) }}</span>
                        </span>
                        <span v-if="!compareSummaryB.params.length" class="compare-summary-empty">无参数</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div ref="canvasRef" class="preview-surface flex-1 min-h-0 relative overflow-hidden">
              <!-- Workflow Record Navigation (Prev / Next record) -->
              <button
                v-if="showRecordNav"
                class="record-nav-btn record-nav-left"
                :disabled="!hasPrevRecord"
                title="上一条记录"
                @click="emit('prevRecord')"
              >
                <ChevronLeft :size="28" />
              </button>
              <button
                v-if="showRecordNav"
                class="record-nav-btn record-nav-right"
                :disabled="!hasNextRecord"
                title="下一条记录"
                @click="emit('nextRecord')"
              >
                <ChevronRight :size="28" />
              </button>
              <!-- Floating Toggles (Top Left) -->
              <div v-if="!activePanelIsModel && !activePanelIsVideo" class="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-zinc-900/95 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                <label v-if="browseMode === 'single'" class="toolbar-toggle">
                  <input
                    v-model="singleCompareMode"
                    type="checkbox"
                    class="toolbar-toggle-input"
                    @change="onSingleCompareToggleChange"
                  />
                  <span class="toolbar-toggle-track">
                    <span class="toolbar-toggle-thumb"></span>
                  </span>
                  <span class="toolbar-toggle-label">对比模式</span>
                </label>

                <div v-if="browseMode === 'single'" class="toolbar-divider"></div>

                <label class="toolbar-toggle">
                  <input v-model="showCompareSummaryEnabled" type="checkbox" class="toolbar-toggle-input" />
                  <span class="toolbar-toggle-track">
                    <span class="toolbar-toggle-thumb"></span>
                  </span>
                  <span class="toolbar-toggle-label">显示参数</span>
                </label>
              </div>

              <MediaCompareStage
                v-if="!activePanelIsModel && !activePanelIsVideo && !is360Mode"
                :images="images"
                :current-index="currentIndex"
                :display-image="displayImage"
                :alt="alt"
                :compare-mode="compareMode"
                :compare-type="compareType"
                :has-compare="hasCompare"
                :compare-left-image="compareLeftImage"
                :compare-right-image="compareRightImage"
                :compare-left-label="compareSource === 'history' ? 'A' : '参考'"
                :compare-right-label="compareSource === 'history' ? 'B' : '结果'"
                :has-reference-compare="hasReferenceCompare"
                :reference-urls="referenceUrls"
                :compare-ref-index="compareRefIndex"
                :show-thumbnails="showOriginalThumbnails"
                :right-nav-offset="fullMode && showInspector && !showCompareSummary && showCompareSummaryEnabled ? 336 : 16"
                @prev="prevImage"
                @next="nextImage"
                @navigate="goToImage"
                @enable-compare="enableCompare"
                @disable-compare="disableCompare"
                @update:compareRefIndex="compareRefIndex = $event"
                 @image-load="onImageLoad"
               />

               <template v-else>
                <div class="absolute inset-0 opacity-[0.2] pointer-events-none" style="background-image: radial-gradient(#27272a 1px, transparent 1px); background-size: 32px 32px;"></div>
                <div class="preview-stage absolute inset-0 flex items-center justify-center transition-transform duration-75 ease-out origin-center pointer-events-auto">
                  <div v-if="!activePanelIsModel" class="absolute inset-0 bg-indigo-500/10 blur-[120px] rounded-full transform scale-75 pointer-events-none"></div>
                  <div ref="imgWrapperRef" class="relative" :class="(activePanelIsModel || activePanelIsVideo) ? 'w-full h-full' : ''">
                    <ThreeDModelView
                      v-if="activePanelIsModel && activeModelUrl"
                      :initial-url="activeModelUrl"
                      class="w-full h-full"
                    />
                    <PanoramaViewer
                      v-else-if="is360Mode && !activePanelIsVideo && displayImage"
                      :src="displayImage"
                      type="image"
                      class="w-full h-full"
                      style="max-width: 80vw; max-height: 80vh;"
                    />
                    <div v-else-if="activePanelIsVideo" class="video-preview-wrapper">
                      <video
                        v-if="!videoUnsupported"
                        ref="videoRef"
                        :src="displayImage"
                        class="video-preview-el"
                        autoplay
                        loop
                        draggable="false"
                        disablepictureinpicture
                        controlslist="nodownload nofullscreen noremoteplayback"
                        @loadedmetadata="onVideoLoad"
                        @play="videoPlaying = true"
                        @pause="videoPlaying = false"
                        @timeupdate="onVideoTimeUpdate"
                        @ended="videoPlaying = false"
                        @volumechange="onVideoVolumeChange"
                        @error="onVideoError"
                      />
                      <div v-else class="video-unsupported">
                        <p class="video-unsupported-text">此视频格式不支持在线预览 (ProRes/MOV)</p>
                        <a :href="displayImage" download class="video-download-btn">下载视频</a>
                      </div>
                      <div class="video-preview-controls">
                        <div class="video-progress-wrap">
                          <input type="range"
                            class="video-progress-slider"
                            min="0"
                            :max="videoDuration || 0"
                            step="0.01"
                            :value="videoCurrentTime"
                            @input="onVideoSeek($event)" />
                        </div>
                        <div class="video-ctrl-bar">
                          <div class="video-ctrl-left">
                            <button class="video-ctrl-btn" @click="seekVideoFrame(-1)" title="上一帧">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
                            </button>
                            <button class="video-ctrl-btn video-play-btn" @click="toggleVideoPlayPause" :title="videoPlaying ? '暂停 (Space)' : '播放 (Space)'">
                              <svg v-if="!videoPlaying" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                            </button>
                            <button class="video-ctrl-btn" @click="seekVideoFrame(1)" title="下一帧">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                            </button>
                            <span class="video-time-display">
                              {{ formatVideoDuration(videoCurrentTime) }} / {{ formatVideoDuration(videoDuration) }}
                              <span style="margin-left: 8px; color: #71717a;">
                                ({{ videoCurrentFrame }}f / {{ videoTotalFrames }}f)
                              </span>
                            </span>
                          </div>
                          <div class="video-ctrl-right">
                            <div class="video-volume-control">
                              <input type="range" min="0" max="1" step="0.1"
                                v-model.number="videoVolume" class="video-volume-slider" @input="onVideoVolumeInput" />
                              <span class="video-volume-val">{{ Math.round(videoVolume * 100) }}</span>
                            </div>
                            <label class="video-mute-toggle" title="静音">
                              <input type="checkbox" v-model="videoMuted" class="video-mute-input" @change="onVideoMutedChange" />
                              <VolumeX :size="14" />
                            </label>
                            <select class="video-speed-select" :value="videoPlaybackRate" @change="onVideoSpeedChange(parseFloat(($event.target as HTMLSelectElement).value))">
                              <option value="0.25">0.25x</option>
                              <option value="0.5">0.5x</option>
                              <option value="1">1x</option>
                              <option value="1.5">1.5x</option>
                              <option value="2">2x</option>
                            </select>
                            <button class="video-ctrl-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
                              <Maximize :size="14" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- Close Button (Simple Mode) -->
            <div
              v-if="!fullMode"
              role="button"
              tabindex="0"
              @click="close"
              class="absolute top-4 right-4 z-20 p-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all backdrop-blur-sm cursor-pointer"
            >
              <X :size="20" />
            </div>

            <!-- Floating Command Bar (Bottom Center) -->
            <div v-if="!fullMode && !activePanelIsModel && !activePanelIsVideo" class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-zinc-900/95 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
              <button @click="downloadImage" class="toolbar-btn" title="下载">
                <Download :size="14" />
              </button>
              <button @click="handleCopy" class="toolbar-btn" title="复制图片">
                <Copy :size="14" />
              </button>
            </div>

          </main>

          <!-- Right Detail Panel (Full Mode Only) -->
          <Transition name="slide-left">
            <MediaDetailPanel
              v-if="fullMode && showInspector && !showCompareSummary && showCompareSummaryEnabled"
              :images="activePanelImages"
              :current-index="0"
              :current-image="displayImage"
              :image-info="activePanelInfo"
              :image-size="imageSize"
              :is-video="activePanelIsVideo"
              :show-ai-tools="showAITools"
              :show-actions="showActions"
              :is-re-editing="isReEditing"
              :is-regenerating="isRegenerating"
              :show-workflow-actions="showWorkflowActions"
              :show-favorite="showFavorite"
              :show-share="showShare"
              :show-delete="showDelete"
              :is-favorited="isFavorited"
              :record-id="activePanelRecordId"
              @navigate="goToImage"
              @toolAction="triggerTool"
              @workflowAction="triggerWorkflow"
              @download="downloadImage"
              @copy="handleCopy"
              @favorite="handleFavorite"
              @share="handleShare"
              @delete="handleDelete"
              @re-edit="handleReEdit"
              @regenerate="handleRegenerate"
              @editImage="emit('editImage')"
              @editVideo="emit('editVideo')"
            />
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent, type Component } from 'vue'
import {
  X, ChevronLeft, ChevronRight, Minus, Plus, Maximize,
  Copy, Check, Info, Video, Sparkles, Wand2, Expand, Brush, Eraser,
  Edit3, RefreshCcw, Loader2, CheckCircle2, PenTool, Download, Heart, Share2, Trash2,
  ArrowLeftRight, Layers, Globe, VolumeX,
} from '@/components/common/icon/lucide'
import MediaDetailPanel from './MediaDetailPanel.vue'
import { downloadMedia } from '@/utils/download'
import { useAssetStore } from '@/stores/assets.store'
import { getReferenceUrls, getVisibleAssetParams } from '@/components/generation/generationResultAdapters'
import ThreeDModelView from '@/views/Director3DView.vue'
import ImageOverlayCompare from './ImageOverlayCompare.vue'
import MediaCompareStage from './MediaCompareStage.vue'
import { getStorage, setStorage } from '@/utils/storage'

defineOptions({ name: 'ImagePreviewModalContent', inheritAttrs: false })

const PanoramaViewer = defineAsyncComponent(() => import('./PanoramaViewer.vue'))

// --- Types ---
interface Toast {
  id: number
  message: string
  icon: Component
  iconClass: string
}

interface ImageInfo {
  prompt?: string
  model?: string
  ratio?: string
  size?: string
  createTime?: string
  vendor?: string
  usedTools?: string
  generationHint?: string
  [key: string]: any
}

interface HistoryItem {
  id: number | string
  thumbnail: string
  source: string
  isModel?: boolean
  title?: string
  subtitle?: string
  width?: number
  height?: number
  asset?: any
}

// --- Props ---
const props = withDefaults(defineProps<{
  images: string[]
  initialIndex?: number
  alt?: string
  imageInfo?: ImageInfo | null
  // Mode flags
  fullMode?: boolean       // Full mode with inspector panel, simple mode without
  showInspector?: boolean
  showActions?: boolean
  showAITools?: boolean
  showWorkflowActions?: boolean
  showFavorite?: boolean
  showShare?: boolean
  showDelete?: boolean
  // State
  isFavorited?: boolean
  isVideo?: boolean
  isModel?: boolean
  is360?: boolean
  modelUrl?: string
  // Record for delete action
  recordId?: number | string
  historyItemsOverride?: HistoryItem[]
  // Workflow record navigation (prev/next record across the workflow)
  showRecordNav?: boolean
  hasPrevRecord?: boolean
  hasNextRecord?: boolean
}>(), {
  initialIndex: 0,
  alt: 'Preview Image',
  imageInfo: null,
  fullMode: true,
  showInspector: true,
  showActions: true,
  showAITools: true,
  showWorkflowActions: true,
  showFavorite: false,
  showShare: false,
  showDelete: true,
  isFavorited: false,
  isVideo: false,
  isModel: false,
  is360: false,
  modelUrl: '',
  recordId: undefined,
  historyItemsOverride: () => [],
  showRecordNav: false,
  hasPrevRecord: false,
  hasNextRecord: false,
})

// --- Emits ---
const emit = defineEmits<{
  close: []
  navigate: [index: number]
  reEdit: [image: string, index: number]
  regenerate: [image: string, index: number]
  toolAction: [tool: string, image: string]
  workflowAction: [action: string, image: string]
  download: [url: string]
  copy: [url: string]
  favorite: [recordId: string | number]
  share: [image: string]
  delete: [id: number | string]
  selectHistory: [id: number | string]
  editImage: []
  editVideo: []
  prevRecord: []
  nextRecord: []
}>()

// --- Models ---
const visible = defineModel<boolean>('visible', { default: true })
const currentIndex = defineModel<number>('currentIndex', { default: 0 })

// --- Refs ---
const modalRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const imgWrapperRef = ref<HTMLElement | null>(null)
const historySidebarRef = ref<HTMLElement | null>(null)
const compareColARef = ref<HTMLElement | null>(null)
const compareColBRef = ref<HTMLElement | null>(null)
  const is360Mode = ref(false)
  const assetStore = useAssetStore()
const uiText = {
  history: '\u5386\u53f2',
  singleBrowse: '\u5355\u72ec\u6d4f\u89c8',
  historyCompare: '\u5386\u53f2\u5bf9\u6bd4',
  singleCaption: '\u9009\u62e9\u4e00\u5f20\u56fe\u67e5\u770b\u8be6\u60c5',
  compareCaption: '\u9009\u62e9\u4e24\u5f20\u4e0d\u540c\u56fe\u7247\u8fdb\u884c\u5bf9\u6bd4',
  alignCards: '\u5bf9\u9f50\u5361\u7247',
} as const

// --- Toast System ---
const toasts = ref<Toast[]>([])
let toastId = 0

const showToast = (message: string, icon: Component = Info, iconClass: string = 'text-blue-400', duration: number = 3000) => {
  const id = toastId++
  toasts.value.push({ id, message, icon, iconClass })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

// --- Action State ---
const isRegenerating = ref(false)
const isReEditing = ref(false)
const promptCopied = ref(false)
const imageSize = ref<{ width: number; height: number } | null>(null)
const isFullscreen = ref(Boolean(document.fullscreenElement))

// --- Canvas State ---
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)

// --- Compare Mode ---
const compareMode = ref(false)
const compareType = ref<'split' | 'overlay'>('overlay')
const singleCompareMode = ref(false)
const comparePercent = ref(50)
const compareRefIndex = ref(0)
const compareSource = ref<'none' | 'history' | 'reference'>('none')
const compareSelectionA = ref<number | string | null>(null)
const compareSelectionB = ref<number | string | null>(null)
const browseMode = ref<'single' | 'compare'>('single')
/** 延迟激活对比：先渲染单图让舞台尺寸稳定，onImageLoad 时再激活 */
const pendingCompareActivation = ref(false)
const singleSidebarWidth = ref(196)
const isResizingSidebar = ref(false)
const sidebarResizeStartX = ref(0)
const sidebarResizeStartWidth = ref(196)
const showCompareSummaryEnabled = ref(true)

// --- Constants ---
const MIN_SCALE = 0.1
const MAX_SCALE = 5
const ZOOM_SPEED = 0.05
const SINGLE_SIDEBAR_MIN_WIDTH = 156
const SINGLE_SIDEBAR_MAX_WIDTH = 472
const SINGLE_CARD_WIDTH = 104
const SINGLE_CARD_HEIGHT = 112
const SINGLE_CARD_GAP = 8
const COMPARE_SUMMARY_VISIBLE_STORAGE_KEY = 'media-preview-compare-summary-visible'
// 用户对"对比模式"的持久化偏好：'on' = 下次自动开启对比，'off' = 下次不自动进入对比
const COMPARE_MODE_PREFERENCE_STORAGE_KEY = 'media-preview-compare-mode-preference'

// --- Computed ---
const currentImage = computed(() => props.images[currentIndex.value] || '')

const referenceUrls = computed<string[]>(() => {
  const refs = activePanelInfo.value?.referenceUrls
  if (!Array.isArray(refs)) return []
  return refs
    .filter((u: any) => typeof u === 'string' && u.trim())
    .map((u: string) => u.trim())
})

const referenceUrl = computed(() => {
  return referenceUrls.value[compareRefIndex.value] || referenceUrls.value[0] || ''
})

const hasReferenceCompare = computed(() => compareSource.value === 'reference' && !!referenceUrl.value && !activePanelIsVideo.value && !activePanelIsModel.value)

const hasMultipleRecords = computed<boolean>(() => {
  // 仅在显式载入多条记录时（如多选详情）开启左侧 单独浏览/历史对比 面板。
  // 单条记录即便自带多张图片（如 4 宫格生成结果）也不算多记录。
  return Array.isArray(props.historyItemsOverride) && props.historyItemsOverride.length > 1
})

const historyItemsToRender = computed<HistoryItem[]>(() => {
  if (props.historyItemsOverride.length) {
    return props.historyItemsOverride.filter((item) => !!item?.thumbnail || !!item?.source)
  }
  if (assetStore.items.length) {
    return assetStore.items.map((asset: any) => ({
      id: asset.id,
      thumbnail: asset.thumbnail_url || asset.url || asset.source_url || '',
      source: asset.source_url || asset.url || asset.thumbnail_url || '',
      isModel: asset.type === 'model',
      title: asset.prompt ? String(asset.prompt).slice(0, 24) : `资产 ${asset.id}`,
      subtitle: asset.model_display_name || asset.model || '',
      width: Number(asset.width || asset.param?.width || asset.param?.params?.width) || undefined,
      height: Number(asset.height || asset.param?.height || asset.param?.params?.height) || undefined,
      asset,
    })).filter((item: HistoryItem) => !!item.thumbnail || !!item.source)
  }
  return props.images.map((img, index) => ({
    id: `image-${index}`,
    thumbnail: img,
    source: img,
    title: `第 ${index + 1} 张`,
    subtitle: props.imageInfo?.modelDisplayName || props.imageInfo?.model || '????????????',
    width: imageSize.value?.width || undefined,
    height: imageSize.value?.height || undefined,
  }))
})
const compareItemA = computed(() => historyItemsToRender.value.find(item => String(item.id) === String(compareSelectionA.value)) || null)
const compareItemB = computed(() => historyItemsToRender.value.find(item => String(item.id) === String(compareSelectionB.value)) || null)
const compareItemIndexA = computed(() => historyItemsToRender.value.findIndex(item => String(item.id) === String(compareSelectionA.value)))
const compareItemIndexB = computed(() => historyItemsToRender.value.findIndex(item => String(item.id) === String(compareSelectionB.value)))
const compareDetailA = computed(() => compareItemA.value?.asset || null)
const compareDetailB = computed(() => compareItemB.value?.asset || null)
const historyCompareLeftImage = computed(() => compareItemA.value?.source || compareItemA.value?.thumbnail || '')
const historyCompareRightImage = computed(() => compareItemB.value?.source || compareItemB.value?.thumbnail || '')
const activeSingleItem = computed(() => compareItemA.value || compareItemB.value || null)
const activeSingleDetail = computed(() => activeSingleItem.value?.asset || null)
const hasHistoryCompare = computed(() =>
  compareSource.value === 'history' &&
  !!historyCompareLeftImage.value &&
  !!historyCompareRightImage.value &&
  historyCompareLeftImage.value !== historyCompareRightImage.value
)
const hasCompare = computed(() => compareSource.value !== 'none')
const displayImage = computed(() => {
  if (hasHistoryCompare.value) return historyCompareRightImage.value
  if (activeSingleItem.value?.source || activeSingleItem.value?.thumbnail) return activeSingleItem.value.source || activeSingleItem.value.thumbnail
  return currentImage.value
})
const compareLeftImage = computed(() => {
  if (compareSource.value === 'reference') return referenceUrl.value
  return historyCompareLeftImage.value
})
const compareRightImage = computed(() => {
  if (compareSource.value === 'reference') return displayImage.value
  return historyCompareRightImage.value
})
const showCompareCards = computed(() => !!compareSelectionA.value && !!compareSelectionB.value && !!compareItemA.value && !!compareItemB.value)
const showOriginalThumbnails = computed(() => !activeSingleItem.value && props.images.length > 1)
const showCompareSummary = computed(() => (
  browseMode.value === 'compare'
  && showCompareCards.value
  && showCompareSummaryEnabled.value
))
const activePanelInfo = computed(() => {
  if (activeSingleDetail.value) return buildPanelInfo(activeSingleDetail.value)
  return props.imageInfo
})
const activePanelImages = computed(() => displayImage.value ? [displayImage.value] : props.images)
const activePanelRecordId = computed(() => {
  if (activeSingleDetail.value?.id !== undefined) return activeSingleDetail.value.id
  return props.recordId
})
const activePanelIsVideo = computed(() => {
  if (activeSingleDetail.value?.type) return activeSingleDetail.value.type === 'video'
  return props.isVideo
})
const activePanelIsModel = computed(() => {
  if (activeSingleDetail.value?.type) return activeSingleDetail.value.type === 'model'
  return props.isModel
})
const activeModelUrl = computed(() => {
  // 从侧边栏选中模型时，用 origin_url 载入实际模型文件
  if (activePanelIsModel.value && activeSingleDetail.value) {
    const detail = activeSingleDetail.value
    const originUrl =
      detail?._asset?.media?.[0]?.origin_url
      || detail?.media?.[0]?.origin_url
      || (typeof detail?.url === 'object' ? detail.url?.origin_url : '')
      || ''
    if (originUrl) return originUrl
  }
  return props.modelUrl || displayImage.value || currentImage.value || ''
})
const compareSummaryA = computed(() => buildCompareSummary(compareDetailA.value))
const compareSummaryB = computed(() => buildCompareSummary(compareDetailB.value))
const historySidebarStyle = computed(() => {
  if (browseMode.value === 'single') {
    return { width: `${singleSidebarWidth.value}px` }
  }
  return {}
})
const singleModeColumnCount = computed(() => {
  const usableWidth = Math.max(singleSidebarWidth.value - 16, SINGLE_CARD_WIDTH)
  const columns = Math.floor((usableWidth + SINGLE_CARD_GAP) / (SINGLE_CARD_WIDTH + SINGLE_CARD_GAP))
  return Math.max(1, Math.min(4, columns))
})
const singleModeScrollStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${singleModeColumnCount.value}, ${SINGLE_CARD_WIDTH}px)`,
  gridAutoRows: `${SINGLE_CARD_HEIGHT}px`,
  justifyContent: 'center',
  alignContent: 'start',
  gap: `${SINGLE_CARD_GAP}px`,
  paddingRight: '0',
}))

// --- Watchers ---
watch(visible, async (newVal) => {
  if (newVal) {
    if (!assetStore.items.length && !assetStore.loading) {
      assetStore.load()
    }
    currentIndex.value = props.initialIndex
    browseMode.value = 'single'
    compareSource.value = 'none'
    compareMode.value = false
    initCompareSelections()
    // 打开弹窗时根据持久化的 singleCompareMode + 当前 referenceUrls 决定是否延迟激活对比
    pendingCompareActivation.value = false
    nextTick(() => {
      if (!visible.value) return
      if (is360Mode.value) return
      if (activePanelIsVideo.value || activePanelIsModel.value) return
      if (singleCompareMode.value && referenceUrls.value.length && compareSource.value === 'none') {
        tryActivateCompare()
      }
    })
    imageSize.value = null
    is360Mode.value = props.is360 || false
    resetView()
    await nextTick()
    scrollSelectedHistoryCardIntoView()
    modalRef.value?.focus()
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeydown)
  } else {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', handleKeydown)
  }
})

watch(() => props.initialIndex, (newVal) => {
  if (visible.value) {
    currentIndex.value = newVal
    browseMode.value = 'single'
    initCompareSelections()
    imageSize.value = null
    videoUnsupported.value = false
    nextTick(() => {
      scrollSelectedHistoryCardIntoView()
    })
  }
})

// Auto-enable compare mode when reference images become available
watch(referenceUrls, (urls) => {
  if (urls.length && visible.value && compareSource.value !== 'history' && !activePanelIsVideo.value && !activePanelIsModel.value && !is360Mode.value) {
    if (browseMode.value === 'single' && !singleCompareMode.value) return
    nextTick(() => {
      if (!visible.value) return
      if (is360Mode.value) return
      tryActivateCompare()
    })
  } else if (!urls.length && compareSource.value === 'reference') {
    compareSource.value = 'none'
    compareMode.value = false
    pendingCompareActivation.value = false
  }
}, { immediate: true })

watch(singleCompareMode, (enabled) => {
  if (browseMode.value !== 'single') return
  if (is360Mode.value) return
  if (enabled && referenceUrls.value.length && compareSource.value === 'none') {
    tryActivateCompare()
  } else if (!enabled && compareSource.value === 'reference') {
    compareSource.value = 'none'
    compareMode.value = false
    pendingCompareActivation.value = false
  }
})

watch(showCompareSummaryEnabled, (enabled) => {
  if (typeof window === 'undefined') return
  setStorage(COMPARE_SUMMARY_VISIBLE_STORAGE_KEY, enabled ? '1' : '0')
})

// 持久化"对比模式"开关状态，照抄 showCompareSummaryEnabled 的做法
watch(singleCompareMode, (enabled) => {
  if (typeof window === 'undefined') return
  setStorage(COMPARE_MODE_PREFERENCE_STORAGE_KEY, enabled ? '1' : '0')
})

watch(historyItemsToRender, () => {
  initCompareSelections()
  nextTick(() => {
    scrollSelectedHistoryCardIntoView()
  })
})

// --- Lifecycle ---
onMounted(() => {
  if (typeof window !== 'undefined') {
    const saved = getStorage<string>(COMPARE_SUMMARY_VISIBLE_STORAGE_KEY)
    if (saved === '0') showCompareSummaryEnabled.value = false
    if (saved === '1') showCompareSummaryEnabled.value = true
    const savedCompareMode = getStorage<string>(COMPARE_MODE_PREFERENCE_STORAGE_KEY)
    if (savedCompareMode === '0') singleCompareMode.value = false
    if (savedCompareMode === '1') singleCompareMode.value = true
  }
  if (visible.value) {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeydown)
  }
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  stopSidebarResize()
})

// --- Methods ---
/** 激活参考对比模式（reference compare）的共享入口 */
const activateReferenceCompare = () => {
  if (!referenceUrls.value.length) return
  if (compareSource.value !== 'none' && compareSource.value !== 'reference') return
  compareSource.value = 'reference'
  compareMode.value = true
  compareType.value = 'overlay'
  comparePercent.value = 50
  compareRefIndex.value = 0
}

/**
 * 按需激活对比：若单图已加载（舞台尺寸稳定）则立即激活，否则延迟到 onImageLoad
 */
const tryActivateCompare = () => {
  if (!referenceUrls.value.length) return
  if (compareSource.value !== 'none') return
  if (imageSize.value) {
    nextTick(() => activateReferenceCompare())
    return
  }
  pendingCompareActivation.value = true
}

const enableCompare = (type: 'split' | 'overlay') => {
  if (compareSource.value === 'none') {
    if (referenceUrls.value.length) {
      compareSource.value = 'reference'
      compareRefIndex.value = 0
    } else if (browseMode.value === 'compare' && hasHistoryCompare.value) {
      compareSource.value = 'history'
    }
  }
  singleCompareMode.value = true
  compareMode.value = true
  compareType.value = type
  if (type === 'overlay') comparePercent.value = 50
}

const disableCompare = () => {
  singleCompareMode.value = false
  compareMode.value = false
  compareSource.value = 'none'
}

// 工具栏"对比模式"开关的 @change：v-model 已经同步了 singleCompareMode，
// 这里只需要在 360 / 视频等场景下兜底关闭对比
const onSingleCompareToggleChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (!checked) {
    compareMode.value = false
    if (compareSource.value === 'reference') compareSource.value = 'none'
  }
}

const toggle360Mode = () => {
  is360Mode.value = !is360Mode.value
  if (is360Mode.value) {
    disableCompare()
  }
}

watch(is360Mode, (enabled) => {
  if (enabled) {
    disableCompare()
  }
})

const close = () => {
  visible.value = false
  emit('close')
}

const prevImage = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    imageSize.value = null
    resetView()
    emit('navigate', currentIndex.value)
  }
}

const nextImage = () => {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
    imageSize.value = null
    resetView()
    emit('navigate', currentIndex.value)
  }
}

const goToImage = (index: number) => {
  currentIndex.value = index
  imageSize.value = null
  resetView()
  emit('navigate', index)
}

const handleSidebarResize = (event: MouseEvent) => {
  if (!isResizingSidebar.value) return
  const delta = event.clientX - sidebarResizeStartX.value
  const nextWidth = sidebarResizeStartWidth.value + delta
  singleSidebarWidth.value = Math.max(SINGLE_SIDEBAR_MIN_WIDTH, Math.min(SINGLE_SIDEBAR_MAX_WIDTH, nextWidth))
}

const stopSidebarResize = () => {
  if (!isResizingSidebar.value) return
  isResizingSidebar.value = false
  document.removeEventListener('mousemove', handleSidebarResize)
  document.removeEventListener('mouseup', stopSidebarResize)
}

const startSidebarResize = (event: MouseEvent) => {
  if (browseMode.value !== 'single') return
  isResizingSidebar.value = true
  sidebarResizeStartX.value = event.clientX
  sidebarResizeStartWidth.value = historySidebarRef.value?.offsetWidth || singleSidebarWidth.value
  document.addEventListener('mousemove', handleSidebarResize)
  document.addEventListener('mouseup', stopSidebarResize)
}

const resolveCurrentHistoryItemId = () => {
  if (props.recordId !== undefined && props.recordId !== null) return props.recordId
  const current = currentImage.value
  if (!current) return historyItemsToRender.value[0]?.id ?? null
  const matched = historyItemsToRender.value.find((item) => item.source === current || item.thumbnail === current)
  return matched?.id ?? historyItemsToRender.value[props.initialIndex]?.id ?? historyItemsToRender.value[0]?.id ?? null
}

const initCompareSelections = () => {
  if (!historyItemsToRender.value.length) return
  const currentId = resolveCurrentHistoryItemId()
  if (compareSelectionA.value != null) {
    const hasA = historyItemsToRender.value.some(item => String(item.id) === String(compareSelectionA.value))
    if (!hasA) compareSelectionA.value = null
  }
  if (compareSelectionB.value != null) {
    const hasB = historyItemsToRender.value.some(item => String(item.id) === String(compareSelectionB.value))
    if (!hasB) compareSelectionB.value = null
  }
  if (browseMode.value === 'single') {
    compareSelectionA.value = currentId
    compareSelectionB.value = null
    if (compareSource.value !== 'reference') {
      compareSource.value = 'none'
      compareMode.value = false
    }
  } else if (compareSelectionA.value == null) {
    compareSelectionA.value = currentId
  }
}

const selectCompareItem = (slot: 'A' | 'B', item: HistoryItem, index: number) => {
  if (isCompareItemDisabled(slot, item)) return
  if (slot === 'A') {
    compareSelectionA.value = compareSelectionA.value === item.id ? null : item.id
  } else {
    compareSelectionB.value = compareSelectionB.value === item.id ? null : item.id
  }
  if (!assetStore.items.length) {
    goToImage(index)
  }
  const canHistoryCompare = !!compareSelectionA.value && !!compareSelectionB.value &&
    compareItemA.value && compareItemB.value &&
    (compareItemA.value?.source || compareItemA.value?.thumbnail) !== (compareItemB.value?.source || compareItemB.value?.thumbnail)
  if (browseMode.value === 'compare' && canHistoryCompare) {
    compareSource.value = 'history'
    compareMode.value = true
  } else if (compareSource.value === 'reference') {
    // keep reference compare alive
  } else {
    compareSource.value = 'none'
    compareMode.value = false
  }
}

const setBrowseMode = (mode: 'single' | 'compare') => {
  browseMode.value = mode
  if (mode === 'single') {
    compareSelectionA.value = compareSelectionB.value ?? compareSelectionA.value ?? resolveCurrentHistoryItemId()
    compareSelectionB.value = null
    if (compareSource.value !== 'reference') {
      compareSource.value = 'none'
      compareMode.value = false
    }
    singleCompareMode.value = compareSource.value === 'reference'
    nextTick(() => {
      scrollSelectedHistoryCardIntoView()
    })
  } else if (compareSelectionA.value && compareSelectionB.value && compareItemA.value && compareItemB.value) {
    compareSource.value = 'history'
    compareMode.value = true
  }
}

const scrollSelectedHistoryCardIntoView = () => {
  const container = compareColARef.value
  const selectedId = compareSelectionA.value
  if (!container || selectedId == null) return
  const target = container.querySelector(`[data-history-id="${String(selectedId)}"]`) as HTMLElement | null
  target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

const alignCompareColumns = () => {
  if (!compareColARef.value || !compareColBRef.value) return
  const source = compareColARef.value
  const target = compareColBRef.value
  const maxSource = Math.max(source.scrollHeight - source.clientHeight, 1)
  const maxTarget = Math.max(target.scrollHeight - target.clientHeight, 0)
  const ratio = source.scrollTop / maxSource
  target.scrollTop = ratio * maxTarget
}

const handleCompareColumnScroll = async (event: Event) => {
  const target = event.target as HTMLElement | null
  if (!target || !assetStore.items.length) return
  const threshold = 180
  const remaining = target.scrollHeight - target.scrollTop - target.clientHeight
  if (remaining <= threshold && assetStore.hasMore && !assetStore.loadingMore) {
    await assetStore.loadMore()
  }
}

const isCompareItemDisabled = (slot: 'A' | 'B', item: HistoryItem) => {
  if (slot === 'A') {
    return compareSelectionB.value !== null && String(compareSelectionB.value) === String(item.id)
  }
  return compareSelectionA.value !== null && String(compareSelectionA.value) === String(item.id)
}

const getCompareCardStyle = (item: HistoryItem) => {
  return {}
}

const buildCompareSummary = (detail: any) => {
  if (!detail) {
    return { prompt: '未选择', referenceUrls: [] as string[], params: [] as any[] }
  }
  return {
    prompt: detail.prompt || '无提示词',
    referenceUrls: getReferenceUrls(detail),
    params: getVisibleAssetParams(detail),
  }
}

const formatCompareParamValue = (value: any) => {
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  return raw.length > 24 ? `${raw.slice(0, 21)}...` : raw
}

const buildPanelInfo = (detail: any) => {
  if (!detail) return null
  return {
    prompt: detail.prompt || '',
    model: detail.model || detail.modelInfo || '',
    modelDisplayName: detail.model_display_name || detail.modelDisplayName || detail.model || detail.modelInfo || '',
    modelVendor: (() => {
      const v = detail.vendor || detail.modelVendor
      return v ? (typeof v === 'string' ? v : v.id || v.name || '') : ''
    })(),
    createTime: detail.created_at || detail.date || '',
    vendor: detail.vendor || '',
    referenceUrls: getReferenceUrls(detail),
    paramsDisplay: detail.params_display || [],
    generateParams: detail.param || null,
    originUrl: detail._asset?.media?.[0]?.origin_url || detail.media?.[0]?.origin_url || detail.url?.origin_url || '',
  }
}

// --- Zoom & Pan ---
const handleWheel = (e: WheelEvent) => {
  const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED
  let newScale = scale.value * (1 + delta)
  newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
  scale.value = newScale
}

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return
  isDragging.value = true
  startX.value = e.clientX - translateX.value
  startY.value = e.clientY - translateY.value
}

const updateComparePercent = (e: MouseEvent) => {
  if (!imgWrapperRef.value) return
  const rect = imgWrapperRef.value.getBoundingClientRect()
  comparePercent.value = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
}

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) {
    translateX.value = e.clientX - startX.value
    translateY.value = e.clientY - startY.value
    return
  }
  // Overlay mode: divider tracks mouse relative to image wrapper (accounts for zoom/pan)
  if (compareMode.value && compareType.value === 'overlay' && hasCompare.value && imgWrapperRef.value) {
    updateComparePercent(e)
  }
}

const handleMouseUp = () => {
  isDragging.value = false
}

const zoomIn = () => scale.value = Math.min(MAX_SCALE, scale.value + 0.25)
const zoomOut = () => scale.value = Math.max(MIN_SCALE, scale.value - 0.25)
const resetView = () => {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

const handleFullscreenChange = () => {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    try {
      const target = activePanelIsVideo.value
        ? videoRef.value
        : (modalRef.value || document.documentElement)
      await target?.requestFullscreen()
    } catch (err) {
      console.error(`Error attempting to enable fullscreen: ${err}`)
    }
  } else {
    if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }
  isFullscreen.value = Boolean(document.fullscreenElement)
}

// --- Action Handlers ---
const handleRegenerate = () => {
  isRegenerating.value = true
  showToast('正在重新生成...', Loader2, 'text-indigo-400 animate-spin')
  emit('regenerate', displayImage.value || currentImage.value, currentIndex.value)
}

const handleReEdit = () => {
  isReEditing.value = true
  showToast('正在进入编辑模式...', Loader2, 'text-indigo-400 animate-spin')
  emit('reEdit', displayImage.value || currentImage.value, currentIndex.value)
  // Demo: auto reset after delay
  setTimeout(() => {
    isReEditing.value = false
    showToast('已进入编辑模式', Edit3, 'text-white')
  }, 1500)
}

const triggerTool = (tool: string) => {
  const messages: Record<string, string> = {
    upscale: '正在进行智能超清处理...',
    enhance: '正在修复图像细节...',
    expand: '正在准备扩图画布...',
    inpaint: '请在画面上涂抹需要重绘的区域',
    erase: '请涂抹需要消除的物体'
  }
  showToast(messages[tool] || '处理中...', Loader2, 'text-indigo-400 animate-spin')
  emit('toolAction', tool, displayImage.value || currentImage.value)
}

const triggerWorkflow = (action: string) => {
  const messages: Record<string, string> = {
    video: '正在转换至视频生成模式...',
    canvas: '正在进入画布编辑模式...'
  }
  showToast(messages[action] || '处理中...', Loader2, 'text-indigo-400 animate-spin')
  emit('workflowAction', action, displayImage.value || currentImage.value)
}

const handleCopyPrompt = async () => {
  if (props.imageInfo?.prompt) {
    try {
      const text = props.imageInfo.prompt
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      promptCopied.value = true
      showToast('提示词已复制到剪贴板', CheckCircle2, 'text-emerald-400')
      setTimeout(() => promptCopied.value = false, 2000)
    } catch (err) {
      showToast('复制失败', X, 'text-red-400')
    }
  }
}

function resolveFavoriteRecordId(recordId?: string | number): string | number {
  return recordId || activePanelRecordId.value || props.recordId || ''
}

const handleFavorite = (recordId?: string | number) => {
  const resolvedRecordId = resolveFavoriteRecordId(recordId)
  if (!resolvedRecordId) {
    showToast('缺少记录ID，无法收藏', X, 'text-red-400')
    return
  }
  emit('favorite', resolvedRecordId)
  showToast(props.isFavorited ? '已取消收藏' : '已添加收藏', Heart, props.isFavorited ? 'text-zinc-400' : 'text-rose-500')
}

const handleShare = () => {
  emit('share', displayImage.value || currentImage.value)
  showToast('分享链接已复制', Share2, 'text-blue-400')
}

const handleDelete = () => {
  if (props.recordId !== undefined) {
    emit('delete', props.recordId)
    close()
  }
}

const downloadImage = async () => {
  const targetImage = displayImage.value || currentImage.value
  if (!targetImage) return
  try {
    await downloadMedia(targetImage)
  } catch {
    window.open(targetImage, '_blank')
  }
  emit('download', targetImage)
}

const handleCopy = async () => {
  const url = displayImage.value || currentImage.value
  if (!url) return

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('图片链接已复制', Copy, 'text-blue-400')
  } catch {
    showToast('复制失败', X, 'text-red-400')
  }

  emit('copy', url)
}

// --- Image Load ---
const onImageLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  imageSize.value = { width: img.naturalWidth, height: img.naturalHeight }
  if (pendingCompareActivation.value) {
    pendingCompareActivation.value = false
    nextTick(() => activateReferenceCompare())
  }
}

const onVideoLoad = (e: Event) => {
  const video = e.target as HTMLVideoElement
  imageSize.value = { width: video.videoWidth, height: video.videoHeight }
  videoDuration.value = video.duration
}

// --- Video Playback Controls (native <video>) ---
const videoRef = ref<HTMLVideoElement | null>(null)
const videoPlaying = ref(false)
const videoUnsupported = ref(false)
const videoCurrentTime = ref(0)
const videoDuration = ref(0)
const videoVolume = ref(1)
const videoMuted = ref(false)
const videoPlaybackRate = ref(1)
const videoFPS = 30

const videoCurrentFrame = computed(() => Math.round(videoCurrentTime.value * videoFPS))
const videoTotalFrames = computed(() => Math.round(videoDuration.value * videoFPS))

let videoTimeRAF = 0
const onVideoTimeUpdate = () => {
  if (videoTimeRAF) return
  videoTimeRAF = requestAnimationFrame(() => {
    videoTimeRAF = 0
    if (videoRef.value) videoCurrentTime.value = videoRef.value.currentTime
  })
}

const onVideoVolumeChange = () => {
  if (!videoRef.value) return
  videoVolume.value = videoRef.value.volume
  videoMuted.value = videoRef.value.muted
}

const onVideoError = () => {
  videoUnsupported.value = true
  videoPlaying.value = false
}

const toggleVideoPlayPause = () => {
  if (!videoRef.value || videoUnsupported.value) return
  try {
    videoRef.value.paused ? videoRef.value.play() : videoRef.value.pause()
  } catch {
    videoUnsupported.value = true
  }
}

const seekVideoFrame = (direction: number) => {
  if (!videoRef.value) return
  videoRef.value.currentTime = Math.max(0, Math.min(videoDuration.value, videoRef.value.currentTime + direction / videoFPS))
  videoRef.value.pause()
}

const onVideoSeek = (e: Event) => {
  if (!videoRef.value) return
  videoRef.value.currentTime = parseFloat((e.target as HTMLInputElement).value)
}

const onVideoVolumeInput = () => {
  if (videoRef.value) videoRef.value.volume = videoVolume.value
}

const onVideoMutedChange = () => {
  if (videoRef.value) videoRef.value.muted = videoMuted.value
}

const onVideoSpeedChange = (rate: number) => {
  videoPlaybackRate.value = rate
  if (videoRef.value) videoRef.value.playbackRate = rate
}

const formatVideoDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// --- Keyboard Navigation ---
const handleKeydown = (e: KeyboardEvent) => {
  if (!visible.value) return

  switch (e.key) {
    case 'ArrowLeft':
      prevImage()
      break
    case 'ArrowRight':
      nextImage()
      break
    case 'Escape':
      close()
      break
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
      zoomOut()
      break
    case '0':
      resetView()
      break
  }
}

// --- Expose methods for external control ---
defineExpose({
  showToast,
  setIsRegenerating: (val: boolean) => { isRegenerating.value = val },
  setIsReEditing: (val: boolean) => { isReEditing.value = val }
})
</script>

<style scoped>
.back-gallery-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 6px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  user-select: none;
  transition: background 0.15s, color 0.15s;
  z-index: 100;
}
.back-gallery-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 8px;
  z-index: 1;
}
.back-gallery-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f4f4f5;
}
.back-gallery-btn kbd {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 11px;
  font-family: inherit;
  font-weight: 400;
  color: #71717a;
  line-height: 1.6;
}

/* Modal Animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from img,
.modal-leave-to img {
  transform: scale(0.9);
}

/* Toast Animation */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}

/* Slide Panel Animation */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.25s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
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

/* Toolbar */
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #a1a1aa;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.toolbar-btn:hover {
  color: #f4f4f5;
  background: rgba(255, 255, 255, 0.07);
}

.toolbar-btn:active {
  transform: scale(0.9);
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 2px;
  flex-shrink: 0;
}

.toolbar-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: #e4e4e7;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.toolbar-action-btn:active {
  transform: scale(0.95);
}

.toolbar-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.toolbar-btn-active {
  color: #818cf8;
  background: rgba(129, 140, 248, 0.12);
}
.toolbar-btn-active:hover {
  color: #a5b4fc;
  background: rgba(129, 140, 248, 0.18);
}

/* Compare Mode */
.compare-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 6;
}

.compare-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.5), 0 0 4px rgba(255, 255, 255, 0.2);
}

.compare-handle {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(24, 24, 27, 0.92);
  border: 2px solid rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
}

.compare-label {
  position: absolute;
  top: 16px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.compare-label-left {
  right: 12px;
}

.compare-label-right {
  left: 12px;
}

/* Split Mode (side-by-side, inside transform container) */
.compare-split-wrapper {
  display: flex;
  align-items: center;
  gap: 0;
  height: 70vh;
  max-width: 90vw;
}

.compare-split-pane {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  overflow: hidden;
}

.compare-split-label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
}

.compare-split-img {
  height: 100%;
  width: auto;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.4);
}

.compare-split-divider {
  width: 2px;
  height: 60%;
  margin: 0 12px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

/* Reference image switcher (thumbnails bar) */
.compare-ref-switcher {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 20;
  display: flex;
  gap: 6px;
  padding: 6px;
  background: rgba(24, 24, 27, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  pointer-events: auto;
}

.compare-ref-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  flex-shrink: 0;
}

.compare-ref-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.compare-ref-thumb:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.compare-ref-thumb.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.history-side-column {
  width: 268px;
  flex-shrink: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  background: #18181b;
  padding: 12px 8px;
}

.history-side-column.single-mode {
  width: 196px;
}

.history-side-column.compare-mode {
  width: 268px;
}

.history-side-header {
  margin-bottom: 10px;
}

.history-side-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.history-side-mode-switch {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.history-mode-btn {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #a1a1aa;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.history-mode-btn.active {
  color: #f4f4f5;
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(59, 130, 246, 0.38);
}

.history-side-title {
  font-size: 12px;
  font-weight: 600;
  color: #71717a;
  letter-spacing: 0.02em;
}

.history-side-title.single-mode {
  color: #60a5fa;
}

.history-side-title.compare-mode {
  color: #f59e0b;
}

.history-side-caption {
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  color: #52525b;
}

.history-side-caption-compare {
  justify-content: flex-start;
}

.history-side-caption-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.history-side-resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
}

.history-side-resize-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
  width: 2px;
  height: 48px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.15s ease;
}

.history-side-resize-handle:hover::before {
  background: rgba(96, 165, 250, 0.6);
}

.compare-picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-height: 0;
  flex: 1;
}

.compare-picker-grid.single-mode {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.compare-align-btn {
  border: 1px solid rgba(59, 130, 246, 0.32);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.16));
  color: #dbeafe;
  border-radius: 999px;
  padding: 5px 11px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.16);
}

.compare-align-btn:hover {
  color: #eff6ff;
  border-color: rgba(96, 165, 250, 0.52);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.28), rgba(37, 99, 235, 0.22));
  box-shadow: 0 8px 22px rgba(37, 99, 235, 0.24);
}

.compare-summary-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  user-select: none;
  color: #a1a1aa;
}

.compare-summary-toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.compare-summary-toggle-track {
  position: relative;
  width: 30px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.18s ease;
  flex-shrink: 0;
}

.compare-summary-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f4f4f5;
  transition: transform 0.18s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
}

.compare-summary-toggle-input:checked + .compare-summary-toggle-track {
  background: rgba(59, 130, 246, 0.72);
}

.compare-summary-toggle-input:checked + .compare-summary-toggle-track .compare-summary-toggle-thumb {
  transform: translateX(12px);
}

.compare-summary-toggle-label {
  font-size: 11px;
  line-height: 1;
  color: #a1a1aa;
  white-space: nowrap;
}

/* Toolbar toggle (compact, for floating command bar) */
.toolbar-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  color: #a1a1aa;
}

.toolbar-toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toolbar-toggle-track {
  position: relative;
  width: 26px;
  height: 15px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.18s ease;
  flex-shrink: 0;
}

.toolbar-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #f4f4f5;
  transition: transform 0.18s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}

.toolbar-toggle-input:checked + .toolbar-toggle-track {
  background: rgba(59, 130, 246, 0.72);
}

.toolbar-toggle-input:checked + .toolbar-toggle-track .toolbar-toggle-thumb {
  transform: translateX(11px);
}

.toolbar-toggle-label {
  font-size: 11px;
  line-height: 1;
  color: #a1a1aa;
  white-space: nowrap;
}

.toolbar-toggle:hover .toolbar-toggle-label {
  color: #d4d4d8;
}

.compare-picker-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.compare-picker-grid.single-mode .compare-picker-col {
  flex: 1;
}

.compare-picker-col-scroll {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-right: 2px;
}

.compare-picker-col-scroll .history-side-card.compact {
  width: 104px;
  height: 112px;
  flex: 0 0 auto;
}

.compare-picker-grid.single-mode .history-side-card.compact {
  margin: 0;
}

.compare-summary-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 14px 20px 10px;
  background: rgba(0, 0, 0, 0.16);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-width: 0;
  overflow: hidden;
}

.compare-summary-col {
  min-width: 0;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(18, 18, 22, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compare-summary-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.88fr);
  gap: 14px;
  align-items: stretch;
  height: 100%;
  min-width: 0;
  overflow: hidden;
}

.compare-summary-main {
  min-width: 0;
  display: flex;
  min-height: 0;
}

.compare-summary-side {
  display: grid;
  grid-template-rows: auto auto;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
}

.compare-summary-col-a {
  border-color: rgba(96, 165, 250, 0.22);
}

.compare-summary-col-b {
  border-color: rgba(244, 114, 182, 0.2);
}

.compare-summary-prompt {
  font-size: 13px;
  line-height: 1.55;
  color: #f4f4f5;
  flex: 1;
  min-height: 0;
  height: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.compare-summary-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.compare-summary-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.compare-summary-ref {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.compare-summary-params {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.compare-summary-param {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: #d4d4d8;
  font-size: 11px;
}

.compare-summary-param-key {
  color: #71717a;
  flex-shrink: 0;
  white-space: nowrap;
}

.compare-summary-param-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-summary-empty {
  font-size: 12px;
  color: #71717a;
}

@media (max-width: 1320px) {
  .compare-summary-panel {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
}

@media (max-width: 1080px) {
  .compare-summary-content {
    grid-template-columns: minmax(0, 1fr);
  }
}

.preview-surface {
  min-height: 0;
}

.record-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  background: rgba(24, 24, 27, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #d4d4d8;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}
.record-nav-btn:hover:not(:disabled) {
  background: rgba(39, 39, 42, 0.95);
  color: #fafafa;
}
.record-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.record-nav-left {
  left: 16px;
}
.record-nav-right {
  right: 16px;
}

.history-side-card {
  width: 100%;
  padding: 0;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  text-align: left;
  background: #202024;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}

.history-side-card.compact {
  border-radius: 8px;
  background: #111114;
}

.history-side-card:hover {
  border-color: rgba(99, 102, 241, 0.45);
  background: #24242a;
  transform: translateY(-1px);
}

.history-side-card.active {
  border-color: rgba(59, 130, 246, 0.98);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4), 0 12px 28px rgba(37, 99, 235, 0.25);
  background: #2a2f3f;
  transform: translateY(-1px);
}

.history-side-card.disabled {
  cursor: not-allowed;
  opacity: 0.42;
  filter: grayscale(0.3);
}

.history-side-card.disabled:hover {
  border-color: rgba(255, 255, 255, 0.08);
  background: #202024;
  transform: none;
}

.history-side-card-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.history-side-card-image.compact {
  width: 100%;
  height: 100%;
}

.history-side-card-model {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.18), transparent 42%),
    linear-gradient(180deg, rgba(24, 24, 27, 0.96), rgba(15, 23, 42, 0.92));
  color: #d4d4d8;
}

.history-side-card-model.compact {
  border-radius: 8px;
}

.history-side-card-model-badge {
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(96, 165, 250, 0.38);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.history-side-card-model-label {
  font-size: 12px;
  color: #a1a1aa;
  text-align: center;
  line-height: 1.4;
}

.history-side-card-model-badge-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 24px;
  height: 16px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.7);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  pointer-events: none;
}

.history-side-card-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 12, 14, 0.58);
  color: rgba(255, 255, 255, 0.92);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.04em;
  pointer-events: none;
}


.history-side-card-subtitle {
  margin-top: 3px;
  font-size: 10px;
  color: #71717a;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Video Preview Controls */
.video-preview-wrapper {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.video-preview-el {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  outline: none;
}

.video-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
  height: 100%;
  min-height: 200px;
}
.video-unsupported-text {
  color: var(--text-muted);
  font-size: 14px;
  margin: 0;
}
.video-download-btn {
  padding: 8px 20px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  text-decoration: none;
  transition: opacity 0.15s;
}
.video-download-btn:hover {
  opacity: 0.85;
}

.video-preview-controls {
  flex-shrink: 0;
  background: #0e0e0f;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding: 10px 14px;
}

.video-progress-wrap {
  margin-bottom: 8px;
}

.video-progress-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
  outline: none;
  cursor: pointer;
}

.video-progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
}

.video-progress-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
}

.video-ctrl-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.video-ctrl-left,
.video-ctrl-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.video-ctrl-right {
  gap: 6px;
}

.video-ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #d4d4d8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.video-ctrl-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.video-ctrl-btn:active { transform: scale(0.9); }
.video-ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.video-ctrl-btn svg { width: 16px; height: 16px; }

.video-play-btn { width: 32px; height: 32px; }
.video-play-btn svg { width: 18px; height: 18px; }

.video-time-display {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: #a1a1aa;
  margin-left: 6px;
  white-space: nowrap;
  user-select: none;
}

.video-volume-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.video-volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 60px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  cursor: pointer;
}

.video-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
}

.video-volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
}

.video-volume-val {
  font-size: 10px;
  color: #71717a;
  min-width: 24px;
  text-align: center;
  user-select: none;
}

.video-mute-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #d4d4d8;
  cursor: pointer;
  transition: all 0.15s;
}

.video-mute-toggle:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.video-mute-input { display: none; }

.video-speed-select {
  background: rgba(255, 255, 255, 0.08);
  color: #d4d4d8;
  border: none;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
  cursor: pointer;
  outline: none;
}

.video-speed-select:hover { background: rgba(255, 255, 255, 0.14); }
.video-speed-select option { background: #27272a; color: #d4d4d8; }

</style>




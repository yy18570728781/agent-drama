<template>
  <div ref="overlayRef" class="ref-edit-overlay">
    <div class="ref-edit-modal" @click.stop tabindex="0">
      <!-- 顶部标题栏 -->
      <div class="ref-edit-header">
        <div class="ref-edit-title">
          <Image :size="16" />
          <span>图片编辑器</span>
          <span class="ref-edit-index">{{ currentIndex + 1 }} / {{ totalCount }}</span>
        </div>
        <div class="ref-edit-nav">
          <button class="ref-edit-nav-btn" :disabled="currentIndex === 0" @click="$emit('prev')">‹</button>
          <button class="ref-edit-nav-btn" :disabled="currentIndex >= totalCount - 1" @click="$emit('next')">›</button>
        </div>
        <button class="ref-edit-close" @click="handleClose"><X :size="18" /></button>
      </div>

      <div class="ref-edit-body">
        <div class="ref-edit-content-wrapper">
          <!-- 左侧竖向工具栏 -->
          <div class="draw-toolbar-vertical">
            <div class="draw-toolbar-tools">
              <button v-for="t in drawTools" :key="t.id"
                class="draw-tool-btn" :class="{ active: drawTool === t.id }"
                :title="t.label + ' (' + t.shortcut + ')'" @click="setDrawTool(t.id)">
                <component :is="t.icon" :size="13" />
              </button>
              <div class="draw-tool-sep-v" />
              <button class="draw-tool-btn" title="撤销 (Ctrl+Z)" :disabled="!drawHistory || drawHistory.length === 0" @click="drawUndo"><Undo2 :size="13" /></button>
              <button class="draw-tool-btn" title="重做 (Ctrl+Y)" :disabled="!drawFuture || drawFuture.length === 0" @click="drawRedo"><Redo2 :size="13" /></button>
            </div>
          </div>

          <!-- 画布区 -->
          <div class="ref-edit-preview-area">
            <div v-if="drawTool === 'compress'" class="ref-edit-compare-shell">
              <div class="ref-edit-compare-head">
                <div class="ref-edit-compare-title">压缩对比</div>
                <div class="ref-edit-compare-sub">右侧处理后，直接在这里拖动查看原图和压缩结果差异。</div>
              </div>
              <div class="ref-edit-compare-stage">
                <MediaCompareStage
                  v-if="compressSelectedRow?.processedPreviewUrl"
                  :images="[compressSelectedRow.previewUrl, compressSelectedRow.processedPreviewUrl]"
                  :current-index="1"
                  :display-image="compressSelectedRow.processedPreviewUrl"
                  :compare-mode="true"
                  compare-type="overlay"
                  :has-compare="true"
                  :compare-left-image="compressSelectedRow.previewUrl"
                  :compare-right-image="compressSelectedRow.processedPreviewUrl"
                  compare-left-label="原图"
                  compare-right-label="压后"
                />
                <div v-else class="ref-edit-compare-empty">
                  <img :src="compressSelectedRow?.previewUrl || imageUrl" alt="" class="ref-edit-compare-original" draggable="false" />
                </div>
              </div>
            </div>
            <!-- canvas 画布 + 缩放容器 -->
            <div
              v-show="drawTool !== 'compress'"
              v-loading="editorImageLoading"
              element-loading-text="加载中"
              class="ref-edit-canvas-wrap"
              :style="{ cursor: canvasCursor }"
              @wheel="onCanvasWheel"
              @pointerdown="onCanvasWrapMouseDown"
              @pointerleave="onCanvasWrapMouseLeave">
              <div v-if="drawTool === 'pencil' || drawTool === 'eraser'"
                   class="brush-cursor-indicator" :style="brushCursorStyle" />
              <div class="ref-canvas-zoom-layer" :style="canvasZoomStyle">
                <canvas ref="editCanvasRef" class="ref-edit-canvas" />
                <!-- 绘制层（承载 DrawElement 对象） -->
                <canvas ref="drawLayerRef" class="ref-edit-canvas ref-edit-draw-layer" />
                <!-- overlay 交互层 -->
                <canvas ref="overlayCanvasRef" class="ref-edit-canvas ref-edit-canvas-overlay" />
                <!-- 光标层（接收所有鼠标事件） -->
                <canvas ref="cursorCanvasRef" class="ref-edit-canvas ref-edit-cursor-layer"
                  @pointerdown="onCanvasMouseDown"
                  @pointermove="onCanvasMouseMove"
                  @pointerup="onCanvasMouseUp"
                  @pointerleave="onCanvasMouseLeave" />
                <!-- 文字输入浮层 -->
                <div v-if="textInput && textInput.visible" class="draw-text-input-wrap" :class="{ 'no-background': !textShowBackground }"
                  :style="{
                    left: (textInput?.x || 0) + 'px',
                    top: (textInput?.y || 0) + 'px',
                    width: (textInput?.width || 120) + 'px',
                    height: (textInput?.height || 40) + 'px',
                    backgroundColor: textShowBackground ? (textInput?.backgroundColor || 'rgba(99, 102, 241, 0.85)') : 'transparent',
                  }">
                      <div ref="textInputRef" class="draw-text-input" contenteditable="plaintext-only"
                    :style="{
                      color: textInput.color,
                      fontSize: (textInput?.fontSize || 24) + 'px',
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'transparent',
                    }"
                    @keydown="onTextKeyDown"
                    @input="onTextInputInput"
                    @mousedown.stop @click.stop />
                  <span
                    v-for="corner in (['tl','tr','bl','br'] as const)"
                    :key="corner"
                    class="draw-text-resize-handle draw-text-handle-drag"
                    :data-corner="corner"
                    title="拖拽调整文字大小"
                    @pointerdown.stop.prevent="onCornerPointerDown($event, corner)" />
                  <span
                    v-for="edge in (['top','right','bottom','left'] as const)"
                    :key="'edge-'+edge"
                    class="draw-text-resize-handle draw-text-handle-edge"
                    :data-edge="edge"
                    title="拖拽移动文字位置"
                    @pointerdown.stop.prevent="onEdgePointerDown($event)" />
                  <span
                    class="draw-text-resize-handle draw-text-handle-delete"
                    data-corner="tr"
                    title="删除文字"
                    @mousedown.stop @click.stop="cancelText" />
                </div>
                <!-- 选中文字元素时显示的操作工具栏 -->
                <div v-if="selectedTextToolbarStyle" class="draw-text-selection-toolbar"
                  :style="selectedTextToolbarStyle"
                  @mousedown.stop @click.stop>
                  <span
                    v-for="c in TEXT_BG_PRESETS"
                    :key="'sel-' + c"
                    class="text-bg-swatch"
                    :style="{ backgroundColor: c }"
                    @click="setActiveTextBgColor(c)" />
                  <button class="selection-toolbar-btn" title="编辑文字" @click.stop="editActiveTextElement">
                    <Pencil :size="13" />
                  </button>
                  <button class="selection-toolbar-btn danger" title="删除" @click.stop="deleteActiveTextElement">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="editImageInfo && editImageInfo.width" class="ref-edit-info">
              {{ editImageInfo?.width || 0 }} × {{ editImageInfo?.height || 0 }} px
              <span style="margin-left:8px;color:#a1a1aa">{{ editFileSizeText }}</span>
              <span v-if="drawTool === 'crop' && cropRect && cropRect.w > 0" style="margin-left:8px;color:#6366f1">
                选区 {{ Math.round(cropRect?.w || 0) }} × {{ Math.round(cropRect?.h || 0) }}
              </span>
            </div>
          </div>

          <!-- 右侧工具栏 -->
          <div class="ref-edit-tools-container">
            <div
              v-if="!toolsCollapsed"
              class="ref-edit-tools-resize"
              :class="{ active: toolsResizeActive }"
              title="拖动调整工具栏宽度"
              @pointerdown="startToolsResize"
            />
            <button class="ref-edit-tools-toggle" @click="toolsCollapsed = !toolsCollapsed" :title="toolsCollapsed ? '展开面板' : '收起面板'">
              <component :is="toolsCollapsed ? ChevronLeft : ChevronRight" :size="14" />
            </button>
          <div class="ref-edit-tools" :class="{ collapsed: toolsCollapsed }" :style="toolsCollapsed ? undefined : { width: toolsWidth + 'px' }">
            <div class="ref-tool-group">
              <div class="ref-tool-group-title">变换</div>
              <div class="ref-tool-row">
                <button class="ref-tool-btn" @click="rotateImage(-90)"><RotateCcw :size="14" /><span>左转</span></button>
                <button class="ref-tool-btn" @click="rotateImage(90)"><RotateCw :size="14" /><span>右转</span></button>
              </div>
              <div class="ref-tool-row">
                <button class="ref-tool-btn" @click="flipImage('h')"><FlipHorizontal2 :size="14" /><span>水平</span></button>
                <button class="ref-tool-btn" @click="flipImage('v')"><FlipVertical2 :size="14" /><span>垂直</span></button>
              </div>
            </div>

            <div class="ref-tool-group">
              <div class="ref-tool-group-title">调色</div>
              <div class="ref-tool-slider-row">
                <Sun :size="12" class="ref-tool-icon" />
                <span class="ref-tool-label">亮度</span>
                <input type="range" min="-100" max="100" v-model.number="imgAdjust.brightness" class="ref-tool-range" @input="applyImageFilters" />
                <span class="ref-tool-val">{{ imgAdjust.brightness }}</span>
              </div>
              <div class="ref-tool-slider-row">
                <Contrast :size="12" class="ref-tool-icon" />
                <span class="ref-tool-label">对比</span>
                <input type="range" min="-100" max="100" v-model.number="imgAdjust.contrast" class="ref-tool-range" @input="applyImageFilters" />
                <span class="ref-tool-val">{{ imgAdjust.contrast }}</span>
              </div>
              <div class="ref-tool-slider-row">
                <Droplets :size="12" class="ref-tool-icon" />
                <span class="ref-tool-label">饱和</span>
                <input type="range" min="-100" max="100" v-model.number="imgAdjust.saturation" class="ref-tool-range" @input="applyImageFilters" />
                <span class="ref-tool-val">{{ imgAdjust.saturation }}</span>
              </div>
           </div>

            <div v-if="drawTool === 'text'" class="ref-tool-group">
              <div class="ref-tool-group-title">文字</div>
              <label class="ref-tool-checkbox-row">
                <input v-model="textShowBackground" type="checkbox" />
                <span>显示背景边框</span>
              </label>
              <div class="ref-tool-row ref-tool-row--wrap" style="gap:4px">
                <span class="ref-tool-label" style="width:100%">文字颜色</span>
                <span
                  v-for="c in TEXT_COLOR_PRESETS"
                  :key="c"
                  class="text-bg-swatch"
                  :class="{ active: textInput.color.includes(c.replace('#', '')) || textInput.color === c }"
                  :style="{ backgroundColor: c }"
                  @click="setTextColor(c)" />
                <span ref="textColorPickerEl" class="text-bg-pickr-btn" title="自定义文字颜色" />
              </div>
              <div class="ref-tool-slider-row">
                <Droplets :size="12" class="ref-tool-icon" />
                <span class="ref-tool-label">透明</span>
                <input type="range" min="10" max="100" v-model.number="textColorOpacity" class="ref-tool-range" />
                <span class="ref-tool-val">{{ textColorOpacity }}%</span>
              </div>
            </div>

            <div v-if="drawTool === 'text' && textShowBackground" class="ref-tool-group">
              <div class="ref-tool-group-title">背景</div>
              <div class="ref-tool-slider-row">
                <span class="ref-tool-label" style="width:100%">背景颜色</span>
              </div>
              <div class="ref-tool-row ref-tool-row--wrap" style="gap:4px">
                <span
                  v-for="c in TEXT_BG_PRESETS"
                  :key="c"
                  class="text-bg-swatch"
                  :class="{ active: textInput.backgroundColor.slice(0, textInput.backgroundColor.lastIndexOf(',') + 1) === c.slice(0, c.lastIndexOf(',') + 1) }"
                  :style="{ backgroundColor: c }"
                  @click="setTextBgColor(c)" />
                <span ref="textBgColorPickerEl" class="text-bg-pickr-btn" title="自定义背景色" />
              </div>
              <div class="ref-tool-slider-row">
                <Droplets :size="12" class="ref-tool-icon" />
                <span class="ref-tool-label">透明</span>
                <input type="range" min="10" max="100" v-model.number="textBgOpacity" class="ref-tool-range" />
                <span class="ref-tool-val">{{ textBgOpacity }}%</span>
              </div>
            </div>

            <div v-if="showBrushProps" class="ref-tool-group">
              <div class="ref-tool-group-title">设置</div>
              <div class="ref-tool-slider-row">
                <Pencil :size="12" class="ref-tool-icon" />
                <span class="ref-tool-label">大小</span>
                <input type="range" min="1" max="100" v-model.number="drawSize" class="ref-tool-range" />
                <span class="ref-tool-val">{{ drawSize }}</span>
              </div>
              <div class="ref-tool-slider-row">
                <Droplets :size="12" class="ref-tool-icon" />
                <span class="ref-tool-label">透明</span>
                <input type="range" min="10" max="100" v-model.number="drawOpacity" class="ref-tool-range" />
                <span class="ref-tool-val">{{ drawOpacity }}%</span>
              </div>
              <div class="ref-tool-slider-row">
                <span class="ref-tool-label" style="flex:1">压感</span>
                <button class="ref-pressure-toggle" :class="{ active: pressureEnabled }" @click="pressureEnabled = !pressureEnabled">
                  {{ pressureEnabled ? '开' : '关' }}
                </button>
              </div>
            </div>

            <div v-if="drawTool === 'crop'" class="ref-tool-group">
              <div class="ref-tool-group-title">裁剪</div>
              <!-- 比例约束预设 -->
              <div class="ref-tool-row ref-tool-row--wrap">
                <button v-for="r in cropRatios" :key="r.label"
                  class="ref-tool-chip" :class="{ active: activeCropRatio === r.label }"
                  @click="setCropRatio(r)">{{ r.label }}</button>
              </div>
              <!-- 选区尺寸 + 操作 -->
              <div v-if="cropRect.w > 0" style="font-size:10px;color:#a1a1aa;margin:2px 0">
                选区：{{ Math.round(cropRect.w) }} × {{ Math.round(cropRect.h) }} px
              </div>
              <div v-else style="font-size:10px;color:#52525b;margin:2px 0">在画布上拖拽选区</div>
              <button class="ref-tool-btn ref-tool-btn--wide" style="margin-top:2px"
                @click="cropRect = { x:0, y:0, w:0, h:0 }"
                :disabled="cropRect.w === 0">
                清除选区
              </button>
            </div>

            <ImageExpandPanel
              v-if="drawTool === 'expand'"
              :expand-drag="expandDrag"
              :expand-color="expandColor"
              :expand-ratio="expandRatio"
              :expand-ratios="expandRatios"
              :expand-info="expandInfo"
              :expand-summary="expandSummary"
              :can-apply-expand="canApplyExpand"
              :is-expand-ready="isExpandReady"
              :bind-expand-color-picker-el="bindExpandColorPickerEl"
              @set-inset="setExpandInset"
              @set-ratio="setExpandRatio"
              @reset="resetExpandDrag"
            />

            <div v-if="drawTool === 'split'" class="ref-tool-group">
              <div class="ref-tool-group-title">宫格拆分</div>
              <div class="ref-tool-row ref-tool-row--wrap">
                <button v-for="m in SPLIT_MODES" :key="m.key"
                  class="ref-tool-chip" :class="{ active: splitConfig?.rows === m.rows && splitConfig?.cols === m.cols }"
                  @click="setSplitMode(m)">{{ m.label }}</button>
              </div>
              <div class="ref-tool-row ref-split-custom">
                <input class="ref-split-input" type="number" :min="1" :max="maxSplitDimension"
                  v-model.number="customRows" @change="applyCustomSplitMode" />
                <span class="ref-split-x">×</span>
                <input class="ref-split-input" type="number" :min="1" :max="maxSplitDimension"
                  v-model.number="customCols" @change="applyCustomSplitMode" />
              </div>
              <div v-if="splitUploadProgress.active" class="ref-split-progress">
                <div class="ref-split-progress__text">{{ splitUploadProgress.message }}</div>
                <div class="ref-split-progress__track">
                  <div class="ref-split-progress__bar" :style="{ width: splitUploadProgress.percent + '%' }" />
                </div>
              </div>
              <div v-if="splitConfig" style="font-size:10px;color:#a1a1aa;margin:4px 0">
                拆分为 {{ splitConfig.rows * splitConfig.cols }} 张图片 · 拖动绿色分割线可微调
              </div>
              <div v-else style="font-size:10px;color:#52525b;margin:2px 0">选择拆分模式或输入行列</div>
            </div>

            <ImageCompressWorkbenchPanel
              v-if="drawTool === 'compress'"
              :oversize-count="0"
              :max-bytes="10485760"
              max-bytes-text="当前画布"
              :show-stats="false"
              :show-upload-more="false"
              :rows="compressRows"
              :selected-row-id="compressSelectedRowId"
              :process-mode="compressProcessMode"
              :show-mode-switch="compressShowModeSwitch"
              :target-width-input="compressTargetWidthInput"
              :target-height-input="compressTargetHeightInput"
              :quality="compressQuality"
              :lock-ratio="compressLockRatio"
              :active-ratio-label="compressActiveRatioLabel"
              :use-source-width="compressUseSourceWidth"
              :show-source-width-toggle="compressCurrentSourceWidth > 0"
              :show-target-height="!compressLockRatio"
              :ratio-presets="compressRatioPresets"
              :processing="compressProcessing"
              :process-disabled="compressProcessDisabled"
              :process-action-label="compressProcessActionLabel"
              @update:selected-row-id="setCompressSelectedRowId"
              @update:process-mode="setCompressProcessMode"
              @update:target-width-input="setCompressTargetWidthInput"
              @update:target-height-input="setCompressTargetHeightInput"
              @update:quality="setCompressQuality"
              @update:lock-ratio="setCompressLockRatio"
              @update:use-source-width="setCompressUseSourceWidth"
              @apply-ratio-preset="applyCompressRatioPreset"
              @process="processCompressRows"
            />

            <div class="ref-edit-actions">
              <button
                class="ref-action-btn ref-action-btn--primary"
                :draggable="Boolean(imageUrl)"
                title="拖到外部"
                @mouseenter="prepareEditedImageDragOut"
                @mousedown="prepareEditedImageDragOut"
                @dragstart.capture="handleEditedImageDragOutStart"
                @dragend.capture="handleEditedImageDragOutEnd"
              >
                <Download :size="14" />
                <span>拖到外部</span>
              </button>
              <button class="ref-action-btn ref-action-btn--secondary" @click="() => resetImageEdit()">重置</button>
              <button
                class="ref-action-btn ref-action-btn--primary"
                :class="{ 'ref-tool-btn--splitting': splitting || splitUploadProgress.active || compressProcessing }"
                :disabled="splitting || splitUploadProgress.active || compressProcessing || (drawTool === 'compress' && !canApplyCompression)"
                @click="applyImageEdit"
              >
                {{ splitting ? '正在拆分...' : (splitUploadProgress.active ? '正在上传...' : (compressProcessing ? '正在压缩...' : '应用')) }}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script lang="ts">
import { defineComponent, ref } from 'vue'
import {
  Image,
  X,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Sun,
  Contrast,
  Droplets,
  Download,
  Pencil,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Trash2,
} from '@/components/common/icon/lucide'
import ImageExpandPanel from './ImageExpandPanel.vue'
import ImageCompressWorkbenchPanel from '@/components/common/ImageCompressWorkbenchPanel.vue'
import MediaCompareStage from '@/components/common/MediaCompareStage.vue'
import { setupImageReferenceEditor } from './setupImageReferenceEditor'
import { useImageReferenceSidebarResize } from './useImageReferenceSidebarResize'
import { SPLIT_MODES } from '@/composables/flow/useImageSplit'

function createEditorFallbackState() {
  return {
    drawHistory: ref([]),
    drawFuture: ref([]),
    textInput: ref({ visible: false, x: 0, y: 0, value: '', canvasX: 0, canvasY: 0, fontSize: 24, width: 160, height: 60, backgroundColor: 'rgba(99, 102, 241, 0.85)', color: '#ff3b30', editingElementId: null }),
    editImageInfo: ref({ width: 0, height: 0 }),
    imgAdjust: ref({ brightness: 0, contrast: 0, saturation: 0 }),
    cropRect: ref({ x: 0, y: 0, w: 0, h: 0 }),
    expandDrag: ref({ top: 0, right: 0, bottom: 0, left: 0 }),
    expandColor: ref('#ffffff'),
    expandRatio: ref('自由'),
    expandRatios: [],
    expandInfo: ref({ width: 0, height: 0, originX: 0, originY: 0, sourceWidth: 0, sourceHeight: 0, hasPending: false }),
    expandSummary: ref(''),
    canApplyExpand: ref(false),
    splitConfig: ref(null),
    splitting: ref(false),
    splitUploadProgress: ref({ active: false, completed: 0, total: 0, percent: 0, message: '' }),
    splitHoverLine: ref(''),
    splitCursor: ref('default'),
    customRows: ref(2),
    customCols: ref(2),
    maxSplitDimension: 8,
    compressRows: ref([]),
    compressSelectedRow: ref(null),
    compressSelectedRowId: ref(''),
    compressProcessDisabled: ref(false),
    compressProcessMode: ref('single'),
    compressShowModeSwitch: ref(false),
    compressTargetWidthInput: ref('1920'),
    compressTargetHeightInput: ref('1080'),
    compressQuality: ref(92),
    compressLockRatio: ref(true),
    compressActiveRatioLabel: ref(''),
    compressUseSourceWidth: ref(false),
    compressRatioPresets: [],
    compressCurrentSourceWidth: ref(0),
    compressProcessing: ref(false),
    compressProcessActionLabel: ref('处理当前图'),
    canApplyCompression: ref(true),
    toolsWidth: ref(280),
    editorImageLoading: ref(false),
    toolsResizeActive: ref(false),
    startToolsResize: () => {},
    setCompressSelectedRowId: () => {},
    setCompressProcessMode: () => {},
    setCompressTargetWidthInput: () => {},
    setCompressTargetHeightInput: () => {},
    setCompressQuality: () => {},
    setCompressLockRatio: () => {},
    setCompressUseSourceWidth: () => {},
    applyCompressRatioPreset: () => {},
    processCompressRows: () => {},
    SPLIT_MODES,
    TEXT_BG_PRESETS: [],
    TEXT_COLOR_PRESETS: [],
    onTextKeyDown: () => {},
    autoFitHeight: () => {},
    onTextInputInput: () => {},
    onCornerPointerDown: () => {},
    onEdgePointerDown: () => {},
    textResizing: ref(false),
    textMoving: ref(false),
    textBgColorPickerEl: ref(null),
    textColorPickerEl: ref(null),
    setTextBgColor: () => {},
    setTextColor: () => {},
    selectedTextToolbarStyle: ref(null),
    deleteActiveTextElement: () => {},
    setActiveTextBgColor: () => {},
    editActiveTextElement: () => {},
    cancelText: () => {},
  }
}

function mergeDefinedState(
  fallbackState: ReturnType<typeof createEditorFallbackState>,
  state: Record<string, unknown> | undefined,
) {
  if (!state) return fallbackState
  const merged: Record<string, unknown> = { ...fallbackState }
  Object.entries(state).forEach(([key, value]) => {
    if (value !== undefined) merged[key] = value
  })
  return merged
}

function setupWithFallback(props: unknown, context: unknown): any {
  const fallbackState = createEditorFallbackState()
  const state = setupImageReferenceEditor(props, context as never) as Record<string, unknown> | undefined
  const resizeState = useImageReferenceSidebarResize() as Record<string, unknown>
  return mergeDefinedState(fallbackState, { ...resizeState, ...state })
}

export default defineComponent({
  name: 'ImageReferenceEditor',
  components: {
    Image,
    X,
    RotateCcw,
    RotateCw,
    FlipHorizontal2,
    FlipVertical2,
    Sun,
    Contrast,
    Droplets,
    Pencil,
    Undo2,
    Redo2,
    ChevronLeft,
    ChevronRight,
   LayoutGrid,
    Trash2,
   ImageExpandPanel,
    ImageCompressWorkbenchPanel,
    MediaCompareStage,
  },
  props: {
    imageUrl: { type: String, required: true },
    imageFile: { type: Object, required: true },
    currentIndex: { type: Number, required: true },
    totalCount: { type: Number, required: true },
  },
  emits: ['close', 'prev', 'next', 'apply', 'splitResult'],
  setup: setupWithFallback,
})
</script>

<style scoped src="./ImageReferenceEditor.css"></style>

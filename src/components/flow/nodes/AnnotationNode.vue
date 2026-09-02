<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { NodeResizer } from '@vue-flow/node-resizer'
import { useVueFlow } from '@vue-flow/core'
import '@vue-flow/node-resizer/dist/style.css'

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const textColorPresets = [
  '#f8fafc',
  '#fbbf24',
  '#38bdf8',
  '#4ade80',
  '#f472b6',
  '#f87171',
]

const backgroundColorPresets = inject('groupPresetColors', ref([
  'transparent',
  'rgba(39, 39, 42, 0.35)',
  'rgba(49, 46, 129, 0.35)',
  'rgba(6, 78, 59, 0.35)',
  'rgba(159, 18, 57, 0.35)',
  'rgba(120, 53, 15, 0.35)',
]))
const flowHasMultiSelection = inject('flowHasMultiSelection', computed(() => false))
const flowSaveHistory = inject('flowSaveHistory', null)

const hovered = ref(false)
const contentDraft = ref(props.data.content || '')
const isEditing = ref(false)
const textareaRef = ref(null)
const measureRef = ref(null)
const resizeBase = ref(null)
const { updateNode, updateNodeInternals, getViewport } = useVueFlow()

function ensureDefaults() {
  if (typeof props.data.content !== 'string') props.data.content = ''
  if (!props.data.label) props.data.label = '文字标注'
  if (!props.data.textColor) props.data.textColor = '#f8fafc'
  if (!props.data.fontSize) props.data.fontSize = 28
  if (!props.data.fontWeight) props.data.fontWeight = 500
  if (!props.data.fontStyle) props.data.fontStyle = 'normal'
  if (!props.data.textDecoration) props.data.textDecoration = 'none'
  if (!props.data.textAlign) props.data.textAlign = 'left'
  if (props.data.bgColor === undefined) props.data.bgColor = 'transparent'
  if (typeof props.data.fitToText !== 'boolean') props.data.fitToText = true
}

ensureDefaults()

watch(
  () => props.data.content,
  (value) => {
    contentDraft.value = value || ''
  }
)

function syncLabelFromContent(value) {
  const firstLine = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  props.data.label = firstLine ? firstLine.slice(0, 24) : '文字标注'
}

function saveContent() {
  props.data.content = contentDraft.value
  syncLabelFromContent(contentDraft.value)
}

function startEditing() {
  queueAutoSize()
  isEditing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function stopEditing() {
  isEditing.value = false
  saveContent()
  queueAutoSize()
  flowSaveHistory?.()
}

function updateStyleField(key, value) {
  props.data[key] = value
  queueAutoSize()
  flowSaveHistory?.()
}

function toggleBold() {
  updateStyleField('fontWeight', Number(props.data.fontWeight || 500) >= 700 ? 500 : 700)
}

function toggleItalic() {
  updateStyleField('fontStyle', props.data.fontStyle === 'italic' ? 'normal' : 'italic')
}

function toggleUnderline() {
  updateStyleField('textDecoration', props.data.textDecoration === 'underline' ? 'none' : 'underline')
}

function setTextColor(color) {
  updateStyleField('textColor', color)
}

function setBackgroundColor(color) {
  updateStyleField('bgColor', color)
}

function updateFontSize(delta) {
  const nextSize = Math.min(96, Math.max(14, Number(props.data.fontSize || 28) + delta))
  updateStyleField('fontSize', nextSize)
}

function setTextAlign(align) {
  updateStyleField('textAlign', align)
}

function enablePointText() {
  props.data.fitToText = true
  queueAutoSize()
}

function enableTextFrame() {
  if (fitToText.value) {
    props.data.fitToText = false
    nextTick(() => updateNodeInternals([props.id]))
  }
}

const fitToText = computed(() => props.data.fitToText !== false)

const textStyles = computed(() => ({
  color: props.data.textColor || '#f8fafc',
  fontSize: `${Number(props.data.fontSize || 28)}px`,
  fontWeight: Number(props.data.fontWeight || 500),
  fontStyle: props.data.fontStyle || 'normal',
  textDecoration: props.data.textDecoration || 'none',
  textAlign: props.data.textAlign || 'left',
}))

const textBackgroundStyles = computed(() => ({
  backgroundColor: props.data.bgColor || 'transparent',
}))

const showToolbar = computed(() => !flowHasMultiSelection.value && (hovered.value || props.selected))
const resizeHandleStyle = {
  width: '10px',
  height: '10px',
  borderRadius: '9999px',
  background: '#60a5fa',
  border: '1px solid rgba(255,255,255,0.9)',
  boxShadow: '0 0 0 1px rgba(59,130,246,0.18)',
}

const resizeLineStyle = {
  borderColor: 'rgba(96,165,250,0.85)',
  borderWidth: '1px',
}

function applyAutoSize() {
  if (!fitToText.value || !measureRef.value || !props.id) return
  const rect = measureRef.value.getBoundingClientRect()
  const zoom = getViewport().zoom || 1
  const width = Math.min(640, Math.max(1, Math.ceil(rect.width / zoom)))
  const height = Math.max(1, Math.ceil(rect.height / zoom))
  updateNode(props.id, () => ({
    style: {
      width: `${width}px`,
      height: `${height}px`,
    },
  }))
  nextTick(() => updateNodeInternals([props.id]))
}

function queueAutoSize() {
  nextTick(() => {
    if (fitToText.value) {
      applyAutoSize()
      return
    }
    updateNodeInternals([props.id])
  })
}

function handleResizeStart(event) {
  const params = event?.params
  resizeBase.value = {
    width: Math.max(1, Number(params?.width || measureRef.value?.offsetWidth || 1)),
    height: Math.max(1, Number(params?.height || measureRef.value?.offsetHeight || 1)),
    fontSize: Math.max(12, Number(props.data.fontSize || 28)),
  }
}

function handleShouldResize(_event, params) {
  if (!fitToText.value) return true
  const base = resizeBase.value
  if (!base) return false
  const widthRatio = Number(params?.width || base.width) / base.width
  const heightRatio = Number(params?.height || base.height) / base.height
  const scale = Math.max(widthRatio, heightRatio)
  const nextFontSize = Math.min(180, Math.max(12, Math.round(base.fontSize * scale)))
  if (nextFontSize !== Number(props.data.fontSize || 28)) {
    props.data.fontSize = nextFontSize
    queueAutoSize()
  }
  return false
}

function handleResizeEnd() {
  resizeBase.value = null
  nextTick(() => updateNodeInternals([props.id]))
}

watch(
  () => [
    contentDraft.value,
    props.data.fontSize,
    props.data.fontWeight,
    props.data.fontStyle,
    props.data.textDecoration,
    props.data.textAlign,
    props.data.bgColor,
  ],
  () => {
    queueAutoSize()
  },
  { immediate: true }
)

onMounted(() => {
  queueAutoSize()
})
</script>

<template>
  <div
    class="annotation-node group relative"
    :class="{ 'manual-frame': !fitToText }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <NodeResizer
      :is-visible="selected && !isEditing"
      :min-width="1"
      :min-height="1"
      :should-resize="handleShouldResize"
      :handle-style="resizeHandleStyle"
      :line-style="resizeLineStyle"
      @resizeStart="handleResizeStart"
      @resizeEnd="handleResizeEnd"
    />

    <div v-if="showToolbar" class="node-toolbar-wrap nodrag" :class="{ active: selected }">
      <button
        class="tb-btn"
        :class="{ active: Number(data.fontWeight || 500) >= 700 }"
        title="加粗"
        @click.stop="toggleBold"
      >
        <span class="tb-text tb-text-strong">B</span>
      </button>
      <button
        class="tb-btn"
        :class="{ active: data.fontStyle === 'italic' }"
        title="斜体"
        @click.stop="toggleItalic"
      >
        <span class="tb-text tb-text-italic">I</span>
      </button>
      <button
        class="tb-btn"
        :class="{ active: data.textDecoration === 'underline' }"
        title="下划线"
        @click.stop="toggleUnderline"
      >
        <span class="tb-text tb-text-underline">U</span>
      </button>

      <div class="tb-divider"></div>

      <div class="tb-group" title="字号">
        <button class="tb-btn" title="缩小字号" @click.stop="updateFontSize(-2)">A-</button>
        <div class="tb-size">{{ Number(data.fontSize || 28) }}</div>
        <button class="tb-btn" title="放大字号" @click.stop="updateFontSize(2)">A+</button>
      </div>

      <div class="tb-divider"></div>

      <div class="tb-group" title="文本模式">
        <span class="tb-group-label">模式</span>
        <button
          class="tb-btn"
          :class="{ active: fitToText }"
          title="贴：拖动时缩放文字本身，适合标题和短句"
          @click.stop="enablePointText"
        >
          <span class="tb-align-label">贴</span>
        </button>
        <button
          class="tb-btn"
          :class="{ active: !fitToText }"
          title="区域文本：可自由拖拽宽高，文字会在框内换行排版"
          @click.stop="enableTextFrame"
        >
          <span class="tb-align-label">框</span>
        </button>
      </div>

      <div class="tb-divider"></div>

      <div class="tb-group" title="对齐方式">
        <span class="tb-group-label">对齐</span>
        <button
          class="tb-btn"
          :class="{ active: (data.textAlign || 'left') === 'left' }"
          title="左对齐"
          @click.stop="setTextAlign('left')"
        >
          <span class="tb-align-label">左</span>
        </button>
        <button
          class="tb-btn"
          :class="{ active: (data.textAlign || 'left') === 'center' }"
          title="居中对齐"
          @click.stop="setTextAlign('center')"
        >
          <span class="tb-align-label">中</span>
        </button>
        <button
          class="tb-btn"
          :class="{ active: (data.textAlign || 'left') === 'right' }"
          title="右对齐"
          @click.stop="setTextAlign('right')"
        >
          <span class="tb-align-label">右</span>
        </button>
      </div>

      <div class="tb-divider"></div>

      <div class="tb-group tb-group-palette" title="文字颜色">
        <span class="tb-group-label">文字</span>
        <div class="tb-palette">
          <button
            v-for="color in textColorPresets"
            :key="`text-${color}`"
            class="palette-dot"
            :class="{ active: (data.textColor || '#f8fafc') === color }"
            :style="{ backgroundColor: color }"
            @click.stop="setTextColor(color)"
          />
        </div>
      </div>

      <div class="tb-group tb-group-palette" title="背景颜色">
        <span class="tb-group-label">背景</span>
        <div class="tb-palette">
          <button
            v-for="color in backgroundColorPresets"
            :key="`bg-${color}`"
            class="palette-dot"
            :class="{ active: (data.bgColor || 'transparent') === color }"
            :style="{ backgroundColor: color === 'transparent' ? 'rgba(255,255,255,0.08)' : color }"
            @click.stop="setBackgroundColor(color)"
          />
        </div>
      </div>
    </div>

    <div class="annotation-stage" :class="{ selected: selected, 'manual-frame': !fitToText }">
      <div
        v-if="!isEditing"
        class="annotation-display"
        :class="{ empty: !contentDraft.trim(), 'manual-frame': !fitToText, selected: selected }"
        :style="textStyles"
        @dblclick.stop="startEditing"
      >
        <span
          class="annotation-inline-bg"
          :class="{ 'manual-frame': !fitToText }"
          :style="textBackgroundStyles"
        >
          {{ contentDraft || '双击输入文字标注...' }}
        </span>
      </div>
      <textarea
        v-else
        ref="textareaRef"
        v-model="contentDraft"
        class="annotation-textarea nodrag"
        :class="{ 'manual-frame': !fitToText }"
        :style="[textStyles, textBackgroundStyles]"
        placeholder="输入文字标注..."
        @input="saveContent"
        @blur="stopEditing"
        @keydown.stop
        @pointerdown.stop
      />
    </div>

    <div ref="measureRef" class="annotation-measure" :style="textStyles">
      <span class="annotation-inline-bg" :style="textBackgroundStyles">
        {{ contentDraft || '双击输入文字标注...' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.annotation-node {
  overflow: visible;
  display: block;
  width: 100%;
  height: 100%;
}

.annotation-node.manual-frame {
  display: block;
  width: 100%;
  height: 100%;
}

.annotation-stage {
  border: none;
  box-shadow: none;
  display: block;
  width: 100%;
  height: 100%;
}

.annotation-stage.manual-frame {
  display: block;
  width: 100%;
  height: 100%;
}

.annotation-textarea {
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  border: none;
  outline: none;
  resize: none;
  overflow: auto;
  background: transparent;
  line-height: 1.45;
  border-radius: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.annotation-textarea.manual-frame {
  display: block;
  overflow-y: auto;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.annotation-textarea.manual-frame::-webkit-scrollbar {
  width: 3px;
}
.annotation-textarea.manual-frame::-webkit-scrollbar-track {
  background: transparent;
}
.annotation-textarea.manual-frame::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 4px;
}

.annotation-measure {
  position: absolute;
  left: -99999px;
  top: -99999px;
  visibility: hidden;
  pointer-events: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  line-height: 1.45;
  padding: 0;
  max-width: 640px;
  min-width: 1px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.annotation-display {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  border-radius: 0;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-y: auto;
  user-select: none;
  cursor: move;
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.annotation-display.manual-frame {
  display: block;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.annotation-display.manual-frame::-webkit-scrollbar {
  width: 3px;
}
.annotation-display.manual-frame::-webkit-scrollbar-track {
  background: transparent;
}
.annotation-display.manual-frame::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}

.annotation-display.selected {
  outline: 1px solid rgba(96, 165, 250, 0.92);
  outline-offset: 3px;
}

.annotation-inline-bg {
  display: inline-block;
  padding: 0.03em 0.08em;
  border-radius: 0.22em;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  vertical-align: top;
  white-space: inherit;
}

.annotation-inline-bg.manual-frame {
  display: block;
  width: 100%;
  min-height: 100%;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  box-sizing: border-box;
}

.annotation-node :deep(.vue-flow__resize-control.handle) {
  width: 12px !important;
  height: 12px !important;
  opacity: 1 !important;
  z-index: 3 !important;
}

.annotation-node :deep(.vue-flow__resize-control.line) {
  opacity: 1 !important;
  border-width: 0 !important;
  background: transparent !important;
  z-index: 2 !important;
}

.annotation-node :deep(.vue-flow__resize-control.line.left) {
  width: 8px !important;
  height: 100% !important;
  left: -8px !important;
  top: 0 !important;
  transform: none !important;
}

.annotation-node :deep(.vue-flow__resize-control.line.right) {
  width: 8px !important;
  height: 100% !important;
  left: calc(100% + 0px) !important;
  top: 0 !important;
  transform: none !important;
}

.annotation-node :deep(.vue-flow__resize-control.line.top) {
  width: 100% !important;
  height: 8px !important;
  left: 0 !important;
  top: -8px !important;
  transform: none !important;
}

.annotation-node :deep(.vue-flow__resize-control.line.bottom) {
  width: 100% !important;
  height: 8px !important;
  left: 0 !important;
  top: calc(100% + 0px) !important;
  transform: none !important;
}

.annotation-display.empty {
  color: rgba(228, 228, 231, 0.45) !important;
}

.annotation-textarea::placeholder {
  color: rgba(228, 228, 231, 0.45);
}

.node-toolbar-wrap {
  position: absolute;
  top: -44px;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 5px;
  border-radius: 5px;
  background: rgba(39, 39, 42, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid #3f3f46;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.32);
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s;
  z-index: 10;
}

.node-toolbar-wrap.active,
.group:hover .node-toolbar-wrap {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}

.tb-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 9999px;
  color: #a1a1aa;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.tb-btn:hover,
.tb-btn.active {
  color: #ffffff;
  border-color: transparent;
  background: #3f3f46;
}

.tb-size {
  min-width: 24px;
  text-align: center;
  color: #e4e4e7;
  font-size: 11px;
  font-weight: 600;
}

.tb-text {
  font-size: 11px;
  line-height: 1;
}

.tb-align-label {
  font-size: 11px;
  line-height: 1;
  font-weight: 600;
}

.tb-text-strong {
  font-weight: 700;
}

.tb-text-italic {
  font-style: italic;
}

.tb-text-underline {
  text-decoration: underline;
}

.tb-divider {
  width: 1px;
  height: 16px;
  background: rgba(63, 63, 70, 0.95);
  margin: 0 2px;
}

.tb-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-direction: row;
  white-space: nowrap;
}

.tb-group-label {
  font-size: 10px;
  line-height: 1;
  color: #71717a;
  padding-right: 2px;
  user-select: none;
}

.tb-group-palette {
  gap: 6px;
}

.tb-palette {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-direction: row;
  white-space: nowrap;
}

.palette-dot {
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  padding: 0;
}

.palette-dot.active {
  outline: 2px solid rgba(255, 255, 255, 0.75);
  outline-offset: 1px;
}
</style>

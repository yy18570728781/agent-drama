<template>
  <div class="flow-personalization">
    <section class="settings-section">
      <div class="settings-section__checkbox-row">
        <label class="settings-section__checkbox-label">
          <input type="checkbox" :checked="showNodeTitle" @change="onToggleNodeTitle" class="settings-section__checkbox" />
          <span>显示标题</span>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-title">连线样式</div><div class="option-grid three-col">
        <button v-for="opt in EDGE_STYLE_OPTIONS" :key="opt.value" class="option-card" :class="{ active: edgeStyle === opt.value }" @click="setEdgeStyle(opt.value)">
          <div class="edge-preview"><svg viewBox="0 0 120 40" class="edge-svg"><path v-if="opt.value === 'smoothstep'" d="M4 20 L40 20 Q50 20 50 30 Q50 40 60 40 Q70 40 70 30 Q70 20 80 20 L116 20" /><path v-else-if="opt.value === 'straight'" d="M4 20 L116 20" /><path v-else d="M4 20 Q60 0 116 20" /></svg></div>
          <span class="option-name">{{ opt.label }}</span></button>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-title">高亮着色</div><p class="section-hint">仅展示当前 VueFlow 画布可以直接生效的连线外观项。</p>
      <div class="option-grid two-col">
        <button v-for="opt in edgeColorOptions" :key="opt.value" class="option-card" :class="{ active: edgeColorMode === opt.value }" @click="setEdgeColorMode(opt.value)">
          <div class="color-preview"><span v-for="(c, index) in opt.colors" :key="`${opt.value}-${index}-${c}`" class="color-bar" :style="{ background: c }" /></div>
          <span class="option-name">{{ opt.label }}</span></button>
      </div>
      <div v-if="edgeColorMode === 'uniform'" class="color-custom-row">
        <span class="color-custom-label">高亮颜色</span><label class="color-picker-wrap"><input type="color" class="color-picker" :value="edgeHighlightColor" @input="onHighlightColorInput" /><span class="color-swatch" :style="{ background: edgeHighlightColor }" /></label>
      </div>
      <div v-else class="color-type-list">
        <div v-for="category in EDGE_TYPE_CATEGORIES" :key="category.key" class="color-custom-row">
          <span class="color-custom-label">{{ category.label }}</span><label class="color-picker-wrap"><input type="color" class="color-picker" :value="getCategoryColor(category)" @input="onCategoryColorInput(category, $event)" /><span class="color-swatch" :style="{ background: getCategoryColor(category) }" /></label>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-title">连线箭头</div>
      <div class="option-grid two-col">
        <button class="option-card" :class="{ active: !edgeArrow }" @click="setEdgeArrow(false)">
          <div class="anim-preview"><svg viewBox="0 0 60 20" class="anim-svg"><line x1="6" y1="10" x2="54" y2="10" class="anim-line" /></svg></div><span class="option-name">无箭头</span></button>
        <button class="option-card" :class="{ active: edgeArrow }" @click="setEdgeArrow(true)">
          <div class="anim-preview"><svg viewBox="0 0 60 20" class="anim-svg"><line x1="6" y1="10" x2="50" y2="10" class="anim-line" /><polygon points="50,6 58,10 50,14" class="anim-arrow-head" /></svg></div><span class="option-name">有箭头</span></button>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-title">显示性能</div>
      <div class="thumb-timing-card">
        <div class="thumb-timing-row">
          <span>媒体预览数量</span><span class="thumb-timing-value">{{ previewLimitLabel }}</span>
        </div>
        <input class="thumb-timing-slider" type="range" min="10" max="300" step="10" :value="mediaPreviewLimit" @input="onPreviewLimitInput" />
        <p class="thumb-timing-hint">当前可见媒体大于这个值时，进入轻量预览。<span class="text-indigo-400 font-medium">(活跃预览: {{ activePreviewCount }}/{{ visibleMediaCount }})</span></p>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-title">外部拖入排列</div>
      <div class="option-grid two-col">
        <button v-for="opt in FLOW_DROP_DIRECTION_OPTIONS" :key="opt.value" class="option-card" :class="{ active: flowDropDirection === opt.value }" @click="setFlowDropDirection(opt.value)">
          <div class="drop-direction-preview" :class="`is-${opt.value}`"><span class="drop-direction-chip" /><span class="drop-direction-chip" /><span class="drop-direction-chip" /></div>
          <span class="option-name">{{ opt.label }}</span>
        </button>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-section__checkbox-row">
        <label class="settings-section__checkbox-label">
          <input type="checkbox" :checked="autoCompressOriginalRatio" @change="onToggleAutoCompress" class="settings-section__checkbox" />
          <span>自动原比例压缩</span>
        </label>
        <div class="settings-section__threshold-inline">
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            :value="compressThresholdMb"
            @input="onThresholdInput"
            class="settings-section__threshold-slider"
          />
          <span class="settings-section__threshold-value">{{ compressThresholdMb }} MB</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { EDGE_COLOR_OPTIONS, EDGE_STYLE_OPTIONS, EDGE_TYPE_CATEGORIES, FLOW_DROP_DIRECTION_OPTIONS } from './flowPersonalizationOptions.constants'

const { nodes } = useVueFlow()
const flowRenderableMediaNodeIds = inject('flowRenderableMediaNodeIds', ref(new Set<string>()))
const flowThumbRenderableMediaNodeIds = inject('flowThumbRenderableMediaNodeIds', ref(new Set<string>()))

function hasMediaUrl(data: Record<string, unknown>): boolean {
  return !!(
    data.url
    || data.preview
    || data.imageUrl
    || data.videoUrl
    || data.audioUrl
    || (data.nodeData as Record<string, unknown> | undefined)?.imageUrl
    || (data.nodeData as Record<string, unknown> | undefined)?.videoUrl
  )
}

function isVisibleMediaNode(node: { data?: unknown; hidden?: boolean; type?: unknown }): boolean {
  const data = (node.data && typeof node.data === 'object' ? node.data : {}) as Record<string, unknown>
  if (node.hidden || data._collapsedByGroup) return false
  const nodeType = String(node.type || '')
  if ((nodeType === 'batch_grid' || nodeType === 'texture_material') && Array.isArray(data.items)) {
    return data.items.length > 0
  }
  return hasMediaUrl(data)
}

const activePreviewCount = computed(() => {
  const activeIds = new Set<string>([
    ...flowRenderableMediaNodeIds.value,
    ...flowThumbRenderableMediaNodeIds.value,
  ])
  return activeIds.size
})

const visibleMediaCount = computed(() => {
  return nodes.value.filter((node) => isVisibleMediaNode(node)).length
})

const {
  edgeStyle,
  edgeColorMode,
  edgeArrow,
  edgeHighlightColor,
  edgeTypeHighlightColors,
  mediaPreviewLimit,
  flowDropDirection,
  showNodeTitle,
  autoCompressOriginalRatio,
  compressThresholdMb,
  setEdgeStyle,
  setEdgeColorMode,
  setEdgeHighlightColor,
  setEdgeTypeHighlightColor,
  setEdgeArrow,
  setMediaPreviewLimit,
  setFlowDropDirection,
  setShowNodeTitle,
  setAutoCompressOriginalRatio,
  setCompressThresholdMb,
} = useTheme()

const edgeColorOptions = computed(() => EDGE_COLOR_OPTIONS.map((option) => (
  option.value === 'uniform'
    ? { ...option, colors: [edgeHighlightColor.value, edgeHighlightColor.value, edgeHighlightColor.value] }
    : option
)))

const previewLimitLabel = computed(() => {
  const value = Number(mediaPreviewLimit.value || 80)
  return `${value}个`
})

function getCategoryColor(category: (typeof EDGE_TYPE_CATEGORIES)[number]): string {
  return edgeTypeHighlightColors.value[category.types[0]] || category.defaultColor
}

function onHighlightColorInput(event: Event): void {
  setEdgeHighlightColor((event.target as HTMLInputElement).value)
}

function onCategoryColorInput(category: (typeof EDGE_TYPE_CATEGORIES)[number], event: Event): void {
  const nextColor = (event.target as HTMLInputElement).value
  category.types.forEach((type) => setEdgeTypeHighlightColor(type, nextColor))
}

function onPreviewLimitInput(event: Event): void {
  setMediaPreviewLimit(Number((event.target as HTMLInputElement).value || 80))
}

function onToggleNodeTitle(event: Event): void {
  setShowNodeTitle((event.target as HTMLInputElement).checked)
}

function onToggleAutoCompress(event: Event): void {
  setAutoCompressOriginalRatio((event.target as HTMLInputElement).checked)
}

function onThresholdInput(event: Event): void {
  setCompressThresholdMb(Number((event.target as HTMLInputElement).value))
}
</script>

<style scoped src="./flowPersonalization.css"></style>

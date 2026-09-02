<script setup lang="ts">
import { computed, ref } from 'vue'
import { Panel } from '@vue-flow/core'
import { MapIcon, LayoutGrid, Maximize } from '@/components/common/icon/lucide'
import FlowLocationMarkerBar from './FlowLocationMarkerBar.vue'
import FlowCanvasMinimap from './FlowCanvasMinimap.vue'
import type { LocationMarkerItem } from '@/composables/flow/useLocationMarkerNavigator'

const props = defineProps<{
  showMinimap?: boolean
  showGrid?: boolean
  isUltraLightCanvasMode?: boolean
  isViewportCanvasPreviewMode?: boolean
  effectiveShowMinimap?: boolean
  shouldAutoHideMinimap?: boolean
  viewport?: { zoom: number }
  minZoom?: number
  locationMarkerItems?: LocationMarkerItem[]
}>()

const emit = defineEmits<{
  'update:showMinimap': [value: boolean]
  'update:showGrid': [value: boolean]
  fitView: []
  zoomTo: [value: number]
  viewportMoveStart: []
  viewportMoveEnd: []
  locationMarkerSelect: [id: string]
}>()

const locationMarkerBarExpanded = ref(false)
const renderMinimap = computed(() => (
  !!props.effectiveShowMinimap
  && !props.isUltraLightCanvasMode
  && !props.isViewportCanvasPreviewMode
))
const minimapSuppressed = computed(() => props.shouldAutoHideMinimap || props.isUltraLightCanvasMode)

function toggleMinimap(): void {
  if (props.shouldAutoHideMinimap) {
    emit('update:showMinimap', false)
    return
  }
  emit('update:showMinimap', !props.showMinimap)
}

function handleFitView() {
  emit('fitView')
}

function handleZoomInput(event: Event): void {
  const value = Number.parseFloat((event.target as HTMLInputElement).value)
  emit('viewportMoveStart')
  emit('zoomTo', value)
  emit('viewportMoveEnd')
}
</script>

<template>
  <Panel position="bottom-right" class="flow-bottom-panel flex flex-col items-end gap-3">
    <!-- 小地图 -->
    <Transition name="fade-slide">
      <div v-if="renderMinimap" class="minimap-container">
        <FlowCanvasMinimap :min-zoom="minZoom" :max-zoom="4" />
      </div>
    </Transition>

    <!-- 控制条 -->
    <div class="flex items-center gap-1 p-1.5 bg-[#18181b] border border-[#27272a] rounded-full shadow-xl">
      <FlowLocationMarkerBar
        v-if="locationMarkerItems && locationMarkerItems.length"
        :items="locationMarkerItems"
        v-model:expanded="locationMarkerBarExpanded"
        @select="emit('locationMarkerSelect', $event)"
      />

      <button
        class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        :class="renderMinimap ? 'bg-[#3f3f46] text-white' : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'"
        :title="minimapSuppressed ? '节点过多或缩放过小，已自动隐藏小地图' : '切换小地图'"
        @click="toggleMinimap"
      >
        <MapIcon class="w-4 h-4" />
      </button>

      <button
        class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        :class="showGrid ? 'bg-[#3f3f46] text-white' : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'"
        title="切换网格"
        @click="$emit('update:showGrid', !showGrid)"
      >
        <LayoutGrid class="w-4 h-4" />
      </button>

      <button
        class="w-9 h-9 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors"
        title="适应屏幕"
        @click="handleFitView"
      >
        <Maximize class="w-4 h-4" />
      </button>

      <div class="flex items-center px-3 w-28">
        <input
          type="range"
          :min="minZoom"
          max="4"
          step="0.05"
          :value="viewport?.zoom ?? 1"
          @input="handleZoomInput"
          class="w-full h-1.5 bg-[#3f3f46] rounded-full appearance-none cursor-pointer zoom-slider"
        />
      </div>
    </div>
  </Panel>
</template>

<style scoped>
.flow-bottom-panel {
  margin-right: var(--flow-floating-edge);
  margin-bottom: var(--flow-floating-edge);
  transform: scale(0.85);
  transform-origin: bottom right;
}

/* 小地图容器 */
.minimap-container {
  width: 220px;
  height: 140px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  position: relative;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 缩放滑块 */
.zoom-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}
</style>

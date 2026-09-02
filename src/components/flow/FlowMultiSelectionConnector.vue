<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeftRight, Heart, HeartOff, Info, Play, Trash2 } from '@/components/common/icon/lucide'

const props = withDefaults(
  defineProps<{
    multiSelectionHotspotStyle?: Record<string, string> | null
    multiSelectionConnectorStyle?: Record<string, string> | null
    selectedNodeCount?: number
    actionKind?: string
    actionTitle?: string
    detailAvailable?: boolean
    sourceConnectionMode?: string
    isUltraLightCanvasMode?: boolean
    connectionDragLine?: string
    edgeStyle?: string
    showResultRecordActions?: boolean
  }>(),
  {
    multiSelectionHotspotStyle: null,
    multiSelectionConnectorStyle: null,
    selectedNodeCount: 0,
    actionKind: '',
    actionTitle: '',
    detailAvailable: false,
    sourceConnectionMode: '',
    isUltraLightCanvasMode: false,
    connectionDragLine: '',
    edgeStyle: 'smoothstep',
    showResultRecordActions: false,
  }
)

const emit = defineEmits<{
  'intent-enter': []
  'intent-leave': []
  'start-connection': []
  'media-action': []
  'detail-action': []
  'favorite-result-records': []
  'unfavorite-result-records': []
  'delete-result-records': []
}>()

const connectorHandleRef = ref<HTMLButtonElement | null>(null)

function handleIntentEnter() {
  emit('intent-enter')
}

function handleIntentLeave() {
  emit('intent-leave')
}

function handleStartConnection() {
  emit('start-connection')
}

function handleMediaAction() {
  emit('media-action')
}

function handleDetailAction() {
  emit('detail-action')
}

defineExpose({
  connectorHandleRef,
})
</script>

<template>
  <div
    v-if="multiSelectionHotspotStyle && !isUltraLightCanvasMode"
    class="multi-selection-connector-hotspot"
    :class="{ 'is-connecting-source': sourceConnectionMode === 'multi' }"
    :style="multiSelectionHotspotStyle"
    @mouseenter="handleIntentEnter"
    @mouseleave="handleIntentLeave"
  >
    <div
      class="multi-selection-connector"
      :style="multiSelectionConnectorStyle"
    >
      <div v-if="actionKind || detailAvailable || showResultRecordActions" class="multi-selection-action-toolbar">
        <button
          v-if="detailAvailable"
          class="multi-selection-action-btn"
          title="详情"
          @click.stop="handleDetailAction"
        >
          <Info :size="14" />
        </button>
        <button
          v-if="actionKind"
          class="multi-selection-action-btn"
          :title="actionTitle"
          @click.stop="handleMediaAction"
        >
          <ArrowLeftRight v-if="actionKind === 'image_compare'" :size="14" />
          <Play v-else-if="actionKind === 'video_preview'" :size="14" />
        </button>
        <button v-if="showResultRecordActions" class="multi-selection-action-btn is-favorite" title="收藏结果" @click.stop="$emit('favorite-result-records')">
          <Heart :size="14" />
        </button>
        <button v-if="showResultRecordActions" class="multi-selection-action-btn is-favorite" title="取消收藏结果" @click.stop="$emit('unfavorite-result-records')">
          <HeartOff :size="14" />
        </button>
        <button v-if="showResultRecordActions" class="multi-selection-action-btn is-danger" title="删除节点" @click.stop="$emit('delete-result-records')">
          <Trash2 :size="14" />
        </button>
      </div>
      <div class="multi-selection-connector-count">{{ selectedNodeCount }}</div>
      <button
        ref="connectorHandleRef"
        class="multi-selection-connector-handle"
        title="连接选中的节点到下游"
        @pointerdown.stop.prevent="handleStartConnection"
      ></button>
    </div>
  </div>
  <svg
    v-if="connectionDragLine && !isUltraLightCanvasMode"
    class="multi-selection-drag-line"
    aria-hidden="true"
  >
    <path :d="connectionDragLine" :class="['multi-selection-drag-line-path', `is-${edgeStyle}`]" />
  </svg>
</template>

<style scoped>
.multi-selection-connector {
  position: absolute;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  z-index: 30;
  pointer-events: none;
}
.multi-selection-action-toolbar {
  position: absolute;
  bottom: calc(50% + 22px);
  left: 0;
  display: flex;
  gap: 2px;
  padding: 4px;
  border: 1px solid rgba(82, 82, 91, 0.9);
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.94);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
  pointer-events: all;
}
.multi-selection-action-btn {
  pointer-events: all;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 9999px;
  border: 0;
  background: transparent;
  color: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.multi-selection-action-btn:hover {
  background: rgba(39, 39, 42, 0.96);
}
.multi-selection-action-btn.is-favorite {
  color: #fb7185;
}
.multi-selection-action-btn.is-danger {
  color: #fca5a5;
}
.multi-selection-connector-hotspot {
  position: absolute;
  z-index: 30;
  pointer-events: all;
  transform: translateY(-50%);
}
.multi-selection-connector-hotspot.is-connecting-source .multi-selection-connector-count,
.multi-selection-connector-hotspot.is-connecting-source .multi-selection-connector-handle {
  filter: drop-shadow(0 0 12px rgba(129, 140, 248, 0.5)) drop-shadow(0 0 24px rgba(56, 189, 248, 0.32));
}
.multi-selection-connector-count {
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  border-radius: 9999px;
  background: rgba(24, 24, 27, 0.92);
  border: 1px solid rgba(82, 82, 91, 0.9);
  color: #e4e4e7;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}
.multi-selection-connector-handle {
  pointer-events: all;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  border: 2px solid #18181b;
  background: var(--accent);
  box-shadow: none;
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 30 30'%3E%3Ccircle cx='15' cy='15' r='8.5' fill='none' stroke='rgba(129,140,248,0.42)' stroke-width='1.5'/%3E%3Cpath d='M15 9.5v11M9.5 15h11' stroke='%23818cf8' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='15' cy='15' r='2.5' fill='%2338bdf8' fill-opacity='0.95'/%3E%3C/svg%3E") 24 24, crosshair;
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  position: relative;
  z-index: 2;
}
.multi-selection-connector-handle::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 9999px;
  border: 2px solid rgba(129, 140, 248, 0.52);
  animation: downstream-port-pulse 1.6s ease-out infinite;
}
.multi-selection-connector-handle:hover {
  transform: scale(1.08);
  box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.22), 0 12px 26px rgba(14, 165, 233, 0.32);
  filter: brightness(1.06);
}
.multi-selection-drag-line {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 29;
  overflow: visible;
}
.multi-selection-drag-line-path {
  stroke: #818cf8;
  stroke-width: 2;
  fill: none;
  stroke-linejoin: round;
  stroke-linecap: round;
  filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.38));
}
.multi-selection-drag-line-path.is-straight,
.multi-selection-drag-line-path.is-smoothstep,
.multi-selection-drag-line-path.is-default {
  stroke-dasharray: none;
}
@keyframes downstream-port-pulse {
  0% {
    transform: scale(0.88);
    opacity: 0.9;
  }
  70% {
    transform: scale(1.35);
    opacity: 0;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}
</style>

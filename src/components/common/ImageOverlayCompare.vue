<template>
  <div
    v-if="mode === 'overlay'"
    ref="wrapperRef"
    class="overlay-compare"
    :class="{ interactive }"
    @mousedown="handlePointerDown"
    @mousemove="handlePointerMove"
  >
    <div ref="stageRef" class="overlay-compare-stage">
      <img
        :src="leftImage"
        :alt="leftLabel"
        class="overlay-compare-base"
        draggable="false"
        referrerpolicy="no-referrer"
      />
      <img
        :src="rightImage"
        :alt="rightLabel"
        class="overlay-compare-front"
        :style="{ clipPath: `inset(0 ${100 - currentPercent}% 0 0)` }"
        draggable="false"
        referrerpolicy="no-referrer"
      />
      <div class="overlay-compare-divider" :style="{ left: `${currentPercent}%` }">
        <div class="overlay-compare-line"></div>
        <div class="overlay-compare-handle">
          <ArrowLeftRight :size="14" />
        </div>
      </div>
    <div v-if="leftLabel" class="overlay-compare-label overlay-compare-label-left">{{ leftLabel }}</div>
    <div v-if="rightLabel" class="overlay-compare-label overlay-compare-label-right">{{ rightLabel }}</div>
    </div>
  </div>
  <div v-else class="split-compare">
    <div class="split-compare-pane">
      <img :src="leftImage" :alt="leftLabel" class="split-compare-img" draggable="false" referrerpolicy="no-referrer" />
      <div v-if="leftLabel" class="split-compare-label">{{ leftLabel }}</div>
    </div>
    <div class="split-compare-divider"></div>
    <div class="split-compare-pane">
      <img :src="rightImage" :alt="rightLabel" class="split-compare-img" draggable="false" referrerpolicy="no-referrer" />
      <div v-if="rightLabel" class="split-compare-label">{{ rightLabel }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftRight } from '@/components/common/icon/lucide'

const props = withDefaults(defineProps<{
  leftImage: string
  rightImage: string
  mode?: 'overlay' | 'split'
  leftLabel?: string
  rightLabel?: string
  initialPercent?: number
  percent?: number | null
  interactive?: boolean
}>(), {
  mode: 'overlay',
  leftLabel: '',
  rightLabel: '',
  initialPercent: 50,
  percent: null,
  interactive: true,
})

const emit = defineEmits<{
  (e: 'update:percent', value: number): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const internalPercent = ref(Math.max(0, Math.min(100, props.initialPercent)))
const dragging = ref(false)

const currentPercent = computed(() => internalPercent.value)

watch(() => props.initialPercent, (value) => {
  internalPercent.value = Math.max(0, Math.min(100, value))
})

watch(() => props.percent, (value) => {
  if (typeof value !== 'number') return
  const next = Math.max(0, Math.min(100, value))
  if (Math.abs(next - internalPercent.value) > 0.5) {
    internalPercent.value = next
  }
})

function setPercent(value: number) {
  const next = Math.max(0, Math.min(100, value))
  internalPercent.value = next
  emit('update:percent', next)
}

function updatePercentFromEvent(event: MouseEvent) {
  const target = stageRef.value || wrapperRef.value
  if (!target) return
  const rect = target.getBoundingClientRect()
  if (!rect.width) return
  setPercent(((event.clientX - rect.left) / rect.width) * 100)
}

function handlePointerDown(event: MouseEvent) {
  if (!props.interactive || event.button !== 0) return
  dragging.value = true
  updatePercentFromEvent(event)
  window.addEventListener('mouseup', handlePointerUp)
}

function handlePointerMove(event: MouseEvent) {
  if (!props.interactive) return
  if (dragging.value) return
  updatePercentFromEvent(event)
}

function handlePointerUp() {
  dragging.value = false
  window.removeEventListener('mouseup', handlePointerUp)
}
</script>

<style scoped>
.overlay-compare {
  position: absolute;
  inset: 0;
  user-select: none;
  overflow: hidden;
}
.overlay-compare.interactive {
  cursor: ew-resize;
}
.overlay-compare-stage {
  position: absolute;
  inset: 0;
}
.overlay-compare-base {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}
.overlay-compare-front {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
  pointer-events: none;
}
.overlay-compare-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 6;
}
.overlay-compare-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
}
.overlay-compare-handle {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(15, 15, 18, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
}
.overlay-compare-label {
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
}
.overlay-compare-label-left {
  right: 12px;
}
.overlay-compare-label-right {
  left: 12px;
}
.split-compare {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 0;
}
.split-compare-pane {
  position: relative;
  flex: 1 1 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.split-compare-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.split-compare-divider {
  width: 2px;
  height: 60%;
  margin: 0 12px;
  border-radius: 1px;
  background: rgba(255,255,255,.2);
  flex-shrink: 0;
}
.split-compare-label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  font-size: 11px;
  font-weight: 500;
  color: rgba(255,255,255,.85);
  white-space: nowrap;
  pointer-events: none;
}
</style>

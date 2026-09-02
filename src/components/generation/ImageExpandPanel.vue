<template>
  <div class="ref-tool-group">
    <div class="ref-tool-group-title">扩图</div>
    <div class="ref-tool-expand-meta ref-tool-expand-meta--panel">
      <span>原图 {{ sourceSizeText }}</span>
      <span>目标 {{ targetSizeText }}</span>
      <span>比例 {{ currentRatioText }}</span>
      <span class="ref-tool-expand-hint">直接在画布四边或四角拖动，右侧只做精确微调</span>
    </div>
    <div class="ref-tool-row ref-tool-row--wrap">
      <button v-for="ratio in expandRatios" :key="ratio.label" class="ref-tool-chip" :class="{ active: expandRatio === ratio.label }" :disabled="!isExpandReady" @click="$emit('set-ratio', ratio)">
        {{ ratio.label }}
      </button>
    </div>
    <div class="ref-tool-expand-grid">
      <label v-for="side in sides" :key="side.key" class="ref-tool-expand-field">
        <span class="ref-tool-expand-field__title">{{ side.label }}</span>
        <div class="ref-tool-expand-control">
          <button class="ref-tool-expand-step" @click="nudgeInset(side.key, -32)">-</button>
          <input class="ref-tool-expand-input" type="number" min="0" step="1" :value="expandDrag[side.key]" @input="onInsetInput(side.key, $event)" />
          <button class="ref-tool-expand-step" @click="nudgeInset(side.key, 32)">+</button>
        </div>
      </label>
    </div>
    <div class="ref-tool-expand-meta">
      <span>{{ targetSizeText }}</span>
      <span v-if="expandSummary">{{ expandSummary }}</span>
      <span v-else>拖拽四边或四角手柄扩展画布</span>
    </div>
    <button class="ref-tool-btn ref-tool-btn--wide" :disabled="!canApplyExpand" @click="$emit('reset')">重置</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExpandInsets, ExpandPreviewInfo, ExpandRatioOption, ExpandSide } from './imageExpand.types'

const props = defineProps<{
  expandDrag: ExpandInsets
  expandColor: string
  expandRatio: string
  expandRatios: ExpandRatioOption[]
  expandInfo: ExpandPreviewInfo
  expandSummary: string
  canApplyExpand: boolean
  isExpandReady: boolean
  bindExpandColorPickerEl: (element: Element | null) => void
}>()

const emit = defineEmits<{
  'set-inset': [side: ExpandSide, value: number]
  'set-ratio': [ratio: ExpandRatioOption]
  reset: []
}>()

const sourceSizeText = computed(() => `${props.expandInfo.sourceWidth} × ${props.expandInfo.sourceHeight} px`)
const targetSizeText = computed(() => `${props.expandInfo.width} × ${props.expandInfo.height} px`)
const sides: Array<{ key: ExpandSide; label: string }> = [
  { key: 'top', label: '上边' },
  { key: 'right', label: '右边' },
  { key: 'bottom', label: '下边' },
  { key: 'left', label: '左边' },
]
const currentRatioText = computed(() => {
  const source = formatRatio(props.expandInfo.sourceWidth, props.expandInfo.sourceHeight)
  const target = formatRatio(props.expandInfo.width, props.expandInfo.height)
  return source === target ? target : `${target}，原图 ${source}`
})

function onInsetInput(side: ExpandSide, event: Event) {
  const value = Number((event.target as HTMLInputElement).value || 0)
  emit('set-inset', side, value)
}

function nudgeInset(side: ExpandSide, delta: number) {
  emit('set-inset', side, Math.max(0, props.expandDrag[side] + delta))
}

function formatRatio(width: number, height: number) {
  if (!width || !height) return '自由'
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
</script>

<style scoped>
.ref-tool-group { display: flex; flex-direction: column; gap: 5px; }
.ref-tool-group-title { font-size: 10px; font-weight: 600; color: #52525b; text-transform: uppercase; letter-spacing: 0.08em; }
.ref-tool-row { display: flex; gap: 6px; }
.ref-tool-row--wrap { flex-wrap: wrap; }
.ref-tool-expand-meta--panel {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
}
.ref-tool-chip {
  display: inline-flex; align-items: center; justify-content: center; padding: 3px 8px; border-radius: 4px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); color: #a1a1aa; font-size: 10px; cursor: pointer;
}
.ref-tool-chip.active { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.4); color: #a5b4fc; }
.ref-tool-chip:disabled { opacity: 0.45; cursor: not-allowed; }
.ref-tool-expand-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.ref-tool-expand-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ref-tool-expand-field__title { font-size: 10px; color: #d4d4d8; }
.ref-tool-expand-control {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  gap: 6px;
  align-items: center;
}
.ref-tool-expand-label { width: 14px; flex-shrink: 0; font-size: 10px; color: #a1a1aa; }
.ref-tool-expand-input {
  width: 100%; min-width: 0; height: 26px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06); color: #f4f4f5; font-size: 11px; padding: 0 8px; text-align: center;
}
.ref-tool-expand-step {
  height: 26px;
  border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #f4f4f5;
  cursor: pointer;
}
.ref-tool-expand-meta { display: flex; flex-direction: column; gap: 2px; font-size: 10px; line-height: 1.4; color: #a1a1aa; }
.ref-tool-expand-hint { color: #818cf8; }
.ref-tool-btn {
  display: flex; align-items: center; justify-content: center; gap: 3px; width: 100%; padding: 4px 6px; border-radius: 5px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); color: #a1a1aa; font-size: 11px; cursor: pointer;
}
.ref-tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

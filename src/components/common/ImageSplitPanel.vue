<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SPLIT_MODES, type SplitMode } from '@/composables/flow/useImageSplit'

const props = defineProps<{
  imageWidth: number
  imageHeight: number
  splitting: boolean
}>()

const emit = defineEmits<{
  (e: 'execute', mode: SplitMode): void
  (e: 'selectMode', mode: SplitMode | null): void
  (e: 'cancel'): void
}>()

const selectedKey = ref('')

const selectedMode = computed(() => SPLIT_MODES.find(m => m.key === selectedKey.value))

watch(selectedKey, (key) => {
  emit('selectMode', SPLIT_MODES.find(m => m.key === key) || null)
})

const totalPieces = computed(() => {
  const m = selectedMode.value
  return m ? m.rows * m.cols : 0
})

const pieceSize = computed(() => {
  const m = selectedMode.value
  if (!m || !props.imageWidth || !props.imageHeight) return ''
  return `${Math.round(props.imageWidth / m.cols)}×${Math.round(props.imageHeight / m.rows)}`
})
</script>

<template>
  <div class="split-panel">
    <div class="split-panel-header">
      <span class="split-panel-title">宫格拆分</span>
      <button class="split-close-btn" @click="emit('cancel')" title="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="split-panel-body">
      <div class="split-mode-grid">
        <button
          v-for="mode in SPLIT_MODES"
          :key="mode.key"
          class="split-mode-btn"
          :class="{ active: selectedKey === mode.key }"
          @click="selectedKey = mode.key"
        >
          <div class="split-mode-icon" :style="{
            gridTemplateRows: `repeat(${mode.rows}, 1fr)`,
            gridTemplateColumns: `repeat(${mode.cols}, 1fr)`,
          }">
            <div v-for="i in mode.rows * mode.cols" :key="i" class="split-mode-cell" />
          </div>
          <span class="split-mode-label">{{ mode.label }}</span>
        </button>
      </div>

      <div v-if="selectedMode" class="split-info">
        <span class="split-info-row">拆分为 <strong>{{ totalPieces }}</strong> 张图片</span>
        <span v-if="pieceSize" class="split-info-row">每张约 <strong>{{ pieceSize }}</strong> px</span>
      </div>

      <div class="split-actions">
        <button class="split-cancel-btn" @click="emit('cancel')">取消</button>
        <button
          class="split-execute-btn"
          :disabled="!selectedMode || splitting"
          @click="selectedMode && emit('execute', selectedMode)"
        >
          {{ splitting ? '拆分中...' : '执行拆分' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.split-panel {
  width: 280px;
  background: #18181b;
  border-left: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}
.split-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.split-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #e4e4e7;
}
.split-close-btn {
  color: #71717a;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
.split-close-btn:hover { color: #d4d4d8; }

.split-panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.split-mode-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.split-mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 8px;
  border: 1px solid #27272a;
  background: #09090b;
  cursor: pointer;
  transition: all 0.15s;
}
.split-mode-btn:hover { border-color: #3f3f46; background: #18181b; }
.split-mode-btn.active {
  border-color: #10b981;
  background: rgba(16,185,129,0.08);
  box-shadow: 0 0 0 1px rgba(16,185,129,0.3);
}
.split-mode-icon {
  width: 32px;
  height: 32px;
  display: grid;
  gap: 2px;
}
.split-mode-cell {
  background: #3f3f46;
  border-radius: 2px;
}
.split-mode-btn.active .split-mode-cell {
  background: #10b981;
  opacity: 0.6;
}
.split-mode-label {
  font-size: 10px;
  color: #a1a1aa;
  font-weight: 500;
}
.split-mode-btn.active .split-mode-label { color: #10b981; }

.split-info {
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.split-info-row {
  font-size: 11px;
  color: #a1a1aa;
}
.split-info-row strong {
  color: #e4e4e7;
}

.split-actions {
  display: flex;
  gap: 8px;
}
.split-cancel-btn {
  flex: 1;
  padding: 8px;
  font-size: 12px;
  border-radius: 8px;
  border: 1px solid #27272a;
  background: #09090b;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s;
}
.split-cancel-btn:hover { background: #18181b; color: #e4e4e7; }

.split-execute-btn {
  flex: 2;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  background: #10b981;
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}
.split-execute-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.split-execute-btn:not(:disabled):hover { background: #059669; }
</style>

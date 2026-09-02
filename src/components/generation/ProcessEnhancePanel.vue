<template>
  <div class="enh-body" :class="{ disabled: !enabled }">
    <div class="enh-field">
      <label class="enh-label">放大模型</label>
      <select v-model="params.upscale_model" class="enh-select">
        <option v-for="(id, name) in upscaleModels" :key="id" :value="id">
          {{ id }} — {{ name }}
        </option>
      </select>
    </div>

    <div class="enh-estimate-row">
      <div class="enh-slider-field">
        <label class="enh-label">估计帧数 (estimate)</label>
        <div class="enh-slider-group">
          <el-slider v-model="params.estimate" :min="0" :max="100" :show-tooltip="false" />
          <input v-model.number="params.estimate" type="number" class="enh-slider-input" min="0" max="100" />
        </div>
      </div>
      <button class="enh-estimate-btn" :disabled="estimating" @click="$emit('estimate')">
        {{ estimating ? '分析中...' : '🔍 分析' }}
      </button>
    </div>

    <div v-if="estimateInfo" class="enh-estimate-result">
      {{ estimateInfo.video_info.width }}×{{ estimateInfo.video_info.height }}
      {{ estimateInfo.video_info.fps }}fps {{ estimateInfo.video_info.duration }}s
      <br />
      <span v-for="(val, key) in estimateInfo.params" :key="key" class="enh-param-tag">
        {{ ESTIMATE_LABELS[key] || key }}: {{ val }}%
      </span>
    </div>

    <div class="enh-slider-grid">
      <div v-for="field in ENHANCE_SLIDER_6" :key="field.key" class="enh-slider-item">
        <label class="enh-label">{{ field.label }}</label>
        <div class="enh-slider-group">
          <el-slider v-model="params[field.key]" :min="field.min" :max="field.max" :show-tooltip="false" />
          <input v-model.number="params[field.key]" type="number" class="enh-slider-input" :min="field.min" :max="field.max" />
        </div>
      </div>
      <div class="enh-slider-item">
        <label class="enh-label">恢复原始细节</label>
        <div class="enh-slider-group">
          <el-slider v-model="params.blend" :min="0" :max="100" :show-tooltip="false" />
          <input v-model.number="params.blend" type="number" class="enh-slider-input" min="0" max="100" />
        </div>
      </div>
      <label class="enh-checkbox-cell">
        <input v-model="params.lock_aspect_ratio" type="checkbox" />
        锁定宽高比
      </label>
    </div>

    <div class="enh-field" style="margin-top:8px">
      <label class="enh-label">输出分辨率</label>
      <select v-model="params.output_resolution" class="enh-select">
        <option v-for="opt in OUTPUT_RESOLUTION_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div v-if="params.output_resolution === 'custom'" class="enh-grid2" style="margin-top:8px">
      <div class="enh-field">
        <label class="enh-label">自定义宽</label>
        <input v-model.number="params.custom_width" type="number" class="enh-input" min="1" max="7680" />
      </div>
      <div class="enh-field">
        <label class="enh-label">自定义高</label>
        <input v-model.number="params.custom_height" type="number" class="enh-input" min="1" max="4320" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { OUTPUT_RESOLUTION_OPTIONS } from '@/services/generation/topazProcess.constants'
import type { TopazProcessParams, EstimateResponse } from '@/services/generation/topazProcess.types'

defineProps<{
  params: TopazProcessParams
  enabled: boolean
  upscaleModels: Record<string, string>
  estimating: boolean
  estimateInfo: EstimateResponse | null
}>()

defineEmits<{
  estimate: []
}>()

const ENHANCE_SLIDER_6 = [
  { key: 'compression' as const, label: '修复压缩', min: 0, max: 100 },
  { key: 'details' as const, label: '恢复细节', min: 0, max: 100 },
  { key: 'blur' as const, label: '锐化', min: 0, max: 100 },
  { key: 'noise' as const, label: '降噪', min: 0, max: 100 },
  { key: 'halo' as const, label: '去除晕影', min: 0, max: 100 },
  { key: 'preblur' as const, label: '抗锯齿/去模糊', min: -100, max: 100 },
]

const ESTIMATE_LABELS: Record<string, string> = {
  compression: '压缩修复',
  details: '细节',
  blur: '锐化',
  noise: '降噪',
  halo: '晕影',
  preblur: '抗锯齿',
  blend: '细节还原',
}
</script>

<style scoped>
.enh-body { display: flex; flex-direction: column; gap: 4px; }
.enh-body.disabled { opacity: 0.4; pointer-events: none; }
.enh-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.enh-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.enh-label { font-size: 11px; color: var(--text-secondary, #a0a0a0); font-weight: 500; }
.enh-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 6px;
  background: var(--bg-elevated, #1e1e1e);
  color: var(--text-primary, #e5e5e5);
  font-size: 12px;
  outline: none;
  font-family: inherit;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.enh-input {
  padding: 5px 8px;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 6px;
  background: var(--bg-elevated, #1e1e1e);
  color: var(--text-primary, #e5e5e5);
  font-size: 12px;
  outline: none;
  font-family: inherit;
  max-width: 100%;
  min-width: 0;
}
.enh-select:focus, .enh-input:focus { border-color: var(--accent, #34d399); }
.enh-estimate-row { display: flex; align-items: flex-end; gap: 8px; margin-top: 8px; }
.enh-slider-field { flex: 1; }
.enh-slider-group { display: flex; align-items: center; gap: 8px; }
.enh-slider-input {
  width: 42px;
  padding: 2px 4px;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 4px;
  background: var(--bg-elevated, #1e1e1e);
  color: var(--text-primary, #e5e5e5);
  font-size: 12px;
  text-align: center;
  outline: none;
  font-family: inherit;
  -moz-appearance: textfield;
  flex-shrink: 0;
}
.enh-slider-input:focus { border-color: var(--accent, #34d399); }
.enh-slider-input::-webkit-inner-spin-button,
.enh-slider-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.enh-estimate-btn {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2a2a2a);
  background: var(--bg-elevated, #1e1e1e);
  color: var(--accent, #34d399);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: border-color 0.15s;
}
.enh-estimate-btn:hover:not(:disabled) { border-color: var(--accent, #34d399); }
.enh-estimate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.enh-estimate-result {
  font-size: 11px;
  color: var(--text-secondary, #a0a0a0);
  background: var(--accent-dim, rgba(52, 211, 153, 0.1));
  border: 1px solid rgba(52, 211, 153, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 8px;
  line-height: 1.6;
}
.enh-param-tag { margin-right: 8px; }
.enh-slider-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}
.enh-slider-item { display: flex; flex-direction: column; gap: 4px; }
.enh-checkbox-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
}
.enh-slider-group :deep(.el-slider) {
  flex: 1;
  min-width: 0;
  height: 20px;
  display: flex;
  align-items: center;
}
.enh-slider-group :deep(.el-slider__runway) {
  margin: 0;
  height: 6px;
  background-color: var(--border-light, #333);
}
.enh-slider-group :deep(.el-slider__bar) {
  background-color: #808080;
}
.enh-slider-group :deep(.el-slider__button) {
  width: 10px;
  height: 10px;
  border: none;
  background-color: #808080;
  -webkit-font-smoothing: antialiased;
}
.enh-slider-group :deep(.el-slider__button:hover) {
  background-color: #909090;
}
.enh-slider-group :deep(.el-slider__button-wrapper) {
  width: 20px;
  height: 20px;
  top: -7px;
}
</style>

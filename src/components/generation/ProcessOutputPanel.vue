<template>
  <div class="out-body">
    <div class="out-grid2">
      <div class="out-field">
        <label class="out-label">输出格式</label>
        <select v-model="params.output_format" class="out-select">
          <option v-for="opt in OUTPUT_FORMAT_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="out-field">
        <label class="out-label">视频编码器</label>
        <select v-model="params.video_encoder" class="out-select">
          <option v-for="(val, label) in encoders" :key="val" :value="val">
            {{ label }}
          </option>
        </select>
      </div>
      <div class="out-field">
        <label class="out-label">视频码率 (M)</label>
        <input v-model.number="params.video_bitrate" type="number" class="out-input" min="0" />
        <small v-if="params.video_bitrate === 0" class="out-hint">自动 (CQP)</small>
      </div>
      <div class="out-field">
        <label class="out-label">音频编码</label>
        <select v-model="params.audio_codec" class="out-select">
          <option v-for="opt in AUDIO_CODEC_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="out-field">
        <label class="out-label">音频码率 (k)</label>
        <input v-model.number="params.audio_bitrate" type="number" class="out-input" min="32" />
      </div>
      <div class="out-field">
        <label class="out-label">Topaz 路径覆盖</label>
        <input v-model="params.topaz_path" type="text" class="out-input" placeholder="留空=自动检测" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AUDIO_CODEC_OPTIONS, OUTPUT_FORMAT_OPTIONS } from '@/services/generation/topazProcess.constants'
import type { TopazProcessParams } from '@/services/generation/topazProcess.types'

defineProps<{
  params: TopazProcessParams
  encoders: Record<string, string>
}>()
</script>

<style scoped>
.out-body { display: flex; flex-direction: column; gap: 4px; }
.out-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.out-field { display: flex; flex-direction: column; gap: 4px; }
.out-label { font-size: 11px; color: var(--text-secondary, #a0a0a0); font-weight: 500; }
.out-select, .out-input {
  padding: 5px 8px;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 6px;
  background: var(--bg-elevated, #1e1e1e);
  color: var(--text-primary, #e5e5e5);
  font-size: 12px;
  outline: none;
  font-family: inherit;
}
.out-select:focus, .out-input:focus { border-color: var(--accent, #34d399); }
.out-input::placeholder { color: var(--text-muted, #666); }
.out-hint { font-size: 10px; color: var(--text-muted, #666); }
</style>

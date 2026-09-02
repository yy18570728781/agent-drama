<template>
  <div class="interp-body" :class="{ disabled: !enabled }">
    <div class="interp-grid2">
      <div class="interp-field">
        <label class="interp-label">插帧模型</label>
        <select v-model="params.fi_model" class="interp-select">
          <option v-for="(id, name) in interpModels" :key="id" :value="id">
            {{ id }} — {{ name }}
          </option>
        </select>
      </div>
      <div class="interp-field">
        <label class="interp-label">目标帧率</label>
        <select v-model.number="params.fps" class="interp-select">
          <option v-for="fps in fpsPresets" :key="fps" :value="fps">{{ fps }} fps</option>
        </select>
      </div>
      <div class="interp-field">
        <label class="interp-label">慢动作倍数</label>
        <input v-model.number="params.slowmo" type="number" class="interp-input" min="1" step="0.5" />
      </div>
      <div class="interp-field">
        <label class="interp-label">RDT</label>
        <input v-model.number="params.rdt" type="number" class="interp-input" min="0" step="0.01" />
      </div>
    </div>
    <div class="interp-grid2" style="margin-top:8px">
      <label class="interp-checkbox-row">
        <input v-model="params.duplicate" type="checkbox" />
        重复帧检测
      </label>
      <div class="interp-field">
        <label class="interp-label">重复帧阈值</label>
        <input v-model.number="params.duplicate_threshold" type="number" class="interp-input" min="0" max="100" />
      </div>
      <label class="interp-checkbox-row">
        <input v-model="params.scene_split" type="checkbox" />
        场景分割
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TopazProcessParams } from '@/services/generation/topazProcess.types'

defineProps<{
  params: TopazProcessParams
  enabled: boolean
  interpModels: Record<string, string>
  fpsPresets: number[]
}>()
</script>

<style scoped>
.interp-body { display: flex; flex-direction: column; gap: 4px; }
.interp-body.disabled { opacity: 0.4; pointer-events: none; }
.interp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.interp-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.interp-label { font-size: 11px; color: var(--text-secondary, #a0a0a0); font-weight: 500; }
.interp-select {
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
.interp-input {
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
.interp-select:focus, .interp-input:focus { border-color: var(--accent, #34d399); }
.interp-checkbox-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
}
</style>

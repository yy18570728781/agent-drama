<script setup lang="ts">
import { usePBRStore } from '@/stores/pbr.store'
import MapSlider from '../shared/MapSlider.vue'
import FrequencyEQ from '../shared/FrequencyEQ.vue'
import ParamGroup from '../shared/ParamGroup.vue'

const store = usePBRStore()
const p = store.params.normal

const PRESETS = [
  { name: '默认', values: [0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80] },
  { name: '平滑', values: [0.10, 0.15, 0.25, 0.60, 0.90, 1.00, 1.00] },
  { name: '清晰', values: [1.00, 0.90, 0.60, 0.40, 0.25, 0.15, 0.10] },
  { name: '中频', values: [0.15, 0.50, 0.85, 1.00, 0.85, 0.50, 0.15] },
]

function resetValues() {
  p.preContrast = 20
  p.weights = [0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80]
  p.angularity = 0
  p.angularIntensity = 0.5
  p.finalContrast = 5
  p.invertY = false
  p.invert = false
  p.shapeRecognition = 0
  p.lightRotation = 0
  p.shapeBias = 0.5
  p.slopeBlur = 50
}
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-zinc-800/50 pb-2 flex items-center justify-between">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">Normal Map (from Height)</span>
      <button @click="resetValues" class="text-[9px] font-bold text-zinc-500 hover:text-indigo-400 border border-zinc-700 rounded px-1.5 py-0.5 cursor-pointer transition-colors">重置全部</button>
    </div>
    <MapSlider v-model="p.preContrast" :defaultValue="20" :min="0" :max="50" step="1" label="预对比度" />

    <ParamGroup title="形状识别" :defaultOpen="false">
      <div class="text-[9px] text-zinc-500 mb-2">Extract lighting shape info from Base Color and blend into Normal</div>
      <MapSlider v-model="p.shapeRecognition" :defaultValue="0" :min="0" :max="1" step="0.01" label="形状识别" />
      <MapSlider v-model="p.lightRotation" :defaultValue="0" :min="-3.14" :max="3.14" step="0.01" label="光照方向" />
      <MapSlider v-model="p.shapeBias" :defaultValue="0.5" :min="0" :max="1" step="0.01" label="形状偏移" />
      <MapSlider v-model="p.slopeBlur" :defaultValue="50" :min="5" :max="100" step="1" label="坡度模糊" />
    </ParamGroup>

    <FrequencyEQ v-model:weights="p.weights" :defaults="[0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80]" :presets="PRESETS" />
    <MapSlider v-model="p.angularity" :defaultValue="0" :min="0" :max="2" step="0.01" label="棱角度" />
    <MapSlider v-model="p.angularIntensity" :defaultValue="0.5" :min="0" :max="2" step="0.01" label="棱角强度" />
    <MapSlider v-model="p.finalContrast" :defaultValue="5" :min="0" :max="15" step="0.1" label="最终对比度" />
    <div class="pt-2 space-y-2">
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="p.invertY" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转绿通道 (DirectX/OpenGL)</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="p.invert" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转法线</span>
      </label>
    </div>
  </div>
</template>

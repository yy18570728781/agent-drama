<script setup lang="ts">
import { usePBRStore } from '@/stores/pbr.store'
import MapSlider from '../shared/MapSlider.vue'
import ColorSamplePanel from '../shared/ColorSamplePanel.vue'

const store = usePBRStore()
const p = store.params.roughness
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-zinc-800/50 pb-2">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">Roughness Map</span>
    </div>
    <MapSlider v-model="p.metalSmoothness" :defaultValue="0.7" :min="0" :max="1" step="0.01" label="金属光滑度" />
    <MapSlider v-model="p.baseSmoothness" :defaultValue="0.1" :min="0" :max="1" step="0.01" label="基础光滑度" />

    <div class="border-b border-zinc-800 pb-1 mt-4">
      <span class="text-[10px] text-zinc-500 uppercase tracking-widest">颜色采样</span>
    </div>
    <ColorSamplePanel channel="roughness" :index="0" :sample="p.samples[0]" />
    <ColorSamplePanel channel="roughness" :index="1" :sample="p.samples[1]" />
    <MapSlider v-model="p.sampleBlend" :defaultValue="0.5" :min="0" :max="1" step="0.01" label="采样混合" />

    <MapSlider v-model="p.highPassBlurSize" :defaultValue="30" :min="1" :max="100" step="1" label="高反差模糊" />
    <MapSlider v-model="p.highPassOverlay" :defaultValue="3.0" :min="0" :max="10" step="0.1" label="高反差叠加" />
    <MapSlider v-model="p.finalContrast" :defaultValue="1.0" :min="0" :max="5" step="0.1" label="最终对比度" />
    <MapSlider v-model="p.finalBias" :defaultValue="0" :min="-1" :max="1" step="0.01" label="偏移" />
    <div class="pt-2">
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="p.invert" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转 (光泽/粗糙切换)</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePBRStore } from '@/stores/pbr.store'
import MapSlider from '../shared/MapSlider.vue'
import FrequencyEQ from '../shared/FrequencyEQ.vue'

const store = usePBRStore()
const p = store.params.edge

const PRESETS: { name: string; values: number[]; extra: Record<string, number> }[] = [
  { name: '默认', values: [1.00, 0.50, 0.30, 0.50, 0.70, 0.70, 0.30], extra: { preContrast: 1.0, edgeAmount: 1.0, creviceAmount: 1.0, pinch: 1.0, pillow: 1.0, finalContrast: 2.0, finalBias: 0 } },
  { name: '位移', values: [0.10, 0.15, 0.25, 0.45, 0.75, 0.95, 1.00], extra: { preContrast: 3.0, finalContrast: 5.0, finalBias: -0.2 } },
  { name: '柔和', values: [0.15, 0.40, 0.70, 0.90, 1.00, 0.90, 0.70], extra: { finalContrast: 4.0 } },
  { name: '紧凑', values: [1.00, 0.45, 0.25, 0.18, 0.15, 0.13, 0.10], extra: { pinch: 1.5 } },
]

function applyPreset(preset: typeof PRESETS[number]) {
  for (let i = 0; i < 7; i++) p.weights[i] = preset.values[i]
  p.preContrast = preset.extra.preContrast ?? p.preContrast
  p.edgeAmount = preset.extra.edgeAmount ?? p.edgeAmount
  p.creviceAmount = preset.extra.creviceAmount ?? p.creviceAmount
  p.pinch = preset.extra.pinch ?? p.pinch
  p.pillow = preset.extra.pillow ?? p.pillow
  p.finalContrast = preset.extra.finalContrast ?? p.finalContrast
  p.finalBias = preset.extra.finalBias ?? p.finalBias
}

function resetValues() {
  p.preContrast = 1.0
  p.weights = [1.00, 0.50, 0.30, 0.50, 0.70, 0.70, 0.30]
  p.edgeAmount = 1.0
  p.creviceAmount = 1.0
  p.pinch = 1.0
  p.pillow = 1.0
  p.finalContrast = 2.0
  p.finalBias = 0
  p.invertY = false
  p.invert = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-zinc-800/50 pb-2 flex items-center justify-between">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">Edge Map (from Normal)</span>
      <button @click="resetValues" class="text-[9px] font-bold text-zinc-500 hover:text-indigo-400 border border-zinc-700 rounded px-1.5 py-0.5 cursor-pointer transition-colors">重置全部</button>
    </div>
    <MapSlider v-model="p.preContrast" :defaultValue="1.0" :min="0" :max="5" step="0.1" label="预对比度" />
    <FrequencyEQ v-model:weights="p.weights" :defaults="[1.00, 0.50, 0.30, 0.50, 0.70, 0.70, 0.30]" :presets="PRESETS.map(p => ({ name: p.name, values: p.values }))" />
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] text-zinc-500 font-bold">联动预设:</span>
      <button v-for="pr in PRESETS" :key="pr.name"
        @click="applyPreset(pr)"
        class="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 cursor-pointer">
        {{ pr.name }}
      </button>
    </div>
    <MapSlider v-model="p.edgeAmount" :defaultValue="1.0" :min="0" :max="5" step="0.1" label="边缘量" />
    <MapSlider v-model="p.creviceAmount" :defaultValue="1.0" :min="0" :max="5" step="0.1" label="裂缝量" />
    <MapSlider v-model="p.pinch" :defaultValue="1.0" :min="0.1" :max="10" step="0.1" label="捏合" />
    <MapSlider v-model="p.pillow" :defaultValue="1.0" :min="0.1" :max="5" step="0.1" label="枕化" />
    <MapSlider v-model="p.finalContrast" :defaultValue="2.0" :min="0" :max="10" step="0.1" label="最终对比度" />
    <MapSlider v-model="p.finalBias" :defaultValue="0" :min="-1" :max="1" step="0.01" label="偏移" />
    <div class="pt-2 space-y-2">
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="p.invertY" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转法线 Y</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="p.invert" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转边缘</span>
      </label>
    </div>
  </div>
</template>

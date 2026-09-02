<script setup lang="ts">
import { usePBRStore } from '@/stores/pbr.store'
import MapSlider from '../shared/MapSlider.vue'
import FrequencyEQ from '../shared/FrequencyEQ.vue'
import ColorSamplePanel from '../shared/ColorSamplePanel.vue'

const store = usePBRStore()
const p = store.params.displacement as any

const WEIGHT_PRESETS = [
  { name: '默认', values: [0.15, 0.19, 0.30, 0.50, 0.70, 0.90, 1.00] },
  { name: '细节', values: [0.70, 0.40, 0.30, 0.50, 0.80, 0.90, 0.70] },
  { name: '位移', values: [0.02, 0.03, 0.10, 0.35, 0.70, 0.90, 1.00] },
]

const CONTRAST_PRESETS = [
  { name: '默认', values: [1, 1, 1, 1, 1, 1, 1] },
  { name: '裂缝', values: [1, 1, 1, 1, -0.2, -2.0, -4.0] },
  { name: '奇特', values: [-3.0, -1.2, 0.3, 1.3, 2.0, 2.5, 2.0] },
]

function resetValues() {
  p.reveal = 0.5
  p.sourceMode = 'diffuse'
  p.weights = [0.15, 0.19, 0.30, 0.50, 0.70, 0.90, 1.00]
  p.contrasts = [1, 1, 1, 1, 1, 1, 1]
  p.finalGain = 0
  p.finalContrast = 1.5
  p.finalBias = 0
  p.invert = false
  p.spread = 50
  p.spreadBoost = 1.0
}
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-zinc-800/50 pb-2 flex items-center justify-between">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">Height Map</span>
      <button @click="resetValues" class="text-[9px] font-bold text-zinc-500 hover:text-indigo-400 border border-zinc-700 rounded px-1.5 py-0.5 cursor-pointer transition-colors">重置全部</button>
    </div>
    <div class="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-center justify-between text-xs">
      <span class="text-zinc-300 font-semibold flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full" :class="store.displacementEnabled ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-600'"></span>
        3D 位移渲染
      </span>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="store.displacementEnabled" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span class="text-[10px] font-mono font-bold" :class="store.displacementEnabled ? 'text-indigo-400' : 'text-zinc-500'">{{ store.displacementEnabled ? '开启' : '关闭' }}</span>
      </label>
    </div>
    <div v-show="store.displacementEnabled" class="space-y-1.5 p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
      <div class="flex items-center justify-between text-xs mb-1">
        <label class="text-zinc-400">位移大小</label>
        <span class="text-indigo-400 font-mono text-xs font-bold">{{ (store.displacementScale * 100).toFixed(1) }}%</span>
      </div>
      <input type="range" min="0" max="0.2" step="0.005" v-model.number="store.displacementScale" class="w-full accent-indigo-500 cursor-pointer bg-zinc-800 h-1 rounded" />
    </div>

    <div class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl flex items-center justify-between text-xs">
      <label class="text-zinc-400">高度来源</label>
      <select v-model="p.sourceMode" class="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 outline-none text-zinc-300 text-[11px]">
        <option value="diffuse">From Base Color</option>
        <option value="normal">From Normal</option>
      </select>
    </div>
    <MapSlider v-model="p.reveal" :defaultValue="0.5" :min="0" :max="1" step="0.01" label="高度显示" />

    <template v-if="p.sourceMode === 'diffuse'">
      <div class="border-b border-zinc-800 pb-1 mt-4">
        <span class="text-[10px] text-zinc-500 uppercase tracking-widest">颜色采样</span>
      </div>
      <ColorSamplePanel channel="displacement" :index="0" :sample="p.samples[0]" :showTarget="true" />
      <ColorSamplePanel channel="displacement" :index="1" :sample="p.samples[1]" :showTarget="true" />
      <MapSlider v-model="p.sampleBlend" :defaultValue="0.5" :min="0" :max="1" step="0.01" label="采样混合" />
      <FrequencyEQ v-model:weights="p.weights" :defaults="[0.15, 0.19, 0.30, 0.50, 0.70, 0.90, 1.00]" :presets="WEIGHT_PRESETS" :min="0" :max="1" :step="0.01" />
      <FrequencyEQ v-model:weights="p.contrasts" :defaults="[1, 1, 1, 1, 1, 1, 1]" :presets="CONTRAST_PRESETS" :min="-5" :max="5" :step="0.1" :showZeroLine="true">
        <template #title>频率对比度均衡器</template>
      </FrequencyEQ>
    </template>

    <template v-if="p.sourceMode === 'normal'">
      <div class="border-b border-zinc-800 pb-1 mt-4">
        <span class="text-[10px] text-zinc-500 uppercase tracking-widest">法线→高度参数</span>
      </div>
      <MapSlider v-model="p.spread" :defaultValue="50" :min="10" :max="200" step="1" label="扩散" />
      <MapSlider v-model="p.spreadBoost" :defaultValue="1" :min="1" :max="5" step="0.1" label="扩散增强" />
    </template>

    <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 mt-4">数值调整</div>
    <MapSlider v-model="p.finalGain" :defaultValue="0" :min="-2" :max="2" step="0.1" label="增益" />
    <MapSlider v-model="p.finalContrast" :defaultValue="1.5" :min="0" :max="5" step="0.1" label="最终对比度" />
    <MapSlider v-model="p.finalBias" :defaultValue="0" :min="-1" :max="1" step="0.01" label="偏移" />
    <div class="pt-2">
      <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
        <input type="checkbox" v-model="p.invert" class="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
        <span>反转凹凸</span>
      </label>
    </div>
  </div>
</template>
